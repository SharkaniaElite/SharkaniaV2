import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const live = readFileSync(new URL("../src/pages/live-stream.tsx", import.meta.url), "utf8");
const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");

test("/live muestra exclusivamente el reproductor de Twitch sin promoción ni chat", () => {
  assert.match(live, /player\.twitch\.tv/);
  assert.match(live, /<iframe/);
  assert.match(live, /<PageShell showMarketing=\{false\}>/);
  for (const removed of [
    "Premio al Campeón de Liga", "Inscripciones con Roberto",
    "Leer Bases Oficiales", "Pokerkai x Sharkania",
    "LivePollPanel", "LiveChat", "live_poll_votes",
    "streamTitle", "streamDesc", "lg:w-[350px]",
  ]) {
    assert.ok(!live.includes(removed), removed);
  }
});

test("/live mantiene fuente administrable, dominio válido y sin escrituras", () => {
  assert.match(live, /\.eq\("key", "live_stream_url"\)/);
  assert.match(live, /window\.location\.hostname/);
  assert.match(live, /new URLSearchParams/);
  assert.match(live, /allow="autoplay; fullscreen; picture-in-picture"/);
  assert.match(live, /https:/);
  assert.match(live, /twitch\.tv/);
  assert.doesNotMatch(live, /supabase\.from\([\s\S]*?\.(?:insert|upsert|update|delete)\(/);
});

test("preview solo habilita lectura de la ruta pública /live", () => {
  const allowlist = app.match(/const READ_ONLY_ARENA_PATHS = \[([\s\S]*?)\];/)?.[1];
  assert.ok(allowlist);
  assert.match(allowlist, /\^\\\/live\\\/\?\$/);
  assert.match(app, /<PreviewReadOnlyGate>\s*<Routes>/);
});
