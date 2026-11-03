/**
 * Read-only Stats Espía launch gate. Run ONLY on an isolated Supabase QA project.
 *
 * All accounts must be synthetic. This script does not create, update or delete
 * records. It signs in to QA identities, queries protected endpoints, and fails
 * closed when grants or RPC checks remain open.
 *
 * Example:
 * QA_SUPABASE_URL=https://your-qa-ref.supabase.co
 * QA_PROJECT_REF=your-qa-ref QA_SUPABASE_ANON_KEY=...
 * QA_TEST_PLAYER_SLUG=fixture-player
 * QA_NO_LICENSE_EMAIL=... QA_NO_LICENSE_PASSWORD=...
 * QA_EXPIRED_EMAIL=... QA_EXPIRED_PASSWORD=...
 * QA_LICENSED_EMAIL=... QA_LICENSED_PASSWORD=...
 * QA_ADMIN_EMAIL=... QA_ADMIN_PASSWORD=...
 * QA_ALLOW_REMOTE_SECURITY_TESTS=I_CONFIRM_ISOLATED_QA npm run qa:stats-spy
 *
 * Never use production account details, service_role, or tokens in chat.
 */
import { createClient } from "@supabase/supabase-js";
import assert from "node:assert/strict";

const PROD_REF = "nhpjzywfzljtlqaigzed";
const e = process.env;
const required = [
  "QA_SUPABASE_URL", "QA_PROJECT_REF", "QA_SUPABASE_ANON_KEY", "QA_TEST_PLAYER_SLUG",
  "QA_NO_LICENSE_EMAIL", "QA_NO_LICENSE_PASSWORD",
  "QA_EXPIRED_EMAIL", "QA_EXPIRED_PASSWORD",
  "QA_LICENSED_EMAIL", "QA_LICENSED_PASSWORD",
  "QA_ADMIN_EMAIL", "QA_ADMIN_PASSWORD"
];
function preflight() {
  assert.equal(e.QA_ALLOW_REMOTE_SECURITY_TESTS, "I_CONFIRM_ISOLATED_QA",
    "Explicit test-only opt-in is required");
  for (const key of required) assert.ok(e[key], "Missing QA-only env var " + key);
  const url = new URL(e.QA_SUPABASE_URL);
  assert.equal(url.protocol, "https:", "QA Supabase endpoint must use HTTPS");
  assert.match(url.hostname, /^[a-z0-9-]+\.supabase\.co$/i);
  const ref = url.hostname.split(".")[0];
  assert.equal(ref, e.QA_PROJECT_REF, "Expected isolated QA ref does not match endpoint");
  assert.notEqual(ref, PROD_REF, "Production project blocked by test harness");
  assert.ok(!e.QA_SUPABASE_ANON_KEY.startsWith("sb_secret_"), "Secret server key is forbidden");
  if (e.QA_SUPABASE_ANON_KEY.includes(".")) {
    try {
      const claims = JSON.parse(Buffer.from(e.QA_SUPABASE_ANON_KEY.split(".")[1], "base64url").toString());
      assert.notEqual(claims.role, "service_role", "Service-role credentials are forbidden");
    } catch (err) {
      if (err instanceof assert.AssertionError) throw err;
      throw new Error("Unrecognized publishable key format");
    }
  }
}
function client() {
  return createClient(e.QA_SUPABASE_URL, e.QA_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  });
}
async function expectDenied(label, run) {
  const { data, error } = await run();
  assert.ok(error, label + ": denied request unexpectedly succeeded");
  assert.equal(error.code, "42501", label + ": expected permission failure (not missing RPC or other error)");
  assert.ok(data === null || data === undefined, label + ": blocked request returned data");
  process.stdout.write("✓ Denied: " + label + "\n");
}
async function login(role, emailKey, passwordKey) {
  const c = client();
  const { data, error } = await c.auth.signInWithPassword({
    email: e[emailKey], password: e[passwordKey]
  });
  assert.ifError(error);
  assert.ok(data?.user, "No QA user for " + role);
  return c;
}
async function allowedSummary(label, c) {
  const { data, error } = await c.rpc("stats_spy_get_summary_v1", {
    p_slug: e.QA_TEST_PLAYER_SLUG
  });
  assert.ifError(error);
  assert.ok(data && typeof data === "object" && !Array.isArray(data), label + ": no summary object");
  assert.equal(typeof data.mixed_currencies, "boolean");
  assert.ok(Array.isArray(data.currency_breakdown), "Must return a per-currency breakdown");
  if (data.mixed_currencies) {
    for (const field of ["total_prize_won", "total_buy_ins_spent", "profit", "roi_percent", "currency"]) {
      assert.equal(data[field], null, label + ": mixed currency " + field + " must be null");
    }
  }
  process.stdout.write("✓ Allowed: " + label + " (currency-safe)\n");
}
async function main() {
  preflight();
  const anonymous = client();
  for (const [label, run] of [
    ["anon: guarded summary", () => anonymous.rpc("stats_spy_get_summary_v1", { p_slug: e.QA_TEST_PLAYER_SLUG })],
    ["anon: guarded history", () => anonymous.rpc("stats_spy_get_history_v1", { p_slug: e.QA_TEST_PLAYER_SLUG, p_limit: 1, p_offset: 0 })],
    ["anon: legacy unrestricted stats RPC", () => anonymous.rpc("get_unified_player_stats", { p_slug: e.QA_TEST_PLAYER_SLUG })],
    ["anon: player financial column", () => anonymous.from("players").select("total_buy_ins_spent").limit(1)],
    ["anon: results financial column", () => anonymous.from("tournament_results").select("buy_ins_count").limit(1)]
  ]) await expectDenied(label, run);

  const { error: publicError } = await anonymous.from("players").select("id,nickname,elo_rating").limit(1);
  assert.ifError(publicError);
  process.stdout.write("✓ Public ranking fields remain readable\n");

  for (const [role, email, pass] of [
    ["not licensed", "QA_NO_LICENSE_EMAIL", "QA_NO_LICENSE_PASSWORD"],
    ["expired", "QA_EXPIRED_EMAIL", "QA_EXPIRED_PASSWORD"]
  ]) {
    const c = await login(role, email, pass);
    await expectDenied(role + ": guarded summary", () =>
      c.rpc("stats_spy_get_summary_v1", { p_slug: e.QA_TEST_PLAYER_SLUG }));
    await expectDenied(role + ": guarded history", () =>
      c.rpc("stats_spy_get_history_v1", { p_slug: e.QA_TEST_PLAYER_SLUG, p_limit: 1, p_offset: 0 }));
  }
  const licensed = await login("licensed", "QA_LICENSED_EMAIL", "QA_LICENSED_PASSWORD");
  await allowedSummary("licensed", licensed);
  const { data: history, error: historyError } = await licensed.rpc("stats_spy_get_history_v1", {
    p_slug: e.QA_TEST_PLAYER_SLUG, p_limit: 30, p_offset: 0
  });
  assert.ifError(historyError);
  assert.ok(Array.isArray(history) && history.length <= 30, "History pagination cannot exceed 30");
  process.stdout.write("✓ Licensed history is paginated\n");

  const admin = await login("super admin", "QA_ADMIN_EMAIL", "QA_ADMIN_PASSWORD");
  await allowedSummary("super admin", admin);
  process.stdout.write("✓ QA security smoke finished without touching production\n");
}
main().catch(err => {
  process.stderr.write("Stats Espía QA gate failed: " + (err?.message || "Unknown error") + "\n");
  process.exitCode = 1;
});
