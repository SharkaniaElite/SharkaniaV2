import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=(p)=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const legacy=read("docs/security/league-atomic-first-upload-2026-11-06.qa-only.sql");
const v2=read("docs/security/league-atomic-results-currency-neutral-v2-2026-11-09.qa-only.sql");
const nick=read("docs/security/league-atomic-nickname-currency-neutral-v2-2026-11-09.qa-only.sql");
const qa=read("tests/fixtures/sharkania-league-future-multicurrency-v2-qa.sql");
const workflow=read(".github/workflows/qa-league-release-final-readiness.yml");
const replayPlan=read("src/lib/elo-replay-preflight.ts");
const replayPreview=read("src/lib/elo-replay-simulator.ts");
const destructive=read("tests/fixtures/sharkania-league-legacy-destructive-fence-qa.sql");

test("v2 is an explicitly named QA candidate and cannot silently overwrite v1",()=>{
 assert.match(v2,/NOT A MIGRATION, NOT APPROVED FOR PRODUCTION/);
 assert.match(v2,/CREATE OR REPLACE FUNCTION public\.publish_league_results_v2_qa/);
 assert.match(nick,/CREATE OR REPLACE FUNCTION public\.publish_league_nickname_results_v2_qa/);
 assert.match(legacy,/CREATE OR REPLACE FUNCTION public\.publish_league_results_guarded_qa/);
 assert.doesNotMatch(v2,/CREATE OR REPLACE FUNCTION public\.publish_league_results_guarded_qa/);
 assert.doesNotMatch(nick,/CREATE OR REPLACE FUNCTION public\.publish_league_nickname_results_guarded_qa/);
 assert.match(v2,/currency-neutral-v2-PROPOSAL/);
 assert.match(nick,/public\.publish_league_results_v2_qa/);
 assert.doesNotMatch(legacy,/currency-neutral-v2-PROPOSAL/);
 assert.match(v2,/REVOKE EXECUTE ON FUNCTION public\.publish_league_results_v2_qa/);
 assert.match(nick,/REVOKE EXECUTE ON FUNCTION public\.publish_league_nickname_results_v2_qa/);
});

test("proposed ELO K removes numeric entry, preserves old Elo and money cannot cross currencies",()=>{
 assert.match(legacy,/\*\(1\+pg_catalog\.log\(v_buyin\+1\)\*0\.1\)/);
 assert.doesNotMatch(v2,/\*\(1\+pg_catalog\.log\(v_buyin\+1\)\*0\.1\)/);
 assert.match(v2,/Mixed-currency league requires currency-aware standings/);
 assert.match(v2,/same_league\.league_id=v_league/);
 assert.match(v2,/total_prize_won=p\.total_prize_won\+/);
 assert.match(v2,/CASE WHEN v_currency='USD' THEN x\.prize_won\+x\.bounties_won ELSE 0 END/);
 assert.match(v2,/CASE WHEN v_currency='USD' THEN v_buyin ELSE 0 END/);
 assert.match(qa,/elo_rating=1220\.90/);
 assert.match(qa,/elo_rating=1179\.10/);
 assert.match(qa,/entry_spend=6600/);
 assert.match(qa,/entry_spend=36/);
 assert.match(qa,/MixedLeagueA/);
 assert.match(qa,/^ROLLBACK;/m);
});

test("historical edit/delete remain previews ONLY, require checkpoints and fail closed",()=>{
 assert.match(replayPlan,/historicalDataCandidate: blockers\.length === 0/);
 assert.match(replayPlan,/ambiguous_publication_order/);
 assert.match(replayPlan,/elo_chain_break/);
 assert.match(replayPreview,/safeToApply: false/);
 assert.match(replayPreview,/A verified checkpoint is required for each affected player/);
 assert.match(replayPreview,/e\.currency!=="USD"/);
 assert.match(replayPreview,/Never assume ELO 1200/);
 assert.doesNotMatch(replayPreview,/supabase\.rpc|supabase\.from|fetch\(|DELETE FROM|UPDATE public\./i);
 assert.match(destructive,/^ROLLBACK;/m);
 assert.match(workflow,/node --test tests\/elo-replay-preflight\.test\.mjs/);
 assert.match(workflow,/node --test tests\/elo-replay-simulator\.test\.mjs/);
});

test("backup and restore happen ONLY inside disposable PG17, comparing full table fingerprints",()=>{
 assert.match(workflow,/image: postgres:17/);
 assert.match(workflow,/PGHOST: 127\.0\.0\.1/);
 assert.match(workflow,/qa_release_final/);
 assert.match(workflow,/pg_dump -F c/);
 assert.match(workflow,/pg_restore --exit-on-error/);
 assert.match(workflow,/qa_release_restored/);
 assert.match(workflow,/sharkania_release_qa\.currency_posting/);
 assert.match(workflow,/public\.elo_history/);
 assert.match(workflow,/pg_catalog\.md5/);
 assert.match(workflow,/qa-release-.*\.dump/);
 assert.doesNotMatch(workflow,/(supabase db push|--remote|--linked|\.supabase\.co|nhpjzywfzljtlqaigzed)/);
});
