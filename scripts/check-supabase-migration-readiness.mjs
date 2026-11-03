/**
 * Fail-closed, offline Supabase migration readiness check.
 *
 *   npm run qa:migrations:history   -> verifies all historical SQL files and hashes
 *   npm run qa:migrations           -> also requires an initial schema baseline
 *
 * No credentials, network calls, SQL execution, costs or database writes.
 * A green history check alone is NOT proof fresh QA database creation will work.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

const dir = resolve("supabase/migrations");
const lockPath = resolve("supabase/migration-history.lock.json");
const historyOnly = process.argv.includes("--history-only");

function gitBlobSha(source) {
  const bytes = Buffer.from(source, "utf8");
  return createHash("sha1")
    .update(Buffer.from("blob " + bytes.length + "\0"))
    .update(bytes)
    .digest("hex");
}

if (!existsSync(dir) || !existsSync(lockPath)) {
  console.error("QA NO-GO: required migrations or migration-history.lock.json not found.");
  process.exitCode = 2;
} else {
  const lock = JSON.parse(readFileSync(lockPath, "utf8"));
  const names = readdirSync(dir).filter(n => n.endsWith(".sql")).sort();
  const malformed = names.filter(n => !/^\d{14}_[a-zA-Z0-9_-]+\.sql$/.test(n));
  const duplicates = names.map(n => n.slice(0,14)).filter((v,i,a) => a.indexOf(v) !== i);
  const historical = lock.applied_migrations || [];
  const missing = historical.filter(m => !names.includes(m.file));
  const altered = historical.filter(m => {
    if (!names.includes(m.file)) return false;
    return gitBlobSha(readFileSync(join(dir,m.file),"utf8")) !== m.git_blob_sha1;
  });
  const allSql = names.map(n => readFileSync(join(dir,n),"utf8")).join("\n");
  // Full inventory of public tables from production metadata (no row data).
  // The initial schema is older than the oldest recorded migration. This is a
  // necessary table-only check; views, roles, functions and RLS also need QA.
  const inventory = JSON.parse(readFileSync(resolve("supabase/schema-baseline-requirements.json"), "utf8"));
  const requiredBaselineObjects = inventory.current_public_tables;
  if (!Array.isArray(requiredBaselineObjects) || requiredBaselineObjects.length < 64) {
    throw new Error("QA NO-GO: incomplete public table inventory");
  }
  const missingBaselineObjects = requiredBaselineObjects.filter(table => {
    const matcher = new RegExp("CREATE\\s+TABLE\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?(?:public\\.)?\"?" + table + "\"?\\b","i");
    return !matcher.test(allSql);
  });
  console.log("Sharkania: " + historical.length + " locked applied migrations; " + names.length + " SQL files.");

  if (malformed.length) console.error("Malformed migration names: " + malformed.join(", "));
  if (duplicates.length) console.error("Duplicate migration versions: " + [...new Set(duplicates)].join(", "));
  if (missing.length) console.error("Missing applied SQL: " + missing.map(m => m.version).join(", "));
  if (altered.length) console.error("Previously applied SQL was changed: " + altered.map(m => m.version).join(", "));

  const historicalOk = !malformed.length && !duplicates.length && !missing.length && !altered.length
    && historical.length === 50;
  if (!historicalOk) {
    console.error("QA NO-GO: the recorded production migration history is not faithfully preserved.");
    process.exitCode = 2;
  } else {
    console.log("PASS: all 50 historically applied migration files match the recovered SQL hashes.");
    if (!historyOnly) {
      if (missingBaselineObjects.length) {
        console.error("QA NO-GO: schema baseline lacks CREATE TABLE for " + missingBaselineObjects.length + " / " + requiredBaselineObjects.length + " public tables.");
        console.error("Examples: " + missingBaselineObjects.slice(0, 15).join(", "));
        console.error("Existing production tables predate the first recorded migration; an approved, schema-only baseline is required.");
        console.error("Do NOT create another billed Supabase branch or repair production migration history yet.");
        process.exitCode = 2;
      } else {
        console.log("Preliminary schema checks passed; a fresh local database reset and test user flows are still required.");
      }
    }
  }
}
