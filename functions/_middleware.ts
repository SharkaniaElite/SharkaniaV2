// 🛡️ Declaraciones nativas de Cloudflare para satisfacer a TypeScript y ESLint
interface Element {
  setInnerContent(content: string, options?: { html?: boolean }): this;
  setAttribute(name: string, value: string): this;
  append(content: string, options?: { html?: boolean }): this;
  prepend(content: string, options?: { html?: boolean }): this;
}

declare class HTMLRewriter {
  on(selector: string, handlers: { element?: (element: Element) => void }): this;
  transform(response: Response): Response;
}

type PagesFunction<Env = any> = (context: {
  request: Request;
  env: Env;
  next: (request?: Request | string) => Promise<Response>;
}) => Promise<Response> | Response;

// ══════════════════════════════════════════════════════════

const SUPABASE_URL = 'https://nhpjzywfzljtlqaigzed.supabase.co';
const SITE_URL = 'https://sharkania.com';

const PAGE_META: Record<string, { title: string, desc: string }> = {
  '/': { title: 'Sharkania — Plataforma Global de Poker Competitivo', desc: 'Ranking ELO global, calendarios en vivo, clubes, ligas y estadísticas de jugadores.' },
  '/ranking': { title: 'Ranking ELO Global | Sharkania', desc: 'Compara los mejores jugadores de clubes privados de Latinoamérica y el mundo.' },
  '/calendar': { title: 'Calendario de Torneos | Sharkania', desc: 'Horarios, buy-ins, garantizados y countdown en tiempo real.' },
  '/clubs': { title: 'Clubes de Poker | Sharkania', desc: 'Directorio de clubes de poker online. PPPoker, PokerBros, ClubGG y más.' },
  '/leagues': { title: 'Ligas de Poker | Sharkania', desc: 'Ligas de poker competitivo con sistema de puntos y rankings.' },
  '/compare': { title: 'Comparador de Jugadores | Sharkania', desc: 'Compara estadísticas: ELO, ITM%, ROI, torneos y evolución.' },
  '/blog': { title: 'Blog — Estrategia & Análisis | Sharkania', desc: 'Estrategia, GTO, ICM y análisis del ecosistema de clubes privados.' },
  '/academia': { title: 'Academia de Poker | Sharkania', desc: 'Aprende estrategia de poker con lecciones, módulos y herramientas de estudio.' },
  '/glosario': { title: 'Glosario de Poker | Sharkania', desc: 'Terminología y conceptos esenciales del poker en español.' },
  '/tv': { title: 'Shark TV | Sharkania', desc: 'Clases, análisis de manos y contenido audiovisual de poker.' },
  '/noticias': { title: 'Noticias y Novedades | Sharkania', desc: 'Mantente al día con la actualidad del circuito.' },
  '/promociones': { title: 'Promociones Exclusivas | Sharkania', desc: 'Bonos de bienvenida, freerolls y beneficios exclusivos.' },
  '/tools': { title: 'Herramientas de Poker | Sharkania', desc: 'Calculadora ICM, simulador ELO, calculadora de bankroll y más.' },
  '/sistema-elo': { title: 'Sistema ELO para Poker | Sharkania', desc: 'Cómo funciona el sistema de rating ELO adaptado al poker.' },
};

async function fetchJson(path: string, key: string) {
  if (!key) return null;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      headers: { 'apikey': key, 'Authorization': `Bearer ${key}`, 'Accept': 'application/json' },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    return null;
  }
}


/**
 * Visible, server-fetched HTML for public content. React's createRoot() replaces this
 * initial markup when JS starts; search engines can read it without JS.
 * Never inject raw CMS HTML, user-submitted links, or non-public Supabase rows.
 */
function escapeSeoText(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (char) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" } as Record<string, string>)[char] || "");
}

function seoLink(prefix: string, slug: unknown): string {
  return escapeSeoText(prefix + encodeURIComponent(String(slug ?? "")));
}

function postCategoryPrefix(category: unknown): string {
  const label = String(category ?? "").trim().toLowerCase();
  return label === "noticias" ? "/noticias/" : label === "promociones" ? "/promociones/" : "/blog/";
}

