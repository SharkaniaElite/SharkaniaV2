import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");

test("November SHARKANIA league and Ignition info routes remain reachable in router", () => {
  const app = read("src/App.tsx");
  assert.match(app, /path="\/leagues\/:leagueSlug"/);
  assert.match(app, /path="\/ignition"/);
  const ignition = read("src/pages/ignition-championship.tsx");
  assert.match(ignition, /liga-sharkania-noviembre-2026/);
  assert.match(ignition, /highlight=ignition/);
});

test("Ignition tournament cards link to nickname/ranking information instead of unrelated club", () => {
  const card = read("src/components/calendar/tournament-card.tsx");
  assert.match(card, /roomLabel === "ignition poker" \|\| roomLabel === "ignition póker"/);
  assert.match(card, /isIgnition\s*\? "\/ignition"/);
  assert.match(card, /to=\{participationLink\}/);
  assert.match(card, /t\.custom_link \?/); // Preserve explicitly configured external custom links
});

test("League details still show canonical dates, rules link and tournament list", () => {
  const page = read("src/pages/league-detail.tsx");
  assert.match(page, /league\.description/);
  assert.match(page, /league\.start_date/);
  assert.match(page, /league\.rules_url/);
  assert.match(page, /useTournamentsByLeague/);
});


test("Arena homepage announces the current Sharkania November league and expires after November", () => {
  const home = read("src/pages/arena-home.tsx");
  const css = read("src/pages/arena-home.css");
  assert.match(home, /Date\.parse\("2026-11-27T03:00:00Z"\)/);
  assert.match(home, /to="\/leagues\/liga-sharkania-noviembre-2026"/);
  assert.match(home, /to="\/ignition"/);
  assert.match(home, /arena-featured-league/);
  assert.match(css, /\.arena-featured-league-inner/);
  assert.match(css, /max-width: 420px/);
  assert.match(css, /focus-visible/);
});

test("November league detail prominently links to Ignition and initially shows scheduled dates", () => {
  const page = read("src/pages/league-detail.tsx");
  assert.match(page, /league\?\.slug === "liga-sharkania-noviembre-2026"/);
  assert.match(page, /setTab\("upcoming"\)/);
  assert.match(page, /nextNovemberDateLabel/);
  assert.match(page, /to="\/ignition"/);
  assert.match(page, /href="#league-tabs"/);
  assert.match(page, /id="league-tabs"/);
  assert.match(page, /currentStatus !== "finished"/);
});


test("League hero keeps the long source description reachable without flooding mobile layout", () => {
  const page = read("src/pages/league-detail.tsx");
  assert.match(page, /line-clamp-3 sm:line-clamp-4/);
  assert.match(page, /Leer descripción y condiciones completas/);
  assert.match(page, /onClick=\{\(\) => setTab\("info"\)\}/);
  assert.match(page, /Descripción y condiciones de la liga/);
  assert.match(page, /whitespace-pre-line leading-relaxed/);
});
