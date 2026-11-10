/**
 * New league nickname writer through genuine LOCAL GoTrue JWT + PostgREST.
 * NEVER use remote host, real accounts, linked projects or production tokens.
 * This is additive to previous Release A Auth tests.
 */
import assert from "node:assert/strict";
import {randomBytes} from "node:crypto";
import {execFileSync} from "node:child_process";
import {createClient} from "@supabase/supabase-js";

const base=process.env.QA_SUPABASE_URL;
const anon=process.env.QA_SUPABASE_ANON_KEY;
const service=process.env.QA_SUPABASE_SERVICE_ROLE_KEY;
if(process.env.GITHUB_ACTIONS!=="true"||
   base!=="http://127.0.0.1:25421"||
   process.env.PGHOST!=="127.0.0.1"||
   process.env.PGPORT!=="25422"||!anon||!service)
   throw Error("STOP: only isolated local Supabase GoTrue/PostgREST allowed");
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const safeUuid=x=>{assert.match(x,UUID);return "'"+x+"'::uuid";};
const sql=q=>execFileSync("psql",["-X","-At","-v","ON_ERROR_STOP=1","-d","postgres","-c",q],{encoding:"utf8"}).trim();
const clubA="00000000-0000-0000-0000-000000000021";
const clubB="00000000-0000-0000-0000-000000000022";
const leagueA="00000000-0000-0000-0000-000000000041";
const roomA="00000000-0000-0000-0000-000000000031";
const tour="00000000-0000-0000-0000-000000000096";
const p1="00000000-0000-0000-0000-000000000051";
const nonce=randomBytes(6).toString("hex");
const newName="QARealNick"+nonce;
const tokens={};
const admin=createClient(base,service,{auth:{persistSession:false,autoRefreshToken:false}});
for(const role of ["organizer","secondary","player"]){
  const email="qa-nickname-"+role+"-"+nonce+"@example.test";
  const password=randomBytes(24).toString("base64url");
  const created=await admin.auth.admin.createUser({email,password,email_confirm:true});
  assert.ifError(created.error);
  const id=created.data.user.id;
  assert.match(id,UUID);
  sql("INSERT INTO public.profiles(id,role) VALUES("+safeUuid(id)+",'player')");
  if(role!=="player"){
    sql("INSERT INTO public.club_admins(club_id,user_id) VALUES("+
      safeUuid(role==="organizer"?clubA:clubB)+","+safeUuid(id)+")");
  }
  const client=createClient(base,anon,{auth:{persistSession:false,autoRefreshToken:false}});
  const logged=await client.auth.signInWithPassword({email,password});
  assert.ifError(logged.error);
  assert.equal(logged.data.user.id,id);
  const jwt=logged.data.session?.access_token;
  assert.ok(jwt);
  const verify=await client.auth.getUser(jwt);
  assert.ifError(verify.error);
  assert.equal(verify.data.user.id,id);
  tokens[role]=jwt;
}
console.log("PASS: 3 actual local GoTrue sessions for primary, secondary and player");

// The local tournament-link trigger requires a genuine organizer JWT.
// Create the tournament through PostgREST, never by bypassing the trigger
// with an unauthenticated owner SQL insertion.
const inserted=await fetch(base+"/rest/v1/tournaments",{
  method:"POST",
  headers:{"Content-Type":"application/json",apikey:anon,
    Authorization:"Bearer "+tokens.organizer},
  body:JSON.stringify({
    id:tour,club_id:clubA,league_id:leagueA,room_id:roomA,
    buy_in:3.30,currency:"USD",start_datetime:"2026-11-12T22:00:00Z"
  }),signal:AbortSignal.timeout(15000)
});
assert.equal(inserted.status,201,
  "authorized local organizer must create tournament via real PostgREST: "+(await inserted.text()).slice(0,300));

async function invoke(role,results){
 const response=await fetch(base+"/rest/v1/rpc/publish_league_nickname_results_guarded_qa",{
    method:"POST",
    headers:{"Content-Type":"application/json",apikey:anon,
      ...(role?{Authorization:"Bearer "+tokens[role]}:{})},
    body:JSON.stringify({p_tournament_id:tour,p_results:results}),
    signal:AbortSignal.timeout(15000)
 });
 const raw=await response.text();let data;
 try{data=JSON.parse(raw)}catch{data=raw}
 return {status:response.status,data};
}
function expect(result,code,what){
 assert.equal(result.status,code,what+": "+JSON.stringify(result.data).slice(0,450));
 console.log("PASS: "+what+" HTTP "+code);
}
const results=[
 {nickname:" sHarkhEro ",position:1,prize_won:15,bounties_won:2,
   league_points_earned:30,ccp_club:"QA",buy_ins_count:2},
 {nickname:newName,position:2,prize_won:0,bounties_won:0,
   league_points_earned:10,ccp_club:null,buy_ins_count:1}
];

