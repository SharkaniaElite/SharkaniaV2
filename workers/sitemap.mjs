// Sharkania sitemap Worker — version-controlled source.
// Deploy this module to the existing "sharkania-sitemap" Worker after preview tests.
// Requires Cloudflare binding SUPABASE_ANON_KEY (secret_text).
const SITE = "https://sharkania.com";
const SUPABASE_URL = "https://nhpjzywfzljtlqaigzed.supabase.co";
const PAGE_SIZE = 500;
const MAX_PAGES = 20;

const PUBLIC_PAGES = [
  "/", "/ranking", "/calendar", "/noticias", "/promociones",
  "/clubs", "/leagues", "/blog", "/glosario", "/tv", "/academia",
  "/compare", "/tools", "/tools/perfilador-salas", "/sistema-elo",
  "/tutorial-csv", "/shop", "/terms", "/privacy",
  // Evergreen how-to guides are public, indexable React routes.
  "/como-jugar-en-clubgg", "/tutorial-ignition",
  "/tutorial-ignition-deposit", "/tutorial-coinpoker",
];

function xmlEscape(value) {
  return String(value).replace(/[&<>"']/g, ch => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;"
  })[ch]);
}

function validLastmod(value) {
  if (typeof value !== "string") return null;
  const date = value.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
}

function xmlUrl(path, lastmod) {
  if (!path || !path.startsWith("/")) return "";
  const location = xmlEscape(SITE + path);
  const lastModified = validLastmod(lastmod);
  return `<url><loc>${location}</loc>${lastModified ? `<lastmod>${lastModified}</lastmod>` : ""}</url>`;
}

async function fetchAll(table, columns, filters, key, fetcher) {
  const rows = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const params = new URLSearchParams({ select: columns, limit: String(PAGE_SIZE), offset: String(page * PAGE_SIZE) });
    for (const [field, condition] of Object.entries(filters)) params.set(field, condition);
    const apiUrl = `${SUPABASE_URL}/rest/v1/${table}?${params.toString()}`;
    const res = await fetcher(apiUrl, {
      headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: "application/json" },
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) {
      throw new Error(`Supabase query failed for ${table}: HTTP ${res.status}`);
    }
    const batch = await res.json();
    if (!Array.isArray(batch)) throw new Error(`Unexpected Supabase response for ${table}`);
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) return rows;
  }
  throw new Error(`Sitemap pagination exceeded limit for ${table}`);
}

export async function buildSitemap(key, fetcher = fetch) {
  if (!key) throw new Error("Missing SUPABASE_ANON_KEY binding");

  // Keep public eligibility aligned with Supabase RLS policies and React routes.
  // Restrict player/tournament pages to content-rich pages to avoid thin-URL flooding.
  const [posts, terms, clubs, leagues, players, tournaments] = await Promise.all([
    fetchAll("blog_posts", "slug,category,updated_at", { published: "eq.true" }, key, fetcher),
    fetchAll("glossary_terms", "slug,updated_at", { is_active: "eq.true" }, key, fetcher),
    fetchAll("clubs", "slug,updated_at", { is_approved: "eq.true", is_demo: "eq.false" }, key, fetcher),
    fetchAll("leagues", "slug,updated_at", { is_demo: "eq.false" }, key, fetcher),
    fetchAll("players", "slug,updated_at", { is_demo: "eq.false", total_tournaments: "gte.10" }, key, fetcher),
    fetchAll("tournaments", "id,updated_at", { is_demo: "eq.false", results_uploaded: "eq.true" }, key, fetcher),
  ]);

  const urls = new Map();
  function add(path, lastmod) {
    if (path && !urls.has(path)) urls.set(path, lastmod);
  }
  for (const path of PUBLIC_PAGES) add(path, null);
  for (const post of posts) {
    if (!post.slug) continue;
    const cat = String(post.category || "").trim().toLowerCase();
    const prefix = cat === "noticias" || cat === "noticia" ? "noticias"
      : cat === "promociones" || cat === "promocion" ? "promociones" : "blog";
    add(`/${prefix}/${encodeURIComponent(post.slug)}`, post.updated_at);
  }
  for (const term of terms) if (term.slug) add(`/glosario/${encodeURIComponent(term.slug)}`, term.updated_at);
  for (const club of clubs) if (club.slug) add(`/clubs/${encodeURIComponent(club.slug)}`, club.updated_at);
  for (const league of leagues) if (league.slug) add(`/leagues/${encodeURIComponent(league.slug)}`, league.updated_at);
  for (const player of players) if (player.slug) add(`/ranking/${encodeURIComponent(player.slug)}`, player.updated_at);
  // The actual React Router path is /tournament/:id (UUID), not a tournament slug.
  for (const t of tournaments) if (t.id) add(`/tournament/${encodeURIComponent(t.id)}`, t.updated_at);

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${Array.from(urls, ([path, lastmod]) => xmlUrl(path, lastmod)).join("\n")}\n</urlset>\n`;
}

export default {
  async fetch(request, env, ctx) {
    const cache = caches.default;
    const cacheKey = new Request(SITE + "/sitemap.xml");
    const cached = await cache.match(cacheKey);
    if (cached) return cached;
    try {
      const xml = await buildSitemap(env.SUPABASE_ANON_KEY);
      const response = new Response(xml, {
        status: 200,
        headers: {
          "Content-Type": "application/xml; charset=UTF-8",
          "Cache-Control": "public, max-age=600, s-maxage=3600",
          "X-Content-Type-Options": "nosniff",
        },
      });
      ctx.waitUntil(cache.put(cacheKey, response.clone()));
      return response;
    } catch (err) {
      // Never cache an incomplete sitemap as HTTP 200 when Supabase is unavailable.
      console.error("Sitemap generation failed", err instanceof Error ? err.message : "unknown error");
      return new Response("Sitemap temporarily unavailable", {
        status: 503,
        headers: { "Content-Type": "text/plain; charset=UTF-8", "Retry-After": "300", "Cache-Control": "no-store" },
      });
    }
  },
};
