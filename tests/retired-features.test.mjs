import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const retiredPaths = [
  "src/components/layout/accounting-shell.tsx",
  ...["agents", "backing", "dashboard", "liquidations", "players", "promotions", "transactions", "upload"].map(name => `src/pages/lap-${name}.tsx`),
  "src/pages/latin-allin-pro.tsx",
  "src/pages/pro-academy-dashboard.tsx",
  "src/pages/academy-admin.tsx"
];

function scan(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? scan(path) : /\.(tsx?|jsx?)$/.test(path) ? [path] : [];
  });
}

test("retired LAP and paid academy pages no longer exist", () => {
  for (const path of retiredPaths) assert.equal(existsSync(path), false, `still exists: ${path}`);
});

test("deleted pages and subscriptions have no remaining code references", () => {
  const disallowed = /\b(?:AccountingShell|LapUploadPage|LapTransactionsPage|LapPlayersPage|LapAgentsPage|LapLiquidationsPage|LapPromotionsPage|LapDashboardPage|LapBackingPage|LatinAllinProPage|ProAcademyDashboardPage|AcademyAdminPage|pro_referrals|pro_subscriptions|pro_academy_modules|pro_academy_videos|pro_referral_code|my-pro-referrals)\b/;
  const errors = scan("src").flatMap(path => {
    const content = readFileSync(path, "utf8");
    return disallowed.test(content) ? [path] : [];
  });
  assert.deepEqual(errors, [], "Found dangling retired feature references");
});

test("core rankings, public academy and administrative tools remain routed", () => {
  const source = readFileSync("src/App.tsx", "utf8");
  for (const route of ["/", "/ranking", "/academia", "/calendar", "/leagues", "/clubs", "/dashboard", "/admin", "/admin/broadcast"]) {
    assert.ok(source.includes(`path="${route}"`), `missing core route ${route}`);
  }
  for (const retired of ["/lap-admin", "/masterclass-latinallin", "/pro-dashboard", "/admin/academy"]) {
    assert.equal(source.includes(retired), false, `retired route present: ${retired}`);
  }
  const dashboard = readFileSync("src/pages/player-dashboard.tsx", "utf8");
  assert.ok(dashboard.includes("Mis Nicknames & Validaciones"));
  assert.ok(dashboard.includes("Mis Estadísticas"));
  assert.ok(!dashboard.includes("Mi Código de Afiliado PRO"));
});
