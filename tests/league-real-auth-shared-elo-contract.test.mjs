import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const authWorkflow=read(".github/workflows/qa-league-nickname-real-auth.yml");
const authTest=read("tests/fixtures/sharkania-league-nickname-real-auth-qa.mjs");
const raceWorkflow=read(".github/workflows/qa-league-cross-tournament-concurrency.yml");
const first=read("tests/fixtures/sharkania-league-cross-tournament-first-qa.sql");
const second=read("tests/fixtures/sharkania-league-cross-tournament-second-qa.sql");
const assertSQL=read("tests/fixtures/sharkania-league-cross-tournament-assert-qa.sql");

test("GoTrue/PostgREST uses real JWTs but STRICTLY loopback-only Supabase",()=>{
 assert.match(authWorkflow,/Initialize ephemeral, unlinked local Supabase/);
 assert.match(authWorkflow,/supabase" init/);
 assert.match(authWorkflow,/supabase" start/);
 assert.match(authWorkflow,/QA_SUPABASE_URL: http:\/\/127\.0\.0\.1:25421/);
 assert.match(authWorkflow,/PGPORT: "25422"/);
 assert.match(authWorkflow,/Stop ephemeral local stack/);
 assert.match(authWorkflow,/nickname-real-auth-qa\.mjs/);
 assert.match(authWorkflow,/docs\/security\/league-atomic-nickname-currency-2026-11-09\.qa-only\.sql/);
 assert.match(authTest,/admin\.auth\.admin\.createUser/);
 assert.match(authTest,/client\.auth\.signInWithPassword/);
 assert.match(authTest,/client\.auth\.getUser\(jwt\)/);
 assert.match(authTest,/\/rest\/v1\/rpc\/publish_league_nickname_results_guarded_qa/);
 assert.match(authTest,/base!=="http:\/\/127\.0\.0\.1:25421"/);
 assert.match(authTest,/role!==.*player/);
 assert.match(authTest,/spoofed CSV player ID rejected/);
 assert.match(authTest,/secondary club cannot publish/);
 assert.match(authTest,/repeat results publication denied/);
 assert.doesNotMatch(authWorkflow,/(supabase db push|supabase functions deploy|--remote|--linked|nhpjzywfzljtlqaigzed|\.supabase\.co)/);
 assert.doesNotMatch(authTest,/(https:\/\/[^ ]+\.supabase\.co|nhpjzywfzljtlqaigzed)/);
});

test("two distinct tournaments share exact player IDs, serialise and continue Elo, without replay",()=>{
 assert.match(raceWorkflow,/image: postgres:17/);
 assert.match(raceWorkflow,/PGHOST: 127\.0\.0\.1/);
 assert.match(raceWorkflow,/Race two DIFFERENT tournaments sharing players/);
 assert.match(raceWorkflow,/wait_event_type='Lock'/);
 assert.match(raceWorkflow,/observed.*true/);
 assert.match(first,/00000000-0000-0000-0000-000000000094/);
 assert.match(second,/00000000-0000-0000-0000-000000000095/);
 for(const name of ["SharkHero","PokerQueen"]){
   assert.ok(first.includes(name));
   assert.ok(second.includes(name));
 }
 assert.match(first,/pg_catalog\.pg_sleep\(4\)/);
 assert.match(first,/^COMMIT;/m);
 assert.match(second,/^COMMIT;/m);
 assert.match(assertSQL,/a\.elo_after=b\.elo_before/);
 assert.match(assertSQL,/p\.total_tournaments<>2/);
 assert.match(assertSQL,/total_entry_spend=9\.90/);
 assert.match(assertSQL,/count\(\*\) FROM public\.elo_history/);
 assert.match(assertSQL,/count\(\*\) FROM sharkania_release_qa\.elo_player_checkpoint/);
 assert.doesNotMatch(raceWorkflow,/(supabase db push|supabase functions deploy|--remote|nhpjzywfzljtlqaigzed|\.supabase\.co)/);
});
