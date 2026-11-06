import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const sql=readFileSync(new URL("../docs/security/league-standings-guarded-2026-11-05.qa-only.sql",import.meta.url),"utf8");
const qa=readFileSync(new URL("./fixtures/sharkania-league-standings-guarded-assert.sql",import.meta.url),"utf8");

test("QA guarded RPC authenticates real identity, primary organizer and limits EXECUTE",()=>{
 assert.match(sql,/\(SELECT auth\.uid\(\)\) IS NULL/);
 assert.match(sql,/public\.is_club_admin\(v_primary\)/);
 assert.match(sql,/public\.is_super_admin\(\)/);
 assert.match(sql,/v_primary_count<>1/);
 assert.match(sql,/REVOKE ALL ON FUNCTION public\.recalculate_league_standings_guarded\(uuid\)/);
 assert.match(sql,/FROM PUBLIC,anon,authenticated/);
 assert.match(sql,/GRANT EXECUTE ON FUNCTION public\.recalculate_league_standings_guarded\(uuid\)/);
});
test("QA protected recalculation never deletes historic rows or overwrites locked fields",()=>{
 assert.doesNotMatch(sql,/DELETE\s+FROM\s+public\.league_standings/i);
 assert.match(sql,/ON CONFLICT \(league_id,player_id\)/);
 assert.match(sql,/Historical standings without source: reconciliation required/);
 assert.match(sql,/FOR UPDATE/);
 assert.match(sql,/total_points=EXCLUDED\.total_points/);
 const after=sql.split("DO UPDATE SET")[1].split("GET DIAGNOSTICS")[0];
 assert.doesNotMatch(after,/ccp_club\s*=/);
 assert.doesNotMatch(after,/total_buy_ins_spent\s*=/);
 assert.doesNotMatch(after,/last_tournament_id\s*=/);
});
test("isolated PostgreSQL QA asserts role rejection, history, idempotency",()=>{
 assert.match(qa,/secondary club B was permitted/);
 assert.match(qa,/ordinary player was permitted/);
 assert.match(qa,/orphan did not block recalc/);
 assert.match(qa,/history or existing row identity modified/);
 assert.match(qa,/idempotency mutated locked fields/);
});
