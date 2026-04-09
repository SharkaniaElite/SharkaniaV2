// supabase/functions/posthog-stats/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const POSTHOG_KEY = Deno.env.get('POSTHOG_PERSONAL_API_KEY')
    const PROJECT_ID = Deno.env.get('POSTHOG_PROJECT_ID')

    // 🚀 CONSULTA MAESTRA: Pedimos Visitantes, Top Páginas y Top Países
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
            "kind": "DataTableNode",
            "source": {
              "kind": "HogQLQuery",
              // Esta query saca: Visitantes únicos, lista de páginas populares y países
              "query": `
                SELECT 
                  count(DISTINCT person_id) as unique_users,
                  topK(properties.$current_url, 5) as top_pages,
                  topK(properties.$geoip_country_name, 5) as top_countries,
                  topK(properties.$device_type, 3) as devices
                FROM events 
                WHERE event = '$pageview' AND timestamp > now() - INTERVAL 7 DAY
              `
            }
          }
        })
      }
    )

    const rawData = await response.json()
    
    // Formateamos la respuesta para que el frontend la entienda fácil
    const stats = {
      uniqueVisitors: rawData.results[0][0],
      pages: rawData.results[0][1],
      countries: rawData.results[0][2],
      devices: rawData.results[0][3]
    }

    return new Response(JSON.stringify(stats), {
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