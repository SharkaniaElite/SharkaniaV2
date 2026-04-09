// supabase/functions/posthog-stats/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // 1. Manejar pre-vuelo de CORS (necesario para que el navegador no bloquee la petición)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const POSTHOG_KEY = Deno.env.get('POSTHOG_PERSONAL_API_KEY')
    const PROJECT_ID = Deno.env.get('POSTHOG_PROJECT_ID')

    if (!POSTHOG_KEY || !PROJECT_ID) {
      throw new Error('Faltan las variables de entorno en Supabase')
    }

    // 2. Construir la consulta a PostHog
    // Filtramos por: Evento $pageview | Math: unique_group (Visitas Únicas) | Propiedad: is_identified = true
    const posthogUrl = `https://us.i.posthog.com/api/projects/${PROJECT_ID}/insights/trend/?events=[{"id":"$pageview","math":"unique_group"}]&properties=[{"key":"is_identified","value":"true","operator":"exact","type":"person"}]&date_from=-7d`

    const response = await fetch(posthogUrl, {
      headers: {
        'Authorization': `Bearer ${POSTHOG_KEY}`,
      },
    })

    const data = await response.json()

    // 3. Devolver la respuesta limpia a tu Super Admin
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