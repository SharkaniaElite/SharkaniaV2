import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

const load = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const sql = load("docs/security/stats-spy-guarded-rpcs-2026-11-03.proposal.sql");
const client = load("src/lib/api/stats-spy.ts");
const hooks = load("src/hooks/use-stats-spy.ts");
const profile = load("src/pages/player-profile.tsx");
const playerApi = load("src/lib/api/players.ts");
const results = load("src/components/players/tournament-history-table.tsx");

test("Stats Spy proposed SQL rejects unauthenticated requests and checks licenses in both RPCs", () => {
  const functions = sql.split(/CREATE OR REPLACE FUNCTION public\.stats_spy_/);
  assert.equal(functions.length, 3, "proposal must declare summary and history endpoints");
  for (const body of functions.slice(1)) {
    assert.match(body, /SECURITY DEFINER/);
    assert.match(body, /SET search_path = ''/);
    assert.match(body, /auth\.uid\(\)/);
    assert.match(body, /v_viewer IS NULL/);
    assert.match(body, /user_purchases/);
    assert.match(body, /feature_key = 'cosmetic_extended_stats'/);
    assert.match(body, /up\.is_active IS TRUE/);
    assert.match(body, /up\.expires_at IS NULL OR up\.expires_at > now\(\)/);
    assert.match(body, /ERRCODE = '42501'/);
  }
});

test("Premium RPC execute grants are limited to authenticated users", () => {
  for (const name of ["stats_spy_get_summary_v1", "stats_spy_get_history_v1"]) {
    assert.match(sql, new RegExp(`REVOKE ALL ON FUNCTION public\\.${name}\\(`));
    assert.match(sql, new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${name}\\(`));
  }
  assert.match(sql, /FROM PUBLIC, anon, authenticated;/);
  assert.match(sql, /TO authenticated;/);
});

test("Secure mode is opt-in and never retries through an unsafe public RPC", () => {
  assert.match(client, /VITE_STATS_SPY_SECURE_RPC === "true"/);
  assert.match(client, /supabase\.rpc\("stats_spy_get_summary_v1"/);
  assert.match(client, /supabase\.rpc\("stats_spy_get_history_v1"/);
  assert.doesNotMatch(client, /get_unified_player_stats|getUnifiedTournamentResults/);
  assert.match(profile, /premiumDataReady/);
  assert.match(profile, /verifiedPremiumAccess/);
});

test("Premium history is incremental and isolated by viewer identity", () => {
  assert.match(client, /STATS_SPY_HISTORY_PAGE_SIZE = 30/);
  assert.match(client, /p_limit: safeLimit/);
  assert.match(client, /p_offset: offset/);
  assert.match(hooks, /useInfiniteQuery/);
  assert.match(hooks, /viewerId/);
  assert.match(hooks, /getNextPageParam/);
  assert.match(profile, /fetchNextPage/);
  assert.match(results, /canLoadMore/);
});

test("Free profile history requests no more than two records", () => {
  assert.match(playerApi, /if \(!hasFullAccess\) query = query\.limit\(2\)/);
  assert.match(profile, /hasMoreHistory/);
  assert.match(results, /sortedResults\.slice\(0, 2\)/);
});

test("Comparator, profile and guarded database RPC use the single real license key", () => {
  const compare = load("src/pages/compare.tsx");
  assert.match(compare, /useFeatureAccess\("cosmetic_extended_stats"\)/);
  assert.match(profile, /useFeatureAccess\("cosmetic_extended_stats"\)/);
  assert.match(sql, /feature_key = 'cosmetic_extended_stats'/);
  assert.doesNotMatch(compare, /useFeatureAccess\("stats_espia"\)/);
});

test("Public player queries use explicit selected columns ahead of security migration", () => {
  assert.doesNotMatch(playerApi, /\bconst BASE_PLAYER_SELECT = `\s*\*/);
  assert.doesNotMatch(playerApi, /\.select\("\*"/);
  assert.match(playerApi, /const BASE_TOURNAMENT_RESULT_SELECT/);
  assert.match(playerApi, /currency, start_datetime/);
});

test("Stats Spy proposal does not sum mixed currencies into fictitious aggregate ROI", () => {
  const types = client;
  const grid = load("src/components/players/player-stats-grid.tsx");
  assert.match(sql, /GROUP BY COALESCE\(t\.currency::text, 'SIN_MONEDA'\)/);
  assert.match(sql, /v_currency_count = 1/);
  assert.match(sql, /v_prizes := NULL/);
  assert.match(sql, /v_buyins := NULL/);
  assert.match(sql, /'mixed_currencies', v_currency_count > 1/);
  assert.match(sql, /'currency_breakdown', v_currency_breakdown/);
  assert.match(sql, /'currency', t\.currency/);
  assert.match(types, /mixed_currencies: boolean/);
  assert.match(grid, /financialComparable/);
  assert.match(grid, /No comparable/);
  assert.match(results, /formatTournamentAmount/);
  assert.match(results, /r\.tournaments\.currency/);
});

test("Guarded comparator gets premium financial values from licensed RPCs and never blurs DOM data", () => {
  const compare = load("src/pages/compare.tsx");
  assert.match(compare, /useSecureStatsSpySummary\(playerA\?\.slug, hasPremiumAccess\)/);
  assert.match(compare, /useSecureStatsSpySummary\(playerB\?\.slug, hasPremiumAccess\)/);
  assert.match(compare, /SECURE_STATS_SPY_MODE/);
  assert.match(compare, /securedA\.data\?\.profit/);
  assert.match(compare, /securedB\.data\?\.roi_percent/);
  assert.match(compare, /profitComparable/);
  assert.match(compare, /No comparable/);
  assert.match(compare, /isPremium=\{row\.premium && SECURE_STATS_SPY_MODE\}/);
  assert.doesNotMatch(compare, /blur-\[6px\]/);
});

test("QA role test harness is syntactically valid and explicitly blocks production", () => {
  const qa = load("scripts/stats-spy-security-smoke.mjs");
  assert.match(qa, /QA_ALLOW_REMOTE_SECURITY_TESTS/);
  assert.match(qa, /I_CONFIRM_ISOLATED_QA/);
  assert.match(qa, /assert\.notEqual\(ref, PROD_REF/);
  assert.match(qa, /expectDenied\("anon: guarded summary"/);
  assert.match(qa, /"expired", "QA_EXPIRED_EMAIL"/);
  assert.match(qa, /"licensed", "QA_LICENSED_EMAIL"/);
  assert.match(qa, /"super admin", "QA_ADMIN_EMAIL"/);
  assert.doesNotMatch(qa, /\.from\(["']players["']\)\.update\(/);
});

// Pending cross-system security work is intentionally visible, not falsely green.
test.todo("Cut over public player select-star queries to explicitly allowed columns");
test.todo("Revoke premium column access and legacy SQL RPC bypasses after all clients migrate");
test.todo("Run live anon / expired / paid / superadmin role checks in isolated Supabase database");
test.todo("Verify single-currency and multi-currency financial totals against synthetic fixture histories on isolated DB");
