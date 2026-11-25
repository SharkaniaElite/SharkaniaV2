import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { PageShell } from "../components/layout/page-shell";
import { SEOHead } from "../components/seo/seo-head";
import { EpisodeCover } from "../components/shark-tv/episode-cover";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { getSharkVideo, sharkTvQueryKey } from "../lib/api/shark-tv";
import { isArenaPreviewHost } from "../lib/arena-preview";
import { CLERIGO_EPISODE, episodeCanonicalPath, episodeDescription, episodePath, getEpisodePlayback, getEpisodeThumbnail, type SharkEpisode } from "../lib/shark-tv";
import "./shark-tv.css";

function EpisodePlayer({ episode }: { episode: SharkEpisode }) {
  const { embed, externalUrl, rumble } = getEpisodePlayback(episode);
  return (
    <section className="shark-tv-prelude" aria-label="Reproducción del episodio">
      <div className="shark-tv-player">
        {embed ? (
          <iframe
            src={embed}
            title={`Reproductor de Rumble: ${episode.title}`}
            allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        ) : <EpisodeCover episode={episode} />}
      </div>
      {!externalUrl && <p>Este episodio no tiene una URL de reproducción disponible.</p>}
      {externalUrl && (
        <a className="shark-tv-link justify-self-start" href={externalUrl} target="_blank" rel="noopener noreferrer">
          {rumble ? "Ver en Rumble" : "Abrir video externo"} <ArrowUpRight size={17} aria-hidden="true" />
        </a>
      )}
    </section>
  );
}

// Motor visual para renderizar cartas dinámicamente desde texto (ej: "As", "Tc", "9d")
function renderCard(cardString: string, isBoard = false) {
  if (!cardString || cardString.length < 2) return null;
  const suitStr = cardString.slice(-1).toLowerCase();
  const rank = cardString.slice(0, -1).toUpperCase();

  let suitSymbol = "";
  let heroSuitClass = "";
  let boardSuitClass = "";

  switch (suitStr) {
    case "s": 
      suitSymbol = "♠"; 
      heroSuitClass = "text-black"; 
      boardSuitClass = "text-sk-text-4"; // Gris claro para modo oscuro
      break;
    case "c": 
      suitSymbol = "♣"; 
      heroSuitClass = "text-green-600"; 
      boardSuitClass = "text-green-400"; 
      break;
    case "d": 
      suitSymbol = "♦"; 
      heroSuitClass = "text-blue-600"; 
      boardSuitClass = "text-blue-400"; 
      break;
    case "h": 
      suitSymbol = "♥"; 
      heroSuitClass = "text-red-500"; 
      boardSuitClass = "text-red-400"; 
      break;
    default: 
      suitSymbol = suitStr; 
      heroSuitClass = "text-black"; 
      boardSuitClass = "text-white";
  }

  // Estilo para las cartas en la mesa (Fondo oscuro)
  if (isBoard) {
    return (
      <div key={cardString} className="w-10 h-14 bg-sk-bg-0 rounded flex items-center justify-center text-lg font-bold text-white border border-sk-border-2 shadow-sm">
        {rank}<span className={boardSuitClass}>{suitSymbol}</span>
      </div>
    );
  }

  // Estilo para las cartas de Hero (Fondo blanco)
  return (
    <div key={cardString} className="w-8 h-12 md:w-9 md:h-14 bg-white rounded flex items-center justify-center text-sm md:text-lg font-bold text-black border-2 border-sk-border-2 shadow-sm">
      {rank}<span className={heroSuitClass}>{suitSymbol}</span>
    </div>
  );
}

