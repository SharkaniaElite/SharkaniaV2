import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const read=x=>fs.readFileSync(x,"utf8");
const client=read("src/lib/api/guarded-v2-results.ts");
const csv=read("src/components/admin/results-upload.tsx");
const editor=read("src/components/admin/results-editor.tsx");
const sql=read("docs/security/elo-v2-usd-fx-observations-2026-11-10.CANDIDATE.sql");
const writers=read("docs/security/elo-v2-usd-results-writers-2026-11-10.CANDIDATE.sql");
const config=read("supabase/config.toml");
const edge=read("supabase/functions/elo-fx-capture/index.ts");

test("v2 requires triple flag and is OFF by default",()=>{
 assert.match(client,/GUARDED_INDEPENDENT_RESULTS_RPC_ENABLED\s*&&\s*import\.meta\.env\.VITE_ELO_USD_V2_RPC\s*===\s*"true"/);
 assert.match(config,/\[functions\.elo-fx-capture\]\s+enabled = false/);
});
test("v2 browser posts only nickname/result values; no currency/FX/player ownership",()=>{
 assert.match(client,/supabase\.rpc\(endpoint/);
 assert.match(client,/publish_league_nickname_results_v2_guarded/);
 assert.match(client,/publish_independent_nickname_results_v2_guarded/);
 assert.doesNotMatch(client,/fx_rate:\s*(row|input)/);
 assert.doesNotMatch(client,/buy_in_usd:\s*(row|input)/);
 assert.doesNotMatch(client,/currency:\s*(row|input)/);
 assert.doesNotMatch(client,/player_id:\s*row/);
});
for(const [name,src] of [["CSV",csv],["editor",editor]]){
 test(name+" v2 branch always precedes old v1 and direct REST writes",()=>{
  const v2=src.indexOf("if (GUARDED_ELO_V2_RPC_ENABLED)");
  const v1=src.indexOf("if (GUARDED_LEAGUE_RPC_ENABLED && tournament.league_id)");
  const independent=src.indexOf("if (GUARDED_INDEPENDENT_RESULTS_RPC_ENABLED && !tournament.league_id)");
  assert.ok(v2>=0&&v1>v2&&independent>v2);
  const part=src.slice(v2,v1);
  assert.match(part,/publishInitialResultsV2/);
  assert.match(part,/return; \/\/ NO fall back/);
  assert.doesNotMatch(part,/calculateElo\(/);
  assert.doesNotMatch(part,/\.from\("players"\)/);
 });
}
test("FX functions are inaccessible to browser; rate receipt timestamp generated in DB",()=>{
 assert.match(sql,/first_seen_at timestamptz NOT NULL DEFAULT clock_timestamp\(\)/);
 assert.match(sql,/fx\.first_seen_at<=v_start/);
 assert.match(sql,/CREATE TABLE sharkania_release\.fx_feed_check_v2/);
 assert.match(sql,/ch\.checked_at<=v_start/);
 assert.match(sql,/ch\.checked_at>=v_start-interval '2 hours'/);
 assert.match(sql,/v_last_check\.newest_effective_date IS DISTINCT FROM/);
 assert.match(sql,/CREATE FUNCTION public\.sharkania_fx_record_feed_check_v2/);
 assert.match(sql,/effective_date<=v_date/);
 assert.match(sql,/CREATE FUNCTION public\.sharkania_fx_ingest_official_v2/);
 assert.match(sql,/GRANT EXECUTE ON FUNCTION\s+public\.sharkania_fx_ingest_official_v2[\s\S]*?TO service_role/);
 assert.match(sql,/enabled boolean NOT NULL DEFAULT false/);
 assert.match(sql,/block_new_league_v1_after_cutover/);
 assert.match(sql,/block_new_independent_v1_after_cutover/);
});
test("v2 writers apply USD only in Elo K; keep native-currency journals",()=>{
 assert.match(writers,/CREATE OR REPLACE FUNCTION sharkania_release\.publish_results_initial_v2/);
 assert.match(writers,/CREATE OR REPLACE FUNCTION public\.publish_league_nickname_results_v2_guarded/);
 assert.match(writers,/CREATE FUNCTION public\.publish_independent_nickname_results_v2_guarded/);
 assert.match(writers,/pg_catalog\.log\(v_buyin_usd\+1\)/);
 assert.match(writers,/reserve_usd_elo_v2\(p_tournament_id\)/);
 assert.match(writers,/CASE WHEN v_currency='USD' THEN x\.prize_won\+x\.bounties_won ELSE 0 END/);
 assert.match(writers,/independent_currency_posting/);
 assert.match(writers,/currency_posting/);
 assert.match(writers,/'algorithm_version','elo-v2-usd-normalized'/);
 assert.match(writers,/OR e\.value \? 'fx_rate'/);
});
test("official capture disabled in config, uses secret-only service access and pinned endpoints",()=>{
 assert.match(edge,/withSupabase\(\{auth:"secret:elo-fx-scheduler"\}/);
 assert.match(edge,/BCCH_BDE_API_TOKEN/);
 assert.match(edge,/si3\.bcentral\.cl/);
 assert.match(edge,/data-api\.ecb\.europa\.eu/);
 assert.match(edge,/sharkania_fx_ingest_official_v2/);
 assert.match(edge,/sharkania_fx_record_feed_check_v2/);
 assert.doesNotMatch(edge,/console\.log\(.*token/i);
});
