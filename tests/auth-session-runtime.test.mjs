import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

// Execute the actual TypeScript store with isolated Supabase, PostHog and
// scheduler substitutes. No real credentials or requests to production.
const source = readFileSync(new URL("../src/stores/auth-store.ts", import.meta.url), "utf8");
const output = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
    esModuleInterop: true,
  },
}).outputText;

function harness() {
  let clock = 0;
  let nextTimerId = 1;
  const timers = new Map();
  const subscriptions = new Set();
  const outstanding = [];
  const traces = { reads: [], unsubscribes: 0, identify: [], resets: 0 };
  let store;

  const create = (factory) => {
    let state;
    const get = () => state;
    const set = (update) => {
      state = { ...state, ...(typeof update === "function" ? update(state) : update) };
    };
    state = factory(set, get);
    store = { getState: get };
    return store;
  };
  const supabase = {
    from(table) {
      assert.equal(table, "profiles");
      return {
        select(columns) {
          assert.equal(columns, "*");
          return {
            eq(field, userId) {
              assert.equal(field, "id");
              return {
                single() {
                  traces.reads.push(userId);
                  return new Promise((resolve) => outstanding.push({ userId, resolve }));
                },
              };
            },
          };
        },
      };
    },
    auth: {
      onAuthStateChange(cb) {
        subscriptions.add(cb);
        return {
          data: {
            subscription: {
              unsubscribe() {
                traces.unsubscribes++;
                subscriptions.delete(cb);
              },
            },
          },
        };
      },
      async signOut() { return { error: null }; },
    },
  };
  const posthog = {
    reset() { traces.resets++; },
    identify(...args) { traces.identify.push(args); },
    setPersonProperties() {},
  };
  const exports = {};
  const sandbox = {
    exports,
    setTimeout(cb, delay) {
      const id = nextTimerId++;
      timers.set(id, { at: clock + delay, cb });
      return id;
    },
    clearTimeout(id) { timers.delete(id); },
    console,
    require(name) {
      if (name === "zustand") return { create };
      if (name === "../lib/supabase") return { supabase };
      if (name === "posthog-js") return { __esModule: true, default: posthog };
      throw new Error("Unexpected import " + name);
    },
  };
  vm.runInNewContext(output, sandbox, { filename: "auth-store.js" });
  assert.equal(exports.useAuthStore, store);

  function advance(ms = 0) {
    const end = clock + ms;
    for (let n = 0; n < 100; n++) {
      const pair = [...timers]
        .filter(([, timer]) => timer.at <= end)
        .sort((a, b) => a[1].at - b[1].at)[0];
      if (!pair) break;
      timers.delete(pair[0]);
      clock = pair[1].at;
      pair[1].cb();
      if (n === 99) throw new Error("Timer recursion");
    }
    clock = end;
  }
  function emit(event, id = null) {
    for (const cb of [...subscriptions]) {
      cb(event, id ? { user: { id, email: id + "@example.test" } } : null);
    }
  }
  function respond(id, role = "player") {
    const i = outstanding.findIndex((request) => request.userId === id);
    assert.ok(i >= 0, "Missing profile request for " + id);
    outstanding.splice(i, 1)[0].resolve({ data: { id, role }, error: null });
  }
  async function settle() {
    await new Promise((resolve) => setImmediate(resolve));
  }
  return {
    store, traces, advance, emit, respond, settle,
    get activeListeners() { return subscriptions.size; },
  };
}

test("initial session resolves profile; token refresh avoids redundant request", async () => {
  const h = harness();
  const cleanup = h.store.getState().initialize();
  assert.equal(h.activeListeners, 1);
  h.emit("INITIAL_SESSION", "alice");
  assert.equal(h.store.getState().isLoading, true);
  h.advance();
  h.respond("alice");
  await h.settle();
  assert.equal(h.store.getState().profile?.id, "alice");
  assert.equal(h.store.getState().isAuthenticated, true);
  assert.equal(h.store.getState().isLoading, false);
  h.emit("TOKEN_REFRESHED", "alice");
  h.advance();
  assert.deepEqual(h.traces.reads, ["alice"]);
  cleanup();
});

test("late profile response cannot revive a signed-out session", async () => {
  const h = harness();
  const cleanup = h.store.getState().initialize();
  h.emit("SIGNED_IN", "alice");
  h.advance();
  h.emit("SIGNED_OUT");
  h.respond("alice");
  await h.settle();
  assert.equal(h.store.getState().user, null);
  assert.equal(h.store.getState().profile, null);
  assert.equal(h.store.getState().isAuthenticated, false);
  cleanup();
});

test("response for account A cannot overwrite newer account B", async () => {
  const h = harness();
  const cleanup = h.store.getState().initialize();
  h.emit("SIGNED_IN", "alice");
  h.advance();
  h.emit("SIGNED_IN", "bob");
  h.advance();
  h.respond("alice", "super_admin");
  await h.settle();
  assert.equal(h.store.getState().profile, null);
  h.respond("bob");
  await h.settle();
  assert.equal(h.store.getState().profile?.id, "bob");
  assert.equal(h.store.getState().isLoading, false);
  cleanup();
});

test("StrictMode cleanup unhooks listener and allows resubscription", async () => {
  const h = harness();
  h.store.getState().initialize()();
  assert.equal(h.activeListeners, 0);
  assert.equal(h.store.getState().initialized, false);
  const cleanup = h.store.getState().initialize();
  assert.equal(h.activeListeners, 1);
  assert.equal(h.traces.unsubscribes, 1);
  h.emit("INITIAL_SESSION", "carol");
  h.advance();
  h.respond("carol");
  await h.settle();
  assert.equal(h.store.getState().user?.id, "carol");
  cleanup();
  assert.equal(h.activeListeners, 0);
});

test("auth timeout and profile timeout both release loading state", async () => {
  const h = harness();
  const cleanup = h.store.getState().initialize();
  h.advance(5000);
  assert.equal(h.store.getState().isLoading, false);
  h.emit("SIGNED_IN", "alice");
  h.advance();
  assert.equal(h.store.getState().isLoading, true);
  h.advance(5000);
  assert.equal(h.store.getState().isLoading, false);
  h.respond("alice");
  await h.settle();
  assert.equal(h.store.getState().profile?.id, "alice");
  cleanup();
});
