import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

const src = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");

test("Preview QA is isolated to Pages preview host and cannot run on production domain", () => {
  const gates = src("src/lib/arena-preview.ts");
  assert.match(gates, /hostname\.endsWith\("\.sharkaniav2\.pages\.dev"\)/);
  assert.match(gates, /VITE_ARENA_ALLOW_PREVIEW_AUTH !== "true"/);
  assert.match(gates, /VITE_ARENA_QA_SUPABASE_REF/);
  assert.match(gates, /actualRef !== "nhpjzywfzljtlqaigzed"/);
  assert.match(gates, /VITE_TURNSTILE_SITE_KEY/);
  const qa = src("src/pages/arena-preview-qa.tsx");
  assert.match(qa, /if \(!isArenaPreviewHost\(\)\) return <Navigate to="\/" replace\/>/);
  assert.match(qa, /noIndex/);
  assert.match(src("src/App.tsx"), /path="\/__arena-qa" element=\{<ArenaPreviewQaPage/);
});

test("Preview synthetic QA never signs in or writes to Supabase", () => {
  const qa = src("src/pages/arena-preview-qa.tsx");
  assert.match(qa, /<PreviewPlayer\/>/);
  assert.doesNotMatch(qa, /<ReplayControls|<PokerTable|PreviewHand/);
  assert.doesNotMatch(qa, /\bsupabase\./);
  assert.doesNotMatch(qa, /\bsignIn\(|\bsignUp\(|\bfetch\(/);
  assert.match(qa, /No inicia sesión, no cambia cuentas/);
  assert.match(qa, /datos ficticios/i);
});

test("Preview blocks every production-backed protected page, including admin routes", () => {
  const protectedRoute = src("src/components/layout/protected-route.tsx");
  assert.match(protectedRoute, /if \(isArenaPreviewAuthBlocked\(\)\)/);
  assert.match(protectedRoute, /<Navigate to="\/__arena-qa" replace/);
  const router = src("src/App.tsx");
  assert.match(router, /path="\/dashboard"/);
  assert.match(router, /path="\/admin"/);
  assert.match(router, /path="\/tools\/replayer"/);
});

test("Login, signup, recovery and password changes do not submit to production on public preview", () => {
  const screens = [
    ["login", /disabled=\{previewBlocked \|\| !captchaToken \|\| loading\}/],
    ["register", /disabled=\{previewBlocked \|\| !captchaToken \|\| loading\}/],
    ["forgot-password", /disabled=\{previewBlocked \|\| !captchaToken \|\| isLoading\}/],
    ["update-password", /disabled=\{previewBlocked \|\| isLoading\}/],
  ];
  for (const [file, submit] of screens) {
    const code = src("src/pages/" + file + ".tsx");
    assert.match(code, /const previewBlocked = isArenaPreviewAuthBlocked\(\)/, file);
    assert.match(code, /if \(previewBlocked\) return;/, file);
    assert.match(code, submit, file);
  }
  const frame = src("src/components/arena/arena-auth-frame.tsx");
  assert.match(frame, /Acceso real deshabilitado en Preview/);
  assert.match(frame, /to="\/__arena-qa"/);
});

test("Retired hand replayer is absent from catalog, Shark Coins shop and Preview showcase", () => {
  const tools = src("src/pages/tools.tsx");
  const shop = src("src/pages/shop.tsx");
  const qa = src("src/pages/arena-preview-qa.tsx");
  assert.doesNotMatch(tools, /\/tools\/replayer|Replayer de Manos/);
  assert.doesNotMatch(shop, /tool_replayer|Ir al Replayer/);
  assert.doesNotMatch(qa, /Replayer de póker|<ReplayControls|<PokerTable/);
  // Keep old links functioning for owners of previously shared hands or purchases.
  const routes = src("src/App.tsx");
  assert.match(routes, /path="\/tools\/replayer\/h\/:id"/);
});
