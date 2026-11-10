/**
 * Full SQL Release A + ELO v2 FX over LOCAL GoTrue and PostgREST.
 * Four genuine ephemeral JWTs; no user data, production or external secrets.
 */
import assert from "node:assert/strict";
import {randomBytes} from "node:crypto";
import {execFileSync} from "node:child_process";
import {createClient} from "@supabase/supabase-js";
const base=process.env.QA_SUPABASE_URL;
const anon=process.env.QA_SUPABASE_ANON_KEY;
const service=process.env.QA_SUPABASE_SERVICE_ROLE_KEY;
if(process.env.GITHUB_ACTIONS!=="true" ||
 base!=="http://127.0.0.1:25421" ||
 process.env.PGHOST!=="127.0.0.1" ||
 process.env.PGPORT!=="25422" || !anon || !service)
 throw Error("STOP: this test is restricted to loopback isolated Supabase");
const sql=q=>execFileSync("psql",["-X","-At","-v","ON_ERROR_STOP=1",
 "-d","postgres","-c",q],{encoding:"utf8"}).trim();
const A="00000000-0000-0000-0000-000000000021";
const B="00000000-0000-0000-0000-000000000022";
const tCLP="00000000-0000-0000-0000-000000000150";
const tEUR="00000000-0000-0000-0000-000000000151";
const tUSD="00000000-0000-0000-0000-000000000152";
const tLeague="00000000-0000-0000-0000-000000000153";
const tNoFX="00000000-0000-0000-0000-000000000154";
const tV1="00000000-0000-0000-0000-000000000155";
const nonce=randomBytes(7).toString("hex");
const admin=createClient(base,service,{auth:{persistSession:false,autoRefreshToken:false}});
const tokens={};const ids={};
for(const type of ["owner","secondary","player","superadmin"]){
 const email="qa-v2-"+type+"-"+nonce+"@example.test";
 const password=randomBytes(24).toString("base64url");
 const made=await admin.auth.admin.createUser({email,password,email_confirm:true});
 assert.ifError(made.error);
 const id=made.data.user.id;
 ids[type]=id;
 sql("INSERT INTO public.profiles(id,role) VALUES('"+id+"','"+
 (type==="superadmin"?"super_admin":"player")+"')");
 if(type==="owner"||type==="secondary"){
  sql("INSERT INTO public.club_admins(club_id,user_id) VALUES('"+
   (type==="owner"?A:B)+"','"+id+"')");
 }
 const client=createClient(base,anon,{auth:{persistSession:false,autoRefreshToken:false}});
 const login=await client.auth.signInWithPassword({email,password});
 assert.ifError(login.error);
 assert.equal(login.data.user.id,id);
 assert.ifError((await client.auth.getUser(login.data.session.access_token)).error);
 tokens[type]=login.data.session.access_token;
}
console.log("PASS: 4 genuine local GoTrue accounts and verified JWT");
const parse=t=>{try{return JSON.parse(t)}catch{return t}};
async function request(path,role,body,method="POST"){
 const response=await fetch(base+"/rest/v1/"+path,{
  method,headers:{apikey:anon,"Content-Type":"application/json",
  ...(role?{Authorization:"Bearer "+tokens[role]}:{})},
  ...(body===undefined?{}:{body:JSON.stringify(body)}),
  signal:AbortSignal.timeout(15000)
 });
 return {status:response.status,data:parse(await response.text())};
}
function expect(response,allowed,label){
 assert.ok(allowed.includes(response.status),
  label+" unexpected HTTP "+response.status+" "+JSON.stringify(response.data).slice(0,500));
 console.log("PASS: "+label+" HTTP "+response.status);
}
function payload(prefix,prize){
 return [
 {nickname:prefix+"First"+nonce,position:1,prize_won:prize,
  bounties_won:0,league_points_earned:0,buy_ins_count:2},
 {nickname:prefix+"Second"+nonce,position:2,prize_won:0,
  bounties_won:0,league_points_earned:0,buy_ins_count:1}
 ];
}
const pub=(id,kind,role,rows)=>request(
 kind==="league"?"rpc/publish_league_nickname_results_v2_guarded"
 :"rpc/publish_independent_nickname_results_v2_guarded",
 role,{p_tournament_id:id,p_results:rows}
);
const clp=payload("CLP",12000);
const eur=payload("EUR",15);
const usd=payload("USD",12);
const league=payload("League",30000);
league[0].league_points_earned=50;
league[1].league_points_earned=10;

