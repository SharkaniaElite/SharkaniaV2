import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  try {
    if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

    const payload = await req.json();
    const eventName = payload.meta.event_name;
    
    // 1. Extraemos el ID del usuario (esto sí es seguro traerlo del custom_data)
    const userId = payload.meta.custom_data?.user_id;
    const orderId = payload.data.id.toString();

    // 2. Extraemos el total pagado en centavos directamente de Lemon Squeezy
    // 499 = $4.99 USD
    const totalCents = payload.data.attributes.total;
    let creditsAmount = 0;

    // 3. Asignamos las monedas según el dinero real cobrado (Anti-hackers)
    if (totalCents === 499) {
        creditsAmount = 500;  // Starter Pack
    } else if (totalCents === 999) {
        creditsAmount = 1200; // Pro Pack
    } else if (totalCents === 2499) {
        creditsAmount = 3500; // Elite Pack
    }

    console.log(`🔔 Evento: ${eventName} | User: ${userId} | Pagó: $${totalCents/100} | Coins: ${creditsAmount}`);

    if (eventName === 'order_created' && userId && creditsAmount > 0) {
      
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      );

      // Usamos la función SQL que ya arreglaste para que sume a 'shark_coins_balance'
      const { error } = await supabase.rpc('add_credits_to_user', {
        p_user_id: userId,
        p_amount: creditsAmount,
        p_order_id: orderId
      });

      if (error) throw error;
      
      console.log(`✅ ¡Éxito! Acreditados ${creditsAmount} Shark Coins al usuario ${userId}`);
    }

    return new Response(JSON.stringify({ received: true }), { 
      status: 200, 
      headers: { 'Content-Type': 'application/json' } 
    });

  } catch (err) {
    console.error('❌ Error Interno:', err.message);
    return new Response('Error procesando el webhook', { status: 500 });
  }
})