import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const catalog = JSON.parse(readFileSync(new URL("../docs/security/supabase-schema-catalog-2026-11-03.json", import.meta.url), "utf8"));
const baseline = JSON.parse(readFileSync(new URL("../supabase/schema-baseline-requirements.json", import.meta.url), "utf8"));
const obj = catalog.objects;

test("Only schema metadata is exported (no account rows or function bodies)", () => {
  assert.equal(catalog.schemaVersion, 1);
  assert.equal(catalog.readOnly, true);
  assert.equal(catalog.notExecutableMigration, true);
  assert.ok(catalog.scope.includes("no rows"));
  assert.deepEqual(Object.fromEntries(Object.entries(obj).map(([name,rows])=>[name,rows.length])),{
    tables: 64, columns: 567, constraints: 184, indexes: 138, functions: 194,
    triggers: 22, policies: 185, views: 2, enums: 77, extensions: 9
  });
  assert.ok(!obj.functions.some(f => "body" in f || "definition" in f));
  assert.ok(!obj.policies.some(p => "expression" in p || "qual" in p || "using" in p));
  assert.ok(!obj.tables.some(t => "rows" in t || "data" in t));
});

test("Catalog table names reconcile with prehistory baseline inventory", () => {
  const tableNames = obj.tables.map(t => t.name).sort();
  assert.deepEqual(tableNames, [...baseline.current_public_tables].sort());
  const known = new Set(tableNames);
  assert.ok(obj.columns.every(x => known.has(x.table_name)));
  assert.ok(obj.constraints.every(x => x.table_name === "" || known.has(x.table_name)));
  assert.ok(obj.indexes.every(x => known.has(x.table_name)));
  assert.ok(obj.policies.every(x => known.has(x.table_name)));
  assert.ok(obj.triggers.every(x => known.has(x.table_name)));
});

test("Local schema-only export never requests data or passes credentials as arguments", () => {
  const script = readFileSync(new URL("../scripts/export-supabase-schema-only.ps1", import.meta.url), "utf8");
  assert.match(script, /supabase db dump --schema public --file/);
  assert.match(script, /supabase db dump --schema private --file/);
  assert.match(script, /nhpjzywfzljtlqaigzed/);
  assert.match(script, /OutputDirectory/);
  assert.doesNotMatch(script, /& supabase db dump [^\n]+--data-only/);
  assert.doesNotMatch(script, /& supabase db dump [^\n]+--role-only/);
  assert.doesNotMatch(script, /service_role\s*[:=]\s*['"]/i);
});


test("History hash verification succeeds but full migration readiness fails closed", () => {
  const options = { cwd: new URL("../", import.meta.url).pathname, encoding: "utf8" };
  const history = spawnSync(process.execPath, ["scripts/check-supabase-migration-readiness.mjs", "--history-only"], options);
  assert.equal(history.status, 0, history.stderr);
  assert.match(history.stdout, /PASS: all 50 historically applied migration files/);

  const full = spawnSync(process.execPath, ["scripts/check-supabase-migration-readiness.mjs"], options);
  assert.equal(full.status, 2, "Do not silently approve paid QA branching without initial schema");
  assert.match(full.stderr, /QA NO-GO: schema baseline lacks CREATE TABLE/);
});
