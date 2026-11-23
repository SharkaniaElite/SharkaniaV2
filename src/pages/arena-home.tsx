import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, ArrowUpRight, BookOpen, Calculator, CalendarDays, ChevronRight, GraduationCap, Library, MonitorPlay, Radar, Swords, Trophy, Users } from "lucide-react";
import { PageShell } from "../components/layout/page-shell";
import { VerifiedSecondaryBannerStrip } from "../components/marketing/verified-banner-strip";
import { SEOHead } from "../components/seo/seo-head";
import { getPlayers } from "../lib/api/players";
import { getUpcomingTournaments } from "../lib/api/tournaments";
import { getBlogPosts } from "../lib/api/blog";
import { HOME_DESCRIPTION, HOME_HEADING, HOME_INTRO, HOME_TITLE } from "../lib/home-content";
import { isArenaPreviewHost } from "../lib/arena-preview";
import { getEditorialPath } from "../lib/editorial-routing";
import type { BlogPost } from "../lib/api/blog";
import type { PlayerWithRoom, TournamentWithDetails } from "../types";
import "./arena-home.css";

function useNearViewport() {
  const ref = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(() => typeof IntersectionObserver === "undefined");
  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setVisible(true);
        observer.disconnect();
      }
    }, { rootMargin: "450px 0px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return { ref, visible };
}

function formatElo(value: number | string | null | undefined) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n).toLocaleString("es-CL") : "—";
}

function cleanNickname(name: string) {
  return name.replace(/^\[DEMO\]\s*/i, "").replace(/⚠️ DATOS DEMO.*$/,"").trim();
}

function isDemoPlayer(player: PlayerWithRoom) {
  return Boolean((player as PlayerWithRoom & { is_demo?: boolean }).is_demo) || /^\[DEMO\]/i.test(player.nickname || "");
}

const pillars = [
  { name: "Academia", title: "Aprende a pensar.", description: "Explora conceptos y módulos de formación para comprender mejor las decisiones del juego.", to: "/academia", icon: GraduationCap },
  { name: "SharkTV", title: "Analiza decisiones.", description: "Descubre análisis de manos y contenidos audiovisuales de póker.", to: "/tv", icon: MonitorPlay },
  { name: "Herramientas", title: "Estudia tu juego.", description: "Explora recursos interactivos para comprender situaciones, conceptos y decisiones.", to: "/tools", icon: Calculator },
  { name: "Arena", title: "Explora la competición.", description: "Consulta rankings ELO, torneos, clubes, ligas y resultados registrados.", to: "/ranking", icon: Trophy },
] as const;

const studyLinks = [
  { label: "Academia de póker", to: "/academia", icon: GraduationCap },
  { label: "Estrategia", to: "/blog", icon: BookOpen },
  { label: "Herramientas", to: "/tools", icon: Calculator },
  { label: "Glosario", to: "/glosario", icon: Library },
] as const;

const leagueDeadline = Date.parse("2026-11-27T03:00:00Z");

function FeaturedLeague() {
  const [current, setCurrent] = useState(() => Date.now() < leagueDeadline);
  useEffect(() => {
    if (!current) return;
    let timer: number;
    function scheduleExpiry() {
      const remaining = leagueDeadline - Date.now();
      timer = window.setTimeout(
        remaining <= 2_147_483_647 ? () => setCurrent(false) : scheduleExpiry,
        Math.min(remaining, 2_147_483_647),
      );
    }
    scheduleExpiry();
    return () => window.clearTimeout(timer);
  }, [current]);

  if (!current) return null;
  return (
    <aside className="arena-featured-league" aria-labelledby="home-featured-league-title">
      <div className="arena-featured-league-inner">
        <div className="arena-featured-league-copy">
          <span className="arena-featured-league-eyebrow"><CalendarDays size={15} aria-hidden="true" /> NOVIEMBRE 2026 · CIRCUITO SHARKANIA</span>
          <h3 id="home-featured-league-title">La Liga SHARKANIA ya tiene calendario.</h3>
          <p>Cuatro jueves, desde el 5 de noviembre a las 21:00 h de Chile. Consulta las fechas y sigue la clasificación en Sharkania.</p>
        </div>
        <div className="arena-featured-league-actions">
          <Link to="/leagues/liga-sharkania-noviembre-2026" className="arena-featured-league-main">Fechas y ranking <ArrowUpRight size={16} aria-hidden="true" /></Link>
          <Link to="/ignition" className="arena-featured-league-secondary">Información de acceso <ArrowRight size={16} aria-hidden="true" /></Link>
        </div>
      </div>
    </aside>
  );
}

