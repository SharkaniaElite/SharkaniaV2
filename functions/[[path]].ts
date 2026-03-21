// functions/[[path]].ts
// Cloudflare Pages Function — Dynamic OG Meta Tags
// This runs on the edge BEFORE serving index.html, injecting the correct
// og:title, og:description, og:image based on the URL path.
//
// SETUP:
// 1. Create folder: functions/ in your project root (same level as src/)
// 2. Save this file as: functions/[[path]].ts
// 3. Cloudflare Pages automatically picks up functions/ as edge functions
// 4. Deploy normally — no extra config needed

interface OGData {
  title: string;
  description: string;
  image: string;
}

const SITE_URL = "https://sharkania.com";
const DEFAULT_OG: OGData = {
  title: "Sharkania — Plataforma Global de Poker Competitivo",
  description: "Ranking ELO, calendarios en vivo, clubes, ligas y estadísticas de jugadores.",
  image: `${SITE_URL}/og-default.avif`,
};

// Static routes with custom OG data
const OG_MAP: Record<string, OGData> = {
  "/ranking": {
    title: "Ranking ELO Global | Sharkania",
    description: "Los mejores jugadores de poker del mundo ordenados por ELO. Busca, filtra y descubre quién domina.",
    image: `${SITE_URL}/og-default.avif`,
  },
  "/calendar": {
    title: "Calendario de Torneos | Sharkania",
    description: "Próximos torneos de poker online en vivo. Countdown, buy-ins, garantizados y clubes de toda Latinoamérica.",
    image: `${SITE_URL}/og-default.avif`,
  },
  "/clubs": {
    title: "Clubes de Poker | Sharkania",
    description: "Encuentra clubes de poker online verificados de toda Latinoamérica y el mundo.",
    image: `${SITE_URL}/og-default.avif`,
  },
  "/leagues": {
    title: "Ligas de Poker | Sharkania",
    description: "Ligas organizadas con tabla de posiciones, puntos y premios.",
    image: `${SITE_URL}/og-default.avif`,
  },
  "/compare": {
    title: "Comparador de Jugadores | Sharkania",
    description: "Compara dos jugadores de poker. ELO, ITM, ROI, torneos en común y evolución histórica.",
    image: `${SITE_URL}/og-default.avif`,
  },
  "/blog": {
    title: "Blog | Sharkania",
    description: "Estrategia de poker, análisis de datos, mental game y más. Artículos para jugadores competitivos.",
    image: `${SITE_URL}/og-default.avif`,
  },
  "/tools": {
    title: "Herramientas de Poker | Sharkania",
    description: "Calculadoras y herramientas gratuitas para jugadores de poker. ICM, ELO, bankroll, quiz de perfil y más.",
    image: `${SITE_URL}/og-default.avif`,
  },
  "/tools/quiz": {
    title: "Quiz: ¿Qué tipo de jugador de poker eres? | Sharkania",
    description: "Descubre tu perfil de jugador con el quiz de Sharkania. 10 preguntas de situaciones reales. Resultado compartible.",
    image: `${SITE_URL}/images/tools/tool-quiz.avif`,
  },
  "/tools/calculadora-icm": {
    title: "Calculadora ICM | Sharkania",
    description: "Calcula tu equity ICM en burbuja y mesa final. Algoritmo Malmuth-Harville. Resultados instantáneos.",
    image: `${SITE_URL}/images/tools/tool-icm.avif`,
  },
  "/tools/simulador-elo": {
    title: "Simulador de ELO | Sharkania",
    description: "Simula cuánto subiría o bajaría tu ELO en Sharkania según tu posición en un torneo.",
    image: `${SITE_URL}/images/tools/tool-elo.avif`,
  },
  "/tools/calculadora-banca": {
    title: "Calculadora de Bankroll | Sharkania",
    description: "Calcula tu bankroll óptimo para torneos de poker. Riesgo de ruina, buy-ins recomendados.",
    image: `${SITE_URL}/images/tools/tool-bankroll.avif`,
  },
  "/register": {
    title: "Registrarse | Sharkania",
    description: "Crea tu cuenta gratis en Sharkania. Para jugadores y clubes de poker.",
    image: `${SITE_URL}/og-default.avif`,
  },
};

