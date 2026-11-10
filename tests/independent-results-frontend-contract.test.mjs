import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read=path=>fs.readFileSync(path,"utf8");
const client=read("src/lib/api/guarded-independent-results.ts");
const csv=read("src/components/admin/results-upload.tsx");
const editor=read("src/components/admin/results-editor.tsx");
const sql=read("docs/security/independent-results-atomic-v1-2026-11-10.CANDIDATE.sql");
const acl=read("docs/security/independent-elo-rest-lockdown-2026-11-10.CANDIDATE.sql");

test("independent writer remains OFF unless both independent and Release A flags enabled",()=>{
 assert.match(client,/GUARDED_LEAGUE_RPC_ENABLED\s*&&\s*import\.meta\.env\.VITE_INDEPENDENT_RESULTS_GUARDED_RPC\s*===\s*"true"/);
 assert.match(client,/if\s*\(!GUARDED_INDEPENDENT_RESULTS_RPC_ENABLED\)/);
});

test("only nickname/finish/prize/entries cross the browser boundary",()=>{
 assert.match(client,/supabase\.rpc\(\s*"publish_independent_nickname_results_guarded"/);
 assert.match(client,/No REST fallback|NEVER return to browser-side Elo/);
 assert.match(client,/prize_won:\s*row\.prizeWon/);
 assert.match(client,/buy_ins_count:\s*row\.buyInsCount/);
 assert.match(client,/league_points_earned:\s*0/);
 assert.doesNotMatch(client,/player_id:\s*row\./);
 assert.doesNotMatch(client,/elo_before:\s*row\./);
 assert.doesNotMatch(client,/currency:\s*row\./);
});

for(const [name,source,legacy] of [
 ["csv",csv,"setResolving(true)"],
 ["editor",editor,'setMessage({ text: "Paso 1/5: Revirtiendo impacto'],
]){
 test(name+" guarded independent branch precedes all legacy mutation code",()=>{
  const gated=source.indexOf("if (GUARDED_INDEPENDENT_RESULTS_RPC_ENABLED && !tournament.league_id)");
  const legacyAt=source.indexOf(legacy);
  assert.ok(gated>=0 && legacyAt>gated);
  const branch=source.slice(gated,legacyAt);
  assert.match(branch,/if\s*\(tournament\.results_uploaded\)/);
  assert.match(branch,/tournament\.currency !== "USD"/);
  assert.match(branch,/publishInitialIndependentResultsGuarded/);
  assert.match(branch,/return; \/\//);
  assert.doesNotMatch(branch,/\.from\("tournament_results"\)\s*\.\s*(insert|delete|update)/);
  assert.doesNotMatch(branch,/calculateElo\(/);
 });
}

test("independent RPC is protected, transactional, idempotent and USD-only",()=>{
 assert.match(sql,/BEGIN;[\s\S]*COMMIT;\s*$/);
 assert.match(sql,/SECURITY DEFINER SET search_path TO ''/);
 assert.match(sql,/v_actor uuid := \(SELECT auth\.uid\(\)\)/);
 assert.match(sql,/IF v_league IS NOT NULL THEN/);
 assert.match(sql,/IF v_currency IS DISTINCT FROM 'USD' THEN/);
 assert.match(sql,/FOR UPDATE OF t/);
 assert.match(sql,/ORDER BY p\.id FOR UPDATE/);
 assert.match(sql,/CREATE TABLE sharkania_release\.independent_elo_publication/);
 assert.match(sql,/tournament_id uuid NOT NULL UNIQUE/);
 assert.match(sql,/CREATE TRIGGER independent_immutable_checkpoint/);
 assert.match(sql,/REVOKE ALL ON FUNCTION public\.publish_independent_nickname_results_guarded/);
 assert.match(sql,/GRANT EXECUTE ON FUNCTION public\.publish_independent_nickname_results_guarded/);
});

test("ACL revocation keeps nickname while forbidding direct Elo and results",()=>{
 assert.match(acl,/REVOKE INSERT,UPDATE,DELETE ON TABLE public\.players/);
 assert.match(acl,/GRANT UPDATE\(nickname,country_code\) ON public\.players TO authenticated/);
 assert.match(acl,/REVOKE INSERT,UPDATE,DELETE ON TABLE public\.elo_history/);
 assert.match(acl,/REVOKE INSERT,UPDATE,DELETE ON TABLE public\.tournament_results/);
 assert.match(acl,/CREATE TRIGGER independent_guard_direct_completion/);
});
