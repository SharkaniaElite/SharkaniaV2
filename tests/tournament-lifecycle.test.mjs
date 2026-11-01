import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import typescript from "typescript";

const source = readFileSync("src/lib/tournament-lifecycle.ts", "utf8");
const compiled = typescript.transpileModule(source, {
  compilerOptions: { module: typescript.ModuleKind.CommonJS, target: typescript.ScriptTarget.ES2022 },
}).outputText;
const lifecycle = {};
runInNewContext(compiled, { exports: lifecycle, Date });

const now = Date.UTC(2026, 10, 1, 12, 0, 0);
const event = (daysAgo, results_uploaded = false, status = "scheduled") => ({
  start_datetime: new Date(now - daysAgo * 86_400_000).toISOString(),
  results_uploaded,
  status,
});

test("public tournament lifecycle respects exact seven-day boundary", () => {
  assert.equal(lifecycle.getTournamentLifecyclePhase(event(-1), now), "upcoming");
  assert.equal(lifecycle.getTournamentLifecyclePhase(event(0), now), "pending");
  assert.equal(lifecycle.getTournamentLifecyclePhase(event(6.99), now), "pending");
  assert.equal(lifecycle.getTournamentLifecyclePhase(event(7), now), "archived");
  assert.equal(lifecycle.getTournamentLifecyclePhase(event(8), now), "archived");
});

test("results are never archived; cancelled events and invalid dates are hidden", () => {
  assert.equal(lifecycle.getTournamentLifecyclePhase(event(700, true), now), "results");
  assert.equal(lifecycle.getTournamentLifecyclePhase(event(1, false, "cancelled"), now), "archived");
  assert.equal(lifecycle.getTournamentLifecyclePhase({start_datetime:"invalid",results_uploaded:false},now), "archived");
  assert.equal(lifecycle.getTournamentLifecyclePhase(event(1, false, "live"),now), "upcoming");
  assert.equal(lifecycle.isPublicTournamentVisible(event(8),now),false);
  assert.equal(lifecycle.isPublicTournamentVisible(event(8,true),now),true);
});

test("the SQL cut-off uses UTC instants and not local calendar days", () => {
  assert.equal(lifecycle.publicTournamentCutoffIso(now), new Date(now-7*86400000).toISOString());
  assert.equal(lifecycle.TOURNAMENT_GRACE_PERIOD_DAYS,7);
});
