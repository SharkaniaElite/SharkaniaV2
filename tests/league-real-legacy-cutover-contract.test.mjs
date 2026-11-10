import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const source=read("tests/fixtures/sharkania-production-legacy-rpc-source-2026-11-10.qa-only.sql");
const cutover=read("docs/security/league-legacy-rpc-guards-2026-11-10.qa-only.sql");
const qa=read("tests/fixtures/sharkania-league-real-legacy-rpc-cutover-qa.sql");
const ci=read(".github/workflows/qa-league-release-final-readiness.yml");

test("legacy functions are production bodies and catalog hash preflight is before any DDL",()=>{
 for(const name of ["bulk_delete_scheduled_tournaments","delete_tournament_god_mode","reset_tournament_impact","recalculate_league_standings","update_league_standings"]){
  assert.ok(source.includes("FUNCTION public."+name),"missing source function "+name);
  assert.ok(cutover.includes("'"+name+"'"),"no catalog hash check "+name);
 }
 assert.match(source,/verbatim pg_get_functiondef snapshot extracted read-only/);
 assert.match(cutover,/Legacy RPC catalog drift/);
 assert.ok(cutover.indexOf("DO $source_preflight$")<cutover.indexOf("CREATE OR REPLACE FUNCTION public.sharkania_guard_legacy_single"));
 assert.match(cutover,/^BEGIN;$/m);
 assert.match(cutover,/^COMMIT;$/m);
 assert.match(cutover,/SELECT t\.league_id,t\.club_id INTO v_league,v_club/);
 assert.match(cutover,/FROM public\.tournaments t WHERE t\.id=p_tournament_id FOR UPDATE/);
 assert.match(cutover,/ORDER BY t\.id FOR UPDATE/);
 assert.match(cutover,/public\.is_club_admin\(v_club\)/);
 assert.match(cutover,/public\.is_club_admin\(r\.club_id\)/);
 assert.match(cutover,/USING ERRCODE='PT409'/);
 assert.match(cutover,/REVOKE EXECUTE ON FUNCTION public\.recalculate_league_standings/);
 assert.match(cutover,/public\.update_league_standings\(uuid\) FROM PUBLIC,anon,authenticated/);
});

test("genuine SQL bodies cannot delete linked tournaments or rebuild Elo before locking",()=>{
 const start=cutover.indexOf("CREATE OR REPLACE FUNCTION public.delete_tournament_god_mode");
 const reset=cutover.indexOf("CREATE OR REPLACE FUNCTION public.reset_tournament_impact");
 const bulk=cutover.indexOf("CREATE OR REPLACE FUNCTION public.bulk_delete_scheduled_tournaments");
 assert.ok(start>0&&reset>0&&bulk>0);
 assert.match(cutover,/PERFORM public\.sharkania_guard_legacy_single_nonleague_qa\(tournament_id_to_delete\)/);
 assert.match(cutover,/PERFORM public\.sharkania_guard_legacy_single_nonleague_qa\(tournament_id_to_reset\)/);
 assert.match(cutover,/PERFORM public\.sharkania_guard_legacy_bulk_nonleague_qa\(p_tournament_ids\)/);
 assert.match(qa,/real legacy GOD MODE deleted linked tournament/);
 assert.match(qa,/real legacy reset could remove linked results/);
 assert.match(qa,/real legacy bulk delete removed league tournament/);
 assert.match(qa,/club ownership gate preserved/);
 assert.match(qa,/nonleague reset lost legacy behavior/);
 assert.match(qa,/nonleague delete lost legacy behavior/);
 assert.match(qa,/nonleague bulk delete count/);
 assert.match(qa,/^ROLLBACK;$/m);
});

test("cutover contract runs in disposable PG17 only",()=>{
 assert.match(ci,/PGHOST: 127\.0\.0\.1/);
 assert.match(ci,/image: postgres:17/);
 assert.match(ci,/sharkania-production-legacy-rpc-source-2026-11-10\.qa-only\.sql/);
 assert.match(ci,/league-legacy-rpc-guards-2026-11-10\.qa-only\.sql/);
 assert.match(ci,/sharkania-league-real-legacy-rpc-cutover-qa\.sql/);
 assert.match(ci,/qa_legacy_drift/);
 assert.match(ci,/Legacy RPC catalog drift/);
 assert.match(ci,/before any DDL/);
 assert.doesNotMatch(ci,/(supabase db push|supabase functions deploy|--remote|\.supabase\.co|nhpjzywfzljtlqaigzed)/);
});
