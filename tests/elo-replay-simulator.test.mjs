import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";

const source=readFileSync(new URL("../src/lib/elo-replay-simulator.ts",import.meta.url),"utf8");
const compiled=ts.transpileModule(source,{compilerOptions:{
  target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext
}});
const {simulateHistoricalEloScenario}=await import(
  "data:text/javascript;base64,"+Buffer.from(compiled.outputText).toString("base64")
);
const result=(playerId,position,prizeWon=0,bountiesWon=0)=>({
  playerId,position,prizeWon,bountiesWon
});
const baseline=(playerId,atEvent,eloRating=1200,totalTournaments=0)=>({
  playerId,atEvent,eloRating,eloPeak:eloRating,
  totalTournaments,totalCashes:0,totalWins:0,
  totalPrizeWon:0,totalBuyInsSpent:0
});
function sample(){
  const events=[
    {tournamentId:"TARGET",buyIn:3.30,currency:"USD",
      results:[result("p1",1,20,2),result("p2",2)]},
    {tournamentId:"B",buyIn:3.30,currency:"USD",
      results:[result("p3",1,5),result("p2",2)]},
    {tournamentId:"C",buyIn:3.30,currency:"USD",
      results:[result("p4",1),result("p3",2)]}
  ];
  const plan={
    targetTournamentId:"TARGET",
    affectedTournamentIds:["TARGET","B","C"],
    affectedPlayerIds:["p1","p2","p3","p4"],
    eventOrder:[],initialRecordedEloByPlayer:{},
    blockers:[],warnings:[],historicalDataCandidate:true,readonlyOnly:true
  };
  const checkpoints=[
    baseline("p1","TARGET"),baseline("p2","TARGET"),
    baseline("p3","B",1340,30),baseline("p4","C",1150,12)
  ];
  return {plan,events,checkpoints,operation:"edit",
    replacement:events[0].results};
}
test("unchanged review has exact legacy JS Elo parity from externally verified checkpoints",()=>{
  const fixture=sample();
  const preview=simulateHistoricalEloScenario(fixture);
  const events=fixture.events.map(e=>({
    ...e,observed:preview.calculated.filter(x=>x.tournamentId===e.tournamentId)
      .map(({playerId,eloBefore,eloAfter,eloChange})=>({
        playerId,eloBefore,eloAfter,eloChange
      }))
  }));
  const original=simulateHistoricalEloScenario({
    ...fixture,events,operation:"unchanged",replacement:undefined
  });
  assert.equal(original.readonlyOnly,true);
  assert.equal(original.safeToApply,false);
  assert.deepEqual(original.parityDifferences,[]);
  assert.equal(original.calculated[0].eloAfter,1222.23);
  assert.equal(original.calculated[1].eloAfter,1177.77);
  const players=new Map(original.finalPlayers.map(p=>[p.playerId,p]));
  assert.equal(players.get("p1").totalPrizeWon,22);
  assert.equal(players.get("p1").totalCashes,1);
  assert.equal(players.get("p1").totalWins,1);
  assert.equal(players.get("p1").totalBuyInsSpent,3.30);
  assert.equal(players.get("p3").totalTournaments,32);
  assert.ok(players.get("p3").eloPeak>=1340);
  events[2].observed[0].eloAfter+=3;
  const diverged=simulateHistoricalEloScenario({
    ...fixture,events,operation:"unchanged",replacement:undefined
  });
  assert.ok(diverged.parityDifferences.some(x=>x.tournamentId==="C" &&
    x.field==="eloAfter"));
});
test("editing TARGET changes downstream opponent ratings transitively without mutating input",()=>{
  const fixture=sample();
  const before=JSON.stringify(fixture);
  const original=simulateHistoricalEloScenario(fixture);
  const edited=simulateHistoricalEloScenario({
    ...fixture,replacement:[result("p2",1,22),result("p1",2)]
  });
  const oldC=original.calculated.find(x=>x.tournamentId==="C"&&x.playerId==="p4");
  const newC=edited.calculated.find(x=>x.tournamentId==="C"&&x.playerId==="p4");
  assert.notEqual(newC.eloAfter,oldC.eloAfter);
  assert.equal(edited.calculated.length,6);
  assert.equal(edited.safeToApply,false);
  assert.equal(JSON.stringify(fixture),before);
});
test("deleting target removes its Elo and stats, then replays later participant closure",()=>{
  const fixture=sample();
  const deleted=simulateHistoricalEloScenario({
    ...fixture,operation:"delete",replacement:undefined
  });
  assert.deepEqual(deleted.calculated.map(x=>x.tournamentId),["B","B","C","C"]);
  const players=new Map(deleted.finalPlayers.map(x=>[x.playerId,x]));
  assert.equal(players.get("p1").eloRating,1200);
  assert.equal(players.get("p1").totalTournaments,0);
  assert.equal(players.get("p2").totalTournaments,1);
  assert.equal(players.get("p3").totalTournaments,32);
});
test("K threshold at 30 tournaments halves the baseline factor",()=>{
  const f=sample();f.events=f.events.slice(0,1);
  f.plan.affectedTournamentIds=["TARGET"];
  f.plan.affectedPlayerIds=["p1","p2"];
  f.checkpoints=f.checkpoints.slice(0,2);
  const young=simulateHistoricalEloScenario(f);
  const senior=simulateHistoricalEloScenario({
    ...f,checkpoints:f.checkpoints.map(p=>({
      ...p,totalTournaments:30
    }))
  });
  const winYoung=young.calculated.find(x=>x.playerId==="p1").eloChange;
  const winSenior=senior.calculated.find(x=>x.playerId==="p1").eloChange;
  assert.ok(winYoung>winSenior && Math.abs(winYoung-2*winSenior)<0.02);
});
test("ELO 100-point floor does not falsify the separately recorded raw change",()=>{
  const f=sample();f.events=f.events.slice(0,1);
  f.plan.affectedTournamentIds=["TARGET"];
  f.plan.affectedPlayerIds=["p1","p2"];
  f.checkpoints=[baseline("p1","TARGET",100),baseline("p2","TARGET",100)];
  f.replacement=[result("p2",1),result("p1",2)];
  const run=simulateHistoricalEloScenario(f);
  const loser=run.calculated.find(x=>x.playerId==="p1");
  assert.equal(loser.eloAfter,100);
  assert.ok(loser.eloChange<0);
});
test("never assume baseline Elo; require verified checkpoint for every newly impacted rival",()=>{
  const f=sample();f.checkpoints=f.checkpoints.slice(0,3);
  assert.throws(()=>simulateHistoricalEloScenario(f),/checkpoint/i);
  const g=sample();g.checkpoints[2].atEvent="TARGET";
  assert.throws(()=>simulateHistoricalEloScenario(g),/checkpoint/i);
});
test("edits cannot silently add a nickname or alter player counts",()=>{
  const f=sample();
  assert.throws(()=>simulateHistoricalEloScenario({
    ...f,replacement:[result("p1",1),result("new",2)]
  }),/New or removed players/);
  assert.throws(()=>simulateHistoricalEloScenario({
    ...f,replacement:[result("p1",1),result("p2",1)]
  }),/Invalid or duplicate/);
});
test("reject broken history, wrong event order and unsupported currency",()=>{
  const f=sample();f.plan.historicalDataCandidate=false;
  assert.throws(()=>simulateHistoricalEloScenario(f),/blocked/);
  const g=sample();g.events.reverse();
  assert.throws(()=>simulateHistoricalEloScenario(g),/event order/);
  const h=sample();h.events[0].currency="CLP";
  assert.throws(()=>simulateHistoricalEloScenario(h),/currency/);
});
test("no database access, network, or apply plan; output cannot authorize mutation",()=>{
  assert.doesNotMatch(source,/supabase\.from|supabase\.rpc|fetch\(|execute_sql|writeFile|DELETE FROM|UPDATE public\./i);
  const f=sample();
  assert.equal(simulateHistoricalEloScenario(f).safeToApply,false);
});
