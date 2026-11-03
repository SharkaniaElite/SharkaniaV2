/** Offline SHA and structural verification of two local Sharkania schema-only dumps.
 * Usage: node scripts/verify-supabase-schema-snapshots.mjs <public.sql> <private.sql>
 * DO NOT commit the dumps. Does not inspect or alter a remote database.
 * Passing means "snapshot captured", NOT "historical migrations reproducible".
 */
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

if (process.argv.length !== 4) {
  console.error('Usage: node scripts/verify-supabase-schema-snapshots.mjs <public.sql> <private.sql>');
  process.exit(2);
}
const problems = [];
const count = (sql, re) => [...sql.matchAll(re)].length;
function inspect(path, schema) {
  let sql;
  try { sql = readFileSync(path, 'utf8'); }
  catch { console.error('Cannot read the ' + schema + ' file.'); process.exit(2); }
  const counts = {
    tables: count(sql, /^CREATE TABLE /gm),
    views: count(sql, /^CREATE VIEW /gm),
    functions: count(sql, /^CREATE FUNCTION /gm),
    triggers: count(sql, /^CREATE TRIGGER /gm),
    policies: count(sql, /^CREATE POLICY /gm),
    rls: count(sql, /^ALTER TABLE [\w.]+ ENABLE ROW LEVEL SECURITY;/gm)
  };
  if (!sql.startsWith('--\n-- PostgreSQL database dump\n--') || !sql.includes('-- PostgreSQL database dump complete')) problems.push(schema + ': incomplete pg_dump');
  if (!sql.includes('CREATE SCHEMA ' + schema + ';')) problems.push(schema + ': missing schema DDL');
  if (/^COPY\s+.*\s+FROM stdin;/mi.test(sql)) problems.push(schema + ': unexpected COPY data');
  if (/\b(?:sk_live_|sk_test_|sb_secret_|-----BEGIN .*PRIVATE KEY-----|jwt_secret\s*[=:])/i.test(sql)) problems.push(schema + ': possible secret pattern; review locally');
  console.log(schema + ': sha256=' + createHash('sha256').update(sql).digest('hex') + ' bytes=' + Buffer.byteLength(sql) + ' ' + JSON.stringify(counts));
  return { sql, counts };
}
const pub = inspect(process.argv[2], 'public');
const priv = inspect(process.argv[3], 'private');
for (const [key, expected] of Object.entries({tables:64,views:2,functions:57,triggers:22,policies:185,rls:64})) {
  if (pub.counts[key] !== expected) problems.push('public ' + key + ': count unexpected');
}
for (const [key, expected] of Object.entries({tables:1,views:0,functions:0,triggers:0,policies:0,rls:1})) {
  if (priv.counts[key] !== expected) problems.push('private ' + key + ': count unexpected');
}
if (!priv.sql.includes('CREATE TABLE private.hand_view_cooldowns (') ||
    !priv.sql.includes('REFERENCES public.shared_hands(id)') ||
    !priv.sql.includes('REFERENCES auth.users(id)') ||
    !pub.sql.includes('private.hand_view_cooldowns')) problems.push('Missing cross-schema dependencies');
if (!pub.sql.includes('public.vector') || !pub.sql.includes('auth.uid()')) problems.push('Missing Supabase extension/auth references');
// Limited by design: --no-acl dumps exclude GRANTs; extension and role provisioning
// as well as full secret scanning and a real isolated restore are separate gates.
console.log('WARNING: no ACL/ownership included; auth/extension dependencies need provisioning.');
console.log('WARNING: current schema is post-migration. Never prepend to 50 historical migrations.');
console.log('WARNING: structural checks do not certify security or restore success.');
if (problems.length) {
  for (const p of problems) console.error('NO-GO: ' + p);
  process.exitCode = 2;
} else console.log('PASS: both schema-only snapshots structurally consistent; isolated QA still NO-GO.');
