import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("personal PostHog API token is never referenced by a browser module", () => {
  const source = readFileSync("src/lib/api/blog.ts", "utf8");
  assert.doesNotMatch(source, /VITE_POSTHOG_PERSONAL_API_KEY|POSTHOG_API_KEY|api\/projects\/.*\/query/);
  assert.match(source, /\/api\/sync-blog-views/);
  const fn = readFileSync("functions/api/sync-blog-views.ts", "utf8");
  assert.match(fn, /rpc\/is_super_admin/);
  assert.match(fn, /Authorization/);
  assert.match(fn, /return json\(\{ success: false, message: "No autorizado/);
});

test("every page has a canonical URL from the request route, with no hidden SEO text", () => {
  const source = readFileSync("functions/_middleware.ts", "utf8");
  assert.match(source, /link\[rel="canonical"\]/);
  assert.match(source, /canonicalPath/);
  assert.doesNotMatch(source, /id="seo-content"/);
  assert.doesNotMatch(source, /if \(!key\) return response/);
  assert.match(source, /'\/academy'/);
  assert.match(source, /'\/shark-tv'/);
  assert.match(source, /status: 410/);
  assert.match(source, /status: 404/);
  assert.match(source, /url\.hostname\.endsWith\("\.pages\.dev"\)/);
  assert.match(source, /headers\.set\("X-Robots-Tag", "noindex"\)/);
  assert.match(source, /headers\.set\("X-Frame-Options", "SAMEORIGIN"\)/);
});

test("staff access fails closed while core routes and academy remain intact", () => {
  const auth = readFileSync("src/components/layout/protected-route.tsx", "utf8");
  assert.match(auth, /requiredRole && \(!profile \|\| !requiredRole.includes/);
  const app = readFileSync("src/App.tsx", "utf8");
  for (const route of ["/academia", "/ranking", "/leagues", "/clubs", "/dashboard"]) {
    assert.ok(app.includes(`path="${route}"`), `core route missing: ${route}`);
  }
});

test("new article slugs handle accents without renaming existing posts", () => {
  const editor = readFileSync("src/components/admin/blog-editor.tsx", "utf8");
  assert.match(editor, /\.normalize\('NFD'\)/);
  assert.equal("Póker y estrategia".normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-"), "poker-y-estrategia");
});