function SectionHeading({ id, eyebrow, title, supporting, href, linkText }: {
  id: string; eyebrow?: string; title: string; supporting?: string; href?: string; linkText?: string;
}) {
  return <div className="arena-heading">
    <div>
      {eyebrow && <div className="arena-eyebrow">{eyebrow}</div>}
      <h2 id={id}>{title}</h2>
      {supporting && <p>{supporting}</p>}
    </div>
    {href && <Link className="arena-heading-link" to={href}>{linkText || "Ver todo"} <ArrowUpRight size={16} /></Link>}
  </div>;
}

function Leaderboard({ players, loading, count, failed }: { players: PlayerWithRoom[]; loading: boolean; count: number; failed: boolean }) {
  return <div className="arena-board" aria-label="Clasificación ELO de jugadores de póker">
    <div className="arena-board-top">
      <div className="arena-board-ident"><span className="arena-pulse" /><span>ARENA / ELO INDEX</span></div>
      <Trophy size={17} aria-hidden="true" />
    </div>
    <div className="arena-board-intro">
      <div>
        <span className="arena-board-kicker">CLASIFICACIÓN</span>
        <h3>El ranking del póker.</h3>
      </div>
      <span className="arena-board-cycle">RANKING GLOBAL</span>
    </div>
    <div className="arena-board-columns" aria-hidden="true"><span>POS / JUGADOR</span><span>PUNTOS ELO</span></div>
    <div className="arena-board-list" aria-live="polite">
      {loading ? <>
        <span className="sr-only">Cargando la clasificación.</span>
        {[1, 2, 3].map(n => <div className="arena-board-skeleton" key={n} aria-hidden="true"><span /><span /></div>)}
      </> :
        players.length ? players.slice(0,3).map((player, index)=>
          <Link to={"/ranking/"+player.slug} className="arena-board-player" key={player.id || player.slug}>
            <span className={"arena-player-position"+(index===0?" is-first":"")}>{String(index+1).padStart(2,"0")}</span>
            <span className="arena-player-monogram" aria-hidden="true">{cleanNickname(player.nickname).charAt(0).toUpperCase()}</span>
            <span className="arena-player-info"><strong>{cleanNickname(player.nickname)}</strong><small>{isDemoPlayer(player)?"Registro demo · ":""}Ver perfil <ChevronRight size={11}/></small></span>
            <strong className="arena-player-elo">{formatElo(player.elo_rating)}</strong>
          </Link>
        ) :
        <div className="arena-board-empty">{failed?"No fue posible cargar la clasificación.":"Todavía no hay posiciones disponibles."}</div>
      }
    </div>
    <div className="arena-board-bottom">
      <span>{!loading && count > 0 ? count.toLocaleString("es-CL")+" jugadores registrados" : "Datos de resultados registrados"}</span>
      <Link to="/ranking">Ver ranking completo <ArrowRight size={15}/></Link>
    </div>
  </div>;
}

