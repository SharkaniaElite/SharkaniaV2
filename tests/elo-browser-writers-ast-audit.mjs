import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

// Browser code only. Backend SECURITY DEFINER/edge writers are reviewed
// separately. No source code or user data is uploaded to any third party.
const watched = new Set([
  "players","elo_history","tournament_results","league_standings","nickname_claims"
]);
const mutators = new Set(["insert","upsert","update","delete"]);

/**
 * All below remain LEGACY browser paths with the cutover flags OFF.
 * They are not deemed safe: this list is an explicit change-control fence.
 * Backend ACL must deny sensitive DML once the guarded cutover is authorized.
 */
const expectedLegacyWriters = new Set([
  "src/lib/api/elo-engine.ts",
  "src/lib/api/players.ts",
  "src/lib/api/tournaments.ts",
  "src/lib/api/leagues.ts",
  "src/components/admin/results-upload.tsx",
  "src/components/admin/results-editor.tsx",
  "src/components/admin/club-players-tab.tsx",
  "src/components/admin/nickname-claim.tsx",
  "src/pages/super-admin.tsx",
]);

const files=[];
function collect(directory){
 if(!fs.existsSync(directory))return;
 for(const item of fs.readdirSync(directory,{withFileTypes:true})){
  const location=path.join(directory,item.name);
  if(item.isDirectory())collect(location);
  else if(/\.(tsx?|jsx?)$/.test(item.name))files.push(location);
 }
}
collect("src");

function stringArgument(arg) {
 return arg && (ts.isStringLiteral(arg)||ts.isNoSubstitutionTemplateLiteral(arg))
   ?arg.text:null;
}

function sourceTable(node){
 let found=null;
 function walk(n){
  if(ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)
   && n.expression.name.text==="from"){
   const table=stringArgument(n.arguments[0]);
   if(watched.has(table)) found=table;
  }
  ts.forEachChild(n,walk);
 }
 walk(node);
 return found;
}

const findings=[];
for(const filename of files){
 const code=fs.readFileSync(filename,"utf8");
 const relative=filename.replaceAll(path.sep,"/");
 const source=ts.createSourceFile(relative,code,ts.ScriptTarget.Latest,true,
   filename.endsWith("tsx")?ts.ScriptKind.TSX:ts.ScriptKind.TS);
 function walk(node){
  if(ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)){
   const operation=node.expression.name.text;
   if(mutators.has(operation)){
    const table=sourceTable(node.expression.expression);
    if(table) {
     const pos=source.getLineAndCharacterOfPosition(node.getStart(source));
     findings.push({file:relative,line:pos.line+1,table,operation});
    }
   }
  }
  ts.forEachChild(node,walk);
 }
 walk(source);
}

test("browser Elo/claim DML occurs only in the catalogued legacy modules",()=>{
 assert.ok(findings.length>=8,"Expected legacy write paths unexpectedly disappeared or scanner drifted");
 const unknown=findings.filter(f=>!expectedLegacyWriters.has(f.file));
 console.log("Legacy browser DML inventory (NOT SAFE BEFORE CUTOVER): "+
  JSON.stringify(findings,null,2));
 assert.deepEqual(unknown,[],"Unreviewed browser direct DML added to protected tables");
});

test("guarded RPC modules must never directly write Elo, results, player or claim rows",()=>{
 const guarded=findings.filter(f=>f.file.includes("guarded-") ||
   f.file.includes("atomic-results"));
 assert.deepEqual(guarded,[],"Guarded client must not have REST write fallback");
});
