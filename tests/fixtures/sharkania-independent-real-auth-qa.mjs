/**
 * PR #96: direct HTTP tests for the COMPLETE Release A + independent SQL and
 * client ACL cutover with genuine LOCAL GoTrue JWT and PostgREST.
 * NO remote hosts, user accounts, project keys or production writes.
 */
import assert from "node:assert/strict";
import {randomBytes} from "node:crypto";
import {execFileSync} from "node:child_process";
import {createClient} from "@supabase/supabase-js";

const base=process.env.QA_SUPABASE_URL;
const anon=process.env.QA_SUPABASE_ANON_KEY;
const service=process.env.QA_SUPABASE_SERVICE_ROLE_KEY;
if(process.env.GITHUB_ACTIONS!=="true" || base!=="http://127.0.0.1:25421" ||
  process.env.PGHOST!=="127.0.0.1" || process.env.PGPORT!=="25422" ||
  !anon || !service) throw Error("STOP: isolated 127.0.0.1 GoTrue/PostgREST only");

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const safeId=x=>{assert.match(x,UUID);return "'"+x+"'::uuid";};
const sql=q=>execFileSync("psql",["-X","-At","-v","ON_ERROR_STOP=1",
  "-d","postgres","-c",q],{encoding:"utf8"}).trim();
const A="00000000-0000-0000-0000-000000000021";
const B="00000000-0000-0000-0000-000000000022";
const room="00000000-0000-0000-0000-000000000031";
const p1="00000000-0000-0000-0000-000000000051";
const t1="00000000-0000-0000-0000-000000000097";
const t2="00000000-0000-0000-0000-000000000102";
const nonce=randomBytes(6).toString("hex");
const fresh="QANonleague"+nonce;
const admin=createClient(base,service,{auth:{persistSession:false,autoRefreshToken:false}});
const tokens={};
const userIds={};
for(const type of ["owner","secondary","player","superadmin"]){
 const email="qa-nonleague-"+type+"-"+nonce+"@example.test";
 const password=randomBytes(24).toString("base64url");
 const created=await admin.auth.admin.createUser({email,password,email_confirm:true});
 assert.ifError(created.error);
 const id=created.data.user.id;assert.match(id,UUID);userIds[type]=id;
 sql("INSERT INTO public.profiles(id,role) VALUES("+safeId(id)+",'"+
      (type==="superadmin"?"super_admin":"player")+"')");
 if(type==="owner"||type==="secondary"){
  sql("INSERT INTO public.club_admins(club_id,user_id) VALUES("+
      safeId(type==="owner"?A:B)+","+safeId(id)+")");
 }
 const client=createClient(base,anon,{auth:{persistSession:false,autoRefreshToken:false}});
 const login=await client.auth.signInWithPassword({email,password});
 assert.ifError(login.error);
 assert.equal(login.data.user.id,id);
 const jwt=login.data.session?.access_token;assert.ok(jwt);
 const current=await client.auth.getUser(jwt);assert.ifError(current.error);
 tokens[type]=jwt;
}
console.log("PASS: 4 real ephemeral GoTrue accounts authenticated (owner, secondary, player, superadmin)");

// SQL fixtures use only fictional records. No production user is touched.
const ownPlayer="00000000-0000-0000-0000-000000000191";
sql("INSERT INTO public.players(id,profile_id,room_id,nickname,country_code,slug) VALUES("+
 safeId(ownPlayer)+","+safeId(userIds.player)+","+safeId(room)+
 ",'QAMyPlayer"+nonce+"','CL','qa-my-player-"+nonce+"')");
function responseData(raw){try{return JSON.parse(raw)}catch{return raw}}
async function rest(path,method,type,payload){
 const response=await fetch(base+"/rest/v1/"+path,{
  method,
  headers:{"Content-Type":"application/json",apikey:anon,
    ...(type?{Authorization:"Bearer "+tokens[type]}:{}),
    ...(method==="PATCH"?{"Prefer":"return=representation"}:{})},
  ...(payload===undefined?{}:{body:JSON.stringify(payload)}),
  signal:AbortSignal.timeout(16000)
 });
 return {status:response.status,data:responseData(await response.text())};
}
const assertStatus=(res,allowed,label)=>{
 assert.ok(allowed.includes(res.status),label+" HTTP "+res.status+
   " "+JSON.stringify(res.data).slice(0,420));
 console.log("PASS: "+label+" -> "+res.status);
};
const results=[
 {nickname:" shARkHERo ",position:1,prize_won:15,bounties_won:0,league_points_earned:0,buy_ins_count:2},
 {nickname:fresh,position:2,prize_won:0,bounties_won:0,league_points_earned:0,buy_ins_count:1},
];
const pub=(type,id=t1,rows=results)=>rest("rpc/publish_independent_nickname_results_guarded",
 "POST",type,{p_tournament_id:id,p_results:rows});

