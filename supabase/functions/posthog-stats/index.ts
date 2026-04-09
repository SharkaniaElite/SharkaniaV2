import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { range = '7d' } = await req.json().catch(() => ({}));
    const POSTHOG_KEY = Deno.env.get('POSTHOG_PERSONAL_API_KEY')
    const PROJECT_ID = Deno.env.get('POSTHOG_PROJECT_ID')

    if (!POSTHOG_KEY || !PROJECT_ID) throw new Error('Missing Secrets');

    const rangeMap: Record<string, string> = {
      'today': '24 HOUR', '7d': '7 DAY', '30d': '30 DAY', '1y': '1 YEAR'
    };
    const interval = rangeMap[range] || '7 DAY';

    // 🚀 QUERY CON AUTO-AISLAMIENTO:
    // Filtra localhost y tus correos personales directamente desde el motor de PostHog
    const hogqlQuery = `
      SELECT 
        count(DISTINCT person_id) as v_unique,
        topK(5)(properties.$current_url) as v_pages,
        topK(5)(properties.$geoip_country_name) as v_countries,
        topK(3)(properties.$device_type) as v_devices
      FROM events 
      WHERE event = '$pageview' 
      AND timestamp > now() - INTERVAL ${interval}
      AND properties.$current_url NOT LIKE '%localhost%'
      AND properties.$current_url NOT LIKE '%127.0.0.1%'
      AND person.properties.email NOT IN ('duhauandres@gmail.com', 'andresduhau@gmail.com')
    `.trim();

    const response = await fetch(
      `https://us.i.posthog.com/api/projects/${PROJECT_ID}/query/`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${POSTHOG_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          "query": {
            "kind": "HogQLQuery",
            "query": hogqlQuery
          }
        })
      }
    )

    const rawData = await response.json()
    
    if (!response.ok) {
      console.error("PostHog Detail:", rawData);
      throw new Error(rawData.detail || "Error en HogQL");
    }

    const mainRow = rawData.results[0];

    return new Response(JSON.stringify({
      uniqueVisitors: mainRow[0] || 0,
      pages: Array.isArray(mainRow[1]) ? mainRow[1] : [],
      countries: Array.isArray(mainRow[2]) ? mainRow[2] : [],
      devices: Array.isArray(mainRow[3]) ? mainRow[3] : []
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})