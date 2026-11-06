/**
 * SHARKANIA: two real PostgreSQL client sessions on synthetic-only database.
 * A transaction intentionally holds row/league locks after publishing.
 * The second session must wait, then either reject a duplicate or serialize.
 * No Supabase cloud connections. This is NOT a production migration.
 */
import assert from "node:assert/strict";
import {spawn, execFileSync} from "node:child_process";

if (process.env.GITHUB_ACTIONS!=="true" ||
    process.env.PGHOST!=="127.0.0.1" ||
    process.env.PGPORT!=="5432" ||
    process.env.PGDATABASE!=="qa_league_race")
 throw Error("STOP: use disposable qa_league_race only");

const t1="00000000-0000-0000-0000-000000000071";
const t2="00000000-0000-0000-0000-000000000072";
const t3="00000000-0000-0000-0000-000000000073";
const league="00000000-0000-0000-0000-000000000041";
const p1="00000000-0000-0000-0000-000000000051";
const p2="00000000-0000-0000-0000-000000000052";
const organizer="00000000-0000-0000-0000-000000000002";
const payload=JSON.stringify([
 {player_id:p1,position:1,prize_won:22,bounties_won:0,league_points_earned:20,ccp_club:"QA",buy_ins_count:1},
 {player_id:p2,position:2,prize_won:0,bounties_won:0,league_points_earned:10,ccp_club:"QA",buy_ins_count:1}
]).replaceAll("'","''");

const query=statement=>execFileSync("psql",
 ["-X","-A","-t","-v","ON_ERROR_STOP=1","-d","qa_league_race","-c",statement],
 {encoding:"utf8",timeout:12000}).trim();
const rpc=id=>"public.publish_league_results_guarded_qa('"+id+"'::uuid,'upload','"+payload+"'::jsonb)";
const prefix="\\set ON_ERROR_STOP on\nBEGIN;\nSET LOCAL ROLE authenticated;\n"+
 "SET LOCAL request.jwt.claim.sub='"+organizer+"';\n"+
 "SET LOCAL statement_timeout='12s';\nSET LOCAL lock_timeout='10s';\n";
function psqlSession(name,sql){
 const child=spawn("psql",["-X","-A","-t","-v","ON_ERROR_STOP=1","-d","qa_league_race"],
   {env:{...process.env,PGAPPNAME:name},stdio:["pipe","pipe","pipe"]});
 let stdout="",stderr="";
 const done=new Promise((resolve,reject)=>{
  child.stdout.setEncoding("utf8").on("data",s=>stdout+=s);
  child.stderr.setEncoding("utf8").on("data",s=>stderr+=s);
  child.on("error",reject);
  child.on("close",code=>code===0?resolve({stdout,stderr}):
    reject(Error(name+" failed: "+stderr.slice(-1100))));
 });
 child.stdin.end(sql);
 return {done,get out(){return stdout}};
}
async function until(check,timeout=2500){
 const deadline=Date.now()+timeout;
 while(Date.now()<deadline){
  if(check())return;
  await new Promise(resolve=>setTimeout(resolve,50));
 }
 throw Error("Timed out waiting for PostgreSQL concurrency barrier");
}
async function waitForLock(name){
 await until(()=>query("SELECT count(*) FROM pg_stat_activity WHERE application_name='"+
   name+"' AND wait_event_type='Lock'")==="1",2200);
}
function firstSQL(id,label){
 return prefix+"SELECT ("+rpc(id)+")->>'status';\n\\echo HOLD_"+label+
 "\nSELECT pg_sleep(3);\nCOMMIT;\n\\echo FIRST_COMMITTED\n";
}
function secondSQL(id,duplicate){
 if(!duplicate)
  return prefix+"SELECT ("+rpc(id)+")->>'status';\nCOMMIT;\n\\echo SECOND_COMMITTED\n";
 return prefix+"DO $block$\nBEGIN\n BEGIN\n  PERFORM "+rpc(id)+
  ";\n  RAISE EXCEPTION 'FAIL: duplicate upload accepted';\n"+
  " EXCEPTION WHEN SQLSTATE 'PT409' THEN\n"+
  "  RAISE NOTICE 'PASS: duplicate upload rejected after lock wait';\n"+
  " END;\nEND $block$;\nCOMMIT;\n\\echo SECOND_REJECTED\n";
}
async function race(firstId,secondId,duplicate,label){
 const first=psqlSession("qa_first_"+label,firstSQL(firstId,label));
 await until(()=>first.out.includes("HOLD_"+label));
 const second=psqlSession("qa_second_"+label,secondSQL(secondId,duplicate));
 await waitForLock("qa_second_"+label);
 const [one,two]=await Promise.all([first.done,second.done]);
 assert.match(one.stdout,/FIRST_COMMITTED/);
 if(duplicate){
  assert.match(two.stdout,/SECOND_REJECTED/);
  assert.match(two.stderr,/duplicate upload rejected after lock wait/);
 } else assert.match(two.stdout,/SECOND_COMMITTED/);
 console.log("PASS: "+label+" genuine concurrent transaction locking");
}

await race(t1,t1,true,"duplicate");
assert.equal(query("SELECT count(*) FROM sharkania_release_qa.elo_publication WHERE tournament_id='"+
 t1+"'"),"1");
assert.equal(query("SELECT count(*) FROM public.elo_history WHERE tournament_id='"+
 t1+"'"),"2");

query("INSERT INTO public.tournaments (id,club_id,buy_in,league_id,room_id,currency,start_datetime) VALUES "+
 "('"+t2+"','00000000-0000-0000-0000-000000000021',3.30,'"+league+
 "','00000000-0000-0000-0000-000000000031','USD','2026-11-06T20:00:00Z'),"+
 "('"+t3+"','00000000-0000-0000-0000-000000000021',3.30,'"+league+
 "','00000000-0000-0000-0000-000000000031','USD','2026-11-07T20:00:00Z')");
await race(t2,t3,false,"league");

const inEvents="('"+t1+"','"+t2+"','"+t3+"')";
assert.equal(query("SELECT count(*) FROM sharkania_release_qa.elo_publication WHERE tournament_id IN "+inEvents),"3");
assert.equal(query("SELECT count(*) FROM public.tournament_results WHERE tournament_id IN "+inEvents),"6");
assert.equal(query("SELECT count(*) FROM public.elo_history WHERE tournament_id IN "+inEvents),"6");
assert.equal(query("SELECT count(*) FROM sharkania_release_qa.elo_player_checkpoint cp "+
 "JOIN sharkania_release_qa.elo_publication ep ON ep.id=cp.publication_id "+
 "WHERE ep.tournament_id IN "+inEvents),"6");
assert.equal(query("SELECT count(*) FROM public.players WHERE id IN ('"+p1+"','"+p2+
 "') AND total_tournaments=3"),"2");
assert.equal(query("SELECT count(*) FROM public.league_standings WHERE league_id='"+
 league+"' AND player_id IN ('"+p1+"','"+p2+"')"),"2");
const gap=query("WITH r AS (SELECT player_id,elo_before,elo_after,"+
 "lag(elo_after) OVER(PARTITION BY player_id ORDER BY recorded_at,id) AS prior "+
 "FROM public.elo_history WHERE tournament_id IN "+inEvents+
 ") SELECT count(*) FROM r WHERE prior IS NOT NULL AND abs(prior-elo_before)>0.011");
assert.equal(gap,"0","concurrent updates must produce a continuous Elo chain");
console.log("PASS FINAL: two-session duplicate rejection + serialized distinct league events; 6 snapshots, no Elo gaps");
