import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const guarded = read("src/lib/api/guarded-leagues.ts");
const legacy = read("src/lib/api/leagues.ts");
const sql = read("docs/security/league-membership-guarded-cutover-2026-11-04.proposal.sql");
const fixture = read("tests/fixtures/sharkania-league-membership-qa-assert.sql");
const workflow = read(".github/workflows/core-supabase-rls-qa.yml");

test("league guarded cutover remains OFF and never falls back to client writes", () => {
  assert.match(guarded, /VITE_LEAGUE_GUARDED_RPC === "true"/);
  assert.match(guarded, /assertGuardedLeagueEnabled\(\)/);
  assert.match(guarded, /supabase\.rpc\("create_league_guarded"/);
  assert.match(guarded, /supabase\.rpc\("add_league_club_guarded"/);
  assert.match(guarded, /supabase\.rpc\("set_league_rooms_guarded"/);
  assert.doesNotMatch(guarded, /\.from\(["']league_clubs["']\)/);
  assert.doesNotMatch(guarded, /\.from\(["']league_rooms["']\)/);
  assert.match(legacy, /if \(GUARDED_LEAGUE_RPC_ENABLED\)/);
  assert.ok(
    legacy.indexOf("if (GUARDED_LEAGUE_RPC_ENABLED)", legacy.indexOf("export async function duplicateLeague(")) <
    legacy.indexOf('supabase\n    .from("leagues")\n    .insert(newLeague)'),
    "guarded duplicate must fail before any legacy INSERT",
  );
});

test("SQL proposal revokes broad membership DML and requires primary-club permissions", () => {
  assert.match(sql, /NOT A MIGRATION/);
  assert.match(sql, /REVOKE INSERT,UPDATE,DELETE ON TABLE public\.league_clubs/);
  assert.match(sql, /REVOKE INSERT,UPDATE,DELETE ON TABLE public\.league_rooms/);
  assert.match(sql, /REVOKE INSERT ON TABLE public\.leagues/);
  assert.match(sql, /leagues_primary_owner_update/);
  assert.match(sql, /leagues_primary_owner_delete/);
  assert.match(sql, /lc\.is_primary/);
  assert.match(sql, /public\.create_league_guarded/);
  assert.match(sql, /public\.add_league_club_guarded/);
  assert.match(sql, /public\.set_league_rooms_guarded/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.create_league_guarded/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.add_league_club_guarded/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.set_league_rooms_guarded/);
  assert.doesNotMatch(sql, /DROP POLICY.*lectura publica/);
});

test("PostgreSQL QA replays pre-patch attack and verifies blocked escalation", () => {
  assert.match(workflow, /CREATE DATABASE qa_league_auth/);
  assert.match(workflow, /sharkania-league-membership-qa-setup\.sql/);
  assert.match(workflow, /sharkania-league-membership-qa-assert\.sql/);
  assert.match(fixture, /club B cannot self-join league A/);
  assert.match(fixture, /secondary club participant cannot take over shared league/);
  assert.match(fixture, /organizer A can edit its league and replace room list/);
});
