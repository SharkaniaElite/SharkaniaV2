import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync("supabase/migrations/20261101230327_auto_link_ccp_latin_allin_tournaments_20261101.sql", "utf8");
const api = readFileSync("src/lib/api/tournaments.ts", "utf8");
const form = readFileSync("src/components/admin/tournament-form.tsx", "utf8");

test("CCP -> Latin Allin sync creates memberships rather than duplicate tournament/result/ELO rows", () => {
  assert.match(migration, /INSERT INTO public\.tournament_clubs \(tournament_id, club_id, is_primary\)/);
  assert.match(migration, /WHERE slug = 'ccp'/);
  assert.match(migration, /WHERE slug = 'latin-allin-poker'/);
  assert.match(migration, /ON CONFLICT \(tournament_id, club_id\) DO NOTHING/);
  assert.doesNotMatch(migration, /INSERT\s+INTO\s+public\.(?:tournaments|elo_history|tournament_results)\b/i);
});

test("manual inserts, templates, reassignments and membership rewrite trigger automatic CCP linking", () => {
  assert.match(migration, /AFTER INSERT OR UPDATE OF club_id ON public\.tournaments/);
  assert.match(migration, /AFTER INSERT OR DELETE ON public\.tournament_clubs/);
  assert.match(migration, /SECURITY INVOKER/);
  assert.match(migration, /REVOKE EXECUTE ON FUNCTION/);
  assert.match(migration, /CROSS JOIN public\.clubs latin/);
});

test("the manual tournament form cannot silently drop required shared links", () => {
  assert.match(form, /c\.slug === "ccp"/);
  assert.match(form, /c\.slug === "latin-allin-poker"/);
  assert.match(form, /disabled=\{isCircuitoChileno && c\.slug === "latin-allin-poker"\}/);
  assert.match(form, /upsert\(tcPayload, \{ onConflict: "tournament_id,club_id" \}\)/);
  assert.match(form, /if \(linkError\) throw linkError/);
});

test("Latin Allin reads all linked tournaments even when membership exceeds the default 1000 limit", () => {
  assert.match(api, /fetchAllTournamentPages\(\s*supabase\.from\("tournament_clubs"\)/);
  assert.match(api, /const batchSize = 120/);
  assert.match(api, /const byId = new Map<string, any>/);
  assert.doesNotMatch(api, /id\.in\.\(\$\{linkedIds\.join\(','\)\}\)/);
  assert.match(api, /return \{ data: matches\.slice\(from, to \+ 1\), count: matches\.length \};/);
});