// Denials before publishing must leave no partial rows.
assertStatus(await pub(null),[401,403],"anon cannot publish independent Elo");
assertStatus(await pub("secondary"),[403],"unrelated club admin cannot publish");
assertStatus(await pub("player"),[403],"player without club cannot publish");
assertStatus(await pub("owner",t1,[results[0],{...results[1],position:1}]),
 [422],"duplicate position rejected");
assertStatus(await pub("owner",t1,[results[0],{...results[1],player_id:p1}]),
 [422],"client-forged player ID rejected");
assert.equal(sql("SELECT count(*) FROM public.tournament_results WHERE tournament_id="+safeId(t1)),"0");
assert.equal(sql("SELECT count(*) FROM sharkania_release.independent_elo_publication WHERE tournament_id="+safeId(t1)),"0");

const ok=await pub("owner");
assertStatus(ok,[200],"primary admin can publish USD independent");
assert.equal(ok.data.status,"published");
assert.equal(ok.data.atomic,true);
assert.equal(ok.data.players,2);
assert.equal(ok.data.currency,"USD");
assert.equal(ok.data.new_players,1);
assert.equal(sql("SELECT count(*) FROM public.tournament_results WHERE tournament_id="+safeId(t1)),"2");
assert.equal(sql("SELECT count(*) FROM public.elo_history WHERE tournament_id="+safeId(t1)),"2");
assert.equal(sql("SELECT count(*) FROM sharkania_release.independent_elo_checkpoint"),"2");
assert.equal(sql("SELECT count(*) FROM sharkania_release.independent_currency_posting WHERE tournament_id="+safeId(t1)),"2");
assertStatus(await pub("owner"),[409],"second publication rejected without double Elo");

// Superadmin may publish OTHER independent tournament later in chronology.
const second=[
 {nickname:"SharkHero",position:1,prize_won:1,bounties_won:0,league_points_earned:0,buy_ins_count:1},
 {nickname:"PokerQueen",position:2,prize_won:0,bounties_won:0,league_points_earned:0,buy_ins_count:1},
];
const elevated=await pub("superadmin",t2,second);
assertStatus(elevated,[200],"verified superadmin may publish separate club's standalone tournament");
assert.equal(elevated.data.players,2);

// Verify the actual Data API cannot insert Elo or results or alter Elo columns,
// while nickname edits are still available to a player allowed by RLS.
assertStatus(await rest("players?id=eq."+ownPlayer,"PATCH","player",{elo_rating:4321}),
 [401,403],"owner direct Elo PATCH blocked");
assertStatus(await rest("players","POST","player",{
 nickname:"Forged"+nonce,room_id:room,elo_rating:77777,elo_peak:77777
}),[401,403],"owner cannot create inflated Elo players");
assertStatus(await rest("elo_history","POST","player",{
 tournament_id:t1,player_id:ownPlayer,elo_before:1200,elo_after:9999,elo_change:8799
}),[401,403],"owner direct history insertion blocked");
assertStatus(await rest("tournament_results","POST","player",{
 tournament_id:t1,player_id:ownPlayer,position:3
}),[401,403],"owner direct results insertion blocked");
const patchNick=await rest("players?id=eq."+ownPlayer,"PATCH","player",
 {nickname:"QAChanged"+nonce,country_code:"CL"});
assertStatus(patchNick,[200],"legitimate nickname/country edit preserved");
assert.equal(patchNick.data.length,1);
assert.equal(patchNick.data[0].nickname,"QAChanged"+nonce);

// Even when tournaments UPDATE is permitted for schedules, state cannot be
// changed to completed via direct authenticated REST for nonleague.
const completion=await rest("tournaments?id=eq.00000000-0000-0000-0000-000000000012",
 "PATCH","owner",{results_uploaded:true});
assertStatus(completion,[409],"direct independent completion blocked");

assert.equal(sql("SELECT count(*) FROM sharkania_release.independent_elo_publication"),"2");
assert.equal(sql("SELECT count(*) FROM public.elo_history WHERE tournament_id="+safeId(t1)),"2");
console.log("PASS FINAL: full PR #95 + PR #96 SQL over real LOCAL GoTrue/PostgREST; client Elo DML closed");
