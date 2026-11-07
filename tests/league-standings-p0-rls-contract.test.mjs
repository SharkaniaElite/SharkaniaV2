import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const sql=readFileSync(new URL(
 "../docs/security/league-standings-rls-p0-2026-11-07.qa-only.sql",import.meta.url),"utf8");
const qa=readFileSync(new URL(
 "./fixtures/sharkania-p0-league-standings-rls-qa.sql",import.meta.url),"utf8");
const legacy=readFileSync(new URL(
 "./fixtures/sharkania-p0-standings-legacy-compat-qa.sql",import.meta.url),"utf8");

test("rejects changed production policy landscape before attempting a rewrite",()=>{
 assert.match(sql,/v_expected<>3/);
 assert.match(sql,/unreviewed standings write policy detected/);
 assert.match(sql,/RAISE EXCEPTION 'STOP:/);
 for(const verb of ["actualizar","eliminar","insertar"]){
  assert.match(sql,new RegExp('DROP POLICY IF EXISTS "Permitir '+verb+' a usuarios autenticados"'));
 }
});
test("single reusable partial unique index protects primary league organizer integrity",()=>{
 assert.match(sql,/CREATE UNIQUE INDEX IF NOT EXISTS league_clubs_one_primary_per_league_guarded/);
 assert.match(sql,/ON public\.league_clubs\(league_id\) WHERE is_primary IS TRUE/);
 assert.match(qa,/secondary club can self-promote and create TWO primaries/);
 assert.match(qa,/unique partial index blocks secondary self-promotion/);
});
test("authorization is a bounded league list not N correlated standings lookups",()=>{
 const parts=sql.match(/league_standings\.league_id IN \(/g)||[];
 assert.equal(parts.length,4,"INSERT, UPDATE USING, UPDATE CHECK, DELETE");
 assert.equal((sql.match(/GROUP BY lc\.league_id/g)||[]).length,4);
 assert.equal((sql.match(/HAVING count\(\*\)=1/g)||[]).length,4);
 assert.equal((sql.match(/pg_catalog\.bool_or\(public\.is_club_admin\(lc\.club_id\)\)/g)||[]).length,4);
 assert.match(sql,/ON public\.league_standings FOR UPDATE TO authenticated\s+USING/);
 assert.match(sql,/WITH CHECK/);
 assert.doesNotMatch(sql,/CREATE POLICY[\s\S]{0,120}auth\.role\(\)/i);
});
test("CI tests legacy invoker admin operations, RLS denial, and full rollback",()=>{
 assert.match(qa,/player cannot INSERT, UPDATE or DELETE standings/);
 assert.match(qa,/secondary admin barred/);
 assert.match(qa,/WITH CHECK rejects cross-league/);
 assert.match(qa,/superadmin permissions retained/);
 assert.match(qa,/anon cannot write but can read public standings/);
 assert.match(qa,/\\ir sharkania-p0-standings-legacy-compat-qa\.sql/);
 assert.match(qa,/ROLLBACK/);
 assert.match(legacy,/SECURITY INVOKER/);
 assert.match(legacy,/legacy invoker delete\/insert\/update workflow/);
 assert.match(legacy,/secondary club cannot invoke old multi-step writer/);
 assert.match(legacy,/EXPLAIN \(FORMAT JSON\) UPDATE/);
 assert.doesNotMatch(legacy,/EXPLAIN \(ANALYZE/i);
});
