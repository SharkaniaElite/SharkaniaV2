import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

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
  assert.match(migration, /CREATE TABLE IF NOT EXISTS private\.hand_view_cooldowns/);
  assert.match(migration, /v_viewer IS NULL/);
  assert.match(migration, /ON CONFLICT ON CONSTRAINT hand_view_cooldowns_pkey/);
  assert.match(migration, /interval '24 hours'/);
  assert.match(migration, /REVOKE EXECUTE ON FUNCTION public\.increment_hand_views\(text\) FROM PUBLIC, anon, authenticated/);
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.increment_hand_views\(text\) TO authenticated, service_role/);
  assert.match(privateRls, /ENABLE ROW LEVEL SECURITY/);
  assert.match(app, /path="\/tools\/replayer\/h\/:id"/);
});

test("shared hand ownership is assigned server-side and browser writes are limited", () => {
  const sql = readFileSync(
    "supabase/migrations/20261031153006_secure_shared_hands_author_ownership_and_column_privileges_20261031.sql", "utf8"
  );
  const replayer = readFileSync("src/lib/replayer-engine.ts", "utf8");
  assert.ok(sql.includes("ALTER COLUMN created_by SET DEFAULT auth.uid()"));
  assert.ok(sql.includes("created_by = (SELECT auth.uid())"));
  assert.ok(sql.includes('CREATE POLICY "Shared hands: insert only signed-in owner"'));
  assert.ok(sql.includes("REVOKE ALL PRIVILEGES ON TABLE public.shared_hands"));
  assert.ok(sql.includes("GRANT INSERT (hand_data, hand_summary)"));
  assert.ok(sql.includes("GRANT SELECT ON TABLE public.shared_hands TO anon, authenticated"));
  assert.ok(replayer.includes('.insert({ hand_data: hand, hand_summary: summary })'));
  assert.ok(replayer.includes('supabase.rpc("increment_hand_views", { hand_id: id })'));
});

test("replayer uses authenticated share RPC rather than publicly selecting hand data", () => {
  const migration=readFileSync("supabase/migrations/20261031154647_prepare_private_shared_hand_lookup_and_strong_ids_20261031.sql","utf8");
  const replayer=readFileSync("src/lib/replayer-engine.ts","utf8");
  const load=replayer.slice(replayer.indexOf("export async function loadHandFromShare"),replayer.indexOf("// ── Mantener compatibilidad"));
  assert.match(migration,/ALTER COLUMN id SET DEFAULT/);
  assert.match(migration,/SECURITY DEFINER/);
  assert.match(migration,/auth.uid\(\)/);
  assert.match(migration,/REVOKE EXECUTE ON FUNCTION public\.get_shared_hand/);
  assert.match(migration,/GRANT EXECUTE ON FUNCTION public\.get_shared_hand\(text\)\s+TO authenticated, service_role/);
  assert.match(load,/supabase\.rpc\("get_shared_hand", \{ p_hand_id: id \}\)/);
  assert.doesNotMatch(load,/\.from\("shared_hands"\)/);
  assert.match(load,/increment_hand_views/);
});

test("shared hand table is not enumerable and exact-ID retrieval remains authenticated", () => {
  const file = readFileSync("supabase/migrations/20261031155504_restrict_shared_hands_table_read_to_owner_20261031.sql","utf8");
  const replayer = readFileSync("src/lib/replayer-engine.ts","utf8");
  assert.ok(file.includes('DROP POLICY IF EXISTS "Shared hands: public read"'));
  assert.ok(file.includes('CREATE POLICY "Shared hands: owner-only SELECT"'));
  assert.ok(file.includes("created_by = (SELECT auth.uid())"));
  assert.ok(file.includes("REVOKE SELECT ON TABLE public.shared_hands FROM PUBLIC, anon"));
  assert.ok(file.includes("GRANT SELECT ON TABLE public.shared_hands TO authenticated"));
  assert.ok(replayer.includes('supabase.rpc("get_shared_hand", { p_hand_id: id })'));
});

test("hand replay guards missing seats and malformed street/action arrays without skipping TypeScript checking", () => {
  const engine=readFileSync("src/lib/replayer-engine.ts","utf8");
  const paywall=readFileSync("src/components/shop/feature-paywall.tsx","utf8");
  assert.ok(engine.includes("if (!player) return state"));
  assert.ok(engine.includes("if (!currentStreet) return { ...state, isFinished: true }"));
  assert.ok(engine.includes("if (!action) return { ...state, isFinished: true }"));
  assert.ok(engine.includes("if (!nextStreet) return { ...state, isFinished: true }"));
  assert.ok(engine.includes("if (!street) continue"));
  assert.ok(engine.includes("if (!action) continue"));
  assert.ok(engine.includes("hand.streets[si]?.actions.length ?? 0"));
  assert.ok(engine.includes("if (player) player.position"));
  assert.ok(paywall.includes("children?: React.ReactNode"));
});

