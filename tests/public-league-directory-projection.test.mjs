import assert from "node:assert/strict";
import {test} from "node:test";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const api=read("src/lib/api/leagues.ts"), hooks=read("src/hooks/use-leagues.ts"), page=read("src/pages/leagues.tsx");
test("public league directory requests exactly the fields rendered by its cards",()=>{
 const src=api.slice(api.indexOf("export async function getLeagueDirectory("),api.indexOf("export async function getLeagueById("));
 assert.ok(src.length>0);
 assert.match(src,/\.select\("id, slug, name, start_date, end_date, description, league_clubs\(is_primary, clubs\(name, country_code, banner_url\)\), league_rooms\(poker_rooms\(name\)\)"\)/);
 assert.match(src,/\.order\("start_date", \{ ascending: false \}\)/);
 assert.doesNotMatch(src,/\.rpc\(|\.insert\(|\.update\(|\.delete\(/);
 assert.match(page,/useLeaguesDirectory\(\)/);
 assert.match(hooks,/queryKey: \["leagues", "public-directory"\]/);
 assert.match(hooks,/queryKey: \["leagues"\],\s*queryFn: getLeagues/);
 assert.match(page,/league\.slug \?\? league\.id/);
 assert.match(page,/const displayedLeagues = tab === "active" \? activeLeagues : archivedLeagues/);
});