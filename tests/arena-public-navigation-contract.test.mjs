import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

const src = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");

test("Public promotions, SharkTV, Bóveda and partner routes share the Arena navbar", () => {
  const paths = [
    "promotions", "shark-tv", "shop", "promo-coinpoker", "tutorial-coinpoker",
    "ignition-championship", "tutorial-ignition", "tutorial-ignition-deposit",
    "promo-ignition-bonus", "promo-freeroll", "promo-mindev", "promo-fullnuts",
    "hand-review", "blog-post",
  ];
  for (const page of paths) {
    const code = src("src/pages/" + page + ".tsx");
    assert.match(code, /<PageShell variant="arena" showMarketing>/, page);
    assert.doesNotMatch(code, /<PageShell>/, page);
  }
});

test("Arena menu styling does not suppress audited commercial banners or the champions ticker", () => {
  const shell = src("src/components/layout/page-shell.tsx");
  assert.match(shell, /showMarketing\?: boolean/);
  assert.match(shell, /const displayMarketing = showMarketing \?\? !isArena/);
  assert.match(shell, /useBannersWithStatus\(displayMarketing\)/);
  assert.match(shell, /displayMarketing && <div className="sticky top-\[56px\]/);
  assert.match(shell, /<VerifiedBannerStrip/);
  assert.match(shell, /<GlobalChampionsTicker/);
});

test("Arena desktop, mobile and Explore links include poker rooms and tutorials", () => {
  const navbar = src("src/components/layout/navbar.tsx");
  assert.match(navbar, /const ARENA_MAIN_LINKS/);
  assert.match(navbar, /const ARENA_MORE_LINKS/);
  assert.match(navbar, /const ARENA_MOBILE_LINKS/);
  assert.match(navbar, /variant === "arena" \? ARENA_MOBILE_LINKS : STANDARD_MOBILE_LINKS/);
  assert.match(navbar, /variant === "arena" \? ARENA_MORE_LINKS : MORE_LINKS/);
  assert.match(navbar, /arena-mobile-rooms/);
  assert.ok(navbar.includes('href: "/tutorial-coinpoker"'));
  assert.ok(navbar.includes('href: "/tutorial-ignition"'));
  assert.match(navbar, /aria-expanded=\{mobileOpen\}/);
});

test("Promotions and SharkTV retain their queries, cards and canonical routes", () => {
  const promos = src("src/pages/promotions.tsx");
  const tv = src("src/pages/shark-tv.tsx");
  assert.match(promos, /promoPhase\(/);
  assert.match(promos, /archivePromos\.map/);
  assert.match(promos, /currentPromos\.map/);
  assert.match(promos, /<PromotionArtwork/);
  assert.match(promos, /<ArenaPageHero/);
  assert.ok(promos.includes('path="/promociones"'));
  assert.match(tv, /from\('shark_tv_videos'\)/);
  assert.match(tv, /videos\.map/);
  assert.match(tv, /<ArenaPageHero/);
  assert.ok(tv.includes('to={\`/tv/\${video.id}\`}'));
  assert.ok(tv.includes('path="/tv"'));
});

test("Bóveda keeps purchases, membership, and real Shark Coins data", () => {
  const shop = src("src/pages/shop.tsx");
  assert.match(shop, /useShopProducts\(/);
  assert.match(shop, /useUserPurchases\(/);
  assert.match(shop, /useSharkCoinsBalance\(/);
  assert.match(shop, /ProductCardGroup/);
  assert.match(shop, /setSelectedProductToBuy/);
  assert.match(shop, /selectedProductToBuy/);
  assert.match(shop, /arena-shop-wallet/);
  assert.match(shop, /aria-pressed=\{tab === "active"\}/);
  assert.match(shop, /aria-pressed=\{tab === "upcoming"\}/);
});

test("Commercial routes retain partner navigation, canonical paths and interactive content", () => {
  const cases = [
    ["promo-coinpoker", "/promociones/coinpoker"],
    ["tutorial-coinpoker", "/tutorial-coinpoker"],
    ["ignition-championship", "/ignition"],
    ["tutorial-ignition", "/tutorial-ignition"],
    ["tutorial-ignition-deposit", "/tutorial-ignition-deposit"],
    ["promo-ignition-bonus", "/promociones/ignition-bonus"],
  ];
  for (const [file, path] of cases) {
    const code = src("src/pages/" + file + ".tsx");
    assert.match(code, /<ArenaRouteTrail/, file);
    assert.ok(code.includes('path="' + path + '"'), file);
  }
  assert.match(src("src/pages/tutorial-coinpoker.tsx"), /setMaximizedImage/);
  assert.match(src("src/pages/ignition-championship.tsx"), /<Turnstile/);
  assert.match(src("src/pages/tutorial-ignition-deposit.tsx"), /macroSteps\.map/);
  assert.match(src("src/pages/hand-review.tsx"), /<RumbleEmbed/);
});

test("Arena bridge CSS is limited to public pages and does not modify admin behavior", () => {
  const css = src("src/styles/arena-public-bridge.css");
  assert.match(css, /\.arena-public-bridge/);
  assert.match(css, /\.arena-partner-route/);
  assert.match(css, /\.arena-mobile-menu/);
  assert.match(css, /@media\(max-width:760px\)/);
  assert.match(css, /@media\(max-width:440px\)/);
  assert.match(src("src/components/arena/arena-page-hero.tsx"), /"promotions" \| "tv" \| "shop"/);
});