function EpisodeNotes({ episode }: { episode: SharkEpisode }) {
  const [vote, setVote] = useState<string | null>(null);
  const context = episode.table_context;
  const heroCards = Array.isArray(context?.hero_cards) ? context.hero_cards : [];
  const board = Array.isArray(context?.board) ? context.board : [];
  const actions = Array.isArray(context?.action_history) ? context.action_history : [];
  const hasContext = Boolean(context?.hero_position || heroCards.length || board.length || actions.length);

  return (
    <div className="shark-tv-detail-grid">
      <section className="shark-tv-panel space-y-3">
        <h2>Continúa el análisis</h2>
        <p>Repasa los conceptos del episodio y aplica el mismo razonamiento al revisar otras manos.</p>
        <div className="flex flex-wrap gap-x-5">
          <Link className="shark-tv-link" to="/academia">Academia Sharkania <ArrowUpRight size={15} aria-hidden="true" /></Link>
          <Link className="shark-tv-link" to="/blog">Estrategia y análisis <ArrowUpRight size={15} aria-hidden="true" /></Link>
        </div>
        {context?.analysis_verdict && (
          <div className="space-y-3 border-t border-sk-border-2 pt-4">
            <h3>¿Qué decisión tomarías?</h3>
            <div className="flex flex-wrap gap-2">
              {["Fold", "Call", "Raise"].map(action => (
                <Button key={action} variant={vote === action ? "accent" : "secondary"} aria-pressed={vote === action}
                  className="min-h-11" onClick={() => setVote(action)}>{action}</Button>
              ))}
            </div>
            {vote && <p role="status"><strong className="text-sk-text-1">Análisis:</strong> {context.analysis_verdict}</p>}
          </div>
        )}
      </section>
      {hasContext && (
        <aside className="shark-tv-panel space-y-3" aria-label="Contexto de la mano">
          <h2>Contexto de la mano</h2>
          {context?.hero_position && <p>Posición: {context.hero_position}</p>}
          {heroCards.length > 0 && <div><p>Cartas del jugador</p><div className="flex flex-wrap gap-1.5">{heroCards.map(card => renderCard(card))}</div></div>}
          {board.length > 0 && <div><p>Cartas comunitarias</p><div className="flex flex-wrap gap-1.5">{board.map(card => renderCard(card, true))}</div></div>}
          {actions.length > 0 && (
            <ul className="space-y-2">
              {actions.map(({ stage, action }, index) => <li className="break-words" key={index}><strong>{stage}:</strong> {action}</li>)}
            </ul>
          )}
        </aside>
      )}
    </div>
  );
}

export function HandReviewPage() {
  const { id = "" } = useParams<{ id: string }>();
  const result = useQuery({
    queryKey: [...sharkTvQueryKey, id],
    queryFn: () => getSharkVideo(id),
    placeholderData: id === CLERIGO_EPISODE.id ? CLERIGO_EPISODE : undefined,
    staleTime: 5 * 60 * 1000,
  });
  const episode = result.data;
  const embed = episode && getEpisodePlayback(episode).embed;
  const canonicalPath = episode ? episodeCanonicalPath(episode) : episodePath(id);
  return (
    <PageShell>
      <SEOHead
        title={episode ? `${episode.title} | SharkTV` : "Episodio de SharkTV"}
        description={episode ? episodeDescription(episode) : "Vídeos educativos y análisis de manos de SharkTV."}
        path={canonicalPath}
        ogImage={episode ? getEpisodeThumbnail(episode.thumbnail_url) ?? undefined : undefined}
        ogType={embed ? "video.other" : "website"}
        ogVideo={embed || undefined}
        noIndex={isArenaPreviewHost() || !episode}
      />
      <div className="shark-tv">
        <div className="shark-tv-shell">
          <Link className="shark-tv-link" to="/tv"><ArrowLeft size={16} aria-hidden="true" /> Volver a SharkTV</Link>
          {episode ? (
            <article>
              <header className="shark-tv-episode-title space-y-3">
                {episode.table_context?.series && <p className="shark-tv-label">{episode.table_context.series}</p>}
                <h1>{episode.title}</h1>
                <p>{episodeDescription(episode)}</p>
                <div className="flex flex-wrap items-center gap-2">
                  {episode.instructor_name && <p>{episode.instructor_name}</p>}
                  {episode.duration && <Badge variant="muted">{episode.duration}</Badge>}
                  {episode.level && <Badge variant="muted">{episode.level}</Badge>}
                  {episode.tags?.map(tag => <Badge key={tag} variant="muted">{tag}</Badge>)}
                </div>
              </header>
              <EpisodePlayer key={canonicalPath} episode={episode} />
              <EpisodeNotes key={canonicalPath} episode={episode} />
            </article>
          ) : result.isPending ? (
            <p className="shark-tv-status" role="status">Cargando el episodio…</p>
          ) : result.isError ? (
            <div className="shark-tv-status" role="status">
              <p>No pudimos cargar el episodio.</p>
              <Button variant="secondary" size="sm" onClick={() => void result.refetch()} disabled={result.isFetching}>Reintentar</Button>
            </div>
          ) : (
            <h1 className="shark-tv-episode-title">Episodio no encontrado</h1>
          )}
        </div>
      </div>
    </PageShell>
  );
}