function getOGData(pathname: string): OGData {
  // Exact match first
  if (OG_MAP[pathname]) return OG_MAP[pathname];

  // Prefix matches for dynamic routes
  if (pathname.startsWith("/blog/")) {
    return {
      title: "Artículo | Sharkania Blog",
      description: "Lee este artículo de estrategia de poker en el blog de Sharkania.",
      image: `${SITE_URL}/og-default.avif`,
    };
  }

  if (pathname.startsWith("/ranking/")) {
    return {
      title: "Perfil de Jugador | Sharkania",
      description: "Consulta las estadísticas, ELO y historial de torneos de este jugador en Sharkania.",
      image: `${SITE_URL}/og-default.avif`,
    };
  }

  if (pathname.startsWith("/clubs/")) {
    return {
      title: "Club de Poker | Sharkania",
      description: "Descubre este club de poker, sus torneos, calendario y ranking de jugadores.",
      image: `${SITE_URL}/og-default.avif`,
    };
  }

  if (pathname.startsWith("/leagues/")) {
    return {
      title: "Liga de Poker | Sharkania",
      description: "Tabla de posiciones, calendario y resultados de esta liga de poker.",
      image: `${SITE_URL}/og-default.avif`,
    };
  }

  return DEFAULT_OG;
}

function injectOGTags(html: string, og: OGData, url: string): string {
  // Replace existing og tags in index.html with the correct ones for this route
  let result = html;

  // Title
  result = result.replace(
    /<title>[^<]*<\/title>/,
    `<title>${og.title}</title>`
  );

  // OG Title
  result = result.replace(
    /<meta property="og:title" content="[^"]*"/,
    `<meta property="og:title" content="${og.title}"`
  );

  // OG Description
  result = result.replace(
    /<meta property="og:description" content="[^"]*"/,
    `<meta property="og:description" content="${og.description}"`
  );

  // OG Image
  result = result.replace(
    /<meta property="og:image" content="[^"]*"/,
    `<meta property="og:image" content="${og.image}"`
  );

  // OG URL
  result = result.replace(
    /<meta property="og:url" content="[^"]*"/,
    `<meta property="og:url" content="${url}"`
  );

  // Twitter Title
  result = result.replace(
    /<meta name="twitter:title" content="[^"]*"/,
    `<meta name="twitter:title" content="${og.title}"`
  );

  // Twitter Description
  result = result.replace(
    /<meta name="twitter:description" content="[^"]*"/,
    `<meta name="twitter:description" content="${og.description}"`
  );

  // Twitter Image
  result = result.replace(
    /<meta name="twitter:image" content="[^"]*"/,
    `<meta name="twitter:image" content="${og.image}"`
  );

  // Meta description
  result = result.replace(
    /<meta name="description" content="[^"]*"/,
    `<meta name="description" content="${og.description}"`
  );

  // Canonical
  result = result.replace(
    /<link rel="canonical" href="[^"]*"/,
    `<link rel="canonical" href="${url}"`
  );

  return result;
}

export const onRequest: PagesFunction = async (context) => {
  const url = new URL(context.request.url);
  const pathname = url.pathname;

  // Let static assets pass through (images, js, css, fonts, etc.)
  const staticExtensions = [".js", ".css", ".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico", ".webp", ".avif", ".woff", ".woff2", ".ttf", ".map", ".json", ".xml", ".txt"];
  if (staticExtensions.some(ext => pathname.endsWith(ext))) {
    return context.next();
  }

  // For HTML routes, fetch the original index.html and inject OG tags
  const response = await context.next();

  // Only modify HTML responses
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html")) {
    return response;
  }

  const html = await response.text();
  const og = getOGData(pathname);
  const fullUrl = `${SITE_URL}${pathname}`;
  const modifiedHtml = injectOGTags(html, og, fullUrl);

  return new Response(modifiedHtml, {
    status: response.status,
    headers: response.headers,
  });
};
