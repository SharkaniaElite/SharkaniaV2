import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ignition = readFileSync("src/pages/ignition-championship.tsx", "utf8");
const dashboard = readFileSync("src/pages/player-dashboard.tsx", "utf8");
const middleware = readFileSync("functions/_middleware.ts", "utf8");

test("Liga SHARKANIA uses November 2026 launch and all four Thursdays", () => {
  assert.match(ignition, /Liga SHARKANIA/);
  assert.match(ignition, /5 de noviembre de 2026/);
  for (const date of ["Jue 5", "Jue 12", "Jue 19", "Jue 26"]) {
    assert.ok(ignition.includes(date), "Missing "+date);
  }
  assert.match(ignition, /path="\/ignition"/);
});

test("paid tournament replaces historic freeroll and ticket distribution", () => {
  assert.match(ignition, /US\$100 garantizados/);
  assert.match(ignition, /US\$3,30/);
  assert.match(ignition, /registro tardío de 60 minutos/i);
  assert.match(ignition, /Reentry y registro tardío: 60 min/);
  assert.doesNotMatch(ignition, /Liga Freeroll|Liga Oficial - Agosto 2026|\$150 USD|FREE \/ \$2 USD|Ticket \$55|Ticket \$33|Ticket \$5\.50/);
});

test("preserves host bounty and all three monthly ticket prizes", () => {
  assert.match(ignition, /Ticket US\$22/);
  assert.match(ignition, /\$325 TT para el \$100,000 High Roller/);
  assert.equal((ignition.match(/\$162 TT para el \$200\.000 GTD/g) || []).length,2);
  assert.match(ignition, /cuatro fechas de noviembre/);
});

test("player dashboard and server-rendered SEO reflect the paid league", () => {
  assert.match(dashboard, /Liga SHARKANIA/);
  assert.match(dashboard, /buy-in US\$3,30/);
  assert.doesNotMatch(dashboard, /SHARKANIA LIGA FREEROLL|torneos gratuitos\./);
  assert.match(middleware, /'\/ignition': \{ title: 'Liga SHARKANIA en Ignition Poker/);
  assert.match(middleware, /US\$100 por fecha/);
});