expect(await invoke(null,results),401,"anonymous denied by RPC grants");
expect(await invoke("player",results),403,"unprivileged player cannot create nicknames/results");
expect(await invoke("secondary",results),403,"secondary club cannot publish primary organizer league");
expect(await invoke("organizer",[results[0],{...results[1],position:1}]),
 422,"duplicated finish positions rejected");
expect(await invoke("organizer",[results[0],{...results[1],player_id:p1}]),
 422,"spoofed CSV player ID rejected");

assert.equal(sql("SELECT count(*) FROM public.players WHERE nickname='"+newName+"'"),"0");
assert.equal(sql("SELECT count(*) FROM public.tournament_results WHERE tournament_id="+safeUuid(tour)),"0");
assert.equal(sql("SELECT count(*) FROM sharkania_release_qa.currency_posting WHERE tournament_id="+safeUuid(tour)),"0");
assert.equal(sql("SELECT count(*) FROM sharkania_release_qa.elo_publication WHERE tournament_id="+safeUuid(tour)),"0");

const done=await invoke("organizer",results);
expect(done,200,"primary organizer publishes with actual GoTrue JWT over PostgREST");
assert.equal(done.data.status,"published");
assert.equal(done.data.currency,"USD");
assert.equal(done.data.new_players,1);
assert.equal(done.data.currency_postings,2);
assert.equal(sql("SELECT count(*) FROM public.players WHERE room_id="+safeUuid(roomA)+
 " AND lower(btrim(nickname))='sharkhero'"),"1","existing normalized nickname must not duplicate");
assert.equal(sql("SELECT count(*) FROM public.players WHERE nickname='"+newName+
 "' AND room_id="+safeUuid(roomA)+" AND profile_id IS NULL AND country_code='CL'"),"1");
assert.equal(sql("SELECT count(*) FROM public.tournament_results WHERE tournament_id="+safeUuid(tour)),"2");
assert.equal(sql("SELECT count(*) FROM public.elo_history WHERE tournament_id="+safeUuid(tour)),"2");
assert.equal(sql("SELECT count(*) FROM sharkania_release_qa.elo_publication WHERE tournament_id="+safeUuid(tour)),"1");
assert.equal(sql("SELECT count(*) FROM sharkania_release_qa.currency_posting WHERE tournament_id="+safeUuid(tour)),"2");
assert.equal(sql("SELECT count(*) FROM sharkania_release_qa.currency_posting WHERE tournament_id="+safeUuid(tour)+
 " AND player_id="+safeUuid(p1)+" AND currency='USD' AND buy_ins_count=2 AND entry_spend=6.60"),"1");
assert.equal(sql("SELECT results_uploaded::text FROM public.tournaments WHERE id="+safeUuid(tour)),"true");

expect(await invoke("organizer",results),409,"repeat results publication denied, no double ELO");
assert.equal(sql("SELECT count(*) FROM sharkania_release_qa.elo_publication WHERE tournament_id="+safeUuid(tour)),"1");
assert.equal(sql("SELECT count(*) FROM public.players WHERE nickname='"+newName+"'"),"1");
console.log("PASS FINAL: actual isolated JWT, PostgREST grants, nickname identity and atomic financial ledger");


