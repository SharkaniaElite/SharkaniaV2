import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const guarded = read("src/lib/api/guarded-leagues.ts");
const leagueForm = read("src/components/admin/league-form.tsx");
const clubAdmin = read("src/pages/club-admin.tsx");
const legacy = read("src/lib/api/leagues.ts");
const sql = read("docs/security/league-membership-guarded-cutover-2026-11-04.proposal.sql");
const fixture = read("tests/fixtures/sharkania-league-membership-qa-assert.sql");
const workflow = read(".github/workflows/qa-league-security-release.yml");

test("league guarded cutover remains OFF and never falls back to client writes", () => {
  assert.match(guarded, /VITE_LEAGUE_GUARDED_RPC === "true"/);
  assert.match(guarded, /assertGuardedLeagueEnabled\(\)/);
  assert.match(guarded, /supabase\.rpc\("create_league_guarded"/);
  assert.match(guarded, /supabase\.rpc\("add_league_club_guarded"/);
  assert.match(guarded, /supabase\.rpc\("set_league_rooms_guarded"/);
  assert.match(guarded, /supabase\.rpc\("duplicate_league_guarded"/);
  assert.match(guarded, /supabase\.rpc\("delete_empty_league_guarded"/);
  assert.match(clubAdmin, /await deleteEmptyLeagueGuarded\(l\.id\)/);
  assert.match(legacy, /await duplicateLeagueGuarded\(leagueId, newName, slug\)/);
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
  assert.match(sql, /REVOKE INSERT,DELETE ON TABLE public\.leagues/);
  assert.match(sql, /leagues_primary_owner_update/);
  assert.match(sql, /public\.delete_empty_league_guarded/);
  assert.match(sql, /lc\.is_primary/);
  assert.match(sql, /public\.create_league_guarded/);
  assert.match(sql, /public\.add_league_club_guarded/);
  assert.match(sql, /public\.set_league_rooms_guarded/);
  assert.match(sql, /public\.duplicate_league_guarded/);
  assert.match(sql, /SELECT v_new,lr\.room_id FROM public\.league_rooms/);
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
  assert.match(fixture, /organizer cloned settings and rooms, no secondary club inherited/);
  assert.match(fixture, /organizer cannot delete league with tournament references/);
  assert.match(fixture, /organizer deletes truly empty league without orphans/);
});

test("league form sends all data in a single guarded RPC before legacy writes", () => {
  assert.match(guarded, /supabase\.rpc\("save_league_guarded"/);
  assert.match(guarded, /p_room_ids: \[\.\.\.input\.roomIds\]/);
  assert.match(leagueForm, /if \(GUARDED_LEAGUE_RPC_ENABLED\) \{/);
  assert.match(leagueForm, /await saveLeagueGuarded\(\{/);
  assert.match(leagueForm, /fields:\s*\{/);
  assert.match(leagueForm, /roomIds: form\.room_ids/);
  assert.ok(
    leagueForm.indexOf("await saveLeagueGuarded({") <
    leagueForm.indexOf('supabase.from("leagues").insert(payload)'),
    "one-RPC guarded branch must precede legacy multi-write INSERT",
  );
  assert.ok(
    leagueForm.indexOf("await saveLeagueGuarded({") <
    leagueForm.indexOf('supabase.from("league_rooms").delete()'),
    "guarded edit cannot first delete rooms through browser API",
  );
  assert.match(sql, /public\.save_league_guarded/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.save_league_guarded/);
  assert.match(fixture, /guarded form creates metadata, organizer and rooms atomically/);
  assert.match(fixture, /rejected form submission leaves earlier league and rooms intact/);
});

test("club admin distinguishes organizer vs participant before showing league edit controls", () => {
  assert.match(clubAdmin, /\.select\("is_primary, leagues\(\*, league_clubs\(club_id, is_primary\)\)"\)/);
  assert.match(clubAdmin, /is_primary_for_club: d\.is_primary === true/);
  assert.match(clubAdmin, /!GUARDED_LEAGUE_RPC_ENABLED \|\| l\.is_primary_for_club \|\| \(isSuperAdmin && !!l\.primary_club_id\)/);
  assert.match(clubAdmin, /\{canManageLeague \? \(/);
  assert.match(clubAdmin, /Club participante · sin permisos de edición/);
  assert.match(clubAdmin, /primary_club_id: l\.league_clubs\?\.find\(\(lc\) => lc\.is_primary\)\?\.club_id/);
  assert.match(clubAdmin, /editLeague\.primary_club_id \?\? firstClubId!/);
});


test("production-backed Cloudflare previews block authenticated UI and browser QA is localhost-only", () => {
  const protectedRoute = read("src/components/layout/protected-route.tsx");
  const localHarness = read("tests/e2e/league-form-local.tsx");
  assert.match(protectedRoute, /hostname\.endsWith/);
  assert.match(protectedRoute, /nhpjzywfzljtlqaigzed\.supabase\.co/);
  assert.match(protectedRoute, /previewUsingProduction/);
  assert.match(protectedRoute, /Administración bloqueada en este preview/);
  assert.match(localHarness, /import\.meta\.env\.DEV/);
  assert.match(localHarness, /SAFE_HOST && SAFE_ORIGIN && GUARDED_LEAGUE_RPC_ENABLED/);
  assert.match(localHarness, /LeagueForm/);
  assert.doesNotMatch(localHarness, /service[_-]?role|SERVICE_ROLE_KEY/i);
});
