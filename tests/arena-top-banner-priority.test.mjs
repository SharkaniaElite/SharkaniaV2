import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
const read=(file)=>readFileSync(new URL("../"+file,import.meta.url),"utf8");
const s=read("src/components/marketing/verified-banner-strip.tsx");
const shell=read("src/components/layout/page-shell.tsx");

test("Top horizontal banners are left Ignition and right ClubGG + Latin Allin Póker",()=>{
  assert.match(s,/const PREVIEW_SUPER_LEFT/);
  assert.match(s,/const PREVIEW_SUPER_RIGHT/);
  assert.match(s,/partner_id: "ignition"/);
  assert.match(s,/partner_id: "latinallin"/);
  assert.match(s,/href: "\/ignition"/);
  assert.match(s,/href: "\/como-jugar-en-clubgg"/);
  assert.match(s,/\["super_left", "super_right"\]/);
  assert.match(s,/slot === "super_left" \? PREVIEW_SUPER_LEFT : PREVIEW_SUPER_RIGHT/);
  assert.match(shell,/<VerifiedBannerStrip banners=\{banners\}/);
});
test("Both images are original Supabase Storage assets; Latin has ClubGG combined mark",()=>{
  assert.match(s,/Logos%20Sharkania\/logo-ignition-poker.png/);
  assert.match(s,/img_clubs\/logoLAP-clubbgg.png/);
  assert.match(s,/img_clubs\/LatinAllinPoker.webp/);
});
test("Jackpot in header is dynamically refreshed from the same admin setting as the guide",()=>{
  assert.match(s,/\.eq\("key", "latin_club_stats"\)/);
  assert.match(s,/Number\.isFinite\(value\.bbjClp\)/);
  assert.match(s,/refetchInterval: 300_000/);
  assert.match(s,/refetchOnWindowFocus: true/);
  assert.match(s,/jackpot\.bbjClp/);
  assert.match(s,/jackpot\.lastUpdate/);
  assert.doesNotMatch(s,/7671871|8594561/);
});
test("Production admin slots are not secretly overwritten by the preview",()=>{
  assert.match(s,/const showPreviewPriority = isArenaPreviewHost\(\)/);
  assert.match(s,/: banners\.slots\[slot\]/);
  assert.match(s,/bannerIsReviewed\(desktop\)/);
  assert.match(s,/bannerIsReviewed\(mobile\)/);
  assert.match(s,/rel=\{external \? "sponsored noopener noreferrer"/);
});