test("academy paid unlock writes one debit and relies on the ledger trigger", () => {
  const sql = readFileSync(
    "supabase/migrations/20261031160943_fix_academy_single_coin_debit_20261031.sql",
    "utf8"
  );
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.academy_unlock_module/);
  assert.match(sql, /SECURITY DEFINER\s+SET search_path TO ''/);
  assert.match(sql, /auth\.uid\(\)\) IS DISTINCT FROM p_user_id/);
  assert.match(sql, /FROM public\.profiles WHERE id = p_user_id FOR UPDATE/);
  assert.match(sql, /COALESCE\(v_balance, 0\) < v_module\.price_coins/);
  assert.equal((sql.match(/INSERT INTO public\.credit_transactions/g) || []).length, 1);
  assert.match(sql, /-v_module\.price_coins, 'spend', 'academy_module'/);
  assert.doesNotMatch(sql, /UPDATE\s+(?:public\.)?profiles\s+SET\s+shark_coins_balance/i);
  assert.match(sql, /REVOKE EXECUTE ON FUNCTION public\.academy_unlock_module\(uuid, uuid\) FROM PUBLIC, anon/);
});

test("retired real-money checkout is absent while the Shark Coins shop remains", () => {
  const config = readFileSync("supabase/config.toml", "utf8");
  const migration = readFileSync(
    "supabase/migrations/20261031162543_remove_legacy_cash_topup_rpc_20261031.sql",
    "utf8"
  );
  const shop = readFileSync("src/lib/api/shop.ts", "utf8");
  assert.doesNotMatch(config, /lemonsqueezy/i);
  assert.equal(existsSync("supabase/functions/lemonsqueezy-webhook/index.ts"), false);
  assert.equal(existsSync("supabase/functions/lemonsqueezy-webhook/deno.json"), false);
  assert.equal(existsSync("supabase/functions/lemonsqueezy-webhook/.npmrc"), false);
  assert.match(migration, /DROP FUNCTION IF EXISTS public\.add_credits_to_user\(uuid, integer, text\)/);
  assert.match(shop, /supabase\.rpc\("spend_credits"/);
  assert.match(shop, /getSharkCoinsBalance/);
});

test("academy lesson progress uses least-privilege column grants", () => {
  const sql = readFileSync(
    "supabase/migrations/20261031175040_restrict_academy_lesson_progress_columns_20261031.sql",
    "utf8"
  );
  const api = readFileSync("src/lib/api/academy.ts", "utf8");
  assert.match(sql, /REVOKE INSERT, UPDATE, TRUNCATE, REFERENCES, TRIGGER[\s\S]*?ON TABLE public\.academy_user_lessons[\s\S]*?FROM PUBLIC, anon, authenticated/);
  assert.match(sql, /GRANT INSERT \(user_id, lesson_id, started_at, quiz_attempts, quiz_last_answers\)/);
  assert.match(sql, /GRANT UPDATE \(quiz_attempts, quiz_last_answers\)/);
  assert.doesNotMatch(sql, /GRANT (?:INSERT|UPDATE) \([^)]*(?:quiz_passed|completed_at|xp_earned|coins_earned)/);
  assert.match(api, /ignoreDuplicates: true/);
  assert.match(api, /\.update\(\{ quiz_attempts: existing\.quiz_attempts \+ 1, quiz_last_answers: answers \}\)/);
  assert.match(api, /\.rpc\("academy_complete_lesson"/);
});

test("web database roles cannot truncate tables or create triggers", () => {
  const sql = readFileSync(
    "supabase/migrations/20261031175418_revoke_web_roles_destructive_table_privileges_20261031.sql",
    "utf8"
  );
  assert.match(sql, /c\.relkind IN \('r', 'p'\)/);
  assert.match(sql, /REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLE %I\.%I FROM PUBLIC, anon, authenticated/);
  assert.match(sql, /ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public/);
  assert.doesNotMatch(sql, /REVOKE (?:SELECT|INSERT|UPDATE|DELETE)/);
  assert.doesNotMatch(sql, /DROP TABLE|TRUNCATE TABLE|DELETE FROM/);
});
