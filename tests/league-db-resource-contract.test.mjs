import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const writer=readFileSync(new URL(
 "../docs/security/league-atomic-first-upload-2026-11-06.qa-only.sql",import.meta.url),"utf8");
const standings=readFileSync(new URL(
 "../docs/security/league-standings-guarded-2026-11-05.qa-only.sql",import.meta.url),"utf8");
const qa=readFileSync(new URL(
 "./fixtures/sharkania-league-atomic-first-upload-qa.sql",import.meta.url),"utf8");

test("initial upload must batch Elo calculations and not issue N per-player queries",()=>{
 assert.match(writer,/WITH entries AS[\s\S]*?factors AS[\s\S]*?changes AS/);
 assert.match(writer,/jsonb_agg\(/);
 assert.doesNotMatch(writer,/FOR v_row IN|FOR v_player IN/);
 assert.doesNotMatch(writer,/LOOP[\s\S]*?SELECT p\.elo_rating,p\.total_tournaments/i);
});
test("profiles use one set-oriented update and avoid per-alias queries",()=>{
 assert.match(writer,/WITH affected_profiles AS MATERIALIZED/);
 assert.match(writer,/UPDATE public\.profiles prof SET unified_elo=x\.unified_elo/);
 assert.match(writer,/prof\.unified_elo IS DISTINCT FROM x\.unified_elo/);
 assert.doesNotMatch(writer,/FOR v_profile IN/);
});
test("publication uses one canonical server fingerprint and batch N-of-N checkpoints",()=>{
 assert.match(writer,/pg_catalog\.sha256\(/);
 assert.match(writer,/ORDER BY x\.position/);
 assert.match(writer,/INSERT INTO sharkania_release_qa\.elo_publication/);
 assert.match(writer,/INSERT INTO sharkania_release_qa\.elo_player_checkpoint/);
 assert.match(writer,/v_checkpoint_rows<>v_n/);
 assert.match(qa,/qa_fail_checkpoint_insert/);
 assert.match(qa,/qa_fault_inject_standing/);
});
test("standings avoid re-writing unchanged ranks to reduce WAL and IO",()=>{
 assert.match(standings,/INSERT INTO public\.league_standings AS existing/);
 assert.match(standings,/LEFT JOIN public\.league_standings prior/);
 assert.match(standings,/prior\.player_id IS NULL OR/);
 assert.match(standings,/IS DISTINCT FROM\s*\(/);
 assert.match(standings,/updated_at=pg_catalog\.now\(\)/);
 const guarded=readFileSync(new URL("./fixtures/sharkania-league-standings-guarded-assert.sql",import.meta.url),"utf8");
 assert.match(guarded,/repeated unchanged recalc writes ZERO rows/);
});
