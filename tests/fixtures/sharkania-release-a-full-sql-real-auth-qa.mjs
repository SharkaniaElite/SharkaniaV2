/**
 * REAL, LOCAL GoTrue/PostgREST exercise of the ONE Release A SQL candidate.
 * Separate from preexisting _qa prototype/alias tests.
 * Only github Actions 127.0.0.1 fake identities; NEVER touch production.
 */
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

const url=process.env.QA_SUPABASE_URL;
const anon=process.env.QA_SUPABASE_ANON_KEY;
const service=process.env.QA_SUPABASE_SERVICE_ROLE_KEY;
if (process.env.GITHUB_ACTIONS!=="true" ||
    url!=="http://127.0.0.1:25421" ||
    process.env.PGHOST!=="127.0.0.1" ||
    process.env.PGPORT!=="25422" ||
    !anon || !service) {
  throw Error("STOP: complete Release A JWT verification requires isolated 127.0.0.1 QA");
}
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const quotedId=x=>{assert.match(x,UUID);return "'"+x+"'::uuid";};
const sql=query=>execFileSync("psql",["-X","-At","-v","ON_ERROR_STOP=1","-d","postgres","-c",query],{encoding:"utf8"}).trim();
const A="00000000-0000-0000-0000-000000000021";
const B="00000000-0000-0000-0000-000000000022";
const league="00000000-0000-0000-0000-000000000041";
const room="00000000-0000-0000-0000-000000000031";
const tour="00000000-0000-0000-0000-000000000096";
const nonleague="00000000-0000-0000-0000-000000000012";
const p1="00000000-0000-0000-0000-000000000051";
const nonce=randomBytes(5).toString("hex");
const newName="QAReleaseA"+nonce;
const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
const actors={};
for(const kind of ["owner","secondary","player","superadmin"]){
  const email="qa-release-a-"+kind+"-"+nonce+"@example.test";
  const password=randomBytes(24).toString("base64url");
  const created=await admin.auth.admin.createUser({email,password,email_confirm:true});
  assert.ifError(created.error);
  const id=created.data.user.id;
  const role=kind==="superadmin"?"super_admin":"player";
  sql("INSERT INTO public.profiles(id,role) VALUES("+quotedId(id)+",'"+role+"')");
  if(kind==="owner"||kind==="secondary"){
    sql("INSERT INTO public.club_admins(club_id,user_id) VALUES("+
      quotedId(kind==="owner"?A:B)+","+quotedId(id)+")");
  }
  const client=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}});
  const session=await client.auth.signInWithPassword({email,password});
  assert.ifError(session.error);
  assert.equal(session.data.user.id,id);
  const jwt=session.data.session?.access_token;
  assert.ok(jwt);
  const get=await client.auth.getUser(jwt);
  assert.ifError(get.error);
  actors[kind]={id,token:jwt};
}
console.log("PASS: 4 genuine local GoTrue accounts authenticated with verified JWT");

async function rest(path,method,role,body){
 const resp=await fetch(url+"/rest/v1/"+path,{
  method,
  headers:{"Content-Type":"application/json",apikey:anon,
    ...(role?{Authorization:"Bearer "+actors[role].token}:{}),
    ...(method==="PATCH"?{"Prefer":"return=representation"}:{})},
  ...(body===undefined?{}:{body:JSON.stringify(body)}),
  signal:AbortSignal.timeout(15000)
 });
 const raw=await resp.text();
 let data;try{data=JSON.parse(raw)}catch{data=raw}
 return {status:resp.status,data};
}
const results=[
 {nickname:"  SHARKHERO  ",position:1,prize_won:15,bounties_won:2,
  league_points_earned:30,ccp_club:"QA",buy_ins_count:2},
 {nickname:newName,position:2,prize_won:0,bounties_won:0,
  league_points_earned:10,ccp_club:null,buy_ins_count:1}
];
const rpc=(kind,body=results)=>rest("rpc/publish_league_nickname_results_guarded","POST",kind,
 {p_tournament_id:tour,p_results:body});
