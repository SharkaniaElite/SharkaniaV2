import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const directories = ["ranking","calendar","clubs","leagues","noticias","blog"];
test("Arena public directories have Arena containers and preserve public canonical routes",()=>{
  for(const name of directories) {
    const src=read("src/pages/"+name+".tsx");
    assert.match(src,/<PageShell variant="arena">/);
    assert.match(src,/<ArenaPageHero/);
    assert.match(src,new RegExp('path="/'+name+'"'));
  }
});
test("Account wallet remains visible on competitive directories",()=>{
  const wallet=read("src/components/arena/arena-wallet-strip.tsx");
  assert.match(wallet,/useAuthStore/);
  assert.match(wallet,/useSharkCoinsBalance/);
  for(const name of ["ranking","calendar","clubs","leagues"])
    assert.match(read("src/pages/"+name+".tsx"),/<ArenaWalletStrip/);
});
test("Listing APIs, league tabs and ranking filters remain wired",()=>{
  assert.match(read("src/pages/ranking.tsx"),/usePlayers/);
  assert.match(read("src/pages/calendar.tsx"),/useUpcomingTournaments/);
  assert.match(read("src/pages/calendar.tsx"),/useCompletedTournaments/);
  assert.match(read("src/pages/leagues.tsx"),/useLeagues/);
  assert.match(read("src/pages/noticias.tsx"),/getBlogPosts/);
  assert.match(read("src/pages/blog.tsx"),/getBlogPosts/);
});
