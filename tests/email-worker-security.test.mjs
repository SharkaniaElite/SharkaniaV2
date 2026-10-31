import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const worker = readFileSync("workers/email-worker.mjs", "utf8");
const admin = readFileSync("src/pages/super-admin.tsx", "utf8");

test("email Worker processes queue via cron and denies public HTTP triggers", () => {
  assert.match(worker, /async scheduled\(event, env, ctx\)/);
  assert.match(worker, /ctx\.waitUntil\(processQueue\(env\)\)/);
  assert.match(worker, /async fetch\(\)/);
  assert.match(worker, /status: 404/);
  assert.doesNotMatch(worker, /ADMIN_TRIGGER_SECRET|X-Admin-Secret|Access-Control-Allow-Origin/);
  assert.match(worker, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(worker, /RESEND_API_KEY/);
  assert.match(worker, /await sendWithResend\(item, env\)/);
  assert.match(worker, /await updateStatus\(item\.id, 'sent', env\)/);
});

test("browser enqueues Ignition/newsletter messages but cannot trigger Worker with a shared secret", () => {
  assert.match(admin, /rpc\("queue_ignition_emails"/);
  assert.match(admin, /rpc\("queue_newsletter_emails"/);
  assert.doesNotMatch(admin, /X-Admin-Secret|ADMIN_TRIGGER_SECRET|sharkania-email-worker\.duhauandres\.workers\.dev/);
  assert.match(admin, /cada 10 minutos/);
});

test("email Worker remains valid JavaScript", async () => {
  const { transform } = await import("esbuild");
  const transpiled = await transform(worker, { loader: "js", target: "es2022" });
  assert.ok(transpiled.code.includes("processQueue"));
});
