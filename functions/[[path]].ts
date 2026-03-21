// functions/[[path]].ts
// Cloudflare Pages Function — Dynamic OG Meta Tags
//
// SETUP:
// 1. Create folder: functions/ in your project root
// 2. Save this file as: functions/[[path]].ts
// 3. In Cloudflare Pages → Settings → Environment Variables, add:
//    SUPABASE_URL = https://nhpjzywfzljtlqaigzed.supabase.co
//    SUPABASE_ANON_KEY = your-anon-key
// 4. Deploy — Cloudflare auto-detects functions/

interface Env {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
}

interface OGData {
  title: string;
  description: string;
  image: string;
}

const SITE_URL = "https://sharkania.com";
const DEFAULT_OG: OGData = {
  title: "Sharkania — Plataforma Global de Poker Competitivo",
  description: "Ranking ELO, calendarios en vivo, clubes, ligas y estadísticas de jugadores.",
  image: `${SITE_URL}/og-default.png`,
};

// ══════════════════════════════════════════════════════════
// STATIC ROUTES
// ══════════════════════════════════════════════════════════

const OG_MAP: Record<string, OGData> = {
  "/": DEFAULT_OG,
  "/ranking": {
    title: "Ranking ELO Global | Sharkania",
    description: "Los mejores jugadores de poker del mundo ordenados por ELO. Busca, filtra y descubre quién domina.",
    image: `${SITE_URL}/og-default.png`,
  },
  "/calendar": {
    title: "Calendario de Torneos | Sharkania",
    description: "Próximos torneos de poker online en vivo. Countdown, buy-ins, garantizados y clubes de toda Latinoamérica.",
    image: `${SITE_URL}/og-default.png`,
  },
  "/clubs": {
    title: "Clubes de Poker | Sharkania",
    description: "Encuentra clubes de poker online verificados de toda Latinoamérica y el mundo.",
    image: `${SITE_URL}/og-default.png`,
  },
  "/leagues": {
    title: "Ligas de Poker | Sharkania",
    description: "Ligas organizadas con tabla de posiciones, puntos y premios.",
    image: `${SITE_URL}/og-default.png`,
  },
  "/compare": {
    title: "Comparador de Jugadores | Sharkania",
    description: "Compara dos jugadores de poker. ELO, ITM, ROI, torneos en común y evolución histórica.",
    image: `${SITE_URL}/og-default.png`,
  },
  "/blog": {
    title: "Blog | Sharkania",
    description: "Estrategia de poker, análisis de datos, mental game y más. Artículos para jugadores competitivos.",
    image: `${SITE_URL}/og-default.png`,
  },
  "/tools": {
    title: "Herramientas de Poker | Sharkania",
    description: "Calculadoras y herramientas gratuitas para jugadores de poker. ICM, ELO, bankroll, quiz de perfil y más.",
    image: `${SITE_URL}/og-default.png`,
  },
  "/tools/quiz": {
    title: "Quiz: ¿Qué tipo de jugador de poker eres? | Sharkania",
    description: "Descubre tu perfil de jugador con el quiz de Sharkania. 10 preguntas de situaciones reales.",
    image: `${SITE_URL}/images/tools/og-tool-quiz.png`,
  },
  "/tools/calculadora-icm": {
    title: "Calculadora ICM | Sharkania",
    description: "Calcula tu equity ICM en burbuja y mesa final. Algoritmo Malmuth-Harville.",
    image: `${SITE_URL}/images/tools/og-tool-icm.png`,
  },
  "/tools/simulador-elo": {
    title: "Simulador de ELO | Sharkania",
    description: "Simula cuánto subiría o bajaría tu ELO según tu posición en un torneo.",
    image: `${SITE_URL}/images/tools/og-tool-elo.png`,
  },
  "/tools/calculadora-banca": {
    title: "Calculadora de Bankroll | Sharkania",
    description: "Calcula tu bankroll óptimo para torneos de poker. Riesgo de ruina y buy-ins recomendados.",
    image: `${SITE_URL}/images/tools/og-tool-bankroll.png`,
  },
  "/register": {
    title: "Registrarse | Sharkania",
    description: "Crea tu cuenta gratis en Sharkania. Para jugadores y clubes de poker.",
    image: `${SITE_URL}/og-default.png`,
  },
  "/login": {
    title: "Iniciar Sesión | Sharkania",
    description: "Accede a tu cuenta de Sharkania.",
    image: `${SITE_URL}/og-default.png`,
  },
};

