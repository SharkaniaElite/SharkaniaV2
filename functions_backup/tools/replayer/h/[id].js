// functions/tools/replayer/h/[id].js
// Cloudflare Pages Function — OG meta tags para manos compartidas

const CRAWLER_AGENTS = [
  "facebookexternalhit", "facebot", "twitterbot",
  "whatsapp", "telegrambot", "linkedinbot",
  "slackbot", "discordbot", "googlebot",
  "bingbot", "applebot", "pinterest",
  "vkshare", "curl", "python-requests",
];

function isCrawler(userAgent) {
  const ua = (userAgent || "").toLowerCase();
  return CRAWLER_AGENTS.some((bot) => ua.includes(bot));
}

function escapeHtml(str) {
  return (str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function buildTitle(summary) {
  if (!summary) return "Mano compartida — Sharkania Replayer";

  const { winner, hand_description, pot, blinds, game_type } = summary;

  if (winner && hand_description) {
    return `${winner} gana con ${hand_description} — Sharkania Replayer`;
  }
  if (pot && blinds) {
    return `Mano de ${game_type || "NLH"} (${blinds}) · Pot: ${pot} — Sharkania Replayer`;
  }
  return "Mano compartida — Sharkania Replayer";
}

function buildDescription(summary) {
  if (!summary) return "Reproduce esta mano paso a paso en Sharkania. Analiza cada decisión y aprende de los errores.";

  const { players_count, game_type, blinds, board, pot } = summary;

  const parts = [];
  if (game_type && blinds) parts.push(`${game_type} ${blinds}`);
  if (players_count) parts.push(`${players_count} jugadores`);
  if (pot) parts.push(`Pot: ${pot}`);
  if (board) parts.push(`Board: ${board}`);

  const details = parts.join(" · ");
  return `${details}. Reproduce esta mano en Sharkania y analiza cada decisión al instante.`;
}

function buildOGHtml(summary, pageUrl, ogImageUrl) {
  const title = buildTitle(summary);
  const description = buildDescription(summary);

  return `<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}" />

    <!-- Open Graph -->
    <meta property="og:site_name" content="Sharkania" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:url" content="${escapeHtml(pageUrl)}" />
    <meta property="og:image" content="${escapeHtml(ogImageUrl)}" />
    <meta property="og:image:secure_url" content="${escapeHtml(ogImageUrl)}" />
    <meta property="og:image:type" content="image/jpeg" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="Mano de poker en Sharkania Replayer" />
    <meta property="og:locale" content="es_MX" />

    <!-- Twitter / X -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
    <meta name="twitter:image" content="${escapeHtml(ogImageUrl)}" />

    <link rel="canonical" href="${escapeHtml(pageUrl)}" />
  </head>
  <body>
    <h1>${escapeHtml(title)}</h1>
    <p>${escapeHtml(description)}</p>
    <a href="${escapeHtml(pageUrl)}">Ver la mano completa en Sharkania</a>
  </body>
</html>`;
}

async function fetchSharedHand(id, supabaseUrl, supabaseKey) {
  const url = `${supabaseUrl}/rest/v1/shared_hands?id=eq.${encodeURIComponent(id)}&select=id,hand_summary&limit=1`;

  const res = await fetch(url, {
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) return null;
  const data = await res.json();
  return data[0] || null;
}

export async function onRequest(context) {
  const { request, params, env } = context;

  try {
    const userAgent = request.headers.get("user-agent") || "";
    const id = params.id;

    if (!isCrawler(userAgent)) {
      return context.next();
    }

    const supabaseUrl = env.SUPABASE_URL;
    const supabaseKey = env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return context.next();
    }

    const record = await fetchSharedHand(id, supabaseUrl, supabaseKey);

    const requestUrl = new URL(request.url);
    const pageUrl = requestUrl.toString();
    const origin = requestUrl.origin;

    // Imagen OG estática para todas las manos compartidas
    const ogImageUrl = `${origin}/images/tools/og-replayer-share.jpg`;

    const html = buildOGHtml(record?.hand_summary ?? null, pageUrl, ogImageUrl);

    return new Response(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html;charset=UTF-8",
        "Cache-Control": "public, max-age=3600, s-maxage=3600",
      },
    });

  } catch (err) {
    console.error("Shared hand OG error:", err);
    return context.next();
  }
}
