// Cloudflare Pages Function: syncs public article view counts without exposing PostHog credentials.
interface Env {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  POSTHOG_PERSONAL_API_KEY?: string;
  VITE_POSTHOG_PROJECT_ID?: string;
  POSTHOG_PROJECT_ID?: string;
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

  const posthogKey = env.POSTHOG_PERSONAL_API_KEY;
  const projectId = env.POSTHOG_PROJECT_ID || env.VITE_POSTHOG_PROJECT_ID;
  // Use the PostHog query API host, never the public SDK ingestion host (us.i.posthog.com).
  const host = (env.POSTHOG_HOST || "us.posthog.com")
    .replace(/^https?:\/\//, "").replace(/\/$/, "");
  if (!posthogKey || !projectId || !/^\d+$/.test(projectId) || !/^(us|eu)\.posthog\.com$/.test(host)) {
    return json({ success: false, message: "Falta configurar el acceso seguro a PostHog." }, 503);
  }

  try {
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
    if (!Array.isArray(aggregate.results)) {
      throw new Error("posthog_invalid_response");
    }
    const paths = aggregate.results;
    // Never overwrite valid stored visit counts with zero if PostHog returns no results.
    if (paths.length === 0) {
      return json({ success: false, message: "PostHog no devolvió visitas; no se modificaron las estadísticas." }, 422);
    }
    const views = new Map<string, number>();
    for (const row of paths) {
      if (!Array.isArray(row) || typeof row[0] !== "string") continue;
      const pathname = row[0].endsWith("/") ? row[0].slice(0, -1) : row[0];
      const parts = pathname.split("/");
      if (parts.length !== 3 || parts[0] !== "" || !["blog", "noticias", "promociones"].includes(parts[1] ?? "")) continue;
      let slug: string;
      try {
        slug = decodeURIComponent(pathname.split("/").pop() || "");
      } catch {
        continue;
      }
      if (!slug || slug.length > 240) continue;
      const count = Number(row[1]);
      if (!Number.isSafeInteger(count) || count < 0 || count > 999999999) continue;
      views.set(slug, (views.get(slug) || 0) + count);
    }

    if (views.size === 0) {
      return json({ success: false, message: "PostHog no devolvió visitas válidas; no se modificó el blog." }, 422);
    }

    // One server-verified RPC updates all articles atomically. 66 individual PATCH
    // calls exceeded the 50-subrequest limit of Cloudflare Workers Free.
    // The SQL function never lowers existing counters and validates super_admin.
    const syncResponse = await fetch(`${base}/rest/v1/rpc/sync_blog_unique_views`, {
      method: "POST",
      headers: { ...apiHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ p_views: Object.fromEntries(views) }),
    });
    if (!syncResponse.ok) {
      console.error("Blog view RPC failed", syncResponse.status);
      return json({ success: false, message: `Supabase rechazó la actualización de visitas (HTTP ${syncResponse.status}).` }, 502);
    }
    const outcome = await syncResponse.json() as { success?: boolean; updated?: number; supplied?: number };
    if (!outcome?.success || typeof outcome.updated !== "number") {
      throw new Error("unexpected_sync_rpc_response");
    }
    return json({
      success: true,
      message: outcome.updated
        ? `Visitas sincronizadas: ${outcome.updated} artículos actualizados; el historial anterior se conserva.`
        : `Sincronización correcta. No había visitas nuevas para actualizar; los contadores existentes se conservan.`,
      updated: outcome.updated,
      supplied: outcome.supplied,
    });
  } catch (err) {
    console.error("PostHog views synchronization failed:", err instanceof Error ? err.message : "unknown");
    return json({ success: false, message: "Error temporal al sincronizar estadísticas." }, 502);
  }
};
