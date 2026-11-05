import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");

test("Ignition November news has only its own two sponsored inline banners", () => {
  const post = read("src/pages/blog-post.tsx");
  const banners = read("src/components/blog/article-ads.tsx");
  assert.match(banners, /liga-sharkania-noviembre-2026-fechas-puntos-premios-ignition/);
  assert.match(banners, /IGNITION_LOGO/);
  assert.match(banners, /Ignition Poker/);
  assert.match(banners, /useBanners\(\)\.slots\[/);
  assert.match(banners, /approvedPair/);
  assert.match(banners, /desktop\?\.partner_id === "ignition"/);
  assert.match(banners, /mobile\?\.partner_id === "ignition"/);
  assert.match(banners, /bannerIsReviewed\(desktop\) && bannerIsReviewed\(mobile\)/);
  assert.match(banners, /href="\/ignition"/);
  assert.match(post, /isIgnitionLeagueArticle\(post\) \? <IgnitionArticleBanner slot="mid"/);
  assert.match(post, /isIgnitionLeagueArticle\(post\) \? <IgnitionArticleBanner slot="final"/);
  assert.match(post, /<PageShell showMarketing=\{!isIgnitionLeagueArticle/);
  assert.match(post, /<WptBanner slot="mid"/); // Existing non-Ignition articles retain their ad route.
  assert.match(post, /<WptBanner slot="final"/);
});

test("Article exclusivity also suppresses global top strips and floating ads", () => {
  const pageShell = read("src/components/layout/page-shell.tsx");
  const floating = read("src/components/marketing/FloatingCTA.tsx");
  assert.match(pageShell, /showMarketing = true/);
  assert.match(pageShell, /showMarketing && hasTopBanner/);
  assert.match(pageShell, /showMarketing && <VerifiedBannerStrip/);
  assert.match(floating, /location\.pathname === "\/noticias\/liga-sharkania-noviembre-2026-fechas-puntos-premios-ignition"\) return null/);
});

test("Desktop and mobile article creatives use native non-deforming frames", () => {
  const ads = read("src/components/blog/article-ads.css");
  const defaults = read("src/lib/api/site-settings.ts");
  const banner = read("src/components/blog/wpt-banner.tsx");
  const admin = read("src/pages/super-admin.tsx");
  assert.match(ads, /aspect-ratio:728\/90/);
  assert.match(ads, /aspect-ratio:320\/100/);
  assert.match(ads, /object-fit:contain/);
  assert.match(banner, /aspect-ratio:728\/90/);
  assert.match(banner, /aspect-ratio:320\/100/);
  assert.match(banner, /objectFit: "contain"/);
  assert.match(defaults, /width: 728, height: 90, label: "Banner artículo final"/);
  assert.match(defaults, /width: 320, height: 100, label: "Banner artículo final móvil"/);
  assert.match(defaults, /ignition_article_mid: BannerSlotConfig/);
  assert.match(defaults, /ignition_article_final: BannerSlotConfig/);
  assert.match(admin, /Exclusivo Ignition: banner intermedio del artículo/);
  assert.match(admin, /Exclusivo Ignition: banner final del artículo/);
  assert.match(admin, /value=\{banner\?\.verified_on \?\? ""\}/);
  assert.match(admin, /value=\{banner\?\.review_by \?\? ""\}/);
  assert.match(admin, /value=\{banner\?\.source_url \?\? ""\}/);
  assert.match(admin, /createImageBitmap\(file\)/);
  assert.match(admin, /expectedWidth = side === "desktop" \? 728 : 320/);
  assert.match(admin, /expectedHeight = side === "desktop" \? 90 : 100/);
});

test("Editorial reading improvements remain isolated from forms, leagues, and ELO", () => {
  const post = read("src/pages/blog-post.tsx");
  const style = read("src/styles/arena-article-quick.css");
  assert.match(post, /className="blog-grid shark-article-page"/);
  assert.match(post, /className="shark-article-title/);
  assert.match(post, /className="shark-article-lede/);
  assert.match(style, /shark-article-page h2/);
  assert.match(style, /focus-visible/);
});
