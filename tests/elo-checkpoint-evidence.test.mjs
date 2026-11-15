import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";

const source=readFileSync(new URL("../src/lib/elo-checkpoint-evidence.ts",import.meta.url),"utf8");
const compiled=ts.transpileModule(source,{
 compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}
});
const {auditEloCheckpointEvidence}=await import(
 "data:text/javascript;base64,"+Buffer.from(compiled.outputText).toString("base64")
);
const stamp=day=>"2026-11-"+String(day).padStart(2,"0")+"T20:00:00Z";
const rec=(playerId,day,before,after)=>({
 playerId,recordedAt:stamp(day),
 eloBefore:before,eloAfter:after,eloChange:Number((after-before).toFixed(2))
});
const t=(id,day,players,elo)=>({
 id,scheduledAt:"2026-11-"+String(day).padStart(2,"0")+"T19:00:00Z",
 resultPlayerIds:players,elo
});
const history=()=>[
 t("PREVIOUS",1,["p0","p1"],[rec("p0",1,1200,1180),rec("p1",1,1200,1220)]),
 t("TARGET",2,["p1","p2"],[rec("p1",2,1220,1231),rec("p2",2,1200,1181)]),
 t("FOLLOWING",3,["p2","p3"],[rec("p2",3,1181,1193),rec("p3",3,1200,1190)])
];
const plan=()=>({
 targetTournamentId:"TARGET",affectedTournamentIds:["TARGET","FOLLOWING"],
 affectedPlayerIds:["p1","p2","p3"],
 readonlyOnly:true,historicalDataCandidate:true,blockers:[],warnings:[],
 initialRecordedEloByPlayer:{},eventOrder:[]
});
test("classifies previous exact ELO link but NEVER asserts full checkpoint verified",()=>{
 const e=auditEloCheckpointEvidence(plan(),history());
 assert.equal(e.readonlyOnly,true);
 assert.equal(e.safeToApply,false);
 assert.equal(e.counts.continuous_recorded_elo,1);
 assert.equal(e.counts.first_recorded_event,2);
 assert.equal(e.counts.recorded_elo_gap,0);
 const p1=e.entries.find(x=>x.playerId==="p1");
 assert.equal(p1.firstAffectedTournamentId,"TARGET");
 assert.equal(p1.previousTournamentId,"PREVIOUS");
 assert.equal(p1.previousRecordedEloAfter,1220);
 assert.equal(p1.firstAffectedRecordedEloBefore,1220);
 assert.equal(p1.numericLinkMatched,true);
 assert.equal(p1.completeCheckpointVerified,false);
 assert.equal(p1.requiresManualReview,true);
 assert.ok(e.missingHistoricalStats.includes("totalTournaments and K-threshold state"));
});
test("history gaps are classified, never auto-repaired or defaulted to 1200",()=>{
 const h=history();
 h[1].elo[0].eloBefore=1237;
 const e=auditEloCheckpointEvidence({...plan(),historicalDataCandidate:false,
  blockers:[{kind:"elo_chain_break",tournamentId:"TARGET",playerId:"p1",detail:"gap"}]},h);
 assert.equal(e.preflightBlocked,true);
 assert.equal(e.counts.recorded_elo_gap,1);
 const p1=e.entries.find(x=>x.playerId==="p1");
 assert.equal(p1.difference,17);
 assert.equal(p1.numericLinkMatched,false);
 assert.equal(e.safeToApply,false);
 assert.equal(e.entries.find(x=>x.playerId==="p2").status,"first_recorded_event");
});
test("absent target event produces a missing-history status and warning",()=>{
 const h=history().filter(x=>x.id!=="TARGET");
 const e=auditEloCheckpointEvidence(plan(),h);
 assert.equal(e.counts.missing_event_history,1);
 assert.ok(e.warnings.some(x=>x.includes("Target tournament event is absent")));
});
test("missing predecessor provides NO verified baseline even for eloBefore=1200",()=>{
 const h=[history()[1]];
 const p={...plan(),affectedTournamentIds:["TARGET"],affectedPlayerIds:["p1","p2"]};
 const e=auditEloCheckpointEvidence(p,h);
 assert.equal(e.counts.first_recorded_event,2);
 assert.ok(e.entries.every(x=>x.completeCheckpointVerified===false));
 assert.ok(e.warnings.some(x=>x.includes("1200")));
});
test("flags overlapping publication windows without declaring a write-safe candidate",()=>{
 const h=history();h[1].elo[0].recordedAt=h[0].elo[0].recordedAt;
 const e=auditEloCheckpointEvidence(plan(),h);
 assert.ok(e.warnings.some(x=>x.includes("Overlapping")));
 assert.equal(e.safeToApply,false);
});
test("rejects invalid, missing, duplicated input rather than inventing lineage",()=>{
 const h=history();h[0].elo[0].recordedAt="invalid";
 assert.throws(()=>auditEloCheckpointEvidence(plan(),h),/recorded-at/);
 const x=history();x[0].id=x[1].id;
 assert.throws(()=>auditEloCheckpointEvidence(plan(),x),/duplicate tournament/);
 const y=history();y[0].elo[1].playerId="p0";
 assert.throws(()=>auditEloCheckpointEvidence(plan(),y),/Duplicate or invalid/);
});
test("is deterministic, read-only and does not alter caller fixtures",()=>{
 const h=history();const p=plan();
 const before=JSON.stringify([h,p]);
 assert.deepEqual(auditEloCheckpointEvidence(p,h),auditEloCheckpointEvidence(p,h));
 assert.equal(JSON.stringify([h,p]),before);
 assert.doesNotMatch(source,/supabase\.from|supabase\.rpc|fetch\(|writeFile|execute_sql|DELETE FROM|UPDATE public\./i);
 assert.throws(()=>auditEloCheckpointEvidence({...p,readonlyOnly:false},h),/read-only/);
});
