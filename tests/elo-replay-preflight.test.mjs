import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const source = readFileSync(new URL("../src/lib/elo-replay-preflight.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
});
const { planHistoricalEloReplay } = await import(
  "data:text/javascript;base64," + Buffer.from(compiled.outputText).toString("base64")
);

const stamp = day => "2026-11-" + String(day).padStart(2,"0") + "T20:00:00.000Z";
const E = (playerId, day, before, after) => ({
  playerId, recordedAt: stamp(day),
  eloBefore: before, eloAfter: after, eloChange: Number((after - before).toFixed(2)),
});
const T = (id, day, players, elo, scheduled = day) => ({
  id,
  scheduledAt: "2026-11-" + String(scheduled).padStart(2,"0") + "T18:00:00.000Z",
  resultPlayerIds: players,
  elo,
});
const makeHistory = () => [
  T("EARLIER", 1, ["p0", "p1"], [E("p0",1,1200,1180),E("p1",1,1200,1220)]),
  T("TARGET", 3, ["p1", "p2"], [E("p1",3,1220,1230),E("p2",3,1200,1178)]),
  T("EARLY-UNRELATED", 4, ["p5","p6"], [E("p5",4,1200,1210),E("p6",4,1200,1190)]),
  T("B", 5, ["p2","p3"], [E("p2",5,1178,1188),E("p3",5,1200,1190)], 2),
  T("C", 6, ["p3","p4"], [E("p3",6,1190,1195),E("p4",6,1200,1195)]),
  T("D", 7, ["p4","p5"], [E("p4",7,1195,1200),E("p5",7,1210,1205)]),
  T("OTHER", 8, ["p6","p7"], [E("p6",8,1190,1195),E("p7",8,1200,1195)]),
];

test("transitive opponent dependencies reach later tournaments, not earlier or unrelated events",()=>{
 const result=planHistoricalEloReplay("TARGET",makeHistory().reverse());
 assert.equal(result.historicalDataCandidate,true);
 assert.equal(result.readonlyOnly,true);
 assert.deepEqual(result.affectedTournamentIds,["TARGET","B","C","D"]);
 assert.deepEqual(result.affectedPlayerIds,["p1","p2","p3","p4","p5"]);
 assert.equal(result.initialRecordedEloByPlayer.p1,1200);
 assert.equal(result.initialRecordedEloByPlayer.p5,1200);
 assert.equal(result.initialRecordedEloByPlayer.p6,undefined);
 assert.deepEqual(result.blockers,[]);
 assert.ok(result.warnings.some(w=>w.includes("B") && w.includes("start_datetime")));
 assert.equal(result.eventOrder[0].firstRecordedAt,"2026-11-03T20:00:00.000Z");
});
test("broken chain in affected player blocks a replay, even if later stored values look plausible",()=>{
 const history=makeHistory(); history[3].elo[0].eloBefore=1300;
 const plan=planHistoricalEloReplay("TARGET",history);
 assert.equal(plan.historicalDataCandidate,false);
 assert.ok(plan.blockers.some(b=>b.kind==="elo_chain_break"&&b.playerId==="p2"&&b.tournamentId==="B"));
});
test("broken chain before target is also disqualifying: cannot infer an authoritative baseline",()=>{
 const history=makeHistory(); history[1].elo[0].eloBefore=1200;
 const plan=planHistoricalEloReplay("TARGET",history);
 assert.ok(plan.blockers.some(b=>b.kind==="elo_chain_break"&&b.tournamentId==="TARGET"));
});
test("missing ELO row or result record in any event prevents replay",()=>{
 const history=makeHistory(); history[4].elo.pop();
 const plan=planHistoricalEloReplay("TARGET",history);
 assert.equal(plan.historicalDataCandidate,false);
 assert.ok(plan.blockers.some(b=>b.kind==="missing_elo" && b.tournamentId==="C"));
});
test("overlapping publication write windows are ambiguous, never order by UUID",()=>{
 const history=makeHistory();history[3].elo[0].recordedAt="2026-11-03T20:00:00.000Z";
 const plan=planHistoricalEloReplay("TARGET",history);
 assert.equal(plan.historicalDataCandidate,false);
 assert.ok(plan.blockers.some(b=>b.kind==="ambiguous_publication_order"));
});
test("duplicate result nickname ID is blocked, regardless of ELO row count",()=>{
 const history=makeHistory();history[4].resultPlayerIds=["p3","p3"];
 const plan=planHistoricalEloReplay("TARGET",history);
 assert.equal(plan.historicalDataCandidate,false);
 assert.ok(plan.blockers.some(b=>b.kind==="duplicate_player"&&b.tournamentId==="C"));
});
test("invalid date/numeric input blocks preflight; target missing refuses to invent history",()=>{
 const history=makeHistory();history[4].elo[0].eloAfter=NaN;
 const plan=planHistoricalEloReplay("TARGET",history);
 assert.equal(plan.historicalDataCandidate,false);
 assert.ok(plan.blockers.some(b=>b.kind==="invalid_data"));
 assert.throws(()=>planHistoricalEloReplay("MISSING",makeHistory()),/Target tournament/);
});
test("function is deterministic and contains no I/O or database mutation",()=>{
 const input=makeHistory();
 const before=JSON.stringify(input);
 const a=planHistoricalEloReplay("TARGET",input);
 const b=planHistoricalEloReplay("TARGET",input);
 assert.deepEqual(a,b);
 assert.equal(JSON.stringify(input),before);
 assert.doesNotMatch(source,/supabase\.from|supabase\.rpc|fetch\(|writeFile|execute_sql|delete from|update public\./i);
});
