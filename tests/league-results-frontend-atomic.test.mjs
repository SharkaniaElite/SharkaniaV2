import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const api=read("src/lib/api/guarded-league-results.ts");
const upload=read("src/components/admin/results-upload.tsx");
const editor=read("src/components/admin/results-editor.tsx");
const e2e=read("tests/fixtures/sharkania-league-nickname-real-auth-qa.mjs");
const sql=read("docs/security/league-results-public-rpc-alias-2026-11-10.qa-only.sql");
const authCI=read(".github/workflows/qa-league-nickname-real-auth.yml");
const workflow=read(".github/workflows/qa-league-results-client-slice.yml");

test("the first-upload client uses stable atomic RPC and never offers REST fallback",()=>{
 assert.match(api,/VITE_LEAGUE_GUARDED_RPC|GUARDED_LEAGUE_RPC_ENABLED/);
 assert.match(api,/publishInitialLeagueResultsGuarded/);
 assert.match(api,/supabase\.rpc\("publish_league_nickname_results_guarded"/);
 assert.doesNotMatch(api,/supabase\.from\(|_qa"|service_role/);
 assert.match(api,/p_tournament_id: tournamentId/);
 assert.match(api,/p_results: payload/);
 assert.match(api,/status !== "published"/);
 assert.match(api,/PGRST202 \/ 42883: backend not deployed, never use REST as fallback/);
 assert.match(api,/Never fall back to browser DML/i);
});

test("client validates row count, nickname identity, positions and reentries before RPC",()=>{
 assert.match(api,/rows\.length < 2 \|\| rows\.length > 1000/);
 assert.match(api,/names\.has\(normalized\)/);
 assert.match(api,/positions\.has\(row\.position\)/);
 assert.match(api,/Number\.isFinite\(x\) && x >= 0/);
 assert.match(api,/Number\.isSafeInteger\(row\.buyInsCount\)/);
 assert.match(api,/row\.buyInsCount > 100/);
 assert.match(api,/ccpClub\.length > 120/);
 assert.match(api,/nickname,/);
 assert.match(api,/league_points_earned: row\.leaguePoints/);
 assert.match(api,/bounties_won: 0/);
 assert.match(api,/buy_ins_count: row\.buyInsCount/);
 assert.doesNotMatch(api,/\bplayer_id:\s*row\.playerId\b/);
 assert.doesNotMatch(api,/\bcurrency:\s*row\./);
});

test("CSV first league publish bypasses all legacy mutations; flag OFF retains old workflow",()=>{
 const a=upload.indexOf("if (GUARDED_LEAGUE_RPC_ENABLED && tournament.league_id)");
 const b=upload.indexOf("publishInitialLeagueResultsGuarded(tournament.id");
 const c=upload.indexOf("return; // NEVER fall back");
 const d=upload.indexOf("const resolvedRows: ResultRow[] = []");
 assert.ok(a>0&&b>a&&c>b&&d>c);
 assert.match(upload.slice(a,c),/tournament\.results_uploaded/);
 assert.match(upload.slice(a,c),/tournament\.currency !== "USD"/);
 assert.match(upload.slice(a,c),/rows\.map\(r =>/);
 assert.doesNotMatch(upload.slice(a,c),/supabase\.from\(|calculateElo\(|prepareTournamentForReedit\(|resolvePlayer\(/);
 assert.match(upload.slice(d),/resolvePlayer\(/);
 assert.match(upload.slice(d),/\.from\("tournament_results"\)/);
});

test("editor only creates first league results; historical league edits are denied",()=>{
 const a=editor.indexOf("if (GUARDED_LEAGUE_RPC_ENABLED && tournament.league_id)");
 const b=editor.indexOf("publishInitialLeagueResultsGuarded(tournament.id");
 const c=editor.indexOf("return; // Never enter legacy");
 const d=editor.indexOf("await prepareTournamentForReedit(tournament.id)");
 assert.ok(a>0&&b>a&&c>b&&d>c);
 assert.match(editor.slice(a,c),/tournament\.results_uploaded/);
 assert.match(editor.slice(a,c),/tournament\.currency !== "USD"/);
 assert.doesNotMatch(editor.slice(a,c),/supabase\.from\(|calculateElo\(|prepareTournamentForReedit\(|resolvePlayer\(/);
 assert.match(editor.slice(d),/\.from\("tournament_results"\)/);
});

test("real JWT HTTP suite exercises same stable endpoint exposed by QA-only alias",()=>{
 assert.match(e2e,/\/rest\/v1\/rpc\/publish_league_nickname_results_guarded"/);
 assert.match(e2e,/client\.auth\.signInWithPassword/);
 assert.match(e2e,/secondary club cannot publish/);
 assert.match(e2e,/spoofed CSV player ID rejected/);
 assert.match(e2e,/repeat results publication denied/);
 assert.match(sql,/SECURITY INVOKER/);
 assert.match(sql,/publish_league_nickname_results_guarded_qa\(p_tournament_id,p_results\)/);
 assert.match(sql,/REVOKE ALL ON FUNCTION public\.publish_league_nickname_results_guarded/);
 assert.match(sql,/GRANT EXECUTE ON FUNCTION public\.publish_league_nickname_results_guarded/);
 assert.match(authCI,/league-results-public-rpc-alias-2026-11-10\.qa-only\.sql/);
 assert.match(workflow,/node --test tests\/league-results-frontend-atomic\.test\.mjs/);
 assert.match(workflow,/tsc -b --pretty false/);
 assert.doesNotMatch(workflow,/(supabase db push|supabase functions deploy|--remote|\.supabase\.co|nhpjzywfzljtlqaigzed)/);
});
