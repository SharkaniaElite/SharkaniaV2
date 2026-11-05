import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
const read = file => readFileSync(new URL("../" + file, import.meta.url), "utf8");
const strip = read("src/components/marketing/verified-banner-strip.tsx");
const shell = read("src/components/layout/page-shell.tsx");
const home = read("src/pages/arena-home.tsx");

test("Mobile shows four branded promotions in one horizontal swipeable row", () => {
  assert.match(strip, /const FEATURED_IGNITION: BannerConfig/);
  assert.match(strip, /const FEATURED_LATINALLIN: BannerConfig/);
  assert.match(strip, /href: "\/ignition"/);
  assert.match(strip, /href: "\/como-jugar-en-clubgg"/);
  assert.match(strip, /\.\.\.featuredBanners\(\), \.\.\.additionalBanners\(banners\)/);
  assert.match(strip, /flex snap-x snap-mandatory/);
  assert.match(strip, /overflow-x-auto/);
  assert.match(strip, /touch-pan-x/);
  assert.match(strip, /data-promotion-banner-layout="compact"/);
  assert.match(strip, /data-banner-order=\{order\}/);
  assert.match(shell, /<VerifiedBannerStrip banners=\{banners\}/);
});
test("Desktop top has only two priority banners in a single row", () => {
  assert.match(strip, /md:grid md:grid-cols-2/);
  assert.match(strip, /index >= 2 \? "md:hidden"/);
  assert.match(strip, /data-promotion-banner-layout="compact"/);
});
test("Existing CoinPoker and WPT CMS banners are retained mid-homepage", () => {
  assert.match(strip, /\["super_left", "super_right"\] as const/);
  assert.match(strip, /banners\.slots\[slot\]/);
  assert.match(strip, /bannerIsReviewed\(pair\?\.desktop\)/);
  assert.match(strip, /bannerIsReviewed\(pair\?\.mobile\)/);
  assert.match(strip, /export function VerifiedSecondaryBannerStrip/);
  assert.match(strip, /data-promotion-banner-layout="midpage"/);
  assert.match(strip, /className="hidden border-y/);
  assert.match(home, /<VerifiedSecondaryBannerStrip\s*\/>/);
  assert.ok(home.indexOf('<section className="arena-circuit') < home.indexOf('<VerifiedSecondaryBannerStrip'));
  assert.ok(home.indexOf('<VerifiedSecondaryBannerStrip') < home.indexOf('<section className="arena-editorial'));
});
test("Authentic logos and dynamic ClubGG jackpot are preserved", () => {
  assert.match(strip, /Logos%20Sharkania\/logo-ignition-poker.png/);
  assert.match(strip, /img_clubs\/logoLAP-clubbgg.png/);
  assert.match(strip, /img_clubs\/LatinAllinPoker.webp/);
  assert.match(strip, /coinpoker:/);
  assert.match(strip, /wptglobal:/);
  assert.match(strip, /\.eq\("key", "latin_club_stats"\)/);
  assert.match(strip, /Number\.isFinite\(value\.bbjClp\)/);
  assert.match(strip, /refetchInterval: 300_000/);
  assert.match(strip, /refetchOnWindowFocus: true/);
  assert.match(strip, /jackpot\.bbjClp/);
  assert.doesNotMatch(strip, /7671871|8594561/);
});
