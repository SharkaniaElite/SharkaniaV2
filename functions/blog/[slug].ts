// functions/blog/[slug].ts
// Cloudflare Pages Function — intercepta crawlers y devuelve HTML con OG tags

import type { EventContext } from "@cloudflare/workers-types";

interface Env {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
}

interface BlogPost {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  read_time: number;
  image_og: string | null;
  published_at: string | null;
}

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

function isCrawler(userAgent: string): boolean {
  const ua = userAgent.toLowerCase();
  return CRAWLER_AGENTS.some((bot) => ua.includes(bot));
}

function buildOGHtml(post: BlogPost, url: string, ogImageUrl: string): string {
  const title = `${post.title} — Sharkania`;
  const description = post.excerpt;
  const publishedTime = post.published_at ?? new Date().toISOString();

  return `<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}" />

    <!-- Open Graph -->
    <meta property="og:site_name" content="Sharkania" />
    <meta property="og:type" content="article" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:url" content="${escapeHtml(url)}" />
    <meta property="og:image" content="${escapeHtml(ogImageUrl)}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:type" content="image/avif" />
    <meta property="og:locale" content="es_MX" />
    <meta property="article:published_time" content="${publishedTime}" />
    <meta property="article:section" content="${escapeHtml(post.category)}" />

    <!-- Twitter / X -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
    <meta name="twitter:image" content="${escapeHtml(ogImageUrl)}" />

    <!-- WhatsApp usa og:image directamente — no necesita tag extra -->

    <!-- Canonical -->
    <link rel="canonical" href="${escapeHtml(url)}" />

    <!-- Redirect crawlers al SPA después de leer los meta tags -->
    <meta http-equiv="refresh" content="0;url=${escapeHtml(url)}" />
  </head>
  <body>
    <h1>${escapeHtml(post.title)}</h1>
    <p>${escapeHtml(post.excerpt)}</p>
  </body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function fetchPost(
  slug: string,
  supabaseUrl: string,
  supabaseKey: string
): Promise<BlogPost | null> {
  const url = `${supabaseUrl}/rest/v1/blog_posts?slug=eq.${encodeURIComponent(slug)}&published=eq.true&select=slug,title,excerpt,category,read_time,image_og,published_at&limit=1`;

  const res = await fetch(url, {
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) return null;

  const data: BlogPost[] = await res.json();
  return data[0] ?? null;
}

export async function onRequest(
  context: EventContext<Env, "slug", Record<string, unknown>>
): Promise<Response> {
  const { request, params, env } = context;
  const userAgent = request.headers.get("user-agent") ?? "";
  const slug = params.slug as string;

  // Si no es crawler, devuelve el index.html normal (la SPA lo maneja)
  if (!isCrawler(userAgent)) {
    return context.next();
  }

  // Es crawler — consulta Supabase
  const post = await fetchPost(slug, env.SUPABASE_URL, env.SUPABASE_ANON_KEY);

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
      // Cache 1 hora para crawlers
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
