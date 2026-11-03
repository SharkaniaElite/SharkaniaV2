import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, ArrowUpRight, CalendarDays, ChevronRight, Compass, Radar, ShieldCheck, Swords, Trophy, Users } from "lucide-react";
import { PageShell } from "../components/layout/page-shell";
import { SEOHead } from "../components/seo/seo-head";
import { getPlayers } from "../lib/api/players";
import { getUpcomingTournaments } from "../lib/api/tournaments";
import { getBlogPosts } from "../lib/api/blog";
import { getEditorialPath } from "../lib/editorial-routing";
import type { BlogPost } from "../lib/api/blog";
import type { PlayerWithRoom, TournamentWithDetails } from "../types";
import "./arena-home.css";

function useNearViewport() {
  const ref = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (!("IntersectionObserver" in window)) { setVisible(true); return; }
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

function isCurrentEditorial(post: BlogPost) {
  if (post.category !== "Promociones") return true;
  const tags = post.tags || [];
  const find = (prefix: string) => tags.find((tag) => tag.startsWith(prefix))?.slice(prefix.length);
  const parts = new Intl.DateTimeFormat("en-GB", {timeZone:"America/Santiago",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());
  const get = (part: string) => parts.find((x)=>x.type===part)?.value || "";
  const today = get("year")+"-"+get("month")+"-"+get("day");
  const reviewed = find("verified-on:");
  const nextReview = find("review-by:");
  const officialEnd = find("official-end:");
  return Boolean(reviewed && nextReview && reviewed <= today && nextReview >= today && (!officialEnd || officialEnd >= today));
}

const pillars = [
  { title: "Ranking ELO", overline: "01 / CLASIFICACIÓN", description: "Cada torneo suma historia. Consulta posiciones, jugadores y evolución.", to: "/ranking", icon: Trophy, cta: "Explorar posiciones" },
  { title: "Circuito de torneos", overline: "02 / COMPETICIÓN", description: "Encuentra los próximos eventos y sigue los resultados registrados.", to: "/calendar", icon: CalendarDays, cta: "Ver calendario" },
  { title: "Clubes y ligas", overline: "03 / COMUNIDAD", description: "Descubre dónde se compite y los circuitos que mueven la escena.", to: "/clubs", icon: Users, cta: "Descubrir clubes" },
] as const;

function SectionHeading({ eyebrow, title, supporting, href, linkText }: {
  eyebrow: string; title: string; supporting?: string; href?: string; linkText?: string;
}) {
  return <div className="arena-heading">
    <div>
      <div className="arena-eyebrow"><span className="arena-cross" aria-hidden="true">✳</span>{eyebrow}</div>
      <h2>{title}</h2>
      {supporting && <p>{supporting}</p>}
    </div>
    {href && <Link className="arena-heading-link" to={href}>{linkText || "Ver todo"} <ArrowUpRight size={16} /></Link>}
  </div>;
}

function Leaderboard({ players, loading, count, failed }: { players: PlayerWithRoom[]; loading: boolean; count: number; failed: boolean }) {
  return <div className="arena-board" aria-label="Clasificación ELO destacada">
    <div className="arena-board-top">
      <div className="arena-board-ident"><span className="arena-pulse" /><span>ARENA / ELO INDEX</span></div>
      <Trophy size={17} aria-hidden="true" />
    </div>
    <div className="arena-board-intro">
      <div>
        <span className="arena-board-kicker">CLASIFICACIÓN</span>
        <h2>La cima se gana.</h2>
      </div>
      <span className="arena-board-cycle">RANKING GLOBAL</span>
    </div>
    <div className="arena-board-columns" aria-hidden="true"><span>POS / JUGADOR</span><span>PUNTOS ELO</span></div>
    <div className="arena-board-list" aria-live="polite">
      {loading ? [1,2,3].map((n)=><div className="arena-board-skeleton" key={n}><span/><span/></div>) :
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
      <span>{post.category==="Promociones"?"Leer condiciones":"Leer historia"} <ArrowUpRight size={15}/></span>
    </div>
  </Link>;
}

export function ArenaHomePage() {
  const circuit = useNearViewport();
  const editorial = useNearViewport();

  const ranking = useQuery({
    queryKey:["arena-home","elo-top-3"],
    queryFn:()=>getPlayers({page:1,pageSize:3,orderBy:"elo_rating",orderDir:"desc"}),
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
    enabled:circuit.visible,
    staleTime:1000*60*3,
    retry:1
  });
  const stories = useQuery({
    queryKey:["arena-home","editorial"],
    queryFn:async()=>{
      const posts = await getBlogPosts();
      return posts.filter(isCurrentEditorial).slice(0,3);
    },
    enabled:editorial.visible,
    staleTime:1000*60*5,
    retry:1
  });

  return <PageShell variant="arena">
    <SEOHead title="Sharkania Arena | Ranking ELO, torneos y póker competitivo" description="El centro de competición de Sharkania. Explora el ranking ELO, los jugadores destacados, clubes, ligas y próximos torneos." path="/" />
    <div className="arena">
      <section className="arena-hero" aria-labelledby="arena-hero-title">
        <div className="arena-hero-aura" aria-hidden="true" />
        <div className="arena-hero-grid">
          <div className="arena-hero-copy">
            <div className="arena-hero-label"><span className="arena-label-line"/><span>SHARKANIA <b>ARENA</b></span><span className="arena-hero-label-index">/ EL CIRCUITO COMPETITIVO</span></div>
            <div className="arena-hero-mark" aria-hidden="true"><span>S</span><span>↗</span></div>
            <h1 id="arena-hero-title">EL RANKING<br/>NO <em>MIENTE.</em></h1>
            <p className="arena-hero-sub">Los resultados dejan huella. <strong>Haz que la tuya cuente.</strong></p>
            <p className="arena-hero-lead">Jugadores, ligas y torneos en un solo lugar. Sigue el circuito, compara posiciones y descubre quién está marcando el ritmo del póker competitivo.</p>
            <div className="arena-hero-actions">
              <Link to="/ranking" className="arena-action-main">Entrar al ranking <ArrowUpRight size={19}/></Link>
              <Link to="/calendar" className="arena-action-secondary">Explorar torneos <ArrowRight size={17}/></Link>
            </div>
            <div className="arena-hero-proof"><ShieldCheck size={16} /><span>Clasificaciones basadas en resultados registrados</span></div>
          </div>
          <div className="arena-hero-widget">
            <div className="arena-orbit" aria-hidden="true"><div className="arena-orbit-a"/><div className="arena-orbit-b"/></div>
            <Leaderboard players={ranking.data?.data || []} loading={ranking.isPending} count={ranking.data?.count||0} failed={ranking.isError}/>
          </div>
        </div>
        <div className="arena-hero-footer"><span>EST. 2026 &nbsp;/&nbsp; LATINOAMÉRICA</span><span>COMPETIR · MEDIR · EVOLUCIONAR</span><span className="arena-hero-scroll">DESCUBRE SHARKANIA ↓</span></div>
      </section>

      <section className="arena-hub" aria-label="Explorar las funciones de Sharkania">
        <div className="arena-section-wrap">
          <SectionHeading eyebrow="TU PUNTO DE PARTIDA" title="Todo empieza en la arena." supporting="Tres puertas de entrada a un mismo ecosistema." />
          <div className="arena-pillar-grid">
            {pillars.map((item)=>{
              const Icon=item.icon;
              return <Link key={item.to} to={item.to} className="arena-pillar">
                <div className="arena-pillar-head"><span>{item.overline}</span><ArrowUpRight size={20}/></div>
                <div className="arena-pillar-symbol"><Icon size={32} strokeWidth={1.5}/></div>
                <div className="arena-pillar-content"><h3>{item.title}</h3><p>{item.description}</p><span>{item.cta} <ArrowRight size={16}/></span></div>
              </Link>;
            })}
          </div>
        </div>
      </section>

      <section className="arena-circuit" ref={circuit.ref}>
        <div className="arena-section-wrap">
          <SectionHeading eyebrow="AGENDA COMPETITIVA" title="Lo que viene en las mesas." supporting="Próximos eventos registrados en la plataforma." href="/calendar" linkText="Calendario completo"/>
          <div className="arena-circuit-grid">
            <div className="arena-events">
              {!circuit.visible || events.isPending ? [1,2,3].map(n=><div className="arena-event-skeleton" key={n}/>) :
                events.isError ? <div className="arena-empty">No pudimos consultar la agenda. <Link to="/calendar">Abrir el calendario</Link></div> :
                events.data?.length ? events.data.map(t=><TournamentRow key={t.id} tournament={t}/>) :
                <div className="arena-empty">No hay próximos eventos publicados en este momento. <Link to="/calendar">Explorar el calendario</Link></div>}
            </div>
            <Link to="/leagues" className="arena-circuit-feature">
              <div className="arena-feature-top"><span><Compass size={16}/> CIRCUITO / LIGAS</span><ArrowUpRight size={19}/></div>
              <div className="arena-feature-art" aria-hidden="true"><span>01</span><div/></div>
              <div><h3>La competición continúa.</h3><p>Descubre las ligas que forman parte del ecosistema Sharkania.</p><strong>Explorar ligas <ArrowRight size={15}/></strong></div>
            </Link>
          </div>
        </div>
      </section>

      <section className="arena-editorial" ref={editorial.ref}>
        <div className="arena-section-wrap">
          <SectionHeading eyebrow="DENTRO DEL CIRCUITO" title="Historias que importan." supporting="Actualidad, estrategia y promociones verificadas; sin confundir publicidad con resultados." href="/noticias" linkText="Explorar noticias"/>
          <div className="arena-story-grid">
            {!editorial.visible || stories.isPending ? [1,2,3].map(n=><div className="arena-story-skeleton" key={n}/>) :
              stories.isError ? <div className="arena-empty">No fue posible cargar las publicaciones. <Link to="/noticias">Ir a Noticias</Link></div> :
              stories.data?.length ? stories.data.map(post=><EditorialCard post={post} key={post.id}/>) :
              <div className="arena-empty">Pronto habrá nuevas publicaciones.</div>}
          </div>
          <div className="arena-editorial-links"><Link to="/promociones">Promociones y condiciones <ArrowUpRight size={16}/></Link><span>Publicidad identificada y sujeta a elegibilidad.</span></div>
        </div>
      </section>

      <section className="arena-final">
        <div className="arena-section-wrap">
          <div className="arena-final-inner"><div><div className="arena-eyebrow"><span className="arena-cross">✳</span> TU HISTORIA EMPIEZA AQUÍ</div><h2>El próximo nombre en el ranking<br/><em>podría ser el tuyo.</em></h2><p>Explora resultados, descubre tu circuito y participa en la comunidad.</p></div><Link to="/register">Crear cuenta <ArrowUpRight size={18}/></Link></div>
        </div>
      </section>
    </div>
  </PageShell>;
}
