// ══════════════════════════════════════════════════════════════
// SHARKANIA EMAIL WORKER v4.1 — Cron y ritmo seguro para Resend
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
  // Process at most 50 pending emails per scheduled invocation.
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/email_queue?status=eq.pending&select=*&limit=50`, {
    headers: { "apikey": env.SUPABASE_SERVICE_ROLE_KEY, "Authorization": `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` }
  });
  
  const emails = await res.json();
  
  if (!emails || emails.length === 0) {
    return { processed: 0, message: "No hay correos pendientes en la cola." };
  }

  // Process batches of five with a pause between batches, keeping well
  // below Resend's documented requests-per-second ceiling.
  const results = [];
  const batchSize = 5;
  for (let start = 0; start < emails.length; start += batchSize) {
    const batch = emails.slice(start, start + batchSize);
    const done = await Promise.all(batch.map(async (item) => {
      try {
        await sendWithResend(item, env);
        await updateStatus(item.id, 'sent', env);
        return { success: true };
      } catch (err) {
        const reason = err instanceof Error ? err.message : 'unknown_email_error';
        // Do not log private recipient addresses or message bodies.
        console.error('Email dispatch failed:', reason);
        await updateStatus(item.id, 'failed', env, reason);
        return { success: false };
      }
    }));
    results.push(...done);
    if (start + batchSize < emails.length) await sleep(1100);
  }

  const successCount = results.filter(r => r.success).length;
  const failedCount = results.filter(r => !r.success).length;

  return { 
    processed: emails.length, 
    success: successCount, 
    failed: failedCount 
  };
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function sendWithResend(item, env) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + env.RESEND_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Sharkania <no-reply@sharkania.com>',
        to: item.recipient_email,
        subject: item.subject,
        html: item.body_html,
      }),
    });

    if (response.ok) return;
    if (response.status === 429 && attempt < 2) {
      const retryAfter = Number(response.headers.get('Retry-After'));
      const delayMs = Number.isFinite(retryAfter) && retryAfter > 0
        ? Math.min(5000, retryAfter * 1000)
        : 1400 * (attempt + 1);
      await sleep(delayMs);
      continue;
    }
    const errorData = await response.text();
    throw new Error('Resend HTTP ' + response.status + ': ' + errorData.slice(0, 300));
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