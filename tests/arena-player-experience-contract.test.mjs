import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

const source = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");

test("Replayer retains protected poker hand parsing, share and fullscreen while using Arena", () => {
  const page = source("src/pages/replayer.tsx");
  assert.match(page, /<Navbar variant="arena"/);
  assert.match(page, /REPLAYER DE <em>MANOS DE PÓKER/);
  assert.match(page, /<SEOHead[^>]*noIndex/);
  assert.match(page, /<PokerTable state=\{rs\}/);
  assert.match(page, /<ReplayControls/);
  assert.match(page, /<FeaturePaywall/);
  assert.match(page, /useFeatureAccess\("tool_replayer"\)/);
  assert.match(page, /supabase\.rpc\('use_free_tool'/);
  for (const contract of ["parseHandHistory(", "loadHandFromShare(", "saveHandForShare(", "requestFullscreen()", "exitFullscreen()", "stopInterval()"]) {
    assert.ok(page.includes(contract), contract);
  }
  assert.match(page, /aria-pressed=\{inputMode === mode\}/);
  assert.match(page, /htmlFor="arena-replayer-history-file"/);
  assert.match(page, /className="arena-replayer-stage"/);
});

test("Replay controls retain step navigation, speed and progress without mobile truncation", () => {
  const controls = source("src/components/replayer/replay-controls.tsx");
  assert.match(controls, /className="arena-replay-controls-summary"/);
  assert.match(controls, /role="region"/);
  for (const prop of ["onStepForward","onStepBackward","onGoToStep","onTogglePlay","onSetSpeed","onReset"]) {
    assert.ok(controls.includes(prop), prop);
  }
  const css = source("src/styles/arena-player-experience.css");
  assert.match(css, /max-width:560px/);
  assert.match(css, /arena-replay-controls-summary/);
  assert.match(css, /grid-template-columns:minmax\(0,1fr\) 118px/);
});

test("Dashboard remains private and retains existing identity, claims, gamification and Ignition flow", () => {
  const code = source("src/pages/player-dashboard.tsx");
  assert.match(code, /<PageShell variant="arena">/);
  assert.match(code, /noIndex=\{true\}/);
  assert.match(code, /TU PANEL DE <em>PÓKER/);
  assert.match(code, /aria-label="Secciones de tu cuenta"/);
  for (const anchor of ["mi-perfil","mis-nicknames","ignition-mi-liga","misiones","mis-estadisticas"]) {
    assert.ok(code.includes('href="#' + anchor + '"'), anchor);
    assert.ok(code.includes('id="' + anchor + '"'), anchor + " target");
  }
  for (const contract of [
    "usePlayer(", "getUnifiedPlayerStats(", "useUnifiedTournamentResults("
  ]) {
    assert.ok(code.includes(contract), contract);
  }
  assert.match(code, /<MissionsPanel/);
  assert.match(code, /<NicknameClaim/);
  assert.match(code, /<PlayerStatsGrid/);
  assert.match(code, /<EloChart/);
  assert.match(code, /<TournamentHistoryTable/);
  assert.match(code, /supabase\.rpc\("check_ignition_duplicate"/);
  assert.match(code, /setIsHighlighting\(true\)/);
});

test("Editing and account actions remain accessible without changing existing operations", () => {
  const code = source("src/pages/player-dashboard.tsx");
  assert.match(code, /aria-label="Cambiar foto de perfil"/);
  assert.match(code, /htmlFor="arena-player-name"/);
  assert.match(code, /htmlFor="arena-player-whatsapp"/);
  assert.match(code, /htmlFor="arena-player-country"/);
  assert.match(code, /aria-label="Correo electrónico de Ignition Poker"/);
  assert.match(code, /aria-label="Nickname en Ignition Poker"/);
  assert.match(code, /handleAvatarUpload/);
  assert.match(code, /handleSave/);
  assert.match(code, /handleSignOut/);
  assert.match(code, /updateProfile\(/);
  assert.match(code, /refreshProfile\(/);
});

test("Player experience CSS remains scoped to workspace and replayer views", () => {
  const css = source("src/styles/arena-player-experience.css");
  for (const selector of [
    ".arena-player-workspace", ".arena-player-hero", ".arena-player-panel",
    ".arena-replayer-landing", ".arena-replayer-stage", ".arena-replayer-intro"
  ]) {
    assert.ok(css.includes(selector), selector);
  }
  assert.match(css, /@media\(max-width:780px\)/);
  assert.match(css, /@media\(max-width:560px\)/);
});
