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
