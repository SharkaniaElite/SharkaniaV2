import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

const rangeMap: Record<string, string> = {
  today: "24 HOUR",
  "7d": "7 DAY",
  "15d": "15 DAY",
  "30d": "30 DAY",
  "3m": "3 MONTH",
  "6m": "6 MONTH",
  "1y": "1 YEAR",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  // Modern publishable keys: the gateway check is disabled; the handler
  // explicitly verifies the user session against Supabase Auth instead.
  const authorization = req.headers.get("Authorization") || "";
  if (!/^Bearer [^\s]+$/i.test(authorization)) {
    return json(401, { error: "authentication_required" });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !anonKey) return json(503, { error: "auth_unavailable" });

  try {
    // Validate an active user session; never trust user ids in the request body.
    const userResponse = await fetch(supabaseUrl + "/auth/v1/user", {
      headers: { Authorization: authorization, apikey: anonKey },
    });
    if (!userResponse.ok) return json(401, { error: "invalid_session" });
    const user = await userResponse.json().catch(() => null);
    if (!user || typeof user.id !== "string") return json(401, { error: "invalid_session" });

    // Evaluate the existing SQL super-admin check with the verified user JWT.
    const adminResponse = await fetch(supabaseUrl + "/rest/v1/rpc/is_super_admin", {
      method: "POST",
      headers: {
        Authorization: authorization,
        apikey: anonKey,
        "Content-Type": "application/json",
      },
      body: "{}",
    });
    if (!adminResponse.ok) return json(503, { error: "authorization_unavailable" });
    const isAdmin = await adminResponse.json().catch(() => false);
    if (isAdmin !== true) return json(403, { error: "forbidden" });

    const requestBody = await req.json().catch(() => ({}));
    const requestedRange = requestBody?.range;
    const range = typeof requestedRange === "string" && Object.hasOwn(rangeMap, requestedRange)
      ? requestedRange
      : "7d";

    const posthogKey = Deno.env.get("POSTHOG_PERSONAL_API_KEY");
    const projectId = Deno.env.get("POSTHOG_PROJECT_ID");
    if (!posthogKey || !projectId || !/^\d+$/.test(projectId)) {
      return json(503, { error: "analytics_unavailable" });
    }

    const hogqlQuery = [
      "SELECT",
      "count(DISTINCT person_id) as v_unique,",
      "topK(5)(properties.$current_url) as v_pages,",
      "topK(5)(properties.$geoip_country_name) as v_countries,",
      "topK(3)(properties.$device_type) as v_devices",
      "FROM events",
      "WHERE event = '$pageview'",
      "AND timestamp > now() - INTERVAL " + rangeMap[range],
      "AND properties.$current_url NOT LIKE '%localhost%'",
      "AND properties.$current_url NOT LIKE '%127.0.0.1%'",
      "AND person.properties.email NOT IN ('duhauandres@gmail.com', 'andresduhau@gmail.com')",
    ].join(" ");

    const posthogResponse = await fetch(
      "https://us.posthog.com/api/projects/" + projectId + "/query/",
      {
        method: "POST",
        headers: {
          Authorization: "Bearer " + posthogKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: { kind: "HogQLQuery", query: hogqlQuery } }),
      },
    );
    if (!posthogResponse.ok) return json(502, { error: "analytics_query_failed" });

    const result = await posthogResponse.json().catch(() => null);
    const row = result?.results?.[0];
    if (!Array.isArray(row)) return json(502, { error: "analytics_invalid_response" });

    return json(200, {
      uniqueVisitors: Number(row[0]) || 0,
      pages: Array.isArray(row[1]) ? row[1] : [],
      countries: Array.isArray(row[2]) ? row[2] : [],
      devices: Array.isArray(row[3]) ? row[3] : [],
    });
  } catch {
    // Never expose vendor error payloads or authentication internals.
    return json(503, { error: "temporary_unavailable" });
  }
});