function articleBodyAsHtml(raw: unknown): string {
  if (!Array.isArray(raw)) return "";
  return raw.slice(0, 220).map((item: unknown) => {
    if (!item || typeof item !== "object") return "";
    const block = item as { type?: unknown; content?: unknown; items?: unknown };
    const content = escapeSeoText(block.content).slice(0, 12000);
    switch (block.type) {
      case "h2": return "<h2 class='text-xl font-bold mt-8 mb-3'>" + content + "</h2>";
      case "h3": return "<h3 class='text-lg font-semibold mt-6 mb-2'>" + content + "</h3>";
      case "p": return "<p class='my-4'>" + content + "</p>";
      case "callout": return "<blockquote class='my-4 border-l-2 pl-4'>" + content + "</blockquote>";
      case "stat": return "<p class='my-4'>" + content + "</p>";
      case "list":
        return "<ul class='list-disc ml-6 my-4'>" +
          (Array.isArray(block.items) ? block.items.slice(0, 40).map((x: unknown) => "<li>" + escapeSeoText(x).slice(0, 3000) + "</li>").join("") : "") +
          "</ul>";
      default: return "";
    }
  }).join("");
}

async function buildVisibleSeoHtml(path: string, key: string): Promise<string> {
  if (!key) return "";
  let content = "";
  if (path === "/blog" || path === "/noticias" || path === "/promociones") {
    const list = await fetchJson("blog_posts?select=slug,title,excerpt,category&published=eq.true&order=published_at.desc&limit=150", key);
    if (Array.isArray(list)) {
      const matches = list.filter((post) => {
        const prefix = postCategoryPrefix(post.category);
        return path === "/blog" ? prefix === "/blog/" : prefix === path + "/";
      });
      const heading = path === "/blog" ? "Artículos y estrategias de póker" : path === "/noticias" ? "Noticias de póker" : "Promociones de póker";
      content = "<h1 class='text-3xl font-bold mb-6'>" + heading + "</h1><section>" +
        matches.map(post => "<article class='my-6'><h2 class='text-xl font-semibold'><a href='" +
          seoLink(postCategoryPrefix(post.category), post.slug) + "'>" + escapeSeoText(post.title) +
          "</a></h2><p>" + escapeSeoText(post.excerpt).slice(0, 1600) + "</p></article>").join("") + "</section>";
    }
  } else if (/^\/(?:blog|noticias|promociones)\/[^/]+$/.test(path)) {
    const slug = path.split("/")[2];
    const posts = await fetchJson("blog_posts?select=slug,title,excerpt,body,category&published=eq.true&slug=eq." +
      encodeURIComponent(slug) + "&limit=1", key);
    if (Array.isArray(posts) && posts[0]) {
      const post = posts[0];
      content = "<article><h1 class='text-3xl font-bold mb-5'>" + escapeSeoText(post.title) +
        "</h1><p class='text-lg my-4'>" + escapeSeoText(post.excerpt) + "</p>" +
        articleBodyAsHtml(post.body) + "</article>";
    }
  } else if (path === "/glosario") {
    const terms = await fetchJson("glossary_terms?select=term,slug,short_definition&is_active=eq.true&order=term.asc&limit=250", key);
    if (Array.isArray(terms)) {
      content = "<h1 class='text-3xl font-bold mb-6'>Glosario de póker</h1><dl>" +
        terms.map(term => "<div class='my-5'><dt class='font-bold'><a href='" +
          seoLink("/glosario/", term.slug) + "'>" + escapeSeoText(term.term) +
          "</a></dt><dd>" + escapeSeoText(term.short_definition) + "</dd></div>").join("") + "</dl>";
    }
  } else if (/^\/glosario\/[^/]+$/.test(path)) {
    const slug = path.slice("/glosario/".length);
    const terms = await fetchJson("glossary_terms?select=term,short_definition,full_definition&is_active=eq.true&slug=eq." +
      encodeURIComponent(slug) + "&limit=1", key);
    if (Array.isArray(terms) && terms[0]) {
      content = "<article><h1 class='text-3xl font-bold mb-5'>" + escapeSeoText(terms[0].term) +
        "</h1><p>" + escapeSeoText(terms[0].short_definition) + "</p><section class='my-5'>" +
        escapeSeoText(terms[0].full_definition) + "</section></article>";
    }
  } else if (/^\/tournament\/[^/]+$/.test(path)) {
    const slug = path.slice("/tournament/".length);
    const entries = await fetchJson(
      "tournaments?select=name,description,start_datetime,game_type,currency,buy_in,results_uploaded&is_demo=eq.false&slug=eq." +
      encodeURIComponent(slug) + "&limit=1", key,
    );
    if (Array.isArray(entries) && entries[0]) {
      const tournament = entries[0];
      const details = [
        tournament.start_datetime ? "Fecha: " + String(tournament.start_datetime).slice(0, 10) : "",
        tournament.game_type ? "Modalidad: " + tournament.game_type : "",
        tournament.buy_in != null ? "Entrada: " + tournament.buy_in + " " + (tournament.currency || "") : "",
      ].filter(Boolean);
      content = "<article><h1 class='text-3xl font-bold mb-5'>" + escapeSeoText(tournament.name) +
        "</h1><p class='text-lg my-4'>" + escapeSeoText(tournament.description) +
        "</p><ul>" + details.map(detail => "<li>" + escapeSeoText(detail) + "</li>").join("") +
        "</ul></article>";
    }
  } else if (path === "/clubs" || path === "/leagues") {
    const isClub = path === "/clubs";
    const query = isClub
      ? "clubs?select=slug,name,description&is_approved=eq.true&is_demo=eq.false&order=name.asc&limit=150"
      : "leagues?select=slug,name,description&is_demo=eq.false&order=name.asc&limit=150";
    const list = await fetchJson(query, key);
    if (Array.isArray(list)) {
      content = "<h1 class='text-3xl font-bold mb-6'>" +
        (isClub ? "Clubes de póker" : "Ligas de póker") + "</h1><section>" +
        list.map(item => "<article class='my-5'><h2 class='text-xl font-semibold'><a href='" +
          seoLink(path + "/", item.slug) + "'>" + escapeSeoText(item.name) + "</a></h2><p>" +
          escapeSeoText(item.description).slice(0, 1800) + "</p></article>").join("") + "</section>";
    }
  } else if (/^\/(?:clubs|leagues)\/[^/]+$/.test(path)) {
    const isClub = path.startsWith("/clubs/");
    const slug = path.split("/")[2];
    const query = (isClub ? "clubs" : "leagues") + "?select=name,description&slug=eq." +
      encodeURIComponent(slug) + (isClub ? "&is_approved=eq.true" : "&is_demo=eq.false") + "&limit=1";
    const items = await fetchJson(query, key);
    if (Array.isArray(items) && items[0]) {
      content = "<article><h1 class='text-3xl font-bold mb-5'>" +
        escapeSeoText(items[0].name) + "</h1><p>" + escapeSeoText(items[0].description) + "</p></article>";
    }
  } else if (/^\/ranking\/[^/]+$/.test(path)) {
    const slug = path.slice("/ranking/".length);
    const players = await fetchJson("players?select=nickname,elo_rating,total_tournaments&slug=eq." +
      encodeURIComponent(slug) + "&is_demo=eq.false&limit=1", key);
    if (Array.isArray(players) && players[0]) {
      content = "<article><h1 class='text-3xl font-bold mb-5'>" +
        escapeSeoText(players[0].nickname) + " — Perfil de jugador</h1><p>ELO: " +
        escapeSeoText(players[0].elo_rating) + ". Torneos jugados: " +
        escapeSeoText(players[0].total_tournaments) + ".</p></article>";
    }
  }
  return content
    ? "<main class='pt-24 pb-16 max-w-4xl mx-auto px-6 leading-relaxed text-sk-text-1' aria-label='Contenido público de Sharkania'>" + content + "</main>"
    : "";
}

