/**
 * SHARKANIA Release A — source dependency inventory (read-only).
 * Scans local repository source with TypeScript AST. No network, DB, env secrets,
 * user data, code execution or migration. Names/paths/line numbers only.
 * Diagnostic, NOT a proof that all aliases or dynamically assembled queries
 * are safe. Review every flagged path before production permission cutover.
 */
import ts from "typescript";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
const root="src";
const targets=new Set(["leagues","league_clubs","league_rooms","league_standings","tournaments","tournament_results"]);
const verbs=new Set(["insert","update","delete","upsert"]);
const helpers=new Set(["forceRecalculateStandings","applyLeaguePoints","deleteTournamentSafe","prepareTournamentForReedit","saveLeagueGuarded","duplicateLeagueGuarded","deleteEmptyLeagueGuarded","createLeagueGuarded","setLeagueRoomsGuarded","addLeagueClubGuarded"]);
const rpcDanger=new Set(["recalculate_league_standings","delete_tournament_god_mode","reset_tournament_impact","recalculate_league_standings_guarded"]);
const records=[];
const files=[];
function walk(dir) {
 for(const item of readdirSync(dir,{withFileTypes:true})) {
  const file=path.join(dir,item.name);
  if(item.isDirectory())walk(file);
  else if(/\.(ts|tsx|js|jsx)$/.test(item.name))files.push(file);
 }
}
function propName(call) {
 const exp=call.expression;
 return ts.isPropertyAccessExpression(exp)?exp.name.text:null;
}
function baseTable(expr) {
 if(ts.isCallExpression(expr)) {
  if(propName(expr)==="from" &&
   expr.arguments.length && ts.isStringLiteralLike(expr.arguments[0]))return expr.arguments[0].text;
  return baseTable(expr.expression);
 }
 if(ts.isPropertyAccessExpression(expr))return baseTable(expr.expression);
 if(ts.isParenthesizedExpression(expr))return baseTable(expr.expression);
 return null;
}
walk(root);
for(const file of files) {
 const source=readFileSync(file,"utf8");
 const sf=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,file.endsWith("x")?ts.ScriptKind.TSX:ts.ScriptKind.TS);
 assert.equal(sf.parseDiagnostics.length,0,"TypeScript parser must accept "+file);
 function visit(n) {
  if(ts.isCallExpression(n)){
   const method=propName(n);
   const at=sf.getLineAndCharacterOfPosition(n.getStart(sf)).line+1;
   if(verbs.has(method)) {
    const table=baseTable(n.expression.expression);
    if(targets.has(table))records.push({type:"DIRECT_DML",table,method,path:file.split(path.sep).join("/"),line:at});
   }
   if(method==="rpc" && n.arguments.length && ts.isStringLiteralLike(n.arguments[0])) {
    const rpc=n.arguments[0].text;
    if(rpcDanger.has(rpc)||/league|tournament|standings|elo/i.test(rpc))records.push({type:"RPC",name:rpc,method:"rpc",path:file.split(path.sep).join("/"),line:at});
   }
   if(ts.isIdentifier(n.expression) && helpers.has(n.expression.text)) {
    records.push({type:"HELPER",name:n.expression.text,method:"call",path:file.split(path.sep).join("/"),line:at});
   }
  }
  ts.forEachChild(n,visit);
 }
 visit(sf);
}
assert.ok(files.length>=150,"STOP: incomplete src inventory, only "+files.length+" files");
const ordered=records.sort((a,b)=>a.path.localeCompare(b.path)||a.line-b.line);
const groups=new Map();
for(const x of ordered){const key=[x.type,x.table||x.name,x.method].join(":");groups.set(key,(groups.get(key)||0)+1)}
console.log("RELEASE A INVENTORY: "+files.length+" TS/TSX/JS/JSX source files scanned");
console.log("TARGETED REFERENCES: "+ordered.length);
console.log("COUNTS:");
for(const [key,num] of [...groups].sort())console.log("COUNT "+key+" = "+num);
console.log("CALLSITES:");
for(const x of ordered)console.log([x.type,x.table||x.name,x.method,x.path+":"+x.line].join(" | "));
console.log("CAVEAT: static direct-chains only; separately review alias/dynamic queries, server RPC bodies, policies and concurrency.");
