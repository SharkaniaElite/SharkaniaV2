import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";

const root = new URL("../supabase/", import.meta.url);
const dir = new URL("./migrations/", root);
const lock = JSON.parse(readFileSync(new URL("./migration-history.lock.json", root), "utf8"));

function gitBlobSha(source) {
  const buf = Buffer.from(source, "utf8");
  return createHash("sha1").update(Buffer.from("blob " + buf.length + "\0")).update(buf).digest("hex");
}

test("50 Supabase applied migration versions are preserved, unique and ordered", () => {
  assert.equal(lock.schema_version, 1);
  assert.equal(lock.applied_migrations.length, 50);
  const versions = lock.applied_migrations.map(x => x.version);
  assert.equal(new Set(versions).size, versions.length);
  assert.deepEqual(versions, [...versions].sort());
  const names = readdirSync(dir).filter(n => n.endsWith(".sql"));
  for (const name of names) {
    assert.match(name, /^\d{14}_[a-zA-Z0-9_-]+\.sql$/, "Malformed migration name: " + name);
  }
  const allVersions = names.map(n => n.slice(0, 14));
  assert.equal(new Set(allVersions).size, allVersions.length, "Migration versions must be unique");
  for (const row of lock.applied_migrations) {
    assert.match(row.version, /^\d{14}$/);
    assert.ok(row.file.startsWith(row.version + "_"), row.file);
    assert.ok(existsSync(new URL("./migrations/" + row.file, root)), "Missing SQL: " + row.file);
  }
});

test("Original production migration SQL stays byte-identical to the recovered lock", () => {
  for (const row of lock.applied_migrations) {
    const actual = readFileSync(new URL("./migrations/" + row.file, root), "utf8");
    assert.equal(gitBlobSha(actual), row.git_blob_sha1, "Applied historical SQL changed: " + row.file);
  }
});

test("Production table inventory documents 54 missing prehistory CREATE TABLE definitions", () => {
  const inventory = JSON.parse(readFileSync(new URL("./schema-baseline-requirements.json", root), "utf8"));
  assert.equal(inventory.current_public_tables.length, 64);
  assert.equal(inventory.without_creation_in_recorded_history.length, 54);
  for (const table of ["players", "profiles", "tournaments", "tournament_results", "clubs", "club_admins", "leagues", "user_purchases"]) {
    assert.ok(inventory.without_creation_in_recorded_history.includes(table), "Missing base table: " + table);
  }
});

test("Before creating paid QA branches, use the separate baseline readiness gate", () => {
  const preflight = readFileSync(new URL("../scripts/check-supabase-migration-readiness.mjs", import.meta.url), "utf8");
  assert.match(preflight, /missingBaselineObjects/);
  assert.match(preflight, /QA NO-GO/);
  assert.match(preflight, /migration-history\.lock\.json/);
});
