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


test("Ignition landing has a keyboard-accessible shortcut to its nickname form", () => {
  const ignition = read("src/pages/ignition-championship.tsx");
  assert.match(ignition, /href="#vincular-nickname"/);
  assert.match(ignition, /id="vincular-nickname"/);
  assert.match(ignition, /Ir al formulario de vinculación/);
  assert.match(ignition, /<Turnstile/);
});


test("Ignition clearly distinguishes download via Sharkania from a returning league participant", () => {
  const ignition = read("src/pages/ignition-championship.tsx");
  assert.match(ignition, /Descarga Ignition desde el enlace de SHARKANIA/);
  assert.match(ignition, /Descargar Ignition desde SHARKANIA/);
  assert.match(ignition, /No necesitas registrarte nuevamente/);
  assert.match(ignition, /Si ya tienes una cuenta SHARKANIA con tu nickname de Ignition vinculado o pendiente de revisión/);
  assert.match(ignition, /Ya tengo cuenta: iniciar sesión/);
  assert.match(ignition, /rel="sponsored noopener noreferrer"/);
});

test("Existing-account login cannot overwrite a previously verified Ignition nickname or status", () => {
  const ignition = read("src/pages/ignition-championship.tsx");
  const loginStart = ignition.indexOf("if (isExistingUser) {");
  const signupStart = ignition.indexOf("// FLUJO 2: SIGN UP", loginStart);
  assert.ok(loginStart >= 0 && signupStart > loginStart);
  const loginFlow = ignition.slice(loginStart, signupStart);
  assert.match(loginFlow, /signInWithPassword/);
  assert.match(loginFlow, /getProfile\(data.session.user.id\)/);
  assert.match(loginFlow, /navigate\("\/dashboard\?highlight=ignition"\)/);
  assert.doesNotMatch(loginFlow, /ignition_status: 'pending'/);
  assert.doesNotMatch(loginFlow, /from\('profiles'\)\.update/);
  assert.doesNotMatch(loginFlow, /auth\.updateUser/);
  assert.doesNotMatch(loginFlow, /check_ignition_duplicate/);
});

test("League detail also explains that pre-registered participants do not enroll again", () => {
  const league = read("src/pages/league-detail.tsx");
  assert.match(league, /descárgalo usando el enlace de SHARKANIA/);
  assert.match(league, /No necesitas registrarte nuevamente/);
  assert.match(league, /Descargar Ignition y vincular nickname/);
});


test("League distinguishes exclusive Sharkania bounty/monthly awards from Ignition tournament prize pool", () => {
  const ignition = read("src/pages/ignition-championship.tsx");
  const league = read("src/pages/league-detail.tsx");
  const dashboard = read("src/pages/player-dashboard.tsx");
  assert.match(ignition, /Bounty de cada fecha y premios de fin de mes: exclusivos para inscritos mediante SHARKANIA/);
  assert.match(ignition, /Jugar el torneo en Ignition sin registrarte en SHARKANIA no te habilita para esos premios/);
  assert.match(ignition, /El pozo garantizado regular de cada torneo se rige por las condiciones de Ignition Poker/);
  assert.match(ignition, /no tienes que volver[\s\S]*a inscribirte/);
  assert.match(league, /El bounty de cada fecha y los premios del ranking mensual requieren inscripción a través de SHARKANIA/);
  assert.match(league, /Participar en los torneos de Ignition por sí solo no habilita para estos premios adicionales/);
  assert.match(league, /no necesitas hacerlo de nuevo/);
  assert.match(dashboard, /El bounty de cada fecha y los premios adicionales de fin de mes son exclusivos/);
  assert.match(dashboard, /Si ya lo hiciste antes, no te registres nuevamente/);
});
