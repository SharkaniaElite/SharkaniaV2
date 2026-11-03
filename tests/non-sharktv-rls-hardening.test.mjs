import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const file = new URL('../docs/security/sharkania-non-sharktv-rls-hardening-2026-11-03.proposal.sql', import.meta.url);
const sql = readFileSync(file, 'utf8');
const create = [...sql.matchAll(/CREATE POLICY "([^"]+)"\s+ON public\.([a-z_]+) FOR (ALL|INSERT|UPDATE|DELETE) TO authenticated([\s\S]*?)\n\);/gm)];
const drops = [...sql.matchAll(/DROP POLICY IF EXISTS "([^"]+)" ON public\.([a-z_]+);/g)];
const protectedTables = new Set([
  'tournament_clubs', 'acc_payouts', 'acc_player_promo_config',
  'acc_player_promo_payouts', 'site_configs', 'live_polls', 'blog_embeddings'
]);

test('RLS hardening is explicitly a non-production proposal', () => {
  assert.match(sql, /NOT A MIGRATION/);
  assert.match(sql, /isolated QA ONLY/);
  assert.match(sql, /BEGIN;/);
  assert.match(sql, /COMMIT;\s*$/);
  assert.ok(!/\b(?:GRANT|ALTER ROLE|CREATE ROLE|TRUNCATE|DELETE FROM|UPDATE public\.|INSERT INTO)\b/i.test(sql));
});

test('All seven high risk non-SharkTV tables are covered', () => {
  assert.equal(drops.length, 7);
  assert.equal(create.length, 9);
  const targets = new Set(create.map(m=>m[2]));
  assert.deepEqual(targets, protectedTables);
  assert.deepEqual(new Set(drops.map(m=>m[2])), protectedTables);
  assert.ok(!create.some(m=>/shark.?tv/i.test(m[2])));
});

test('All new write policies are authenticated and demand authorization, not login alone', () => {
  for (const [, name, table, operation, body] of create) {
    assert.match(body, /\(SELECT auth\.uid\(\)\) IS NOT NULL/, name);
    assert.match(body, /\(SELECT public\.is_super_admin\(\)\)/, name);
    assert.match(body, /WITH CHECK\s*\(/, name);
    assert.ok(!/\bUSING\s*\(\s*true\s*\)|\bWITH CHECK\s*\(\s*true\s*\)/i.test(body), name);
    if (table === 'tournament_clubs') {
      assert.match(body, /SELECT public\.is_club_admin\(t\.club_id\)/, name);
      assert.match(body, /t\.id = tournament_id/, name);
    }
    if (table.startsWith('acc_')) {
      assert.match(body, /FROM public\.acc_managers m WHERE m\.id = \(SELECT auth\.uid\(\)\)/, name);
    }
    if (operation === 'UPDATE' || operation === 'DELETE' || operation === 'ALL') assert.match(body, /USING\s*\(/, name);
  }
});

test('Public read policies are not revoked and related publishing triggers are left alone', () => {
  assert.ok(!/DROP POLICY[^\n]+(?:lectura publica|public select)/i.test(sql));
  assert.ok(!/ON public\.current_league_champion\s+FOR/i.test(sql));
  assert.ok(!/ALTER FUNCTION\s+public\.trigger_publish_league_champion/i.test(sql));
});
