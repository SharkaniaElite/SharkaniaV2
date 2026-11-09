/**
 * SHARKANIA QA: first league-result upload via REAL local GoTrue JWT and
 * PostgREST. Strict localhost-only; no real project data or credentials.
 * The remaining edit/delete legacy flows are intentionally unavailable.
 */
import assert from "node:assert/strict";
import {randomBytes} from "node:crypto";
import {execFileSync} from "node:child_process";
import {createClient} from "@supabase/supabase-js";

const url=process.env.QA_SUPABASE_URL;
const anon=process.env.QA_SUPABASE_ANON_KEY;
const serviceKey=process.env.QA_SUPABASE_SERVICE_ROLE_KEY;
if(process.env.GITHUB_ACTIONS!=="true" ||
 url!=="http://127.0.0.1:25421" ||
 process.env.PGHOST!=="127.0.0.1" || process.env.PGPORT!=="25422" ||
 !anon||!serviceKey)throw Error("STOP: only ephemeral local Supabase accepted");
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const asUuid=x=>{assert.match(x,UUID);return "'"+x+"'::uuid"};
const sql=q=>execFileSync("psql",
 ["-X","-At","-v","ON_ERROR_STOP=1","-d","postgres","-c",q],
 {encoding:"utf8"}).trim();
const service=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
const nonce=randomBytes(6).toString("hex");
const tokens={};
const actors={};
const clubA="00000000-0000-0000-0000-000000000021";
const clubB="00000000-0000-0000-0000-000000000022";
const leagueA="00000000-0000-0000-0000-000000000041";
const tournament="00000000-0000-0000-0000-000000000074";
const p1="00000000-0000-0000-0000-000000000051";
const p2="00000000-0000-0000-0000-000000000052";

for(const role of ["organizer","secondary","player"]){
 const email="qa-atomic-"+role+"-"+nonce+"@example.test";
 const password=randomBytes(24).toString("base64url");
 const created=await service.auth.admin.createUser({email,password,email_confirm:true});
 assert.ifError(created.error);
 const id=created.data.user.id;
 sql("INSERT INTO public.profiles(id,role) VALUES("+asUuid(id)+",'player')");
 if(role!=="player"){
  sql("INSERT INTO public.club_admins(club_id,user_id) VALUES("+
    asUuid(role==="organizer"?clubA:clubB)+","+asUuid(id)+")");
 }
 const client=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}});
 const login=await client.auth.signInWithPassword({email,password});
 assert.ifError(login.error);
 assert.equal(login.data.user.id,id);
 const token=login.data.session?.access_token;
 assert.ok(token);
 const checked=await client.auth.getUser(token);
 assert.ifError(checked.error);
 tokens[role]=token;
 actors[role]=id;
}
console.log("PASS: real GoTrue sessions for primary, secondary and normal player");

async function api(path,role,method,body){
 const resp=await fetch(url+"/rest/v1/"+path,{
  method,headers:{"Content-Type":"application/json",apikey:anon,
   ...(role?{Authorization:"Bearer "+tokens[role]}:{})},
  body:JSON.stringify(body),
  signal:AbortSignal.timeout(15000)
 });
 const raw=await resp.text();
 let data;try{data=JSON.parse(raw)}catch{data=raw}
 return {status:resp.status,data};
}
function expect(resp,status,label){
 assert.equal(resp.status,status,label+": "+JSON.stringify(resp.data).slice(0,500));
 console.log("PASS: "+label+" HTTP "+status);
}
const payload=[
 {player_id:p1,position:1,prize_won:20,bounties_won:2,
  league_points_earned:30,ccp_club:"CCP-P51",buy_ins_count:2},
 {player_id:p2,position:2,prize_won:0,bounties_won:0,
  league_points_earned:12,ccp_club:"CCP-P52",buy_ins_count:1}
];
const rpc=(role,operation,results)=>api("rpc/publish_league_results_guarded_qa",
 role,"POST",{p_tournament_id:tournament,p_operation:operation,p_results:results});

expect(await api("tournaments","organizer","POST",{
 id:tournament,club_id:clubA,league_id:leagueA,buy_in:3.30,
 room_id:"00000000-0000-0000-0000-000000000031",
 currency:"USD",start_datetime:"2026-11-09T20:00:00Z"
}),201,"primary organizer created a synthetic league tournament");
assert.equal(sql("SELECT count(*) FROM public.tournament_results WHERE tournament_id="+asUuid(tournament)),"0");
const beforeElo=sql("SELECT count(*) FROM public.elo_history WHERE tournament_id="+asUuid(tournament));
const beforeStandings=sql("SELECT count(*) FROM public.league_standings WHERE league_id="+asUuid(leagueA));
const existingId=sql("SELECT id FROM public.league_standings WHERE league_id="+asUuid(leagueA)+" AND player_id="+asUuid(p1));
const existingLocked=sql("SELECT ccp_club||':'||total_buy_ins_spent::text FROM public.league_standings WHERE league_id="+asUuid(leagueA)+" AND player_id="+asUuid(p1));
assert.match(existingId,UUID);
assert.equal(sql("SELECT count(*) FROM sharkania_release_qa.elo_publication WHERE tournament_id="+asUuid(tournament)),"0");

