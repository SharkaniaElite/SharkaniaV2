import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const client = read("src/lib/api/guarded-elo.ts");
const engine = read("src/lib/api/elo-engine.ts");
const sql = read("docs/security/elo-transactional-guarded-rpc-2026-11-03.proposal.sql");
const workflow = read(".github/workflows/core-supabase-rls-qa.yml");
const fixture = read("tests/fixtures/sharkania-elo-qa-reentries.sql");

test("Guarded ELO remains disabled unless explicitly opted in", () => {
  assert.match(client, /VITE_ELO_GUARDED_RPC === "true"/);
  assert.match(client, /supabase\.rpc\("calculate_tournament_elo_guarded"/);
  assert.match(client, /p_tournament_id: tournamentId/);
  assert.match(engine, /if \(GUARDED_ELO_RPC_ENABLED\) return calculateEloThroughGuardedRpc\(tournamentId\)/);
  assert.match(client, /if \(error\)\s*\{/);
  assert.doesNotMatch(client, /\.from\(["']players["']\)\.update/);
  assert.doesNotMatch(client, /calculateElo\(/);
  assert.match(client, /No se ejecutó el cálculo alternativo desde el navegador/);
});

test("Reverse ELO is blocked in guarded mode until a protected reset exists", () => {
  assert.match(engine, /export async function reverseElo/);
  assert.match(engine, /if \(GUARDED_ELO_RPC_ENABLED\)\s*\{\s*return \{ success: false/);
});

test("SQL preserves Elo rating formula but charges each actual entry", () => {
  assert.match(sql, /v_k := \(CASE WHEN v_result\.total_tournaments < 30 THEN 40 ELSE 20 END\)/);
  assert.match(sql, /log\(10::numeric,v_buy_in\+1::numeric\)/);
  assert.match(sql, /tr\.buy_ins_count <> trunc\(tr\.buy_ins_count\)/);
  assert.match(sql, /total_buy_ins_spent=p\.total_buy_ins_spent\+v_buy_in\*v_result\.buy_ins_count/);
  assert.match(sql, /Existing ELO history requires reconciliation/);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.calculate_tournament_elo_guarded\(uuid\) FROM anon/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.calculate_tournament_elo_guarded\(uuid\) TO authenticated/);
});

test("Continuous integration exercises real PostgreSQL reentries and concurrency with synthetic data", () => {
  assert.match(workflow, /sharkania-elo-qa-reentries\.sql/);
  assert.match(workflow, /sharkania-elo-qa-concurrency-assert\.sql/);
  assert.match(fixture, /total_buy_ins_spent[\s\S]*<> 40/);
  assert.match(fixture, /buy_ins_count\) VALUES/);
  assert.match(fixture, /invalid reentry count was accepted/);
});

test.todo("Run guarded ELO RPC with full Supabase QA schema and real Auth/RLS test roles");
test.todo("Validate admin upload, guarded re-edit/reverse, standings and mixed-currency accounting on QA");
test.todo("Reconcile historical buy-ins before any production data correction");
