// Cloudflare Pages Function: syncs public article view counts without exposing PostHog credentials.
interface Env {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  VITE_POSTHOG_PERSONAL_API_KEY?: string; // Existing Cloudflare binding; move to unprefixed secret after rotation.
  POSTHOG_PERSONAL_API_KEY?: string;
  VITE_POSTHOG_PROJECT_ID?: string;
  POSTHOG_PROJECT_ID?: string;
  VITE_PUBLIC_POSTHOG_HOST?: string;
  POSTHOG_HOST?: string;
}
type FunctionContext = { request: Request; env: Env };
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" },
});

export const onRequestPost = async ({ request, env }: FunctionContext): Promise<Response> => {
  const token = request.headers.get("Authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return json({ success: false, message: "Inicio de sesión requerido." }, 401);

  const base = (env.SUPABASE_URL || "").replace(/\/$/, "");
  const anonKey = env.SUPABASE_ANON_KEY;
  if (!base || !anonKey) return json({ success: false, message: "Servicio temporalmente no configurado." }, 503);
  const apiHeaders = { apikey: anonKey, Authorization: `Bearer ${token}`, Accept: "application/json" };

  // This RPC checks auth.uid() against a server-stored super_admin role.
  const check = await fetch(`${base}/rest/v1/rpc/is_super_admin`, {
    method: "POST", headers: { ...apiHeaders, "Content-Type": "application/json" }, body: "{}",
  }).catch(() => null);
  if (!check?.ok || await check.json().catch(() => false) !== true) {
    return json({ success: false, message: "No autorizado para sincronizar visitas." }, 403);
  }

  const posthogKey = env.POSTHOG_PERSONAL_API_KEY || env.VITE_POSTHOG_PERSONAL_API_KEY;
  const projectId = env.POSTHOG_PROJECT_ID || env.VITE_POSTHOG_PROJECT_ID;
  const host = (env.POSTHOG_HOST || env.VITE_PUBLIC_POSTHOG_HOST || "us.posthog.com")
    .replace(/^https?:\/\//, "").replace(/\/$/, "");
  if (!posthogKey || !projectId || !/^\d+$/.test(projectId) || !/^(us|eu|us-assets|eu-assets)\.posthog\.com$/.test(host)) {
    return json({ success: false, message: "Falta configurar el acceso seguro a PostHog." }, 503);
  }

  try {
    const postsResponse = await fetch(`${base}/rest/v1/blog_posts?select=id,slug&published=eq.true&limit=1000`, { headers: apiHeaders });
    if (!postsResponse.ok) throw new Error("read_posts");
    const posts = await postsResponse.json() as Array<{ id: string; slug: string }>;
    if (!Array.isArray(posts)) throw new Error("invalid_posts");

    const queryResponse = await fetch(`https://${host}/api/projects/${projectId}/query/`, {
      method: "POST",
      headers: { Authorization: `Bearer ${posthogKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        query: {
          kind: "HogQLQuery",
          query: "SELECT properties.$pathname AS path, count(distinct person_id) AS visitors FROM events WHERE event = '$pageview' AND (properties.$pathname LIKE '/blog/%' OR properties.$pathname LIKE '/noticias/%' OR properties.$pathname LIKE '/promociones/%') GROUP BY path LIMIT 10000",
        },
      }),
    });
    if (!queryResponse.ok) throw new Error(`posthog_${queryResponse.status}`);
    const aggregate = await queryResponse.json() as { results?: unknown[][] };
    const paths = Array.isArray(aggregate.results) ? aggregate.results : [];
    const views = new Map<string, number>();
    for (const row of paths) {
      if (!Array.isArray(row) || typeof row[0] !== "string") continue;
      const pathname = row[0].replace(/\/$/, "");
      const slug = pathname.split("/").pop();
      if (!slug) continue;
      views.set(slug, (views.get(slug) || 0) + (Math.max(0, Number(row[1])) || 0));
    }

    let updated = 0;
    let failures = 0;
    for (let i = 0; i < posts.length; i += 5) {
      const batch = posts.slice(i, i + 5);
      const results = await Promise.all(batch.map(async post => {
        if (!post.slug) return false;
        const res = await fetch(`${base}/rest/v1/blog_posts?id=eq.${encodeURIComponent(post.id)}`, {
          method: "PATCH",
          headers: { ...apiHeaders, "Content-Type": "application/json", Prefer: "return=representation" },
          body: JSON.stringify({ unique_views: views.get(post.slug) || 0 }),
        });
        if (!res.ok) return false;
        const payload = await res.json().catch(() => []);
        return Array.isArray(payload) && payload.length === 1;
      }));
      updated += results.filter(Boolean).length;
      failures += results.filter(x => !x).length;
    }

    return json({
      success: failures === 0,
      message: failures
        ? `Se actualizaron ${updated} artículos, pero ${failures} no pudieron guardarse.`
        : `Se actualizaron las visitas de ${updated} artículos correctamente.`,
    }, failures ? 207 : 200);
  } catch (err) {
    console.error("PostHog views synchronization failed:", err instanceof Error ? err.message : "unknown");
    return json({ success: false, message: "Error temporal al sincronizar estadísticas." }, 502);
  }
};
