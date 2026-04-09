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

    // 🚀 CAMBIO CLAVE: Usamos el endpoint /query/ con método POST
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
            "kind": "TrendsQuery",
            "dateRange": { "date_from": "-7d" },
            "series": [
              {
                "kind": "EventsNode",
                "event": "$pageview",
                "math": "unique_group"
              }
            ],
            "properties": [
              {
                "key": "is_identified",
                "value": "true",
                "operator": "exact",
                "type": "person"
              }
            ]
          }
        })
      }
    )

    const data = await response.json()

    return new Response(JSON.stringify(data), {
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