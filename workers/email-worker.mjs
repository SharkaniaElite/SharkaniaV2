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


/**
 * Linkify only plain text fragments of a pre-rendered email.
 * Existing buttons, <a> tags, HTML attributes, and CSS are left untouched.
 * URLs from the admin's text areas become clickable in the delivered email.
 */
export function linkifyPlainUrlsInHtml(html) {
  if (typeof html !== "string" || !html) return html;
  let inAnchor = false;
  let inRaw = false;
  return html.split(/(<[^>]*>)/g).map((fragment) => {
    if (fragment.startsWith("<")) {
      if (/^<a(?:\s|>)/i.test(fragment)) inAnchor = true;
      if (/^<\/a\s*>/i.test(fragment)) inAnchor = false;
      if (/^<(?:style|script|textarea)(?:\s|>)/i.test(fragment)) inRaw = true;
      if (/^<\/(?:style|script|textarea)\s*>/i.test(fragment)) inRaw = false;
      return fragment;
    }
    if (inAnchor || inRaw) return fragment;
    return fragment.replace(/https?:\/\/[^\s<>"]+/gi, (full) => {
      const textUrl = full.replace(/[.,;:!?)]*$/, "");
      const after = full.slice(textUrl.length);
      try {
        const url = new URL(textUrl.replace(/&amp;/gi, "&"));
        if (!["https:", "http:"].includes(url.protocol)) return full;
        // Keep the original visible URL; escape all href attribute characters.
        const href = url.toString().replace(/&/g, "&amp;").replace(/"/g, "&quot;")
          .replace(/</g, "&lt;").replace(/>/g, "&gt;");
        return '<a href="' + href + '" target="_blank" rel="noopener noreferrer" style="color:#42d8ed;text-decoration:underline;">' + textUrl + '</a>' + after;
      } catch {
        return full;
      }
    });
  }).join("");
}


/**
 * Embed the official Fecha 1 visual guide only for the November welcome
 * and the first-date reminder. The other tournament dates have unconfirmed IDs.
 * No extra email is created and the image remains clickable at full size.
 */
export function addIgnitionFecha1Guide(html, campaignKey) {
  if (typeof html !== "string") return html;
  if (campaignKey !== "ignition-2026-11-welcome" && campaignKey !== "ignition-2026-11-05") return html;
  const photo = "https://sharkania.com/images/guias/ignition-liga-privada-fecha-1-email.jpg";
  const full = "https://sharkania.com/images/guias/ignition-liga-privada-fecha-1.svg";
  if (html.includes(photo)) return html;
  const card = '<div style="margin:20px auto;max-width:530px;padding:14px;background:#0b2735;border:1px solid #2bbbd5;border-radius:12px;">'
    + '<p style="font:700 16px Arial,sans-serif;color:#e4fcff;margin:0 0 10px;">Cómo encontrar la Fecha 1 · ID #82905364</p>'
    + '<a href="' + full + '" target="_blank" rel="noopener noreferrer">'
    + '<img src="' + photo + '" width="480" height="304" alt="Guía ilustrada: busca Liga Privada - Fecha 1, ID 82905364 en Torneos Programados de Ignition" style="display:block;width:100%;max-width:480px;height:auto;border:0;" />'
    + '</a><p style="font:13px Arial,sans-serif;color:#a9dce9;margin:10px 0 0;">'
    + '<a href="' + full + '" style="color:#54d8ee;">Ver guía completa a tamaño grande</a>'
    + '</p></div>';
  if (/<\/body>/i.test(html)) return html.replace(/<\/body>/i, card+"</body>");
  return html + card;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function sendWithResend(item, env) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + env.RESEND_API_KEY,
        'Content-Type': 'application/json',
        'Idempotency-Key': 'sharkania-queue-' + item.id,
      },
      body: JSON.stringify({
        from: 'Sharkania <no-reply@sharkania.com>',
        to: item.recipient_email,
        subject: item.subject,
        html: addIgnitionFecha1Guide(linkifyPlainUrlsInHtml(item.body_html), item.campaign_key),
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
  const response = await fetch(`${env.SUPABASE_URL}/rest/v1/email_queue?id=eq.${id}`, {
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
  if (!response.ok) throw new Error('Email queue status update failed: HTTP ' + response.status);
}