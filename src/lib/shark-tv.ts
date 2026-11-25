export interface EpisodeContext {
  series?: string;
  description?: string;
  public_url?: string;
  featured?: boolean;
  hero_position?: string;
  hero_cards?: string[];
  board?: string[];
  analysis_verdict?: string;
  action_history?: { stage: string; action: string }[];
}

export interface SharkEpisode {
  id: string;
  title: string;
  video_url: string | null;
  thumbnail_url: string | null;
  duration: string | null;
  level: string | null;
  instructor_name: string | null;
  tags: string[] | null;
  created_at: string | null;
  table_context: EpisodeContext | null;
}

export const SHARK_TV_TITLE = "SharkTV — Vídeos educativos de póker";
export const SHARK_TV_DESCRIPTION = "Entiende el póker y analiza tus decisiones con revisiones de manos, conceptos de estudio y episodios de Clérigo Analiza.";

const launchRumbleEmbedId = "v7gq0y0";
const launchRumblePublicId = "v7iwdvi";

export const CLERIGO_EPISODE: SharkEpisode = {
  id: "clerigo-analiza-01",
  title: "Clérigo Analiza #01 — Gané con una escalera… ¿pero hice bien el call?",
  video_url: `https://rumble.com/embed/${launchRumbleEmbedId}/?pub=4par2u`,
  thumbnail_url: "https://nhpjzywfzljtlqaigzed.supabase.co/storage/v1/object/public/blog_images/clerigo_analiza_%20jugue_mal.webp",
  duration: "6:18",
  level: null,
  instructor_name: "Clérigo Póker",
  tags: ["Análisis de manos", "Pot odds", "Decisiones", "NL25"],
  created_at: null,
  table_context: {
    series: "Clérigo Analiza",
    description: "Una mano de NL25 para repasar las pot odds y evaluar si el call tenía sentido antes de saber cómo terminaría la mano.",
    public_url: `https://rumble.com/${launchRumblePublicId}-gan-con-una-escalera-pero-hice-bien-el-call-clrigo-analiza-01.html`,
  },
};

export function episodePath(id: string) {
  return "/tv/" + encodeURIComponent(id);
}

function parseHttps(value: unknown) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && !url.port ? url : null;
  } catch {
    return null;
  }
}

const isRumble = (url: URL) => url.hostname === "rumble.com" || url.hostname === "www.rumble.com";

export function getRumbleEmbed(value: unknown) {
  const url = parseHttps(value);
  if (!url || !isRumble(url)) return null;
  const id = /^\/embed\/(v[a-z0-9]+)\/?$/i.exec(url.pathname)?.[1];
  if (!id) return null;
  const pub = url.searchParams.get("pub");
  return `https://rumble.com/embed/${id}/${pub && /^[a-z0-9]+$/i.test(pub) ? `?pub=${pub}` : ""}`;
}

export function getRumbleWatchUrl(value: unknown) {
  const url = parseHttps(value);
  if (!url || !isRumble(url) || !/^\/v[a-z0-9]+(?:-[a-z0-9-]+)?\.html$/i.test(url.pathname)) return null;
  return "https://rumble.com" + url.pathname;
}

export function getEpisodePlayback(episode: SharkEpisode) {
  const embed = getRumbleEmbed(episode.video_url);
  const publicUrl = getRumbleWatchUrl(episode.table_context?.public_url) ?? getRumbleWatchUrl(episode.video_url);
  const original = parseHttps(episode.video_url);
  const externalUrl = publicUrl ?? embed ?? (original && !isRumble(original) ? original.href : null);
  return { embed, externalUrl, rumble: Boolean(publicUrl ?? embed) };
}

export function getEpisodeThumbnail(value: unknown) {
  return parseHttps(value)?.href ?? null;
}

export function episodeDescription(episode: SharkEpisode) {
  const description = episode.table_context?.description;
  return (typeof description === "string" && description.trim())
    || `Revisa «${episode.title}» y estudia las decisiones de la mano en SharkTV.`;
}

export const clerigoLaunchFilter = ["rumble.com", "www.rumble.com"].flatMap(host => [
  `video_url.ilike.https://${host}/embed/${launchRumbleEmbedId}*`,
  `video_url.ilike.https://${host}/${launchRumblePublicId}*`,
  `table_context->>public_url.ilike.https://${host}/${launchRumblePublicId}*`,
]).join(",");

function isLaunchWatchUrl(value: unknown) {
  const watch = getRumbleWatchUrl(value);
  return Boolean(watch && new URL(watch).pathname.match(/^\/(v[a-z0-9]+)(?:-|\.html$)/i)?.[1]?.toLowerCase() === launchRumblePublicId);
}

export function isClerigoLaunch(episode: SharkEpisode) {
  const embed = getRumbleEmbed(episode.video_url);
  return episode.id === CLERIGO_EPISODE.id
    || isLaunchWatchUrl(episode.table_context?.public_url)
    || isLaunchWatchUrl(episode.video_url)
    || Boolean(embed && new URL(embed).pathname.split("/")[2]?.toLowerCase() === launchRumbleEmbedId);
}

export function episodeCanonicalPath(episode: SharkEpisode) {
  return episodePath(isClerigoLaunch(episode) ? CLERIGO_EPISODE.id : episode.id);
}

