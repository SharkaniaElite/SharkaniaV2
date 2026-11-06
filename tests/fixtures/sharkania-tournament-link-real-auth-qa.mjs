/**
 * SHARKANIA QA: real Supabase GoTrue + PostgREST for the tournament / league
 * ownership trigger. Local-only Supabase Docker service, no production data.
 */
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

const base=process.env.QA_SUPABASE_URL;
const anonKey=process.env.QA_SUPABASE_ANON_KEY;
const serviceKey=process.env.QA_SUPABASE_SERVICE_ROLE_KEY;
if(process.env.GITHUB_ACTIONS!=="true" || base!=="http://127.0.0.1:25421" ||
 process.env.PGHOST!=="127.0.0.1" || process.env.PGPORT!=="25422" ||
 !anonKey || !serviceKey) {
 throw Error("STOP: tournament ownership E2E requires disposable local-only Auth/PostgREST");
}
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const safeUuid=x=>{assert.match(x,UUID);return "'"+x+"'::uuid"};
const sql=q=>execFileSync("psql",["-X","-At","-v","ON_ERROR_STOP=1","-d","postgres","-c",q],
 {encoding:"utf8"}).trim();
const service=createClient(base,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
const nonce=randomBytes(5).toString("hex");
const identities={};
const clubA="00000000-0000-0000-0000-000000000021";
const clubB="00000000-0000-0000-0000-000000000022";
const leagueA="00000000-0000-0000-0000-000000000041";
const leagueB="00000000-0000-0000-0000-000000000042";
const tournamentA="00000000-0000-0000-0000-000000000011";
const tournamentB="00000000-0000-0000-0000-000000000012";
const newB="00000000-0000-0000-0000-000000000017";
const blockedB="00000000-0000-0000-0000-000000000018";

for(const role of ["organizer","participant","player","superadmin"]) {
 const email="qa-linked-"+role+"-"+nonce+"@example.test";
 const password=randomBytes(23).toString("base64url");
 const created=await service.auth.admin.createUser({email,password,email_confirm:true});
 assert.ifError(created.error);
 const id=created.data.user.id;
 assert.match(id,UUID);
 sql("INSERT INTO public.profiles(id,role) VALUES ("+safeUuid(id)+",'"+
    (role==="superadmin"?"super_admin":"player")+"')");
 if(role==="organizer"||role==="participant") {
  sql("INSERT INTO public.club_admins(club_id,user_id) VALUES ("+
     safeUuid(role==="organizer"?clubA:clubB)+","+safeUuid(id)+")");
 }
 const cli=createClient(base,anonKey,{auth:{persistSession:false,autoRefreshToken:false}});
 const login=await cli.auth.signInWithPassword({email,password});
 assert.ifError(login.error);
 assert.equal(login.data.user.id,id);
 const session=login.data.session;
 assert.ok(session?.access_token);
 const got=await cli.auth.getUser(session.access_token);
 assert.ifError(got.error);
 identities[role]=session.access_token;
}
console.log("PASS: four actual local GoTrue JWT sessions are valid");

const baseline=sql("SELECT club_id::text||':'||COALESCE(league_id::text,'NULL')||':'||buy_in::text FROM public.tournaments WHERE id="+safeUuid(tournamentB));
const resultsBefore=sql("SELECT count(*) FROM public.tournament_results");
const standingsBefore=sql("SELECT count(*) FROM public.league_standings");
const eloBefore=sql("SELECT count(*) FROM public.elo_history");

async function request(role,method,tournamentId,body) {
 const url=base+"/rest/v1/tournaments"+(tournamentId?"?id=eq."+tournamentId:"");
 const response=await fetch(url,{method,
  headers:{"Content-Type":"application/json",apikey:anonKey,
   ...(role?{Authorization:"Bearer "+identities[role]}:{})},
  body:JSON.stringify(body),
  signal:AbortSignal.timeout(20000)});
 const raw=await response.text();
 let data;try{data=JSON.parse(raw)}catch{data=raw}
 return {status:response.status,data};
}
function expect(res,status,title){
 assert.equal(res.status,status,title+": "+JSON.stringify(res.data).slice(0,350));
 console.log("PASS: "+title+" ["+status+"]");
}
expect(await request("participant","PATCH",tournamentB,{league_id:leagueA}),
 403,"secondary club cannot assign its tournament to organizer A league");
assert.equal(sql("SELECT club_id::text||':'||COALESCE(league_id::text,'NULL')||':'||buy_in::text FROM public.tournaments WHERE id="+safeUuid(tournamentB)),baseline);

expect(await request("participant","POST",null,{id:blockedB,club_id:clubB,buy_in:10,league_id:leagueA}),
 403,"secondary club cannot INSERT tournament into organizer A league");
assert.equal(sql("SELECT count(*) FROM public.tournaments WHERE id="+safeUuid(blockedB)),"0");

expect(await request("player","PATCH",tournamentB,{league_id:leagueB}),
 204,"ordinary player cannot see or edit foreign tournament (RLS zero rows)");
assert.equal(sql("SELECT club_id::text||':'||COALESCE(league_id::text,'NULL')||':'||buy_in::text FROM public.tournaments WHERE id="+safeUuid(tournamentB)),baseline);

expect(await request("participant","PATCH",tournamentB,{league_id:leagueB}),
 204,"primary B admin can link its own tournament to league B");
assert.equal(sql("SELECT league_id::text FROM public.tournaments WHERE id="+safeUuid(tournamentB)),leagueB);

expect(await request("participant","PATCH",tournamentB,{buy_in:16}),
 204,"primary B can edit normal buy-in metadata without changing league link");
expect(await request("participant","POST",null,{id:newB,club_id:clubB,buy_in:3.30,league_id:leagueB}),
 201,"primary B can create linked tournament in league B");
assert.equal(sql("SELECT league_id::text FROM public.tournaments WHERE id="+safeUuid(newB)),leagueB);

expect(await request("superadmin","PATCH",tournamentB,{league_id:leagueA}),
 403,"superadmin cannot put B-owned tournament into league A");
assert.equal(sql("SELECT league_id::text FROM public.tournaments WHERE id="+safeUuid(tournamentB)),leagueB);

expect(await request("participant","PATCH",tournamentB,{league_id:null}),
 204,"primary B can detach own tournament");
assert.equal(sql("SELECT COALESCE(league_id::text,'NULL') FROM public.tournaments WHERE id="+safeUuid(tournamentB)),"NULL");
expect(await request("organizer","PATCH",tournamentA,{league_id:null}),
 204,"organizer A can detach its own tournament");
expect(await request("organizer","PATCH",tournamentA,{league_id:leagueA}),
 204,"organizer A can restore its own league link");

assert.equal(sql("SELECT count(*) FROM public.tournament_results"),resultsBefore);
assert.equal(sql("SELECT count(*) FROM public.league_standings"),standingsBefore);
assert.equal(sql("SELECT count(*) FROM public.elo_history"),eloBefore);
console.log("PASS FINAL: server-side association protects primary club using REAL Auth over PostgREST in isolated stack");