// Proposed VERSION v2 is tested only in isolated local GoTrue + PostgREST.
// No live code selects this function: sports policy/date remain unapproved.
const future=[
 {league:"00000000-0000-0000-0000-000000000046",
  tournament:"00000000-0000-0000-0000-000000000112",club:clubA,
  role:"organizer",currency:"CLP",buyIn:3300,prize:7000,entries:2},
 {league:"00000000-0000-0000-0000-000000000047",
  tournament:"00000000-0000-0000-0000-000000000113",club:clubB,
  role:"secondary",currency:"EUR",buyIn:12,prize:30,entries:3}
];
for(const x of future){
 sql("INSERT INTO public.leagues(id,name,slug) VALUES("+
    safeUuid(x.league)+",'QA v2 "+x.currency+"',"+
    "'qa-v2-real-auth-"+x.currency.toLowerCase()+"-"+nonce+"')");
 sql("INSERT INTO public.league_clubs(league_id,club_id,is_primary) VALUES("+
    safeUuid(x.league)+","+safeUuid(x.club)+",true)");
 sql("INSERT INTO public.league_rooms(league_id,room_id) VALUES("+
    safeUuid(x.league)+","+safeUuid(roomA)+")");
 const tRes=await fetch(base+"/rest/v1/tournaments",{
  method:"POST",
  headers:{"Content-Type":"application/json",apikey:anon,
    Authorization:"Bearer "+tokens[x.role]},
  body:JSON.stringify({id:x.tournament,club_id:x.club,league_id:x.league,
    room_id:roomA,buy_in:x.buyIn,currency:x.currency,
    start_datetime:"2026-11-24T20:00:00Z"}),
  signal:AbortSignal.timeout(15000)
 });
 assert.equal(tRes.status,201,
  "v2 synthetic "+x.currency+" tournament should be created by own club JWT: "+
  (await tRes.text()).slice(0,300));
 const n1="QA_v2_"+x.currency+"_A_"+nonce,n2="QA_v2_"+x.currency+"_B_"+nonce;
 const body=[
  {nickname:n1,position:1,prize_won:x.prize,bounties_won:0,
   league_points_earned:20,buy_ins_count:x.entries},
  {nickname:n2,position:2,prize_won:0,bounties_won:0,
   league_points_earned:10,buy_ins_count:1}
 ];
 const callV2=async role=>{
  const res=await fetch(base+"/rest/v1/rpc/publish_league_nickname_results_v2_qa",{
   method:"POST",headers:{"Content-Type":"application/json",apikey:anon,
    ...(role?{Authorization:"Bearer "+tokens[role]}:{})},
   body:JSON.stringify({p_tournament_id:x.tournament,p_results:body}),
   signal:AbortSignal.timeout(15000)
  });
  const raw=await res.text();let data;
  try{data=JSON.parse(raw)}catch{data=raw}
  return {status:res.status,data};
 };
 expect(await callV2(null),401,"v2 candidate anonymous blocked for "+x.currency);
 const other=x.role==="organizer"?"secondary":"organizer";
 expect(await callV2(other),403,"v2 other primary organizer blocked for "+x.currency);
 const ok=await callV2(x.role);
 expect(ok,200,"v2 "+x.currency+" candidate published over actual JWT");
 assert.equal(ok.data.status,"published");
 assert.equal(ok.data.new_players,2);
 assert.equal(ok.data.currency,x.currency);
 assert.equal(ok.data.currency_postings,2);
 assert.equal(sql("SELECT count(*) FROM sharkania_release_qa.elo_publication "+
  "WHERE tournament_id="+safeUuid(x.tournament)+
  " AND algorithm_version='currency-neutral-v2-PROPOSAL'"),"1");
 assert.equal(sql("SELECT count(*) FROM public.elo_history "+
  "WHERE tournament_id="+safeUuid(x.tournament)),"2");
 assert.equal(sql("SELECT count(*) FROM sharkania_release_qa.currency_posting "+
  "WHERE tournament_id="+safeUuid(x.tournament)),"2");
 const expectedSpend=x.buyIn*x.entries;
 assert.equal(sql("SELECT count(*) FROM sharkania_release_qa.currency_posting cp "+
  "JOIN public.players p ON cp.player_id=p.id WHERE cp.tournament_id="+
  safeUuid(x.tournament)+" AND p.nickname='"+n1+"' AND cp.currency='"+
  x.currency+"' AND cp.entry_spend="+expectedSpend+
  " AND cp.buy_ins_count="+x.entries), "1");
 assert.equal(sql("SELECT count(*) FROM public.players WHERE nickname='"+n1+
  "' AND elo_rating=1220.90 AND total_prize_won=0 "+
  "AND total_buy_ins_spent=0"),"1");
 expect(await callV2(x.role),409,"v2 candidate duplicate prevented for "+x.currency);
}
console.log("PASS FINAL: QA v2 prospective CLP EUR authenticated, no FX aggregation or ELO duplicates");