// ══════════════════════════════════════════════════════════
// SUPABASE HELPERS
// ══════════════════════════════════════════════════════════

async function supabaseFetch(env: Env, table: string, query: string): Promise<Record<string, unknown>[] | null> {
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) return null;
  try {
    const url = `${env.SUPABASE_URL}/rest/v1/${table}?${query}`;
    const res = await fetch(url, {
      headers: {
        apikey: env.SUPABASE_ANON_KEY,
        Authorization: `Bearer ${env.SUPABASE_ANON_KEY}`,
        Accept: "application/json",
      },
    });
    if (!res.ok) return null;
    return await res.json() as Record<string, unknown>[];
  } catch {
    return null;
  }
}

// ══════════════════════════════════════════════════════════
// DYNAMIC OG RESOLVER
// ══════════════════════════════════════════════════════════

async function getOGData(pathname: string, env: Env): Promise<OGData> {
  // 1. Exact match on static routes
  if (OG_MAP[pathname]) return OG_MAP[pathname];

  // 2. Blog posts: /blog/:slug → fetch title, excerpt, image_og from Supabase
  const blogMatch = pathname.match(/^\/blog\/([^/]+)$/);
  if (blogMatch) {
    const slug = blogMatch[1];
    const rows = await supabaseFetch(
      env,
      "blog_posts",
      `slug=eq.${encodeURIComponent(slug)}&select=title,excerpt,image_og&published=eq.true&limit=1`
    );
    if (rows && rows.length > 0) {
      const post = rows[0];
      const imageOg = post.image_og as string | null;
      return {
        title: `${post.title} | Sharkania`,
        description: (post.excerpt as string) || DEFAULT_OG.description,
        image: imageOg
          ? (imageOg.startsWith("http") ? imageOg : `${SITE_URL}${imageOg}`)
          : `${SITE_URL}/og-default.png`,
      };
    }
    return {
      title: "Artículo | Sharkania Blog",
      description: "Lee este artículo de estrategia de poker en el blog de Sharkania.",
      image: `${SITE_URL}/og-default.png`,
    };
  }

  // 3. Player profiles: /ranking/:id → fetch nickname, elo, country
  const playerMatch = pathname.match(/^\/ranking\/([0-9a-f-]{36})$/);
  if (playerMatch) {
    const playerId = playerMatch[1];
    const rows = await supabaseFetch(
      env,
      "players",
      `id=eq.${playerId}&select=nickname,elo_rating,country_code,total_tournaments&limit=1`
    );
    if (rows && rows.length > 0) {
      const p = rows[0];
      const nickname = (p.nickname as string).replace(/^\[DEMO\]\s*/, "");
      const elo = Math.round(Number(p.elo_rating));
      return {
        title: `${nickname} — Perfil | Sharkania`,
        description: `Perfil de ${nickname}. ELO ${elo.toLocaleString()}, ${p.total_tournaments} torneos jugados.`,
        image: `${SITE_URL}/og-default.png`,
      };
    }
    return {
      title: "Perfil de Jugador | Sharkania",
      description: "Estadísticas, ELO y historial de torneos de este jugador.",
      image: `${SITE_URL}/og-default.png`,
    };
  }

  // 4. Club detail: /clubs/:id
  const clubMatch = pathname.match(/^\/clubs\/([0-9a-f-]{36})$/);
  if (clubMatch) {
    const clubId = clubMatch[1];
    const rows = await supabaseFetch(
      env,
      "clubs",
      `id=eq.${clubId}&select=name,description,country_code&is_approved=eq.true&limit=1`
    );
    if (rows && rows.length > 0) {
      const c = rows[0];
      return {
        title: `${c.name} | Sharkania`,
        description: (c.description as string) || `Club de poker ${c.name}. Torneos, calendario y ranking.`,
        image: `${SITE_URL}/og-default.png`,
      };
    }
    return {
      title: "Club de Poker | Sharkania",
      description: "Descubre este club de poker, sus torneos y su ranking de jugadores.",
      image: `${SITE_URL}/og-default.png`,
    };
  }

  // 5. League detail: /leagues/:id
  const leagueMatch = pathname.match(/^\/leagues\/([0-9a-f-]{36})$/);
  if (leagueMatch) {
    const leagueId = leagueMatch[1];
    const rows = await supabaseFetch(
      env,
      "leagues",
      `id=eq.${leagueId}&select=name,description&limit=1`
    );
    if (rows && rows.length > 0) {
      const l = rows[0];
      return {
        title: `${l.name} — Liga | Sharkania`,
        description: (l.description as string) || `Liga de poker ${l.name}. Tabla de posiciones y calendario.`,
        image: `${SITE_URL}/og-default.png`,
      };
    }
  }

  // 6. Tournament detail: /tournament/:id
  const tournamentMatch = pathname.match(/^\/tournament\/([0-9a-f-]{36})$/);
  if (tournamentMatch) {
    const tId = tournamentMatch[1];
    const rows = await supabaseFetch(
      env,
      "tournaments",
      `id=eq.${tId}&select=name,buy_in,start_datetime&limit=1`
    );
    if (rows && rows.length > 0) {
      const t = rows[0];
      return {
        title: `${t.name} — Resultados | Sharkania`,
        description: `Resultados del torneo ${t.name}. Posiciones, premios y cambios de ELO.`,
        image: `${SITE_URL}/og-default.png`,
      };
    }
  }

  return DEFAULT_OG;
}

