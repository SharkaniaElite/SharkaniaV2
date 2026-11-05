import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
const read = file => readFileSync(new URL("../" + file, import.meta.url), "utf8");
const strip = read("src/components/marketing/verified-banner-strip.tsx");
const shell = read("src/components/layout/page-shell.tsx");

test("Four navbar banners, in order: Ignition, ClubGG/Latin Allin, CoinPoker, WPT Global", () => {
  assert.match(strip, /const FEATURED_IGNITION: BannerConfig/);
  assert.match(strip, /const FEATURED_LATINALLIN: BannerConfig/);
  assert.match(strip, /href: "\/ignition"/);
  assert.match(strip, /href: "\/como-jugar-en-clubgg"/);
  assert.match(strip, /partner_id: "ignition"/);
  assert.match(strip, /partner_id: "latinallin"/);
  assert.match(strip, /\["super_left", "super_right"\] as const/);
  assert.match(strip, /\.\.\.featured, \.\.\.existing/);
  assert.match(strip, /data-banner-order=\{index \+ 1\}/);
  assert.match(strip, /data-promotion-banner-layout="four"/);
  assert.match(shell, /<VerifiedBannerStrip banners=\{banners\}/);
});
test("CoinPoker and WPT still originate from existing reviewed CMS slots", () => {
  assert.match(strip, /banners\.slots\[slot\]/);
  assert.match(strip, /bannerIsReviewed\(pair\?\.desktop\)/);
  assert.match(strip, /bannerIsReviewed\(pair\?\.mobile\)/);
  assert.match(strip, /OFFICIAL_LOGOS\[config\.partner_id\]/);
  assert.match(strip, /coinpoker:/);
  assert.match(strip, /wptglobal:/);
});
test("Both partner logos come from verified Supabase storage", () => {
  assert.match(strip, /Logos%20Sharkania\/logo-ignition-poker.png/);
  assert.match(strip, /img_clubs\/logoLAP-clubbgg.png/);
  assert.match(strip, /img_clubs\/LatinAllinPoker.webp/);
});
test("Jackpot is loaded from daily-updated site_settings, not hardcoded", () => {
  assert.match(strip, /\.eq\("key", "latin_club_stats"\)/);
  assert.match(strip, /Number\.isFinite\(value\.bbjClp\)/);
  assert.match(strip, /refetchInterval: 300_000/);
  assert.match(strip, /refetchOnWindowFocus: true/);
  assert.match(strip, /jackpot\.bbjClp/);
  assert.doesNotMatch(strip, /7671871|8594561/);
});
test("Responsive banners show all four, never an unseen mobile carousel", () => {
  assert.match(strip, /grid grid-cols-1 gap-3 sm:grid-cols-2/);
  assert.doesNotMatch(strip, /overflow-x-auto snap-x/);
  assert.match(strip, /\[0, 1, 2, 3\]\.map\(index/);
});
