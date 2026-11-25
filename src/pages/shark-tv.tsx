import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Play } from "lucide-react";
import { Link } from "react-router-dom";
import { PageShell } from "../components/layout/page-shell";
import { SEOHead } from "../components/seo/seo-head";
import { EpisodeCover } from "../components/shark-tv/episode-cover";
import { Button } from "../components/ui/button";
import { getAllSharkVideos, sharkTvQueryKey } from "../lib/api/shark-tv";
import { isArenaPreviewHost } from "../lib/arena-preview";
import { episodeCanonicalPath, episodeDescription, selectSharkTvEpisodes, SHARK_TV_DESCRIPTION, SHARK_TV_TITLE } from "../lib/shark-tv";
import "./shark-tv.css";

export function SharkTvPage() {
  const catalog = useQuery({ queryKey: sharkTvQueryKey, queryFn: getAllSharkVideos, staleTime: 5 * 60 * 1000 });
  const { featured, archive } = selectSharkTvEpisodes(catalog.data ?? []);

  return (
    <PageShell>
      <SEOHead title={SHARK_TV_TITLE} description={SHARK_TV_DESCRIPTION} path="/tv" noIndex={isArenaPreviewHost()} />
      <div className="shark-tv">
        <div className="shark-tv-shell">
          <header className="shark-tv-heading">
            <h1>SharkTV</h1>
            <p>Entiende el póker. Analiza tus decisiones.</p>
          </header>
          <section className="shark-tv-featured" aria-labelledby="shark-tv-featured-title">
            <EpisodeCover episode={featured} priority />
            <div className="shark-tv-featured-copy">
              <p className="shark-tv-label">{featured.table_context?.series || "Episodio destacado"}</p>
              <h2 id="shark-tv-featured-title">{featured.title}</h2>
              <p>{episodeDescription(featured)}</p>
              <Link className="shark-tv-primary" to={episodeCanonicalPath(featured)}>
                <Play size={17} aria-hidden="true" /> Ver episodio
              </Link>
            </div>
          </section>

          <section className="shark-tv-archive" aria-labelledby="shark-tv-archive-title">
            <h2 id="shark-tv-archive-title">Más episodios</h2>
            {catalog.isPending && <p role="status">Cargando el catálogo…</p>}
            {catalog.isError && (
              <div role="status" className="shark-tv-status">
                <p>No pudimos cargar el catálogo de SharkTV.</p>
                <Button variant="secondary" size="sm" onClick={() => void catalog.refetch()} disabled={catalog.isFetching}>Reintentar</Button>
              </div>
            )}
            {catalog.isSuccess && !archive.length && <p className="shark-tv-status">Todavía no hay otros episodios publicados.</p>}
            {archive.length > 0 && (
              <ul className="shark-tv-grid">
                {archive.map(episode => (
                  <li key={episode.id}>
                    <Link className="shark-tv-card" to={episodeCanonicalPath(episode)}>
                      <EpisodeCover episode={episode} />
                      <div className="shark-tv-card-copy">
                        {episode.table_context?.series && <p className="shark-tv-label">{episode.table_context.series}</p>}
                        <h3>{episode.title}</h3>
                        {episode.instructor_name && <p>{episode.instructor_name}</p>}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <Link className="shark-tv-link" to="/academia">Explorar la Academia Sharkania <ArrowRight size={17} aria-hidden="true" /></Link>
        </div>
      </div>
    </PageShell>
  );
}
