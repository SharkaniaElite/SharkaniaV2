import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const src=readFileSync(new URL("../src/lib/api/tournaments.ts",import.meta.url),"utf8");
const helper=src.slice(src.indexOf("async function assertLegacyTournamentMutationAllowed"),
 src.indexOf("// ── UTILIDADES"));
test("legacy tournament protection flag fails closed on unseen or league-affiliated rows",()=>{
 assert.match(helper,/GUARDED_LEAGUE_RPC_ENABLED/);
 assert.match(helper,/select\("league_id"\)/);
 assert.match(helper,/if \(error\) throw error/);
 assert.match(helper,/if \(!data\) throw new Error/);
 assert.match(helper,/if \(data\.league_id\)/);
});
test("legacy destructive RPC wrappers check the guarded league restriction before calling server",()=>{
 for(const [name,ends,rpc] of [
  ["deleteTournamentSafe","applyLeaguePoints","delete_tournament_god_mode"],
  ["prepareTournamentForReedit","", "reset_tournament_impact"]
 ]){
  const start=src.indexOf("export async function "+name);
  assert.ok(start>=0,"missing "+name);
  const stop=ends?src.indexOf("export async function "+ends,start+1):src.length;
  const body=src.slice(start,stop);
  const preflight=body.indexOf("await assertLegacyTournamentMutationAllowed(tournamentId)");
  const destructive=body.indexOf('supabase.rpc(\''+rpc+'\'');
  assert.ok(preflight>=0 && destructive>preflight,name+" must authorize before RPC");
 }
});
test("legacy client standings writer stops before read and DML under the security flag",()=>{
 const start=src.indexOf("export async function applyLeaguePoints");
 const stop=src.indexOf("export async function prepareTournamentForReedit",start);
 const body=src.slice(start,stop);
 assert.match(body,/if \(GUARDED_LEAGUE_RPC_ENABLED\)/);
 assert.ok(body.indexOf("if (GUARDED_LEAGUE_RPC_ENABLED)")<body.indexOf('.from("tournament_results")'));
 assert.match(body,/No se permiten escrituras de posiciones/);
});
