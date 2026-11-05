import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {test} from "node:test";
const load = p => readFileSync(new URL("../"+p,import.meta.url),"utf8");
test("Arena home uses read-only competitive APIs",()=>{const s=load("src/pages/arena-home.tsx");assert.match(s,/getPlayers/);assert.match(s,/getUpcomingTournaments/);assert.match(s,/getBlogPosts/);assert.doesNotMatch(s,/supabase\.from\([^)]*\)\.(?:insert|update|delete)/);});
test("Home route preserves original auth and signup components",()=>{const s=load("src/App.tsx");assert.match(s,/pages\/arena-home/);assert.match(s,/<AuthInitializer>/);assert.match(s,/Route path="\/register"/);assert.match(s,/Route path="\/login"/);});
test("Isolated Arena shell preserves marketing controls and navigation",()=>{const s=load("src/components/layout/page-shell.tsx");assert.match(s,/showMarketing = true/);assert.match(s,/variant = "standard"/);assert.match(s,/showMarketing && <VerifiedBannerStrip/);assert.match(s,/Navbar variant=/);});
