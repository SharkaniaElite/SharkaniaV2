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
  assert.match(fn, /const posthogKey = env\.POSTHOG_PERSONAL_API_KEY;/);
  assert.doesNotMatch(fn, /VITE_POSTHOG_PERSONAL_API_KEY/);
  assert.doesNotMatch(fn, /env\.VITE_PUBLIC_POSTHOG_HOST/);
  assert.match(fn, /"us\.posthog\.com"/);
  assert.match(fn, /if \(paths\.length === 0\)/);
  assert.match(fn, /no se modificaron las estadísticas/);
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

test("server HTML fallback is public-only, escaped, and not invisible SEO content", () => {
  const middleware = readFileSync("functions/_middleware.ts", "utf8");
  assert.match(middleware, /async function buildVisibleSeoHtml/);
  assert.match(middleware, /escapeSeoText\(post\.title\)/);
  assert.match(middleware, /escapeSeoText\(item\.description\)/);
  assert.match(middleware, /escapeSeoText\(prefix \+ encodeURIComponent/);
  assert.match(middleware, /'glossary_terms\?|glossary_terms\?/);
  assert.match(middleware, /\.on\('#root'/);
  assert.match(middleware, /!isPrivate \? await buildVisibleSeoHtml/);
  assert.doesNotMatch(middleware, /display:none|id="seo-content"/);
  const main = readFileSync("src/main.tsx", "utf8");
  assert.match(main, /createRoot\(rootElement\)/);
});

test("signup never trusts a browser-selected role or marks Ignition verified", () => {
  const src = readFileSync("src/lib/api/auth.ts", "utf8");
  assert.match(src, /_requestedRole: UserRole/);
  assert.doesNotMatch(src, /\n\s*role,\s*\n/);
  assert.doesNotMatch(src, /updatePayload\.ignition_status\s*=\s*['"]verified/);
  assert.doesNotMatch(src, /updatePayload\.ignition_linked_at\s*=/);
});

test("club signup never inserts arbitrary email messages from the browser", () => {
  const src = readFileSync("src/pages/register.tsx", "utf8");
  assert.doesNotMatch(src, /\.from\(["']email_queue["']\)/);
  assert.doesNotMatch(src, /sharkania-email-worker\.duhauandres\.workers\.dev/);
  assert.match(src, /registration_type: regType === "club"/);
  const auth = readFileSync("src/lib/api/auth.ts", "utf8");
  assert.match(auth, /registration_type: extra\?\.registration_type === "club"/);
});

test("PostHog sync performs a single atomic authorized RPC without per-post PATCH calls", () => {
  const fn = readFileSync("functions/api/sync-blog-views.ts", "utf8");
  const db = readFileSync("supabase/migrations/20261031_secure_batch_blog_views.sql", "utf8");
  const api = readFileSync("src/lib/api/blog.ts", "utf8");
  assert.match(fn, /rpc\/sync_blog_unique_views/);
  assert.match(fn, /Object\.fromEntries\(views\)/);
  assert.doesNotMatch(fn, /method: "PATCH"/);
  assert.doesNotMatch(fn, /for \(let i = 0; i < posts\.length/);
  assert.match(db, /public\.is_super_admin\(\)/);
  assert.match(db, /GREATEST\(COALESCE\(b\.unique_views, 0\), v\.visits\)/);
  assert.match(db, /REVOKE EXECUTE ON FUNCTION public\.sync_blog_unique_views\(jsonb\)/);
  assert.match(api, /response\.headers\.get\("content-type"\)/);
  assert.match(api, /response\.ok && result\.success === true/);
});

test("privileged reward functions enforce server-side verification and mission scope", () => {
  const base = "supabase/migrations/";
  const missions = readFileSync(base + "20261031145349_enforce_verified_auto_mission_claims_only_20261031.sql", "utf8");
  const permissions = readFileSync(base + "20261031145511_secure_manual_mission_requests_and_private_evidence_20261031.sql", "utf8");
  const academy = readFileSync(base + "20261031145750_validate_academy_quizzes_and_serialize_rewards_20261031.sql", "utf8");
  const rows = readFileSync(base + "20261031145859_secure_academy_reward_tables_against_client_bypass_20261031.sql", "utf8");
  assert.match(missions, /validation_type = 'auto'/);
  assert.match(missions, /Esta misión requiere revisión administrativa/);
  assert.match(permissions, /status='pending'/);
  assert.match(permissions, /validation_type='manual'/);
  assert.doesNotMatch(permissions, /CREATE POLICY "Permitir lectura publica"/);
  assert.match(academy, /quiz_failed/);
  assert.match(academy, /module_locked/);
  assert.match(academy, /FOR UPDATE/);
  assert.match(academy, /WHERE id = p_player_mission_id AND status = 'pending'/);
  assert.match(rows, /guard_academy_lesson_rewards/);
  assert.match(rows, /REVOKE INSERT,UPDATE,DELETE ON public\.academy_user_modules/);
  assert.match(rows, /REVOKE DELETE ON public\.academy_user_lessons/);
});

test("hand view counting requires a session and prevents public counter inflation", () => {
  const base = "supabase/migrations/";
  const migration = readFileSync(base+"20261031151248_throttle_authenticated_shared_hand_views_once_per_day_20261031.sql","utf8");
  const privateRls = readFileSync(base+"20261031151554_enforce_rls_internal_hand_view_counter_20261031.sql","utf8");
  const app = readFileSync("src/App.tsx","utf8");
  assert.match(migration, /CREATE TABLE IF NOT EXISTS private\\.hand_view_cooldowns/);
  assert.match(migration, /v_viewer IS NULL/);
  assert.match(migration, /ON CONFLICT ON CONSTRAINT hand_view_cooldowns_pkey/);
  assert.match(migration, /interval '24 hours'/);
  assert.match(migration, /REVOKE EXECUTE ON FUNCTION public\\.increment_hand_views\\(text\\) FROM PUBLIC, anon, authenticated/);
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\\.increment_hand_views\\(text\\) TO authenticated, service_role/);
  assert.match(privateRls, /ENABLE ROW LEVEL SECURITY/);
  assert.match(app, /path="\\/tools\\/replayer\\/h\\/:id"/);
});
