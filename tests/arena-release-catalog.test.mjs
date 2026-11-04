import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");

test("Unwanted hand replayer cannot be discovered or purchased as a new product", () => {
  const tools = read("src/pages/tools.tsx");
  const shop = read("src/pages/shop.tsx");
  assert.doesNotMatch(tools, /slug:\s*"\/tools\/replayer"/);
  assert.doesNotMatch(tools, /reproducción de manos|Replayer de Manos/i);
  assert.doesNotMatch(shop, /"tool_replayer"/);
  const preview = read("src/pages/arena-preview-qa.tsx");
  assert.doesNotMatch(preview, /PreviewHand|<ReplayControls|Replayer de póker/);
});

test("Legacy hand links remain accessible for existing purchasers without advertising them", () => {
  const app = read("src/App.tsx");
  assert.match(app, /path="\/tools\/replayer\/h\/:id"/);
  assert.match(app, /path="\/tools\/replayer"/);
  assert.match(app, /<ProtectedRoute>/);
  // Existing purchases, database records and stored hand IDs are deliberately not altered.
});

test("Arena navigation never fakes a live broadcast or reverts to an old navbar on /live", () => {
  const nav = read("src/components/layout/navbar.tsx");
  assert.match(nav, /hidden sm:inline">Transmisiones/);
  assert.match(nav, /variant !== "arena" && <span className="animate-ping/);
  assert.match(nav, /className="sm:hidden">TV/);
  const live = read("src/pages/live-stream.tsx");
  assert.match(live, /<PageShell variant="arena" showMarketing>/);
  assert.match(live, /videoUrl\.trim\(\) \? \(/);
  assert.match(live, /configLoaded \? "No hay una transmisión configurada/);
  assert.doesNotMatch(live, /🔴 EN VIVO:/);
});