expect(await pub(tCLP,"ind","",clp),[401,403],"anonymous rejected by v2");
expect(await pub(tCLP,"ind","player",clp),[403],"player rejected by v2");
expect(await pub(tCLP,"ind","secondary",clp),[403],"foreign organizer rejected by v2");
expect(await pub(tCLP,"ind","owner",[{...clp[0],fx_rate:1},clp[1]]),
 [422],"browser-provided FX rate rejected");
expect(await pub(tCLP,"ind","owner",[{...clp[0],currency:"USD"},clp[1]]),
 [422],"browser-forged currency rejected");
expect(await pub(tNoFX,"ind","owner",payload("NoFX",9)),[409],
 "official rate not captured before historical tournament, fail closed");
const clpResponse=await pub(tCLP,"ind","owner",clp);
expect(clpResponse,[200],"CLP first publication through genuine local JWT");
assert.equal(clpResponse.data.algorithm_version,"elo-v2-usd-normalized");
assert.equal(clpResponse.data.currency,"CLP");
assert.ok(Math.abs(clpResponse.data.buy_in_usd-10)<0.00001);
const eurResponse=await pub(tEUR,"ind","owner",eur);
expect(eurResponse,[200],"EUR first publication through genuine local JWT");
assert.equal(eurResponse.data.algorithm_version,"elo-v2-usd-normalized");
assert.ok(Math.abs(eurResponse.data.buy_in_usd-10)<0.02);
const usdResponse=await pub(tUSD,"ind","owner",usd);
expect(usdResponse,[200],"USD first publication through genuine local JWT");
assert.equal(usdResponse.data.buy_in_usd,10);
const leagueResponse=await pub(tLeague,"league","owner",league);
expect(leagueResponse,[200],"league CLP first publication through genuine local JWT");
assert.equal(leagueResponse.data.algorithm_version,"elo-v2-usd-normalized");
assert.equal(leagueResponse.data.currency,"CLP");
expect(await pub(tCLP,"ind","owner",clp),[409],"repeated publication blocked");

expect(await request("rpc/sharkania_fx_ingest_official_v2","player",{
 p_currency:"CLP",p_effective_date:"2026-11-09",p_quote:1,
 p_raw_sha256:"a".repeat(64),p_reference_id:"CLIENT:FORGED"
}),[401,403,404],"logged-in user cannot invent official exchange rate");

const old=await request("rpc/publish_independent_nickname_results_guarded","owner",{
 p_tournament_id:tV1,p_results:payload("Old",3)
});
expect(old,[409],"legacy ELO v1 RPC blocked after activation");

assert.equal(sql("SELECT count(*) FROM sharkania_release.elo_v2_event_fx"),"4");
assert.equal(sql("SELECT count(*) FROM sharkania_release.independent_elo_publication WHERE algorithm_version='elo-v2-usd-normalized'"),"3");
assert.equal(sql("SELECT count(*) FROM sharkania_release.elo_publication WHERE algorithm_version='elo-v2-usd-normalized'"),"1");
const left=sql("SELECT coalesce(min(elo_change),0) FROM public.tournament_results WHERE tournament_id='"+tCLP+"' AND position=1");
const right=sql("SELECT coalesce(min(elo_change),0) FROM public.tournament_results WHERE tournament_id='"+tUSD+"' AND position=1");
assert.ok(Math.abs(Number(left)-Number(right))<=0.01,
 "currency normalized ELO differs CLP vs USD");
assert.equal(Number(sql("SELECT total_prize_won FROM public.players WHERE nickname='CLPFirst"+nonce+"'")),0);
assert.equal(sql("SELECT currency FROM sharkania_release.independent_currency_posting WHERE tournament_id='"+tCLP+"' LIMIT 1"),"CLP");
assert.equal(sql("SELECT count(*) FROM public.tournament_results WHERE tournament_id='"+tNoFX+"'"),"0");
assert.equal(sql("SELECT count(*) FROM public.tournament_results WHERE tournament_id='"+tV1+"'"),"0");
console.log("PASS FINAL: genuine GoTrue/PostgREST HTTP v2 league and independent USD/CLP/EUR, source immutability, ACL, cutover and equal Elo");
