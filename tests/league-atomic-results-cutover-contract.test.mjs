import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const sql = read("docs/security/league-atomic-first-upload-2026-11-06.qa-only.sql");
const audit = read("docs/security/league-elo-publication-evidence-2026-11-06.qa-only.sql");
const currencyQA = read("tests/fixtures/sharkania-league-atomic-currency-gates-qa.sql");
const happyQA = read("tests/fixtures/sharkania-league-atomic-first-upload-qa.sql");
const workflow = read(".github/workflows/qa-league-atomic-results.yml");

test("writer is a QA-only initial upload and refuses historical edit and delete", () => {
  assert.match(sql, /QA-only prototype/);
  assert.match(sql, /NEVER apply to production/);
  assert.match(sql, /SECURITY DEFINER/);
  assert.match(sql, /SET search_path TO ''/);
  assert.match(sql, /IF p_operation IN \('edit','delete'\) THEN/);
  assert.match(sql, /requires full Elo replay/);
  assert.match(sql, /IF v_currency IS DISTINCT FROM 'USD'/);
  assert.match(sql, /Currency conversion rules must be approved/);
  assert.match(sql, /Unknown players: resolve nicknames before publishing/);
  assert.match(sql, /REVOKE EXECUTE ON FUNCTION public\.publish_league_results_guarded_qa/);
  assert.match(sql, /FROM PUBLIC,anon,authenticated/);
});

test("atomic ledger, history, standings and stats are written inside the same database call", () => {
  const expected = [
    "INSERT INTO sharkania_release_qa.elo_publication",
    "INSERT INTO sharkania_release_qa.elo_player_checkpoint",
    "INSERT INTO public.tournament_results",
    "INSERT INTO public.elo_history",
    "UPDATE public.players",
    "UPDATE public.tournaments",
    "public.recalculate_league_standings_guarded",
  ];
  let previous = 0;
  for (const clause of expected) {
    const position = sql.indexOf(clause);
    assert.ok(position > previous, "missing or out of order: " + clause);
    previous = position;
  }
  assert.match(sql, /pg_catalog\.sha256/);
  assert.match(sql, /v_checkpoint_rows<>v_n/);
  assert.match(audit, /BEFORE UPDATE OR DELETE ON sharkania_release_qa\.elo_publication/);
  assert.match(audit, /BEFORE UPDATE OR DELETE ON sharkania_release_qa\.elo_player_checkpoint/);
});

test("CLP, EUR and missing player ID must reject without partial data", () => {
  for (const currency of ["EUR", "CLP", "USD"]) assert.ok(currencyQA.includes("'" + currency + "'"));
  assert.match(currencyQA, /WHEN SQLSTATE 'PT409'/);
  assert.match(currencyQA, /Currency conversion rules must be approved/);
  assert.match(currencyQA, /WHEN SQLSTATE 'PT422'/);
  assert.match(currencyQA, /Unknown players:/);
  assert.match(currencyQA, /players_before IS DISTINCT FROM/);
  assert.match(currencyQA, /profiles_before IS DISTINCT FROM/);
  assert.match(currencyQA, /standings_before IS DISTINCT FROM/);
  assert.match(currencyQA, /history_before IS DISTINCT FROM/);
  assert.match(currencyQA, /results_before IS DISTINCT FROM/);
  assert.match(currencyQA, /^ROLLBACK;/m);
  assert.match(happyQA, /^ROLLBACK;/m);
});

test("CI operates only on a disposable PostgreSQL 17 instance", () => {
  assert.match(workflow, /image: postgres:17/);
  assert.match(workflow, /PGHOST: 127\.0\.0\.1/);
  assert.match(workflow, /QA_SKIP_CUTOVER=1/);
  assert.match(workflow, /sharkania-league-atomic-currency-gates-qa\.sql/);
  assert.match(workflow, /sharkania-league-atomic-first-upload-qa\.sql/);
  assert.match(workflow, /sharkania-league-atomic-volume-qa\.sql/);
  assert.doesNotMatch(workflow, /\bsupabase db push\b|\bsupabase functions deploy\b|nhpjzywfzljtlqaigzed|\.supabase\.co/);
});