expect(await rpc(null,"upload",payload),401,"anonymous cannot run guarded publication");
expect(await rpc("player","upload",payload),403,"ordinary player cannot publish league results");
expect(await rpc("secondary","upload",payload),403,"secondary club cannot publish primary organizer's results");
expect(await rpc("organizer","upload",[payload[0],{...payload[1],position:1}]),
 422,"duplicate finishing positions are rejected by the database");
assert.equal(sql("SELECT count(*) FROM public.tournament_results WHERE tournament_id="+asUuid(tournament)),"0",
 "forbidden/invalid HTTP calls must not write results");
assert.equal(sql("SELECT count(*) FROM public.elo_history WHERE tournament_id="+asUuid(tournament)),beforeElo);
assert.equal(sql("SELECT count(*) FROM sharkania_release_qa.elo_publication WHERE tournament_id="+asUuid(tournament)),"0");
assert.equal(sql("SELECT count(*) FROM public.league_standings WHERE league_id="+asUuid(leagueA)),beforeStandings);

const published=await rpc("organizer","upload",payload);
expect(published,200,"authorized initial publication commits in one server transaction");
assert.equal(published.data.audit_recorded,true,"publication RPC must certify its audit row");
assert.equal(sql("SELECT count(*) FROM public.tournament_results WHERE tournament_id="+asUuid(tournament)),"2");
assert.equal(sql("SELECT count(*) FROM public.elo_history WHERE tournament_id="+asUuid(tournament)),"2");
assert.equal(sql("SELECT elo_rating FROM public.players WHERE id="+asUuid(p1)),"1222.23");
assert.equal(sql("SELECT elo_rating FROM public.players WHERE id="+asUuid(p2)),"1177.77");
assert.equal(sql("SELECT unified_elo FROM public.profiles WHERE id='00000000-0000-0000-0000-000000000061'::uuid"),"1222.23");
assert.equal(sql("SELECT id FROM public.league_standings WHERE league_id="+asUuid(leagueA)+" AND player_id="+asUuid(p1)),existingId);
assert.equal(sql("SELECT ccp_club||':'||total_buy_ins_spent::text FROM public.league_standings WHERE league_id="+asUuid(leagueA)+" AND player_id="+asUuid(p1)),existingLocked);
assert.equal(sql("SELECT results_uploaded::text||':'||status::text FROM public.tournaments WHERE id="+asUuid(tournament)),"true:completed");

const ledgerCount=sql("SELECT count(*) FROM sharkania_release_qa.elo_publication WHERE tournament_id="+asUuid(tournament));
const snapshotCount=sql("SELECT count(*) FROM sharkania_release_qa.elo_player_checkpoint cp JOIN sharkania_release_qa.elo_publication ep ON ep.id=cp.publication_id WHERE ep.tournament_id="+asUuid(tournament));
assert.equal(ledgerCount,"1","single durable audit event per published tournament");
assert.equal(snapshotCount,"2","exactly one pre-write checkpoint per participant");
assert.equal(sql("SELECT actor_profile_id::text FROM sharkania_release_qa.elo_publication WHERE tournament_id="+asUuid(tournament)),actors.organizer);
assert.equal(sql("SELECT count(*) FROM sharkania_release_qa.elo_player_checkpoint cp JOIN sharkania_release_qa.elo_publication ep ON ep.id=cp.publication_id WHERE ep.tournament_id="+asUuid(tournament)+" AND cp.elo_before=1200 AND cp.tournaments_before=0 AND cp.elo_after IN (1222.23,1177.77)"),"2");
const actualHash=sql("SELECT input_fingerprint FROM sharkania_release_qa.elo_publication WHERE tournament_id="+asUuid(tournament));
assert.match(actualHash,/^[0-9a-f]{64}$/);
const reversedPayload=JSON.stringify([...payload].reverse()).replaceAll("'","''");
const canonicalHashSql="SELECT encode(sha256(convert_to(jsonb_build_object("+
 "'algorithm_version','legacy-js-v1','tournament_id',"+asUuid(tournament)+
 ",'league_id',"+asUuid(leagueA)+",'buy_in',3.30::numeric,"+
 "'currency','USD','results',("+
 "SELECT jsonb_agg(to_jsonb(x) ORDER BY x.position) FROM jsonb_to_recordset('"+
 reversedPayload+"'::jsonb) AS x("+
 "player_id uuid,position integer,prize_won numeric,bounties_won numeric,"+
 "league_points_earned numeric,ccp_club text,buy_ins_count numeric)"+
 "))::text,'UTF8')),'hex')";
assert.equal(actualHash,sql(canonicalHashSql),
 "fingerprint must be server-side canonical, independent of input array order");


expect(await rpc("organizer","upload",payload),409,"replay of successful publication cannot double-count Elo");
expect(await rpc("organizer","edit",payload),409,"historical edit needs the future deterministic replay engine");
expect(await rpc("organizer","delete",null),409,"historical delete needs the future deterministic replay engine");
assert.equal(sql("SELECT count(*) FROM public.elo_history WHERE tournament_id="+asUuid(tournament)),"2");
assert.equal(sql("SELECT count(*) FROM sharkania_release_qa.elo_publication WHERE tournament_id="+asUuid(tournament)),"1");
console.log("PASS FINAL: atomic initial publication, SHA256 server audit, pre-state checkpoints and no duplication over real GoTrue/PostgREST");