const denied=(response,statuses,why)=>{
 assert.ok(statuses.includes(response.status),
   why+" expected "+statuses+" but got "+response.status+": "+JSON.stringify(response.data).slice(0,360));
 console.log("PASS: "+why+" denied HTTP "+response.status);
};

denied(await rpc(null),[401,403],"anon cannot invoke real Release A writer");
denied(await rpc("player"),[403],"unrelated player cannot publish");
denied(await rpc("secondary"),[403],"non-primary club admin cannot publish");
denied(await rpc("owner",[results[0],{...results[1],position:1}]),[422],
 "duplicate finishing positions");
denied(await rpc("owner",[results[0],{...results[1],player_id:p1}]),[422],
 "untrusted client player_id");
assert.equal(sql("SELECT count(*) FROM public.tournament_results WHERE tournament_id="+quotedId(tour)),"0");
assert.equal(sql("SELECT count(*) FROM sharkania_release.elo_publication WHERE tournament_id="+quotedId(tour)),"0");

const success=await rpc("owner");
assert.equal(success.status,200,"primary owner should publish via REAL public function: "+
 JSON.stringify(success.data).slice(0,500));
assert.equal(success.data.status,"published");
assert.equal(success.data.currency,"USD");
assert.equal(success.data.new_players,1);
assert.equal(success.data.currency_postings,2);
assert.equal(sql("SELECT count(*) FROM public.tournament_results WHERE tournament_id="+quotedId(tour)),"2");
assert.equal(sql("SELECT count(*) FROM public.elo_history WHERE tournament_id="+quotedId(tour)),"2");
assert.equal(sql("SELECT count(*) FROM sharkania_release.elo_player_checkpoint WHERE publication_id=("+
 "SELECT id FROM sharkania_release.elo_publication WHERE tournament_id="+quotedId(tour)+")"),"2");
assert.equal(sql("SELECT count(*) FROM sharkania_release.currency_posting WHERE tournament_id="+quotedId(tour)),"2");
assert.equal(sql("SELECT results_uploaded::text FROM public.tournaments WHERE id="+quotedId(tour)),"true");
denied(await rpc("owner"),[409],"duplicate first publication / double ELO");
assert.equal(sql("SELECT count(*) FROM sharkania_release.elo_publication WHERE tournament_id="+quotedId(tour)),"1");
console.log("PASS: exact consolidated candidate SQL over genuine local JWT, no QA alias");

// The next two requests are INTENTIONALLY expected vulnerabilities until the
// standalone tournament and shared Elo writers are moved server-side.
// Roles/policies below were added locally to simulate the production catalog.
const ownPlayer="00000000-0000-0000-0000-000000000191";
sql("INSERT INTO public.players(id,profile_id,room_id,nickname,country_code,slug) VALUES("+
 quotedId(ownPlayer)+","+quotedId(actors.player.id)+","+quotedId(room)+
 ",'QAOwn"+nonce+"','CL','qa-own-"+nonce+"')");
const patch=await rest("players?id=eq."+ownPlayer,"PATCH","player",{elo_rating:4321});
assert.equal(patch.status,200,"locally recreated owner UPDATE policy should show NO-GO risk: "+
 JSON.stringify(patch.data).slice(0,360));
assert.equal(patch.data[0]?.elo_rating,4321);
const insertNonleague=await rest("elo_history","POST","player",{
 tournament_id:nonleague,player_id:ownPlayer,elo_before:1200,elo_after:4321,elo_change:3121
});
assert.equal(insertNonleague.status,201,
 "locally recreated ANY-authenticated INSERT policy should reproduce NO-GO risk: "+
 JSON.stringify(insertNonleague.data).slice(0,360));
console.warn("RELEASE A NO GO: real local GoTrue player changed their Elo and inserted non-league Elo via REST");

// League rows remain protected by this candidate's guards even when broad REST
// grants and policies have been simulated (as in production).
const insertLeague=await rest("elo_history","POST","player",{
 tournament_id:tour,player_id:ownPlayer,elo_before:1200,elo_after:9999,elo_change:8799
});
denied(insertLeague,[409],"linked league Elo direct REST insert remains denied");
console.log("PASS FINAL: real local GoTrue and PostgREST validated full SQL; shared Elo weakness remains explicit NO GO");
