import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (file) => readFileSync(new URL("../" + file, import.meta.url), "utf8");
const api = read("src/lib/api/guarded-leagues.ts");
const leagues = read("src/lib/api/leagues.ts");
const form = read("src/components/admin/league-form.tsx");
const club = read("src/pages/club-admin.tsx");
const tournament = read("src/lib/api/tournaments.ts");
const uploader = read("src/components/admin/results-upload.tsx");
const editor = read("src/components/admin/results-editor.tsx");
const bulk = read("src/components/admin/bulk-delete-bar.tsx");

test("the league cutover is disabled unless explicitly enabled in a future release", () => {
 assert.match(api, /VITE_LEAGUE_GUARDED_RPC === "true"/);
 assert.match(api, /function assertGuardedLeagueEnabled\(/);
 assert.match(api, /throw new Error\([\s\S]*?administración protegida de ligas todavía no está habilitada/);
 assert.match(api, /assertGuardedLeagueEnabled\(\)/);
});

test("atomic client integration does not fall back to legacy writes after enabling", () => {
 assert.match(api, /rpc\("save_league_guarded"/);
 assert.match(api, /rpc\("duplicate_league_guarded"/);
 assert.match(api, /rpc\("delete_empty_league_guarded"/);
 assert.match(form, /if \(GUARDED_LEAGUE_RPC_ENABLED\) \{/);
 assert.match(form, /await saveLeagueGuarded\(/);
 assert.match(leagues, /if \(GUARDED_LEAGUE_RPC_ENABLED\) \{/);
 assert.match(leagues, /await duplicateLeagueGuarded\(/);
 assert.match(club, /await deleteEmptyLeagueGuarded\(/);
 assert.match(club, /Club participante · sin permisos de edición/);
});

test("legacy results mutations are explicitly fenced if guarded flag becomes active", () => {
 assert.match(tournament, /async function assertLegacyTournamentMutationAllowed/);
 assert.match(tournament, /if \(!GUARDED_LEAGUE_RPC_ENABLED\) return/);
 assert.match(tournament, /if \(GUARDED_LEAGUE_RPC_ENABLED\) \{[\s\S]*?No se permiten escrituras de posiciones/);
 assert.match(uploader, /GUARDED_LEAGUE_RPC_ENABLED && tournament\.league_id/);
 assert.match(editor, /GUARDED_LEAGUE_RPC_ENABLED && tournament\.league_id/);
 assert.match(bulk, /GUARDED_LEAGUE_RPC_ENABLED/);
});
test("legacy flag-off renders the original league query without guarded joins", () => {
 assert.match(club, /if \(!GUARDED_LEAGUE_RPC_ENABLED\) \{[\s\S]*?\.select\("leagues\(\*\)"\)/);
 assert.match(club, /\.select\("is_primary, leagues\(\*, league_clubs\(club_id, is_primary\)\)"\)/);
});
