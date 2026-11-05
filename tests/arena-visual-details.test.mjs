import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
const read = path => readFileSync(new URL("../"+path,import.meta.url),"utf8");
test("Club and tournament detail pages preserve data and use Arena UI",()=>{
 const club=read("src/pages/club-detail.tsx");
 const tournament=read("src/pages/tournament-detail.tsx");
 for (const page of [club,tournament]) {
   assert.match(page,/<PageShell variant="arena">/);
   assert.match(page,/arena-interior-container/);
   assert.match(page,/<SEOHead/);
 }
 assert.match(club,/useClub/);
 assert.match(tournament,/useTournament/);
});
