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

// Pending cross-system security work is intentionally visible, not falsely green.
test.todo("Cut over public player select-star queries to explicitly allowed columns");
test.todo("Revoke premium column access and legacy SQL RPC bypasses after all clients migrate");
test.todo("Run live anon / expired / paid / superadmin role checks in isolated Supabase database");
