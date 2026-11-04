import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const client = read("src/lib/api/guarded-results.ts");
const upload = read("src/components/admin/results-upload.tsx");
const editor = read("src/components/admin/results-editor.tsx");
const proposedSql = read("docs/security/tournament-publication-transaction-2026-11-04.proposal.sql");

test("new guarded publication is OFF by default and requires BOTH cutover flags", () => {
  assert.match(client, /VITE_TOURNAMENT_PUBLISH_RPC === "true"/);
  assert.match(client, /GUARDED_RESULTS_RPC_ENABLED \|\| !GUARDED_ELO_RPC_ENABLED/);
  assert.match(client, /supabase\.rpc\("publish_tournament_results_guarded"/);
  assert.match(client, /p_tournament_id: tournamentId/);
  assert.match(client, /p_results: payload/);
  assert.doesNotMatch(client, /\.from\("tournament_results"\)\.(?:insert|update|delete)/);
  assert.doesNotMatch(client, /\.from\("elo_history"\)/);
  assert.doesNotMatch(client, /\.from\("players"\)\.(?:insert|update)/);
  assert.doesNotMatch(client, /calculateElo\(/);
});

test("frontend guarded branch precedes all legacy browser mutations", () => {
  for (const file of [upload, editor]) {
    assert.match(file, /if \(GUARDED_RESULTS_RPC_ENABLED\) \{/);
    assert.match(file, /await publishTournamentResultsGuarded\(/);
    assert.ok(
      file.indexOf("if (GUARDED_RESULTS_RPC_ENABLED)") < file.indexOf("if (GUARDED_ELO_RPC_ENABLED)"),
      "guarded publication must precede the old fail-closed Elo branch",
    );
  }
  assert.ok(upload.indexOf("if (GUARDED_RESULTS_RPC_ENABLED)") < upload.indexOf("await resolvePlayer("));
  assert.ok(editor.indexOf("if (GUARDED_RESULTS_RPC_ENABLED)") < editor.indexOf("await prepareTournamentForReedit("));
});

test("publication payload cannot include any client-supplied Elo or derived stats", () => {
  const resultBuilder = client.split("export function buildGuardedTournamentResults(")[1]
    .split("export async function publishTournamentResultsGuarded(")[0];
  assert.match(resultBuilder, /position: row\.position/);
  assert.match(resultBuilder, /buy_ins_count: row\.buyInsCount/);
  assert.match(resultBuilder, /prize_won: prize/);
  assert.doesNotMatch(resultBuilder, /elo_before\s*:/);
  assert.doesNotMatch(resultBuilder, /elo_after\s*:/);
  assert.doesNotMatch(resultBuilder, /elo_change\s*:/);
  assert.doesNotMatch(resultBuilder, /total_prize_won\s*:/);
});

test("SQL proposal guards Auth, chronology, currencies and server-calculated fields", () => {
  assert.match(proposedSql, /NOT A MIGRATION/);
  assert.match(proposedSql, /SECURITY DEFINER\s+SET search_path TO ''/);
  assert.match(proposedSql, /auth\.uid\(\)/);
  assert.match(proposedSql, /is_super_admin\(\)/);
  assert.match(proposedSql, /is_club_admin\(v_t\.club_id\)/);
  assert.match(proposedSql, /Unexpected result field/);
  assert.match(proposedSql, /v_t\.currency IS DISTINCT FROM 'USD'/);
  assert.match(proposedSql, /t\.start_datetime>=v_t\.start_datetime/);
  assert.match(proposedSql, /later\/same-date player history/i);
  assert.match(proposedSql, /public\.ensure_tournament_player_guarded\(/);
  assert.match(proposedSql, /public\.calculate_tournament_elo_guarded\(/);
  assert.match(proposedSql, /public\.recalculate_league_standings\(/);
  assert.match(proposedSql, /REVOKE ALL ON FUNCTION public\.publish_tournament_results_guarded\(uuid,jsonb\)/);
  assert.match(proposedSql, /GRANT EXECUTE ON FUNCTION public\.publish_tournament_results_guarded\(uuid,jsonb\)/);
  assert.ok(
    proposedSql.indexOf("Later/same-date player history") <
    proposedSql.indexOf("DELETE FROM public.elo_history"),
    "chronology must reject before destructive reset",
  );
  assert.ok(
    proposedSql.indexOf("DELETE FROM public.elo_history") <
    proposedSql.indexOf("INSERT INTO public.tournament_results"),
    "replacement should happen after successful preflight",
  );
  assert.doesNotMatch(proposedSql, /pg_catalog\.(?:coalesce|greatest)\(/i);
});

test.todo("Execute generalized SQL proposal with real Supabase local PG17 and Auth/RLS test identities");
test.todo("Verify real HTTP/PostgREST/JWT admin flows, last-event republication and concurrent writes");
test.todo("Verify correct safe cutover of legacy GRANTs and player/league direct DML");
