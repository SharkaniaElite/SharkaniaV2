// ══════════════════════════════════════════════════════════════
// SHARKANIA EMAIL WORKER v4.0 — Asíncrono, Concurrente y Seguro
// ══════════════════════════════════════════════════════════════

export default {
  async scheduled(event, env, ctx) { 
    // Gatillado por Cron Job de Cloudflare
    ctx.waitUntil(processQueue(env)); 
  },
  
  // No browser-triggered processing: the email queue is exclusively
  // processed by Cloudflare Cron. In particular, no public CORS or static
  // password can trigger a mass send.
  async fetch() {
    return new Response("Not Found", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    });
  }
};

async function processQueue(env) {
  // 🔥 1. Reducimos el lote a 50 para asegurar que termine en < 5 segundos
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/email_queue?status=eq.pending&select=*&limit=50`, {
    headers: { "apikey": env.SUPABASE_SERVICE_ROLE_KEY, "Authorization": `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` }
  });
  
  const emails = await res.json();
  
  if (!emails || emails.length === 0) {
    return { processed: 0, message: "No hay correos pendientes en la cola." };
  }

  // 🔥 2. Concurrencia: Procesamos los 50 correos AL MISMO TIEMPO
  const processPromises = emails.map(async (item) => {
    try {
      await sendWithResend(item, env);
      await updateStatus(item.id, 'sent', env);
      return { success: true };
    } catch (err) {
      console.error(`Error enviando a ${item.recipient_email}:`, err.message);
      await updateStatus(item.id, 'failed', env, err.message);
      return { success: false };
    }
  });

  // Esperamos a que los 50 terminen su ciclo
  const results = await Promise.all(processPromises);

  const successCount = results.filter(r => r.success).length;
  const failedCount = results.filter(r => !r.success).length;

  return { 
    processed: emails.length, 
    success: successCount, 
    failed: failedCount 
  };
}

async function sendWithResend(item, env) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: 'Sharkania <no-reply@sharkania.com>',
      to: item.recipient_email,
      subject: item.subject,
      html: item.body_html
    })
  });

  if (!response.ok) {
    const errorData = await response.text();
    throw new Error(`Resend Error: ${errorData}`);
  }
}

async function updateStatus(id, status, env, error = null) {
  await fetch(`${env.SUPABASE_URL}/rest/v1/email_queue?id=eq.${id}`, {
    method: 'PATCH',
    headers: {
      "apikey": env.SUPABASE_SERVICE_ROLE_KEY,
      "Authorization": `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ 
      status, 
      sent_at: status === 'sent' ? new Date().toISOString() : null, 
      error_log: error 
    })
  });
}