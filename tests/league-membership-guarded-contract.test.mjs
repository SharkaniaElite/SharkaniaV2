import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const guarded = read("src/lib/api/guarded-leagues.ts");
const leagueForm = read("src/components/admin/league-form.tsx");
const clubAdmin = read("src/pages/club-admin.tsx");
const legacy = read("src/lib/api/leagues.ts");
const resultUpload = read("src/components/admin/results-upload.tsx");
const resultEditor = read("src/components/admin/results-editor.tsx");
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
  assert.match(leagueForm, /const fields = \{/);
  assert.match(leagueForm, /fields,\s*roomIds: form\.room_ids/);
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
  // QA harness must pass the real organizer club (not the selected
  // participant club) to the guarded RPC. This keeps the superadmin
  // scenario valid without granting edit rights to a secondary admin.
  assert.ok(localHarness.includes('league_clubs(club_id, is_primary)'));
  assert.ok(localHarness.includes('primary_club_id: league.league_clubs?.find((m) => m.is_primary)?.club_id ?? null'));
  assert.ok(localHarness.includes('clubId={edit ? (edit.primary_club_id ?? "") : clubId}'));
});

test("release A guarded flag blocks league result writes before any mutation", () => {
  // The secure standings recalculation RPC belongs to a later integration.
  // These two legacy handlers must fail CLOSED before creating players,
  // resetting tournament impact, replacing results or modifying ELO.
  for (const [source, handler, firstWrite] of [
    [resultUpload, "const handleResolveAndUpload = async () => {", "await resolvePlayer("],
    [resultEditor, "const handleSave = async () => {", "await prepareTournamentForReedit("],
  ]) {
    assert.ok(source.includes('import { GUARDED_LEAGUE_RPC_ENABLED } from "../../lib/api/guarded-leagues";'));
    const start = source.indexOf(handler);
    assert.ok(start !== -1, "result handler must exist");
    const code = source.slice(start);
    const guard = code.indexOf("if (GUARDED_LEAGUE_RPC_ENABLED && tournament.league_id) {");
    assert.ok(guard >= 0 && guard < code.indexOf(firstWrite),
      "guarded-mode block must occur before the first mutation");
    const beforeWrites = code.slice(guard, code.indexOf(firstWrite));
    assert.match(beforeWrites, /setMessage\(\{[\s\S]*?type: "error",[\s\S]*?\}\);\s*return;\s*\}/);
  }
  assert.match(legacy, /if \(GUARDED_LEAGUE_RPC_ENABLED\) \{\s*throw new Error\("El recálculo manual de ligas requiere/);
});


test("guarded league forms avoid existence reads, clone is disclosed, and unchanged saves avoid WAL", () => {
  const guarded = read("src/lib/api/guarded-leagues.ts");
  const formBranch = leagueForm.slice(
    leagueForm.indexOf("if (GUARDED_LEAGUE_RPC_ENABLED) {"),
    leagueForm.indexOf("let leagueId: string;")
  );
  const duplicateBranch = legacy.slice(
    legacy.indexOf("if (GUARDED_LEAGUE_RPC_ENABLED) {", legacy.indexOf("export async function duplicateLeague(")),
    legacy.indexOf("// 1. Obtener la liga original", legacy.indexOf("export async function duplicateLeague("))
  );
  assert.ok(formBranch.length > 300 && duplicateBranch.length > 200);
  assert.doesNotMatch(formBranch, /\.from\(["']leagues["']\)\.select/);
  assert.doesNotMatch(duplicateBranch, /\.from\(["']leagues["']\)\.select/);
  assert.match(formBranch, /error instanceof GuardedLeagueSlugConflictError|saveError instanceof GuardedLeagueSlugConflictError/);
  assert.match(duplicateBranch, /error instanceof GuardedLeagueSlugConflictError/);
  assert.match(guarded, /isSlugConflict\(error\.code, error\.message\)/);
  assert.match(clubAdmin, /Los clubes participantes adicionales NO quedarán inscritos automáticamente/);
  assert.match(clubAdmin, /tampoco se copiarán torneos, resultados ni rankings/);

  const save = sql.slice(sql.indexOf("CREATE OR REPLACE FUNCTION public.save_league_guarded("),
    sql.indexOf("CREATE OR REPLACE FUNCTION public.delete_empty_league_guarded("));
  const rooms = sql.slice(sql.indexOf("CREATE OR REPLACE FUNCTION public.set_league_rooms_guarded("),
    sql.indexOf("CREATE OR REPLACE FUNCTION public.duplicate_league_guarded("));
  for (const section of [save, rooms]) {
    assert.match(section, /NOT \(lr\.room_id = ANY\(v_rooms\)\)/);
    assert.match(section, /WHERE NOT EXISTS\s*\(/);
    assert.match(section, /lr\.league_id=.*? AND lr\.room_id=x\.id/);
  }
  assert.match(save, /IS DISTINCT FROM\s*\(v_name,nullif/);
  assert.match(fixture, /identical guarded save creates zero league tuple changes and keeps room IDs/);
  assert.match(fixture, /delta room writes preserve existing relation IDs/);
  assert.match(fixture, /forced late clone room error rolled back entire RPC/);
  assert.match(fixture, /forced clone rollback left no orphan league/);
});


test("Release A fails closed if interim P1 or unknown league writes are present", () => {
  assert.match(sql, /DO \$league_cutover_preflight\$/);
  assert.match(sql, /STOP: legacy league policies changed/);
  assert.match(sql, /STOP: unreviewed league write policy exists/);
  assert.match(sql, /STOP: league has missing or multiple primary clubs/);
  assert.match(sql, /league_rooms' AND policyname IN[\s\S]*?League rooms: super admin update/);
  assert.match(sql, /cmd IN \('ALL','INSERT','UPDATE','DELETE'\)/);
  assert.ok(
    sql.indexOf("DO $league_cutover_preflight$") <
      sql.indexOf("DROP POLICY IF EXISTS"),
    "Catalog preflight must happen before any policy/privilege mutation",
  );
  assert.match(workflow, /qa_league_cutover_conflict/);
  assert.match(workflow, /CREATE POLICY leagues_primary_update_p1/);
  assert.match(workflow, /STOP: unreviewed league write policy exists/);
  assert.match(workflow, /STOP: legacy league policies changed/);
});
