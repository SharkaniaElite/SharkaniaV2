import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("workers/email-worker.mjs", "utf8");
const moduleUrl = "data:text/javascript;base64," + Buffer.from(source).toString("base64");
const worker = (await import(moduleUrl)).default;

async function executeQueue(messages, { rejectOnce = false } = {}) {
  const originalFetch = globalThis.fetch;
  const originalError = console.error;
  const resendTimes = [];
  const patchStatuses = [];
  const attempts = new Map();
  let scheduled;
  globalThis.fetch = async (url, config) => {
    if (String(url).includes("/rest/v1/email_queue?")) {
      return new Response(JSON.stringify(messages), { status: 200 });
    }
    if (String(url).includes("api.resend.com")) {
      const to = JSON.parse(config.body).to;
      const attempt = attempts.get(to) ?? 0;
      attempts.set(to, attempt + 1);
      resendTimes.push(Date.now());
      if (rejectOnce && attempt === 0) return new Response("rate limit", { status: 429 });
      return new Response(JSON.stringify({ id: "test" }), { status: 200 });
    }
    if (String(url).includes("/rest/v1/email_queue?id=")) {
      patchStatuses.push(JSON.parse(config.body).status);
      return new Response(null, { status: 204 });
    }
    throw new Error("Unexpected URL " + url);
  };
  console.error = () => {};
  try {
    await worker.scheduled({}, { SUPABASE_URL: "https://test.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "fake", RESEND_API_KEY: "fake" }, {
      waitUntil(promise) { scheduled = promise; },
    });
    await scheduled;
  } finally {
    globalThis.fetch = originalFetch;
    console.error = originalError;
  }
  return { resendTimes, patchStatuses, attempts };
}

test("cron sends controlled groups instead of 50 simultaneous Resend requests", async () => {
  const messages = Array.from({ length: 11 }, (_, i) => ({
    id: String(i), recipient_email: "test-" + i + "@example.test",
    subject: "Prueba", body_html: "<p>Prueba</p>",
  }));
  const { resendTimes, patchStatuses } = await executeQueue(messages);
  assert.equal(resendTimes.length, 11);
  assert.deepEqual(patchStatuses, Array(11).fill("sent"));
  assert.ok(resendTimes[5] - resendTimes[0] >= 1000);
  assert.ok(resendTimes[10] - resendTimes[5] >= 1000);
});

test("429 responses are retried instead of marking confirmation emails failed", async () => {
  const messages = [{ id: "1", recipient_email: "test@example.test", subject: "Prueba", body_html: "<p>Prueba</p>" }];
  const { attempts, patchStatuses } = await executeQueue(messages, { rejectOnce: true });
  assert.equal(attempts.get("test@example.test"), 2);
  assert.deepEqual(patchStatuses, ["sent"]);
});

test("safe cron-only endpoint and provider credentials stay server-side", () => {
  const admin = readFileSync("src/pages/super-admin.tsx", "utf8");
  assert.match(source, /async fetch\(\)/);
  assert.match(source, /status: 404/);
  assert.match(source, /async scheduled\(event, env, ctx\)/);
  assert.match(source, /await sleep\(1100\)/);
  assert.match(source, /response\.status === 429/);
  assert.doesNotMatch(admin, /X-Admin-Secret|ADMIN_TRIGGER_SECRET|RESEND_API_KEY/);
  assert.doesNotMatch(source, /X-Admin-Secret|ADMIN_TRIGGER_SECRET|Access-Control-Allow-Origin/);
});
