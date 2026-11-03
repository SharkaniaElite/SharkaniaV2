import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");

test("Ignition league exclusively renders its own sponsor banner", () => {
  const league = read("src/pages/ignition-championship.tsx");
  const shell = read("src/components/layout/page-shell.tsx");

  assert.match(league, /<PageShell variant="arena">/);
  assert.doesNotMatch(league, /<PageShell variant="arena" showMarketing>/);
  assert.match(shell, /const displayMarketing = showMarketing \?\? !isArena/);
  assert.match(shell, /useBannersWithStatus\(displayMarketing\)/);

  assert.equal(
    (league.match(/media\.revenuenetwork\.com\/GIF\/Ignition%20Poker\/Spanish\/Poker\/728x90\.jpg/g) || []).length,
    1,
    "There must be exactly one Ignition advertising creative"
  );
  assert.match(league, /aria-label="Publicidad de Ignition Poker"/);
  assert.match(league, /rel="sponsored noopener noreferrer"/);
  assert.match(league, /className="arena-ignition-sponsor"/);
  assert.match(league, /<ArenaRouteTrail/);
  assert.ok(!/coinpoker|wptglobal|americascardroom/i.test(league), "Unrelated poker-room ads cannot appear in this page component");
});

test("Floating global promotions cannot overlay the Ignition league", () => {
  const floating = read("src/components/marketing/FloatingCTA.tsx");
  assert.match(floating, /const isIgnitionLeaguePage = location\.pathname === "\/ignition"/);
  assert.match(floating, /if \(!visible \|\| isIgnitionLeaguePage\) return null/);
  assert.match(floating, /if \(isIgnitionLeaguePage\) \{/);
});

test("League keeps the existing enrollment, anti-abuse and SEO features", () => {
  const page = read("src/pages/ignition-championship.tsx");
  for (const feature of [
    "check_ignition_duplicate",
    "ignition_league_player",
    "turnstileRef",
    "captchaToken",
    "signUp(",
    "getProfile(",
    "navigate(\"/dashboard?highlight=ignition\")",
    'path="/ignition"',
  ]) {
    assert.ok(page.includes(feature), "Missing existing league behavior: " + feature);
  }
  assert.match(page, /<Turnstile/);
  assert.match(page, /arena-ignition-hero/);
  assert.match(page, /LIGA DE PÓKER/);
});

test("Sponsor style is scoped to Ignition and mobile layout", () => {
  const css = read("src/styles/arena-public-bridge.css");
  assert.match(css, /\.arena-ignition-route \.arena-ignition-sponsor/);
  assert.match(css, /\.arena-ignition-route \.arena-ignition-hero/);
  assert.match(css, /@media\(max-width:760px\)/);
});