export const onRequest: PagesFunction<{ SUPABASE_ANON_KEY: string }> = async (context) => {
  const { request, next, env } = context;
  const url = new URL(request.url);
  const path = url.pathname;
  let canonicalPath = path === '/' ? '/' : path.replace(/\/$/, '');
  const isPrivate = /^\/(?:admin(?:\/|$)|dashboard(?:\/|$)|login(?:\/|$)|register(?:\/|$)|welcome(?:\/|$)|update-password(?:\/|$)|forgot-password(?:\/|$)|tools\/(?:quiz|calculadora-icm|simulador-elo|calculadora-banca|replayer)(?:\/|$))/.test(path);
  // URLs con UUID de los sitemaps anteriores: redirigir al slug y mantener query.
  const legacyUuid = canonicalPath.match(/^\/tournament\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i);
  if (request.method === 'GET' && legacyUuid) {
    const rows = await fetchJson(
      "tournaments?select=slug&id=eq." + encodeURIComponent(legacyUuid[1]) +
      "&is_demo=eq.false&results_uploaded=eq.true&limit=1",
      env.SUPABASE_ANON_KEY,
    );
    if (Array.isArray(rows) && rows[0]?.slug) {
      const target = new URL(SITE_URL + "/tournament/" + encodeURIComponent(rows[0].slug));
      target.search = url.search;
      return Response.redirect(target.toString(), 301);
    }
    if (Array.isArray(rows)) {
      return new Response("Torneo no encontrado", {
        status: 404, headers: { "content-type": "text/plain; charset=utf-8", "x-robots-tag": "noindex" },
      });
    }
    return new Response("Datos temporalmente no disponibles", {
      status: 503, headers: { "Retry-After": "300", "Cache-Control": "no-store" },
    });
  }
  if (request.method === 'GET' && (path === '/academy' || path === '/shark-tv')) {
    return Response.redirect(`${SITE_URL}${path === '/academy' ? '/academia' : '/tv'}`, 301);
  }

  // HTTP 410 evita que las URLs retiradas se interpreten como páginas válidas
  // por el fallback SPA (un origen habitual de errores Soft 404).
  if (/^\/(?:lap-admin(?:\/.*)?|masterclass-latinallin|pro-dashboard|admin\/academy)\/?$/.test(path)) {
    return new Response(
      '<!doctype html><html lang="es"><meta charset="utf-8"><title>Página retirada | Sharkania</title><meta name="robots" content="noindex"><main><h1>Esta sección ya no está disponible</h1><p><a href="/">Volver a Sharkania</a></p></main></html>',
      { status: 410, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=300", "x-robots-tag": "noindex" } },
    );
  }

  // 1. Obtener el index.html generado por Vite
  const response = await next();

  // Si no es una petición HTML (es decir, es una imagen, JS, CSS), la dejamos pasar sin tocarla
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html")) {
    return response;
  }

  const key = env.SUPABASE_ANON_KEY;
  const visibleSeoHtml = !isPrivate ? await buildVisibleSeoHtml(canonicalPath, key) : '';

  // Valores por defecto
  let title = PAGE_META['/'].title;
  let description = PAGE_META['/'].desc;
  let image = `${SITE_URL}/og-default.png?v=2`;
  let ogType = "website";

  // 2. Lógica de ruteo para buscar los datos exactos en Supabase
  if (PAGE_META[path]) {
    title = PAGE_META[path].title;
    description = PAGE_META[path].desc;
    image = `${SITE_URL}/og/page/${path.replace('/', '') || 'ranking'}`;
  } else {
    // Rutas dinámicas (Noticias, Blog, Promociones)
    const POST_PREFIXES = ['/blog/', '/noticias/', '/promociones/'];
    const matchedPrefix = POST_PREFIXES.find(prefix => path.startsWith(prefix));

    if (matchedPrefix && path.length > matchedPrefix.length) {
      const slug = path.replace(matchedPrefix, '').replace(/\/$/, '');
      const data: any = await fetchJson(`blog_posts?slug=eq.${encodeURIComponent(slug)}&select=title,excerpt,image_og,image_thumbnail,category&published=eq.true&limit=1`, key);
      
      if (matchedPrefix === '/blog/' && Array.isArray(data) && data.length === 0) {
        return new Response('Artículo no encontrado', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8', 'x-robots-tag': 'noindex' } });
      }
      if (data && data[0]) {
        const postCategory = String(data[0].category || '').toLowerCase();
        const prefix = postCategory === 'noticias' ? '/noticias/' : postCategory === 'promociones' ? '/promociones/' : '/blog/';
        canonicalPath = `${prefix}${slug}`;
        title = `${data[0].title} — Sharkania`;
        description = data[0].excerpt;
        const imgPath = data[0].image_og || data[0].image_thumbnail || '/og-default.png';
        image = imgPath.startsWith('http') ? imgPath : `${SITE_URL}${imgPath}`;
        ogType = "article";
      }
    } 
    // Glosario: el título y la descripción deben existir en el HTML inicial,
    // no depender de que el navegador ejecute SEOHead después de cargar React.
    else if (canonicalPath.startsWith('/glosario/') && canonicalPath.slice('/glosario/'.length).length > 0 && canonicalPath.split('/').length === 3) {
      const termSlug = canonicalPath.slice('/glosario/'.length);
      const data: any = await fetchJson(
        `glossary_terms?select=term,short_definition&slug=eq.${encodeURIComponent(termSlug)}&is_active=eq.true&limit=1`, key,
      );
      if (Array.isArray(data) && data.length === 0) {
        return new Response('Término no encontrado', {
          status: 404,
          headers: { 'content-type': 'text/plain; charset=utf-8', 'x-robots-tag': 'noindex' },
        });
      }
      if (Array.isArray(data) && data[0]) {
        title = `${data[0].term} — Glosario de Poker | Sharkania`;
        description = data[0].short_definition || `Definición de ${data[0].term} en el glosario de póker de Sharkania.`;
        ogType = 'article';
      }
    }
    // Las fichas de liga tampoco deben heredar los metadatos de la portada.
    else if (canonicalPath.startsWith('/leagues/') && canonicalPath.slice('/leagues/'.length).length > 0 && canonicalPath.split('/').length === 3) {
      const leagueSlug = canonicalPath.slice('/leagues/'.length);
      const data: any = await fetchJson(
        `leagues?select=name,description&slug=eq.${encodeURIComponent(leagueSlug)}&is_demo=eq.false&limit=1`, key,
      );
      if (Array.isArray(data) && data.length === 0) {
        return new Response('Liga no encontrada', {
          status: 404,
          headers: { 'content-type': 'text/plain; charset=utf-8', 'x-robots-tag': 'noindex' },
        });
      }
      if (Array.isArray(data) && data[0]) {
        title = `${data[0].name} — Liga de Poker | Sharkania`;
        description = data[0].description
          ? String(data[0].description).slice(0, 180)
          : `Resultados, torneos y ranking de ${data[0].name} en Sharkania.`;
      }
    }
    // Torneos: metadatos y HTML visibles desde la primera respuesta HTTP.
    else if (canonicalPath.startsWith('/tournament/') && canonicalPath.slice('/tournament/'.length).length > 0 && canonicalPath.split('/').length === 3) {
      const tournamentSlug = canonicalPath.slice('/tournament/'.length);
      const data: any = await fetchJson(
        "tournaments?select=name,description,results_uploaded&slug=eq." +
        encodeURIComponent(tournamentSlug) + "&is_demo=eq.false&limit=1", key,
      );
      if (Array.isArray(data) && data.length === 0) {
        return new Response("Torneo no encontrado", {
          status: 404, headers: { "content-type": "text/plain; charset=utf-8", "x-robots-tag": "noindex" },
        });
      }
      if (Array.isArray(data) && data[0]) {
        title = data[0].name + " — " + (data[0].results_uploaded ? "Resultados" : "Torneo") + " | Sharkania";
        description = data[0].description
          ? String(data[0].description).slice(0, 180)
          : "Información, resultados y calendario del torneo " + data[0].name + " en Sharkania.";
        ogType = "article";
      }
    }
    // Perfiles de Jugadores
    else if (path.startsWith('/ranking/') && path !== '/ranking/') {
      const playerSlug = path.replace('/ranking/', '').replace(/\/$/, '').split('/')[0];
      const data: any = await fetchJson(`players?slug=eq.${encodeURIComponent(playerSlug)}&select=nickname,elo_rating,total_tournaments&limit=1`, key);
      
      if (Array.isArray(data) && data.length === 0) {
        return new Response('Jugador no encontrado', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8', 'x-robots-tag': 'noindex' } });
      }
      if (data && data[0]) {
        const elo = Math.round(Number(data[0].elo_rating));
        title = `${data[0].nickname} — ELO ${elo} | Sharkania`;
        description = `Perfil de ${data[0].nickname}: ELO ${elo}, ${data[0].total_tournaments} torneos jugados. Ranking global de poker competitivo.`;
        image = `${SITE_URL}/og/player/${playerSlug}`;
        ogType = "profile";
      }
    } 
    // Clubes
    else if (path.startsWith('/clubs/') && path !== '/clubs/') {
      const clubSlug = path.replace('/clubs/', '').replace(/\/$/, '').split('/')[0];
      const data: any = await fetchJson(`clubs?slug=eq.${encodeURIComponent(clubSlug)}&select=name,description&is_approved=eq.true&limit=1`, key);
      
      if (Array.isArray(data) && data.length === 0) {
        return new Response('Club no encontrado', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8', 'x-robots-tag': 'noindex' } });
      }
      if (data && data[0]) {
        title = `${data[0].name} — Club de Poker | Sharkania`;
        description = data[0].description || `Club de poker competitivo ${data[0].name}. Rankings y estadísticas.`;
        image = `${SITE_URL}/og/club/${clubSlug}`;
      }
    }
  }

  // 3. INYECTAR METADATOS AL VUELO: Reemplazamos las etiquetas del index.html
  const rewritten = new HTMLRewriter()
    .on('title', { element(e: Element) { e.setInnerContent(title) } })
    .on('meta[name="description"]', { element(e: Element) { e.setAttribute("content", description) } })
    .on('meta[name="robots"]', { element(e: Element) { e.setAttribute('content', isPrivate ? 'noindex, nofollow' : 'index, follow') } })
    .on('meta[property="og:title"]', { element(e: Element) { e.setAttribute("content", title) } })
    .on('meta[property="og:description"]', { element(e: Element) { e.setAttribute("content", description) } })
    .on('meta[property="og:image"]', { element(e: Element) { e.setAttribute("content", image) } })
    .on('meta[property="og:url"]', { element(e: Element) { e.setAttribute("content", `${SITE_URL}${canonicalPath}`) } })
    .on('meta[property="og:type"]', { element(e: Element) { e.setAttribute("content", ogType) } })
    .on('meta[name="twitter:title"]', { element(e: Element) { e.setAttribute("content", title) } })
    .on('meta[name="twitter:description"]', { element(e: Element) { e.setAttribute("content", description) } })
    .on('meta[name="twitter:image"]', { element(e: Element) { e.setAttribute("content", image) } })
    .on('link[rel="canonical"]', { element(e: Element) { e.setAttribute('href', `${SITE_URL}${canonicalPath}`) } })
    .on('#root', { element(e: Element) { if (visibleSeoHtml) e.prepend(visibleSeoHtml, { html: true }) } })
    .transform(response);

  // Las reglas de public/_headers NO se aplican a respuestas de Pages Functions.
  // Deben añadirse al HTML transformado sin perder el streaming del body.
  const headers = new Headers(rewritten.headers);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "SAMEORIGIN");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
  headers.set("Cache-Control", "public, max-age=0, must-revalidate");
  if (isPrivate || url.hostname.endsWith(".pages.dev")) {
    headers.set("X-Robots-Tag", "noindex");
  }
  return new Response(rewritten.body, {
    status: rewritten.status,
    statusText: rewritten.statusText,
    headers,
  });
};