/**
 * Read-only migration-preflight: check whether this checkout can initialize
 * a fresh Supabase QA database before creating a billed branch.
 *
 * No Supabase credentials, network calls or writes. EXIT 2 means QA NOT READY.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
const dir = resolve("supabase/migrations");
if (!existsSync(dir)) {
  console.error("QA NO-GO: supabase/migrations is missing.");
  process.exitCode = 2;
} else {
  const names = readdirSync(dir).filter(n => n.toLowerCase().endsWith(".sql")).sort();
  const malformed = names.filter(n => !/^\d{14}_[a-zA-Z0-9_-]+\.sql$/.test(n));
  const duplicateVersions = names.map(n => n.slice(0,14)).filter((v,i,a)=>a.indexOf(v)!==i);
  const text = names.map(n => readFileSync(join(dir,n),"utf8")).join("\n");
  const missingBaselineObjects = ["players","profiles","tournaments","tournament_results","clubs"]
    .filter(table => !new RegExp("CREATE\\s+TABLE\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?(?:public\\.)?[\x22]?" + table + "[\x22]?\\b","i").test(text));
  console.log("Supabase migration preflight: " + names.length + " SQL files.");
  if (malformed.length) console.error("Malformed migration versions:\n"+malformed.map(n=>"  - "+n).join("\n"));
  if (duplicateVersions.length) console.error("Duplicate version prefixes: "+[...new Set(duplicateVersions)].join(", "));
  if (missingBaselineObjects.length) {
    console.error("Required baseline CREATE TABLE statements not found in local migrations: "+missingBaselineObjects.join(", "));
    console.error("This is a static check, not proof of the exact provider migration failure.");
  }
  if (malformed.length || duplicateVersions.length || missingBaselineObjects.length) {
    console.error("QA NO-GO: inspect remote migration history, recover an approved schema baseline, and test locally before creating a billed Supabase branch.");
    process.exitCode = 2;
  } else {
    console.log("Local filename and baseline shape checks passed. Still validate against remote history and a local PostgreSQL instance.");
  }
}
