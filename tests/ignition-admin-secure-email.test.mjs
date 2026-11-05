import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
const read = name => readFileSync(new URL("../" + name, import.meta.url), "utf8");
const tab = read("src/components/admin/ignition-claims-tab.tsx");
const migration = read("supabase/migrations/20261105165000_secure_ignition_admin_email_campaigns.sql");
const worker = read("workers/email-worker.mjs");
const admin = read("src/pages/super-admin.tsx");

test("Ignition player panel can enqueue only via the protected server RPC", () => {
  assert.match(tab, /rpc\("queue_ignition_selected_campaign"/);
  assert.match(tab, /rpc\("ignition_campaign_recipients"/);
  assert.match(tab, /rpc\("retry_ignition_failed_campaign"/);
  assert.doesNotMatch(tab, /\.from\(["']email_queue["']\)\.insert/);
  assert.doesNotMatch(tab, /ignition_password_sent:\s*(true|false)/);
  assert.doesNotMatch(tab, /Reset Semanal/);
  assert.match(tab, /setSelectedIds\(new Set\(\)\)/);
  assert.match(tab, /window\.confirm/);
  assert.match(tab, /COMPLETAR/);
});
test("Each November campaign has an independent state and editable copy", () => {
  for (const day of ["05","12","19","26"]) assert.match(tab, new RegExp("ignition-2026-11-" + day));
  assert.match(tab, /ignition-2026-11-welcome/);
  assert.match(tab, /setCampaignKey\(key\)/);
  assert.match(tab, /setContent\(key==="ignition-2026-11-welcome"&&autoReady\?autoSavedBody:defaultMessage\(key\)\)/);
  assert.match(tab, /onlyFailed\?retrySelected:queueSelected/);
  assert.match(tab, /Aceptado por Resend/);
  assert.match(tab, /Sin preparar/);
  assert.match(tab, /No elegible/);
});
test("DB queue is deduplicated by user and campaign, not subject alone", () => {
  assert.match(migration, /ADD COLUMN IF NOT EXISTS campaign_key/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS recipient_user_id uuid/);
  assert.match(migration, /CREATE UNIQUE INDEX IF NOT EXISTS email_queue_campaign_recipient_unique/);
  assert.match(migration, /ON CONFLICT \(campaign_key, recipient_user_id\)/);
  assert.match(migration, /DO NOTHING/);
});
test("Server enforces superadmin plus confirmed account and verified Ignition identity", () => {
  assert.equal((migration.match(/IF NOT public\.is_super_admin\(\)/g)||[]).length,3);
  assert.match(migration, /p\.ignition_league_player IS TRUE/);
  assert.match(migration, /p\.ignition_status = 'verified'/);
  assert.match(migration, /u\.email_confirmed_at IS NOT NULL/);
  assert.match(migration, /JOIN auth\.users u ON u\.id=p\.id/);
  assert.match(migration, /REVOKE EXECUTE ON FUNCTION public\.queue_ignition_selected_campaign/);
  assert.match(migration, /TO authenticated, service_role/);
  assert.doesNotMatch(tab, /SUPABASE_SERVICE_ROLE_KEY|RESEND_API_KEY/);
});
test("Worker remains cron-only, uses idempotency and checks database status write", () => {
  assert.match(worker, /async scheduled\(event, env, ctx\)/);
  assert.match(worker, /async fetch\(\)/);
  assert.match(worker, /status: 404/);
  assert.match(worker, /'Idempotency-Key': 'sharkania-queue-' \+ item\.id/);
  assert.match(worker, /if \(!response\.ok\) throw new Error\('Email queue status update failed:/);
});
test("Newsletter keeps existing admin RPC and does not send from this change", () => {
  assert.match(admin, /rpc\("queue_newsletter_emails"/);
  assert.match(admin, /p_test_email: isTestMode \? testEmail : null/);
  assert.match(admin, /if \(!isTestMode\)/);
});
