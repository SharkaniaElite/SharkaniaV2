/**
 * QA-only end-to-end of recalculate_league_standings_guarded through REAL
 * GoTrue authentication and PostgREST. Runs on a disposable Supabase local
 * stack inside GitHub Actions. Never accepts a non-loopback endpoint.
 * Does not reach remote Supabase, Cloudflare or real player data.
 */
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

const base=process.env.QA_SUPABASE_URL;
const anonKey=process.env.QA_SUPABASE_ANON_KEY;
const serviceKey=process.env.QA_SUPABASE_SERVICE_ROLE_KEY;
if (process.env.GITHUB_ACTIONS!=="true" ||
 base!=="http://127.0.0.1:25421" ||
 process.env.PGHOST!=="127.0.0.1" ||
 process.env.PGPORT!=="25422" || !anonKey || !serviceKey) {
  throw new Error("STOP: guarded standings real Auth requires ephemeral local-only Supabase");
}
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const safeUuid=x=>{assert.match(x,UUID);return "'"+x+"'::uuid";};
const sql=q=>execFileSync("psql",
 ["-X","-At","-v","ON_ERROR_STOP=1","-d","postgres","-c",q],
 {encoding:"utf8"}).trim();
const service=createClient(base,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
const suffix=randomBytes(6).toString("hex");
const actors={};
const clubA="00000000-0000-0000-0000-000000000021";
const clubB="00000000-0000-0000-0000-000000000022";
const leagueA="00000000-0000-0000-0000-000000000041";
const leagueB="00000000-0000-0000-0000-000000000042";
const existingPlayer="00000000-0000-0000-0000-000000000051";
const newPlayer="00000000-0000-0000-0000-000000000052";
for(const role of ["organizer","participant","player","superadmin"]) {
 const email="qa-standings-"+role+"-"+suffix+"@example.test";
 const password=randomBytes(23).toString("base64url");
 const create=await service.auth.admin.createUser({email,password,email_confirm:true});
 assert.ifError(create.error);
 const id=create.data.user.id;
 assert.match(id,UUID);
 sql("INSERT INTO public.profiles(id,role) VALUES ("+safeUuid(id)+",'"+
    (role==="superadmin"?"super_admin":"player")+"')");
 if(role==="organizer"||role==="participant") {
   const club=role==="organizer"?clubA:clubB;
   sql("INSERT INTO public.club_admins(club_id,user_id) VALUES ("+
       safeUuid(club)+","+safeUuid(id)+")");
 }
 const client=createClient(base,anonKey,{auth:{persistSession:false,autoRefreshToken:false}});
 const signin=await client.auth.signInWithPassword({email,password});
 assert.ifError(signin.error);
 assert.equal(signin.data.user.id,id);
 const token=signin.data.session?.access_token;
 assert.ok(token);
 const verify=await client.auth.getUser(token);
 assert.ifError(verify.error);
 assert.equal(verify.data.user.id,id);
 actors[role]={token};
}
console.log("PASS: authenticated with four real GoTrue QA accounts");

async function rpc(who,leagueId) {
 const response=await fetch(base+"/rest/v1/rpc/recalculate_league_standings_guarded",{
  method:"POST",headers:{"Content-Type":"application/json",apikey:anonKey,
   ...(who?{Authorization:"Bearer "+actors[who].token}:{})},
  body:JSON.stringify({p_league_id:leagueId}),
  signal:AbortSignal.timeout(15000)
 });
 const raw=await response.text();
 let data;try{data=JSON.parse(raw)}catch{data=raw}
 return {status:response.status,data};
}
function expectCode(r,code,label) {
 assert.equal(r.status,code,label+" "+JSON.stringify(r.data).slice(0,280));
 console.log("PASS: "+label+" HTTP "+code);
}
const auditBefore=sql("SELECT count(*)::text||':'||coalesce(sum(elo_rating),0)::text FROM public.players");
const resultsBefore=sql("SELECT count(*) FROM public.tournament_results");
const historyBefore=sql("SELECT count(*) FROM public.elo_history");
const originalId=safeUuid("00000000-0000-0000-0000-000000000061");
const orphanId=safeUuid("00000000-0000-0000-0000-000000000062");
const originalSnapshot=sql("SELECT id::text||':'||coalesce(ccp_club,'')||':'||total_buy_ins_spent::text||':'||last_tournament_id::text FROM public.league_standings WHERE id="+originalId);
const orphanSnapshot=sql("SELECT id::text||':'||total_points::text||':'||coalesce(ccp_club,'') FROM public.league_standings WHERE id="+orphanId);
const allBefore=sql("SELECT count(*) FROM public.league_standings");

expectCode(await rpc(null,leagueA),401,"anonymous cannot execute privileged recalculation");
expectCode(await rpc("player",leagueA),403,"ordinary player cannot recalculate");
expectCode(await rpc("participant",leagueA),403,"secondary club admin cannot recalculate organizer league");
expectCode(await rpc("organizer",leagueB),403,"club A admin cannot recalculate club B league");
assert.equal(sql("SELECT count(*) FROM public.league_standings"),allBefore,"forbidden calls cannot mutate standings");

const first=await rpc("organizer",leagueA);
expectCode(first,200,"real-session club A organizer may recalculate league A");
assert.equal(first.data,2,"must update old and insert new players");
assert.equal(sql("SELECT total_points::text||':'||tournaments_played::text||':'||best_position::text||':'||rank_position::text FROM public.league_standings WHERE id="+originalId),
 "30:2:1:1","top-one scoring and preserved identity");
assert.equal(sql("SELECT id::text||':'||coalesce(ccp_club,'')||':'||total_buy_ins_spent::text||':'||last_tournament_id::text FROM public.league_standings WHERE id="+originalId),
 originalSnapshot,"existing CCP, registrations and last tournament must remain locked");
assert.equal(sql("SELECT total_points::text||':'||tournaments_played::text||':'||rank_position::text||':'||ccp_club||':'||total_buy_ins_spent::text FROM public.league_standings WHERE league_id="+safeUuid(leagueA)+" AND player_id="+safeUuid(newPlayer)),
 "20:2:2:CCP-FIRST-52:5","new source candidate includes registration without CCP");
const newId=sql("SELECT id FROM public.league_standings WHERE league_id="+safeUuid(leagueA)+" AND player_id="+safeUuid(newPlayer));
assert.match(newId,UUID);

expectCode(await rpc("superadmin",leagueB),409,"orphan historical standing blocks even superadmin");
assert.equal(sql("SELECT id::text||':'||total_points::text||':'||coalesce(ccp_club,'') FROM public.league_standings WHERE id="+orphanId),orphanSnapshot);
const again=await rpc("superadmin",leagueA);
expectCode(again,200,"superadmin can repeat authorized calculation");
assert.equal(again.data,2);
assert.equal(sql("SELECT id FROM public.league_standings WHERE league_id="+safeUuid(leagueA)+" AND player_id="+safeUuid(newPlayer)),newId,"second calculation preserves new ID");
assert.equal(sql("SELECT id::text||':'||coalesce(ccp_club,'')||':'||total_buy_ins_spent::text||':'||last_tournament_id::text FROM public.league_standings WHERE id="+originalId),originalSnapshot);
assert.equal(sql("SELECT count(*) FROM public.league_standings WHERE league_id="+safeUuid(leagueA)),2);
assert.equal(sql("SELECT count(*) FROM public.tournament_results"),resultsBefore);
assert.equal(sql("SELECT count(*) FROM public.elo_history"),historyBefore);
assert.equal(sql("SELECT count(*)::text||':'||coalesce(sum(elo_rating),0)::text FROM public.players"),auditBefore);
console.log("PASS FINAL: guarded standings over real GoTrue JWT and PostgREST, fully isolated");
