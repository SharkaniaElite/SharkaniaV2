import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sql = readFileSync(new URL("../docs/security/league-standings-shadow-2026-11-05.readonly.sql", import.meta.url), "utf8");
const doc = readFileSync(new URL("../docs/security/league-standings-shadow-findings-2026-11-05.md", import.meta.url), "utf8");

test("shadow reconciliation contains one read-only CTE/SELECT statement", () => {
  const stripped = sql.replace(/--[^\n]*/g, "").trim();
  assert.match(stripped, /^WITH inputs AS \(/);
  assert.match(stripped, /\bSELECT l\.slug AS league_slug/);
  assert.equal(stripped.split(";").length, 2, "only one SQL statement is allowed");
  assert.match(stripped, /;$/);
  // No data/schema mutation or privileged execution is permitted in this file.
  assert.doesNotMatch(stripped, /\b(CREATE|ALTER|DROP|INSERT|UPDATE|DELETE|TRUNCATE|GRANT|REVOKE|CALL|DO|EXECUTE|MERGE|COPY)\b/i);
});

test("shadow comparison preserves unmatched historical rows and deterministic ordering", () => {
  assert.match(sql, /FULL OUTER JOIN public\.league_standings s/);
  assert.match(sql, /existing_player IS NOT NULL AND source_player IS NULL/);
  assert.match(sql, /source_player IS NOT NULL AND existing_player IS NULL/);
  assert.match(sql, /score_rank <= best_dates_to_count/);
  assert.match(sql, /best_position ASC NULLS LAST, final_tables_count DESC,/);
  assert.match(sql, /player_id ASC/);
  assert.match(sql, /ccp_diff/);
  assert.match(sql, /reentries_diff/);
  assert.match(sql, /GROUP BY l\.slug/);
  assert.doesNotMatch(sql, /SELECT .*email|SELECT .*nickname/i);
});

test("release A remains blocked without business reconciliation and approvals", () => {
  assert.match(doc, /NO GO/);
  assert.match(doc, /51 posiciones históricas/);
  assert.match(doc, /reentradas con\/sin CCP/);
  assert.match(doc, /No\*\* se aplicó SQL de escritura/);
  assert.match(doc, /solicitar aprobación explícita/);
});