// ══════════════════════════════════════════════════════════
// HTML INJECTION
// ══════════════════════════════════════════════════════════

function injectOGTags(html: string, og: OGData, url: string): string {
  let result = html;

  result = result.replace(/<title>[^<]*<\/title>/, `<title>${og.title}</title>`);
  result = result.replace(/<meta property="og:title" content="[^"]*"/, `<meta property="og:title" content="${og.title}"`);
  result = result.replace(/<meta property="og:description" content="[^"]*"/, `<meta property="og:description" content="${og.description}"`);
  result = result.replace(/<meta property="og:image" content="[^"]*"/, `<meta property="og:image" content="${og.image}"`);
  result = result.replace(/<meta property="og:url" content="[^"]*"/, `<meta property="og:url" content="${url}"`);
  result = result.replace(/<meta name="twitter:title" content="[^"]*"/, `<meta name="twitter:title" content="${og.title}"`);
  result = result.replace(/<meta name="twitter:description" content="[^"]*"/, `<meta name="twitter:description" content="${og.description}"`);
  result = result.replace(/<meta name="twitter:image" content="[^"]*"/, `<meta name="twitter:image" content="${og.image}"`);
  result = result.replace(/<meta name="description" content="[^"]*"/, `<meta name="description" content="${og.description}"`);
  result = result.replace(/<link rel="canonical" href="[^"]*"/, `<link rel="canonical" href="${url}"`);

  return result;
}

// ══════════════════════════════════════════════════════════
// REQUEST HANDLER
// ══════════════════════════════════════════════════════════

export const onRequest: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url);
  const pathname = url.pathname;

  // Let static assets pass through
  const staticExts = [".js", ".css", ".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico", ".webp", ".avif", ".woff", ".woff2", ".ttf", ".map", ".json", ".xml", ".txt"];
  if (staticExts.some(ext => pathname.endsWith(ext))) {
    return context.next();
  }

  // Fetch the original response (index.html for SPA routes)
  const response = await context.next();
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html")) {
    return response;
  }

  // Get dynamic OG data (may fetch from Supabase for blogs/players/clubs)
  const og = await getOGData(pathname, context.env);
  const fullUrl = `${SITE_URL}${pathname}`;

  // Read HTML body and inject OG tags
  const html = await response.text();
  const modifiedHtml = injectOGTags(html, og, fullUrl);

  return new Response(modifiedHtml, {
    status: response.status,
    headers: response.headers,
  });
};