// 🛡️ Declaraciones nativas de Cloudflare para satisfacer a TypeScript y ESLint
interface Element {
  setInnerContent(content: string, options?: { html?: boolean }): this;
  setAttribute(name: string, value: string): this;
  append(content: string, options?: { html?: boolean }): this;
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

export const onRequest: PagesFunction<{ SUPABASE_ANON_KEY: string }> = async (context) => {
  const { request, next, env } = context;
  const url = new URL(request.url);
  const path = url.pathname;
  let canonicalPath = path === '/' ? '/' : path.replace(/\/$/, '');
  const isPrivate = /^\/(?:admin(?:\/|$)|dashboard(?:\/|$)|login(?:\/|$)|register(?:\/|$)|welcome(?:\/|$)|update-password(?:\/|$)|forgot-password(?:\/|$)|tools\/(?:quiz|calculadora-icm|simulador-elo|calculadora-banca|replayer)(?:\/|$))/.test(path);
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