function TournamentRow({ tournament }: {tournament: TournamentWithDetails}) {
  const dt = new Date(tournament.start_datetime);
  const hasDate = !Number.isNaN(dt.getTime());
  const time = hasDate ? new Intl.DateTimeFormat("es-CL", {day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit",timeZone:"America/Santiago"}).format(dt) : "Horario por confirmar";
  const inProgress = tournament.status === "live" || tournament.status === "late_registration";
  const demo = Boolean((tournament as TournamentWithDetails & {is_demo?:boolean}).is_demo);
  return <Link to={"/tournament/"+(tournament.slug || tournament.id)} className="arena-event">
    <span className="arena-event-icon"><Swords size={19}/></span>
    <span className="arena-event-main"><strong>{tournament.name}</strong><small>{tournament.clubs?.name || tournament.poker_rooms?.name || "Circuito Sharkania"}{demo?" · Demo":""}</small></span>
    <span className="arena-event-meta"><small className={inProgress?"arena-event-live":""}>{inProgress?"En curso":time}</small><span>Detalles <ArrowUpRight size={14}/></span></span>
  </Link>;
}

function EditorialCard({ post }: {post:BlogPost}) {
  return <Link className="arena-story" to={getEditorialPath(post.category,post.slug)}>
    <div className="arena-story-media">
      {post.image_thumbnail ?
        <img src={post.image_thumbnail} alt="" loading="lazy" decoding="async" width={640} height={360}/> :
        <div className="arena-story-noimage"><Radar size={42}/></div>}
      <span className="arena-story-tag">{post.category}</span>
    </div>
    <div className="arena-story-body">
      <small>{post.published_at ? new Date(post.published_at).toLocaleDateString("es-CL",{day:"numeric",month:"long",year:"numeric"}) : "Actualidad"}</small>
      <h3>{post.title}</h3>
      <span>Leer noticia <ArrowUpRight size={15}/></span>
    </div>
  </Link>;
}

export function ArenaHomePage() {
  const { ref: circuitRef, visible: circuitVisible } = useNearViewport();
  const { ref: editorialRef, visible: editorialVisible } = useNearViewport();

  const ranking = useQuery({
    queryKey:["arena-home","elo-top-3"],
    queryFn:()=>getPlayers({page:1,pageSize:3,orderBy:"elo_rating",orderDir:"desc"}),
    enabled:circuitVisible,
    staleTime:1000*60*5,
    retry:1
  });
  const events = useQuery({
    queryKey:["arena-home","upcoming-events"],
    queryFn:async()=> {
      const now = Date.now();
      const tournaments = await getUpcomingTournaments();
      return tournaments.filter(t=>t.status==="live"||t.status==="late_registration"||new Date(t.start_datetime).getTime()>now).slice(0,4);
    },
    enabled:circuitVisible,
    staleTime:1000*60*3,
    retry:1
  });
  const stories = useQuery({
    queryKey:["arena-home","news"],
    queryFn:()=>getBlogPosts({ category: "Noticias", limit: 3 }),
    enabled:editorialVisible,
    staleTime:1000*60*5,
    retry:1
  });

  return <PageShell variant="arena">
    <SEOHead title={HOME_TITLE} description={HOME_DESCRIPTION} path="/" noIndex={isArenaPreviewHost()} />
    <div className="arena">
      <section className="arena-hero arena-scene" aria-labelledby="arena-hero-title">
        <img className="arena-scene-photo" src="/images/arena/home-hero.webp" alt="" aria-hidden="true" width={720} height={240} loading="eager" decoding="async" fetchPriority="high" />
        <span className="arena-scene-shade" aria-hidden="true" />
        <div className="arena-hero-grid">
          <div className="arena-hero-copy">
            <div className="arena-hero-label"><span className="arena-label-line" aria-hidden="true" /> TU PLATAFORMA DE PÓKER EN LATINOAMÉRICA</div>
            <h1 id="arena-hero-title">{HOME_HEADING[0]} <em>{HOME_HEADING[1]}</em></h1>
            <p className="arena-hero-lead">{HOME_INTRO}</p>
            <div className="arena-hero-actions">
              <Link to="/academia" className="arena-action-main">Comenzar a aprender <ArrowUpRight size={19} aria-hidden="true" /></Link>
              <Link to="/tv" className="arena-action-secondary">Ver SharkTV <ArrowRight size={17} aria-hidden="true" /></Link>
            </div>
          </div>
        </div>
      </section>

      <section className="arena-hub" aria-labelledby="home-pillars-title">
        <div className="arena-section-wrap">
          <SectionHeading id="home-pillars-title" title="Explora Sharkania" />
          <div className="arena-pillar-grid">
            {pillars.map(({ name, title, description, to, icon: Icon }) => (
              <Link key={to} to={to} className="arena-pillar">
                <div className="arena-pillar-head"><Icon size={25} strokeWidth={1.6} aria-hidden="true" /><ArrowUpRight size={17} aria-hidden="true" /></div>
                <div className="arena-pillar-content">
                  <span>{name}</span>
                  <h3>{title}</h3>
                  <p>{description}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="arena-originals" aria-labelledby="home-originals-title">
        <div className="arena-section-wrap">
          <div className="arena-originals-card">
            <div className="arena-originals-copy">
              <SectionHeading id="home-originals-title" eyebrow="Sharkania Originals" title="Clérigo Analiza" />
              <p className="arena-originals-tagline">Cada decisión tiene una razón.</p>
              <p className="arena-originals-description">Clérigo Póker prepara una serie educativa para revisar manos de su propio historial y explicar el razonamiento detrás de cada jugada.</p>
              <div className="arena-originals-actions">
                <Link className="arena-action-secondary" to="/tv">Explorar SharkTV <ArrowUpRight size={17} aria-hidden="true" /></Link>
                <span>Serie en preparación</span>
              </div>
            </div>
            <div className="arena-originals-art" aria-hidden="true">
              <img src="/images/arena/home-ranking.webp" alt="" width={720} height={240} loading="lazy" decoding="async" />
            </div>
          </div>
        </div>
      </section>

      <section className="arena-study" aria-labelledby="home-study-title">
        <div className="arena-section-wrap">
          <SectionHeading id="home-study-title" title="Aprende, estudia y comprende el póker." />
          <ul className="arena-study-grid">
            {studyLinks.map(({ label, to, icon: Icon }) => (
              <li key={to}>
                <Link to={to}><Icon size={20} aria-hidden="true" />{label}<ArrowRight size={16} aria-hidden="true" /></Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="arena-circuit arena-scene" ref={circuitRef} aria-labelledby="home-arena-title">
        <img className="arena-scene-photo" src="/images/arena/home-tournaments.webp" alt="" aria-hidden="true" width={720} height={240} loading="lazy" decoding="async" />
        <span className="arena-scene-shade" aria-hidden="true" />
        <div className="arena-section-wrap">
          <SectionHeading id="home-arena-title" eyebrow="Sharkania Arena" title="El póker tiene su Arena." supporting="Consulta clasificaciones ELO, resultados registrados, clubes, ligas y el calendario de torneos." />
          <div className="arena-circuit-grid">
            <Leaderboard players={ranking.data?.data || []} loading={ranking.isPending} count={ranking.data?.count || 0} failed={ranking.isError} />
            <div className="arena-agenda">
              <div className="arena-agenda-heading">
                <h3>Próximos torneos de póker.</h3>
                <Link className="arena-heading-link" to="/calendar">Calendario completo <ArrowUpRight size={16} aria-hidden="true" /></Link>
              </div>
              <div className="arena-events" aria-live="polite">
                {events.isPending ? <>
                  <span className="sr-only">Cargando próximos torneos.</span>
                  {[1, 2, 3].map(n => <div className="arena-event-skeleton" key={n} aria-hidden="true" />)}
                </> :
                  events.isError ? <div className="arena-empty">No pudimos consultar la agenda. <Link to="/calendar">Abrir el calendario</Link></div> :
                  events.data?.length ? events.data.map(t => <TournamentRow key={t.id} tournament={t} />) :
                  <div className="arena-empty">No hay próximos eventos publicados en este momento. <Link to="/calendar">Explorar el calendario</Link></div>}
              </div>
              <div className="arena-competition-links">
                <Link className="arena-action-secondary" to="/clubs"><Users size={17} aria-hidden="true" /> Clubes <ArrowUpRight size={16} aria-hidden="true" /></Link>
                <Link className="arena-action-secondary" to="/leagues"><Trophy size={17} aria-hidden="true" /> Ligas <ArrowUpRight size={16} aria-hidden="true" /></Link>
              </div>
            </div>
          </div>
          <FeaturedLeague />
        </div>
      </section>

      {/* Publicidad secundaria tras ranking y torneos; nunca por encima de la competición. */}
      <VerifiedSecondaryBannerStrip />

      <section className="arena-editorial arena-scene" ref={editorialRef} aria-labelledby="home-news-title">
        <img className="arena-scene-photo" src="/images/arena/home-editorial.webp" alt="" aria-hidden="true" width={720} height={240} loading="lazy" decoding="async" />
        <span className="arena-scene-shade" aria-hidden="true" />
        <div className="arena-section-wrap">
          <SectionHeading id="home-news-title" title="Últimas noticias de póker" href="/noticias" linkText="Explorar noticias" />
          <div className="arena-story-grid" aria-live="polite">
            {stories.isPending ? <>
              <span className="sr-only">Cargando noticias.</span>
              {[1, 2, 3].map(n => <div className="arena-story-skeleton" key={n} aria-hidden="true" />)}
            </> :
              stories.isError ? <div className="arena-empty">No fue posible cargar las publicaciones. <Link to="/noticias">Ir a Noticias</Link></div> :
              stories.data?.length ? stories.data.map(post=><EditorialCard post={post} key={post.id}/>) :
              <div className="arena-empty">Pronto habrá nuevas publicaciones.</div>}
          </div>
        </div>
      </section>

      <section className="arena-final arena-scene" aria-labelledby="home-close-title">
        <img className="arena-scene-photo" src="/images/arena/home-final.webp" alt="" aria-hidden="true" width={720} height={240} loading="lazy" decoding="async" />
        <span className="arena-scene-shade" aria-hidden="true" />
        <div className="arena-section-wrap">
          <div className="arena-final-inner">
            <div>
              <h2 id="home-close-title">Tu próximo aprendizaje <em>comienza aquí.</em></h2>
              <p>Explora los recursos educativos, los análisis y la comunidad de Sharkania.</p>
            </div>
            <Link to="/register">Crear cuenta <ArrowUpRight size={18} aria-hidden="true" /></Link>
          </div>
        </div>
      </section>
    </div>
  </PageShell>;
}
