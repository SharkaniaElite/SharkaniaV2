/**
 * Admin-only preview of the official BCCh observed dollar.
 * READ ONLY: never writes site_settings, tournaments, ELO or FX ledger.
 * Never sends BCCH_BDE_API_TOKEN to the browser, GitHub or logs.
 */
import { createClient } from "npm:@supabase/supabase-js@2.99.1";
import { parseBcchObservedUsd } from "../elo-fx-capture/official-parsers.mjs";

const trustedOrigins = new Set([
  "https://sharkania.com",
  "https://www.sharkania.com",
  "http://localhost:5173",
  "http://localhost:5174",
]);
const cors = (origin: string | null) => ({
  ...(origin && trustedOrigins.has(origin) ? { "Access-Control-Allow-Origin": origin } : {}),
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Max-Age": "600",
  "Cache-Control": "no-store",
  "Vary": "Origin",
  "X-Content-Type-Options": "nosniff",
});
const response = (status: number, payload: Record<string, unknown>, origin: string | null) =>
  Response.json(payload, { status, headers: cors(origin) });
const isoDate = (date: Date) => date.toISOString().slice(0, 10);

Deno.serve(async (req: Request): Promise<Response> => {
  const origin = req.headers.get("Origin");
  if (origin && !trustedOrigins.has(origin)) return response(403, {error:"origin_not_allowed"}, origin);
  if (req.method === "OPTIONS") return new Response(null,{status:204,headers:cors(origin)});
  if (req.method !== "POST") return response(405,{error:"method_not_allowed"},origin);

  const jwt = req.headers.get("Authorization")?.match(/^Bearer\s+([^\s]+)$/i)?.[1];
  if (!jwt) return response(401,{error:"authentication_required"},origin);
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const publishableKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !publishableKey) {
    return response(503,{error:"service_unavailable"},origin);
  }
  try {
    const userDb = createClient(supabaseUrl,publishableKey,{
      global:{headers:{Authorization:"Bearer "+jwt}},
      auth:{persistSession:false,autoRefreshToken:false},
    });
    const {data:identity,error:authError}=await userDb.auth.getUser(jwt);
    if (authError || !identity.user?.id) {
      return response(401,{error:"invalid_session"},origin);
    }
    const {data:allowed,error:roleError}=await userDb.rpc("is_super_admin");
    if(roleError || allowed !== true) return response(403,{error:"super_admin_required"},origin);
  } catch {
    return response(503,{error:"authentication_unavailable"},origin);
  }

  // Pure read-only preview: never even constructs an admin/role-bypassing DB client.
  const token = Deno.env.get("BCCH_BDE_API_TOKEN");
  if (!token) return response(503,{error:"official_source_not_configured"},origin);

  // Fixed provider hostname, fixed series, fixed look-back. No user URL,
  // amount, rate, token or date accepted in the request body.
  const now = new Date();
  const from = new Date(now.getTime() - 10 * 86_400_000);
  const url = new URL("https://si3.bcentral.cl/SieteRestWS/SieteRestWS.ashx");
  url.searchParams.set("token",token);
  url.searchParams.set("function","GetSeries");
  url.searchParams.set("timeseries","F073.TCO.PRE.Z.D");
  url.searchParams.set("firstdate",isoDate(from));
  url.searchParams.set("lastdate",isoDate(now));
  try {
    // NO logging of the URL — it contains the BCCh personal token.
    const upstream = await fetch(url, {
      method:"GET",
      headers: {Accept:"application/json"},
      signal: AbortSignal.timeout(12000),
    });
    if (!upstream.ok) return response(503,{error:"official_source_unavailable"},origin);
    const raw = await upstream.text();
    if (raw.length > 150_000) return response(503,{error:"invalid_official_response"},origin);
    const parsed = parseBcchObservedUsd(JSON.parse(raw));
    const today = isoDate(now);
    const recent = parsed
      .filter(x=>x.effectiveDate<=today && x.effectiveDate >= isoDate(new Date(now.getTime()-7*86_400_000)))
      .sort((a,b)=>b.effectiveDate.localeCompare(a.effectiveDate))[0];
    if (!recent || recent.quote<300 || recent.quote>3000) {
      return response(503,{error:"official_quote_unavailable"},origin);
    }
    return response(200,{
      source:"Banco Central de Chile",
      series:"F073.TCO.PRE.Z.D",
      currency:"CLP",
      unit:"CLP por USD",
      rateClpPerUsd:recent.quote,
      effectiveDate:recent.effectiveDate,
      fetchedAt:now.toISOString(),
      note:"Cotización observada oficial; no es cotización de compra/venta en tiempo real."
    },origin);
  } catch {
    return response(503,{error:"official_source_unavailable"},origin);
  }
});
