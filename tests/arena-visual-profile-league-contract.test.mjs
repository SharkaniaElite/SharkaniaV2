import assert from "node:assert/strict";import { readFileSync } from "node:fs";import { test } from "node:test";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
test("Player profile and league detail preserve original business logic",()=>{
const profile=read("src/pages/player-profile.tsx"),league=read("src/pages/league-detail.tsx");
assert.match(profile,/arena-profile-hero/);assert.match(league,/arena-detail-banner--league/);
assert.match(profile,/useFeatureAccess/);assert.match(league,/getLeagueCCPStandings/);
assert.match(league,/rules_url/);
assert.doesNotMatch(profile,/VITE_STATS_SPY_SECURE_RPC/);
for(const source of [profile,league])assert.match(source,/<PageShell variant="arena">/);
});
