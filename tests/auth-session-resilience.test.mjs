import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const auth = readFileSync(new URL("../src/stores/auth-store.ts", import.meta.url), "utf8");
const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
const sf = ts.createSourceFile("auth-store.ts", auth, ts.ScriptTarget.Latest, true);

test("Auth listener is synchronous to avoid Supabase auth-lock deadlock", () => {
  const callbacks = [];
  function visit(node) {
    if (ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === "onAuthStateChange") {
      callbacks.push(node.arguments[0]);
    }
    ts.forEachChild(node, visit);
  }
  visit(sf);
  assert.equal(callbacks.length, 1);
  const cb = callbacks[0];
  assert.ok(ts.isArrowFunction(cb));
  assert.equal(cb.modifiers?.some(m => m.kind === ts.SyntaxKind.AsyncKeyword) ?? false, false);
  const body = cb.getText(sf);
  assert.match(body, /setTimeout\(\(\) => \{/);
  assert.match(body, /void fetchProfile\(userId\)/);
  assert.ok(body.indexOf("setTimeout(() => {") < body.indexOf("fetchProfile(userId)"));
  const codeBeforeDeferral = body.slice(0, body.indexOf("setTimeout(() => {"))
    .replace(/\/\/[^\n]*\n/g, "\n");
  assert.doesNotMatch(codeBeforeDeferral, /await\s+|fetchProfile\(/);
});

test("Initialization uses one Auth source and closes remount subscriptions", () => {
  assert.doesNotMatch(auth, /supabase\.auth\.getSession\(/);
  assert.match(auth, /event !== "INITIAL_SESSION"/);
  assert.match(auth, /subscription\.unsubscribe\(\)/);
  assert.match(auth, /set\(\{ initialized: false \}\)/);
  assert.match(app, /return initialize\(\);\s*\}, \[initialize\]\)/);
  assert.doesNotMatch(app, /\[initialize, initialized\]/);
});

test("Delayed profile read cannot restore state after logout, account change or cleanup", () => {
  assert.match(auth, /authSequence\+\+/);
  assert.match(auth, /authSequence !== sequenceAtSchedule/);
  assert.match(auth, /get\(\)\.user\?\.id !== userId/);
  assert.match(auth, /!get\(\)\.isAuthenticated/);
  assert.match(auth, /active = false/);
  assert.match(auth, /if \(active && get\(\)\.isLoading\)/);
});

test("No secrets, production API writes or broad authentication bypasses introduced", () => {
  assert.doesNotMatch(auth, /service_role|createClient\(|localStorage\.clear|signInAnonymously/);
  assert.match(app, /isArenaPreviewAuthBlocked\(\)/);
});
