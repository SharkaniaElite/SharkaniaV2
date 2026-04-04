// functions/blog/[slug].js
// Cloudflare Pages Function — sin TypeScript para evitar errores de tipos

const CRAWLER_AGENTS = [
  "facebookexternalhit",
  "facebot",
  "twitterbot",
  "whatsapp",
  "telegrambot",
  "linkedinbot",
  "slackbot",
  "discordbot",
  "googlebot",
  "bingbot",
  "applebot",
  "pinterest",
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

function buildOGHtml(post, pageUrl, ogImageUrl) {
  const title = `${post.title} — Sharkania`;
  const description = post.excerpt;
  const publishedTime = post.published_at || new Date().toISOString();

  return `<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}" />
    <meta property="og:site_name" content="Sharkania" />
    <meta property="og:type" content="article" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:url" content="${escapeHtml(pageUrl)}" />
    <meta property="og:image" content="${escapeHtml(ogImageUrl)}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:locale" content="es_MX" />
    <meta property="article:published_time" content="${escapeHtml(publishedTime)}" />
    <meta property="article:section" content="${escapeHtml(post.category)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
    <meta name="twitter:image" content="${escapeHtml(ogImageUrl)}" />
    <link rel="canonical" href="${escapeHtml(pageUrl)}" />
  </head>
  <body>
    <h1>${escapeHtml(post.title)}</h1>
    <p>${escapeHtml(post.excerpt)}</p>
    <a href="${escapeHtml(pageUrl)}">Ver artículo completo</a>
  </body>
</html>`;
}

async function fetchPost(slug, supabaseUrl, supabaseKey) {
  const url = `${supabaseUrl}/rest/v1/blog_posts?slug=eq.${encodeURIComponent(slug)}&published=eq.true&select=slug,title,excerpt,category,read_time,image_og,published_at&limit=1`;

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
    const slug = params.slug;

    // Si no es crawler, pasa al siguiente handler (sirve el SPA normal)
    if (!isCrawler(userAgent)) {
      return context.next();
    }

    const supabaseUrl = env.SUPABASE_URL;
    const supabaseKey = env.SUPABASE_ANON_KEY;

    // Si no hay variables configuradas, pasa al SPA
    if (!supabaseUrl || !supabaseKey) {
      return context.next();
    }

    const post = await fetchPost(slug, supabaseUrl, supabaseKey);

    // Si no existe el post, pasa al SPA
    if (!post) {
      return context.next();
    }

    const requestUrl = new URL(request.url);
    const pageUrl = requestUrl.toString();
    const origin = requestUrl.origin;

    const ogImageUrl = post.image_og
      ? `${origin}${post.image_og}`
      : `${origin}/sharkania-app-icon.svg`;

    const html = buildOGHtml(post, pageUrl, ogImageUrl);

    return new Response(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html;charset=UTF-8",
        "Cache-Control": "public, max-age=3600, s-maxage=3600",
      },
    });

  } catch (err) {
    // Si algo falla, sirve el SPA normal — nunca romper la app
    console.error("OG Function error:", err);
    return context.next();
  }
}
