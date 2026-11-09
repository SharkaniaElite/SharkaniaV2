import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const sql = read("docs/security/league-membership-guarded-cutover-2026-11-04.proposal.sql");
const workflow = read(".github/workflows/qa-league-backend-cutover.yml");
const qa = read("tests/fixtures/sharkania-league-backend-acl-qa.sql");
const client = read("src/lib/api/guarded-leagues.ts");

test("proposal remains QA-only and requires an unmodified expected legacy policy catalog", () => {
  assert.match(sql, /NOT A MIGRATION. DO NOT APPLY TO PRODUCTION/);
  assert.match(sql, /^BEGIN;/m);
  assert.match(sql, /^COMMIT;/m);
  assert.match(sql, /DO \$league_cutover_preflight\$/);
  assert.match(sql, /v_expected <> 8/);
  assert.match(sql, /cmd IN \('ALL','INSERT','UPDATE','DELETE'\)/);
  assert.match(sql, /STOP: unreviewed league write policy exists/);
  assert.match(sql, /STOP: league has missing or multiple primary clubs/);
  assert.ok(sql.indexOf("DO $league_cutover_preflight$") < sql.indexOf("DROP POLICY"));
  assert.ok(sql.indexOf("DO $league_cutover_preflight$") < sql.indexOf("CREATE OR REPLACE FUNCTION"));
});

test("backend enforces primary-organizer owner checks and revokes broad direct DML", () => {
  assert.match(sql, /REVOKE INSERT,UPDATE,DELETE ON TABLE public\.league_clubs/);
  assert.match(sql, /REVOKE INSERT,UPDATE,DELETE ON TABLE public\.league_rooms/);
  assert.match(sql, /REVOKE INSERT,DELETE ON TABLE public\.leagues/);
  assert.match(sql, /CREATE POLICY "leagues_primary_owner_update"/);
  assert.match(sql, /WITH CHECK/);
  assert.doesNotMatch(sql, /DROP POLICY[^\n]*lectura publica/i);
  assert.match(sql, /CREATE UNIQUE INDEX IF NOT EXISTS league_clubs_one_primary_per_league_guarded/);
  assert.match(sql, /public\.delete_empty_league_guarded/);
  assert.match(sql, /League has tournaments, templates, standings or champions/);
});

test("all guarded RPCs explicitly revoke anonymous execution in the same transaction", () => {
  for (const rpc of [
    "create_league_guarded", "add_league_club_guarded",
    "set_league_rooms_guarded", "duplicate_league_guarded",
    "delete_empty_league_guarded", "save_league_guarded",
  ]) {
    assert.match(sql, new RegExp("CREATE OR REPLACE FUNCTION public\\." + rpc + "\\("));
    assert.match(sql, new RegExp("REVOKE ALL ON FUNCTION public\\." + rpc + "\\("));
    assert.match(sql, new RegExp("GRANT EXECUTE ON FUNCTION public\\." + rpc + "\\("));
  }
  assert.equal((sql.match(/SECURITY DEFINER/g) ?? []).length >= 6, true);
  assert.match(qa, /has_function_privilege\('anon'/);
  assert.match(qa, /has_function_privilege\('authenticated'/);
  assert.match(qa, /legacy permissive write policies survived cutover/);
});

test("workflow uses only a disposable PostgreSQL 17, includes negative preflight, and never deploys", () => {
  assert.match(workflow, /image: postgres:17/);
  assert.match(workflow, /PGHOST: 127\.0\.0\.1/);
  assert.match(workflow, /QA_SKIP_CUTOVER=1/);
  assert.match(workflow, /unexpected_global_all/);
  assert.match(workflow, /STOP: legacy league policies changed/);
  assert.match(workflow, /STOP: league has missing or multiple primary clubs/);
  assert.doesNotMatch(workflow, /\bsupabase db push\b|\bmcp__Supabase__apply_migration\b|supabase\.co|project_ref/i);
  assert.match(client, /VITE_LEAGUE_GUARDED_RPC === "true"/);
});
