import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read = path => readFileSync(new URL("../"+path,import.meta.url),"utf8");
const sql=read("docs/security/league-atomic-nickname-currency-2026-11-09.qa-only.sql");
const setup=read("tests/fixtures/sharkania-league-nickname-ledger-setup-qa.sql");
const fixture=read("tests/fixtures/sharkania-league-nickname-ledger-integration-qa.sql");
const workflow=read(".github/workflows/qa-league-nickname-currency.yml");

test("no public production write or row-level bypass in deployment workflow",()=>{
  assert.match(sql,/QA PROTOTYPE ONLY/);
  assert.match(sql,/NEVER deploy to production/);
  assert.match(sql,/SET search_path TO ''/);
  assert.match(sql,/IF \(SELECT auth\.uid\(\)\) IS NULL/);
  assert.match(sql,/public\.is_club_admin\(v_primary\)/);
  assert.match(sql,/FROM PUBLIC,anon,authenticated/);
  assert.match(sql,/GRANT EXECUTE ON FUNCTION public\.publish_league_nickname_results_guarded_qa\(uuid,jsonb\)/);
  assert.match(workflow,/image: postgres:17/);
  assert.match(workflow,/PGHOST: 127\.0\.0\.1/);
  assert.doesNotMatch(workflow,/(supabase db push|supabase functions deploy|nhpjzywfzljtlqaigzed|\.supabase\.co)/);
});

test("nickname resolution strictly derives identity from room and server-side nickname",()=>{
  assert.match(sql,/t\.room_id,t\.currency,t\.buy_in/);
  assert.match(sql,/item\.value \? 'player_id'/);
  assert.match(sql,/count\(DISTINCT pg_catalog\.lower\(pg_catalog\.btrim\(nickname\)\)\)/);
  assert.match(sql,/pg_catalog\.pg_advisory_xact_lock/);
  assert.match(sql,/qa_players_normalized_nickname_room/);
  assert.match(setup,/CREATE UNIQUE INDEX qa_players_normalized_nickname_room/);
  assert.match(sql,/INSERT INTO public\.players\(nickname,room_id,country_code,elo_rating,elo_peak\)/);
  assert.match(sql,/JOIN public\.players p ON p\.room_id=v_room/);
  assert.match(sql,/public\.publish_league_results_guarded_qa\(/);
  assert.match(sql,/IF v_resolved_count<>v_rows/);
});

test("per-currency ledger is private, immutable, one-row-per-player with correct reentries",()=>{
  assert.match(setup,/CREATE TABLE sharkania_release_qa\.currency_posting/);
  assert.match(setup,/currency text NOT NULL CHECK \(currency IN \('USD','EUR','CLP'\)\)/);
  assert.match(setup,/entry_spend numeric GENERATED ALWAYS AS \(buy_in_per_entry \* buy_ins_count\) STORED/);
  assert.match(setup,/UNIQUE\(tournament_id,player_id\)/);
  assert.match(setup,/ALTER TABLE sharkania_release_qa\.currency_posting ENABLE ROW LEVEL SECURITY/);
  assert.match(setup,/REVOKE ALL ON sharkania_release_qa\.currency_posting FROM PUBLIC,anon,authenticated/);
  assert.match(setup,/BEFORE UPDATE OR DELETE ON sharkania_release_qa\.currency_posting/);
  assert.match(sql,/INSERT INTO sharkania_release_qa\.currency_posting/);
  assert.match(sql,/IF v_postings<>v_rows/);
  assert.match(sql,/IF v_currency IS DISTINCT FROM 'USD'/);
  assert.match(sql,/Non-USD league publication needs an approved Elo\/amount policy/);
  assert.doesNotMatch(sql,/UPDATE public\.players SET total_prize_won|UPDATE public\.players SET total_buy_ins_spent/);
});

test("QA proves negative authorization, normalized identity and late failure rollback",()=>{
  assert.match(fixture,/secondary club admin denied before player creation/);
  assert.match(fixture,/case\/whitespace duplicate was not rejected/);
  assert.match(fixture,/CSV-supplied player_id spoofing was accepted/);
  assert.match(fixture,/SharkHero/);
  assert.match(fixture,/NuevoTiburon/);
  assert.match(fixture,/qa-other-room-sharkhero/);
  assert.match(fixture,/p\.room_id='00000000-0000-0000-0000-000000000032'/);
  assert.match(fixture,/j\.currency='USD'/);
  assert.match(fixture,/j\.buy_ins_count=2 AND j\.entry_spend=6\.60/);
  assert.match(fixture,/pt503/i);
  assert.match(fixture,/s\.players_before IS DISTINCT FROM/);
  assert.match(fixture,/s\.results_before IS DISTINCT FROM/);
  assert.match(fixture,/s\.postings_before IS DISTINCT FROM/);
  assert.match(fixture,/^ROLLBACK;/m);
});

test("native-currency totals are grouped, never converted, and immutability is exercised",()=>{
  const currencyQA=read("tests/fixtures/sharkania-league-currency-separation-qa.sql");
  assert.match(setup,/CREATE VIEW sharkania_release_qa\.currency_totals_by_player/);
  assert.match(setup,/security_invoker = true/);
  assert.match(setup,/GROUP BY j\.player_id,j\.currency/);
  assert.match(setup,/sum\(j\.entry_spend\) AS total_entry_spend/);
  assert.match(setup,/REVOKE ALL ON sharkania_release_qa\.currency_totals_by_player/);
  for(const currency of ["USD","EUR","CLP"]) assert.ok(currencyQA.includes("currency='"+currency+"'"));
  assert.match(currencyQA,/currency='USD' AND total_entry_spend=6\.60/);
  assert.match(currencyQA,/currency='EUR' AND total_entry_spend=36/);
  assert.match(currencyQA,/currency='CLP' AND total_entry_spend=6600/);
  assert.match(currencyQA,/WHEN SQLSTATE 'PT409'/);
  assert.match(currencyQA,/has_table_privilege\('authenticated'/);
  assert.match(currencyQA,/^ROLLBACK;/m);
  assert.match(workflow,/sharkania-league-currency-separation-qa\.sql/);
});
