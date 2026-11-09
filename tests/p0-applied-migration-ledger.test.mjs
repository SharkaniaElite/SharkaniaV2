import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sql = readFileSync(new URL("../supabase/migrations/20261107191558_p0_restrict_league_standings_rls_20261107.sql", import.meta.url), "utf8");
const evidence = readFileSync(new URL("../docs/security/league-standings-p0-production-applied-2026-11-07.md", import.meta.url), "utf8");

test("the P0 migration is the original one-time fail-closed transaction", () => {
  assert.match(sql, /^BEGIN;/);
  assert.match(sql, /SET LOCAL lock_timeout=/);
  assert.match(sql, /SET LOCAL statement_timeout=/);
  assert.match(sql, /5789/);
  assert.match(sql, /n<>41/);
  assert.match(sql, /index preexists, review its exact definition/);
  assert.match(sql, /legacy standings policy landscape changed/);
  assert.match(sql, /unreviewed standings write policy detected/);
  assert.match(sql, /COMMIT;\s*$/);
});

test("the policy replacement restricts writes and preserves public reading", () => {
  for (const action of ["insert", "update", "delete"]) {
    assert.match(sql, new RegExp("CREATE POLICY standings_primary_guarded_" + action + "_p0"));
    assert.match(sql, new RegExp("ON public\\.league_standings FOR " + action.toUpperCase() + " TO authenticated"));
  }
  assert.match(sql, /ON public\.league_standings FOR UPDATE TO authenticated\s+USING/);
  assert.match(sql, /WITH CHECK/);
  assert.match(sql, /league_clubs_one_primary_per_league_guarded/);
  assert.doesNotMatch(sql, /DROP POLICY.*lectura publica/i);
});

test("deployment evidence says already applied and forbids replay", () => {
  assert.match(evidence, /APLICADO Y VERIFICADO EN SUPABASE PRODUCTIVO/);
  assert.match(evidence, /20261107191558/);
  assert.match(evidence, /No ejecutar otra vez este procedimiento/);
  assert.match(evidence, /5\.789 \/ 5\.789/);
});