export function mergeLaunchEpisode(episode: SharkEpisode): SharkEpisode {
  if (!isClerigoLaunch(episode)) return episode;
  const context = episode.table_context;
  return {
    ...episode,
    video_url: CLERIGO_EPISODE.video_url,
    duration: episode.duration || CLERIGO_EPISODE.duration,
    instructor_name: episode.instructor_name || CLERIGO_EPISODE.instructor_name,
    tags: episode.tags?.length ? episode.tags : CLERIGO_EPISODE.tags,
    thumbnail_url: getEpisodeThumbnail(episode.thumbnail_url) ?? CLERIGO_EPISODE.thumbnail_url,
    table_context: {
      ...context,
      series: (typeof context?.series === "string" && context.series.trim()) || CLERIGO_EPISODE.table_context?.series,
      description: (typeof context?.description === "string" && context.description.trim()) || CLERIGO_EPISODE.table_context?.description,
      public_url: CLERIGO_EPISODE.table_context?.public_url,
    },
  };
}

export function selectLaunchEpisode(episodes: SharkEpisode[]) {
  return mergeLaunchEpisode(episodes.find(isClerigoLaunch) ?? CLERIGO_EPISODE);
}

export function selectSharkTvEpisodes(episodes: SharkEpisode[]) {
  const launch = selectLaunchEpisode(episodes);
  const featured = episodes.find(episode => episode.table_context?.featured === true) ?? launch;
  const archive = episodes.filter(episode => episode.id !== featured.id && !isClerigoLaunch(episode));
  if (!isClerigoLaunch(featured)) archive.push(launch);
  return { featured: isClerigoLaunch(featured) ? launch : featured, archive };
}

export function videoStructuredData(episode: SharkEpisode) {
  const { embed } = getEpisodePlayback(episode);
  const thumbnail = getEpisodeThumbnail(episode.thumbnail_url);
  if (!embed || !thumbnail || !episode.created_at || !Number.isFinite(Date.parse(episode.created_at))) return null;
  const duration = episode.duration?.match(/^(\d{1,3}):([0-5]\d)$/);
  return {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    name: episode.title,
    description: episodeDescription(episode),
    thumbnailUrl: [thumbnail],
    uploadDate: new Date(episode.created_at).toISOString(),
    embedUrl: embed,
    ...(duration ? { duration: `PT${Number(duration[1])}M${Number(duration[2])}S` } : {}),
  };
}

export function validateEpisode(input: unknown, original?: SharkEpisode) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Se requiere un objeto de episodio.");
  const row = input as Record<string, unknown>;
  const read = (key: string) => {
    const value = row[key];
    if (value != null && typeof value !== "string") throw new Error(`Revisa el campo ${key}.`);
    return (value as string | null | undefined)?.trim() || "";
  };
  const title = read("title");
  if (!title) throw new Error("Ingresa el título del episodio.");
  const suppliedVideo = read("video_url");
  const video = getRumbleEmbed(suppliedVideo) ?? getRumbleWatchUrl(suppliedVideo)
    ?? (suppliedVideo === original?.video_url ? suppliedVideo : null);
  if (!video) throw new Error("Copia la URL de Rumble desde Compartir → Insertar, o pega la página pública.");
  const thumbnail = read("thumbnail_url");
  if (thumbnail && !getEpisodeThumbnail(thumbnail) && thumbnail !== original?.thumbnail_url) {
    throw new Error("La miniatura debe tener una URL HTTPS.");
  }
  const duration = read("duration");
  if (duration && !/^\d{1,3}:[0-5]\d$/.test(duration) && duration !== original?.duration) {
    throw new Error("Ingresa la duración como minutos y segundos, por ejemplo 6:18.");
  }
  if (row.tags != null && (!Array.isArray(row.tags) || row.tags.some(tag => typeof tag !== "string"))) {
    throw new Error("Los temas del episodio deben estar en una lista de textos.");
  }
  const context = row.table_context;
  if (context != null && (typeof context !== "object" || Array.isArray(context))) {
    throw new Error("El contexto del episodio debe ser un objeto.");
  }
  const notes = (context ?? {}) as EpisodeContext;
  for (const key of ["series", "description", "public_url", "hero_position", "analysis_verdict"] as const) {
    if (notes[key] != null && typeof notes[key] !== "string") throw new Error(`Revisa el campo ${key}.`);
  }
  for (const key of ["hero_cards", "board"] as const) {
    const cards = notes[key];
    if (cards != null && (!Array.isArray(cards) || cards.some(card => typeof card !== "string"))) {
      throw new Error(`Revisa la lista de cartas en ${key}.`);
    }
  }
  if (notes.featured != null && typeof notes.featured !== "boolean") throw new Error("El campo featured debe ser booleano.");
  if (notes.action_history != null && (!Array.isArray(notes.action_history)
    || notes.action_history.some(item => typeof item?.stage !== "string" || typeof item?.action !== "string"))) {
    throw new Error("El historial necesita una etapa y una acción por entrada.");
  }
  if (notes.public_url && !getRumbleWatchUrl(notes.public_url)) throw new Error("La página pública debe ser un enlace de Rumble.");
  return {
    title,
    video_url: video,
    thumbnail_url: thumbnail,
    duration,
    instructor_name: read("instructor_name"),
    level: read("level"),
    tags: row.tags ?? [],
    table_context: { ...notes, public_url: getRumbleWatchUrl(notes.public_url) ?? undefined },
  };
}
