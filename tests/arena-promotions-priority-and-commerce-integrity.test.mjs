import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {test} from "node:test";
const read = p => readFileSync(new URL("../"+p,import.meta.url),"utf8");
const promo = read("src/pages/promotions.tsx");
const shop = read("src/pages/shop.tsx");
const tools = read("src/pages/tools.tsx");
test("Ignition, ClubGG Latin Allin, CoinPoker and WPT remain in mandated order",()=>{
  const one=promo.indexOf("number={1}");
  const two=promo.indexOf("number={2}");
  const verified=promo.indexOf("verifiedPartnerPosts.map");
  assert.ok(one>=0 && two>one && verified>two);
  assert.match(promo,/brand="Ignition Poker"/);
  assert.match(promo,/href="\/ignition"/);
  assert.match(promo,/brand="ClubGG · Latin Allin Póker"/);
  assert.match(promo,/href="\/como-jugar-en-clubgg"/);
  assert.match(promo,/number=\{coin \? 3 : 4\}/);
  assert.match(promo,/coinpoker-bono-bienvenida-150-2026/);
  assert.match(promo,/wpt-global-paquete-bienvenida-2026/);
});
test("ClubGG jackpot reads current settings, not a fake or static value",()=>{
  assert.match(promo,/\.eq\("key", "latin_club_stats"\)/);
  assert.match(promo,/value\.bbjClp/);
  assert.match(promo,/value\.lastUpdate/);
  assert.match(promo,/new Intl\.NumberFormat\("es-CL"/);
  assert.match(promo,/document\.addEventListener\("visibilitychange", onFocus\)/);
  assert.doesNotMatch(promo,/7671871/);
});
test("Original partner logos are loaded from the actual Supabase storage buckets",()=>{
  assert.match(promo,/supabase\.storage\.from\(bucket\)\.getPublicUrl/);
  assert.match(promo,/logoLAP-clubbgg\.png/);
  assert.match(promo,/LatinAllinPoker\.webp/);
  for(const asset of ["logo-ignition-poker.png","coinpoker.png","wptglobal.png"])
    assert.ok(promo.includes(asset));
});
test("Historical unverified promotions stay in the archive, not featured",()=>{
  assert.match(promo,/promoPhase\(p, today\)/);
  assert.match(promo,/review-by:/);
  assert.match(promo,/archivePromos/);
  assert.match(promo,/remainingCurrent/);
});
test("Arena shop and tools changed presentation, not the existing purchase or unlock mechanics",()=>{
  assert.match(shop,/<PageShell variant="arena">/);
  assert.match(shop,/tool_replayer/);
  assert.match(shop,/useShopProducts/);
  assert.match(shop,/useUserPurchases/);
  assert.match(shop,/selectedProductToBuy/);
  assert.match(shop,/onPurchase\(selectedOption\)/);
  assert.match(shop,/arena-shop-wallet/);
  assert.match(tools,/<PageShell variant="arena">/);
  assert.match(tools,/\/tools\/replayer/);
  assert.match(tools,/handleLoginClick/);
  assert.match(tools,/arena-tools-grid/);
});
