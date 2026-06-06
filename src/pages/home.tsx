// src/pages/home.tsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PageShell } from "../components/layout/page-shell";
import { RevealSection } from "../components/landing/reveal-section";
import { CountdownTimer } from "../components/landing/countdown-timer";
import { TournamentDetailModal } from "../components/calendar/tournament-detail-modal";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { cn } from "../lib/cn";
import { getPlayers } from "../lib/api/players";
import { getUpcomingTournaments } from "../lib/api/tournaments";
import { getBlogPosts, formatBlogDate } from "../lib/api/blog";
import { supabase } from "../lib/supabase";
import { FlagIcon } from "../components/ui/flag-icon";
import { Trophy, CalendarDays, Megaphone, Zap, Brain, Flame } from "lucide-react";
import { format } from "date-fns";
import type { PlayerWithRoom, TournamentWithDetails } from "../types";
import { SEOHead } from "../components/seo/seo-head";

// Definimos las promociones estáticas para inyectarlas en el feed de la portada
const staticPromos = [
  {
    id: "static-promo-1",
    title: "Paquete de Bienvenida $1,000 USD en Ignition",
    excerpt: "Duplica tu primer depósito, llévate 4 entradas a Freerolls de $1,200 garantizados y 50 giros gratis de Casino.",
    image_thumbnail: "/bg/ignition-promo.webp",
    category: "Promociones",
    published_at: "2026-06-04T12:00:00Z",
    slug: "ignition-bonus",
    isStaticPromo: true,
    link: "/promociones/ignition-bonus"
  },
  {
    id: "static-promo-2",
    title: "El Camino del Tiburón: Freeroll Diario",
    excerpt: "Juega gratis todos los días a las 17:00 hrs en LatinAllinPoker y clasifica a nuestros torneos principales.",
    image_thumbnail: "/bg/freeroll-diario.webp",
    category: "Promociones",
    published_at: "2026-06-01T12:00:00Z",
    slug: "freeroll-diario",
    isStaticPromo: true,
    link: "/promociones/freeroll-diario"
  }
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function secsUntil(datetime: string) {
  return Math.max(0, Math.floor((new Date(datetime).getTime() - Date.now()) / 1000));
}

function DemoBadge() {
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-sk-gold-dim text-sk-gold uppercase tracking-wider shrink-0">
      ⚠ Demo
    </span>
  );
}

function RankBadge({ rank }: { rank: number }) {
  const cls =
    rank === 1 ? "bg-sk-gold-dim text-sk-gold"
    : rank === 2 ? "bg-[rgba(203,213,225,0.1)] text-sk-silver"
    : rank === 3 ? "bg-[rgba(217,119,6,0.1)] text-sk-bronze"
    : "text-sk-text-2";
  return (
    <span className={cn("font-mono font-bold text-sk-sm w-7 h-7 inline-flex items-center justify-center rounded-xs", cls)}>
      {rank}
    </span>
  );
}

function SectionHeader({ overline, title, desc }: { overline: string; title: string; desc?: string }) {
  return (
    <div className="mb-8 px-4 flex flex-col md:flex-row items-start md:items-end justify-between gap-4 border-b border-sk-border-2 pb-4">
      <div>
        <p className="font-mono text-[11px] font-bold tracking-[0.08em] uppercase text-sk-accent mb-2 flex items-center gap-2">
          <Zap size={14} /> {overline}
        </p>
        <h2 className="text-sk-2xl font-extrabold tracking-tight text-sk-text-1">{title}</h2>
        {desc && <p className="text-sk-sm text-sk-text-3 mt-2 max-w-2xl">{desc}</p>}
      </div>
    </div>
  );
}

function RowSkeleton() {
  return (
    <tr className="animate-sk-pulse">
      {[40,120,60,50,60,60].map((w,i) => (
        <td key={i} className="py-3 px-4 border-b border-sk-border-2">
          <div className="h-4 rounded bg-sk-bg-4" style={{ width: w }} />
        </td>
      ))}
    </tr>
  );
}

function CardSkeleton() {
  return (
    <div className="animate-sk-pulse bg-sk-bg-3 border border-sk-border-2 rounded-md p-3 px-4">
      <div className="h-4 w-40 rounded bg-sk-bg-4 mb-2" />
      <div className="h-3 w-24 rounded bg-sk-bg-4" />
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export function HomePage() {
  const [players,     setPlayers]     = useState<PlayerWithRoom[]>([]);
  const [tournaments, setTournaments] = useState<TournamentWithDetails[]>([]);
  const [blogPosts,   setBlogPosts]   = useState<any[]>([]); // Cambiado a any[] para aceptar estáticos
  const [stats,       setStats]       = useState({ players:0, tournaments:0, clubs:0, leagues:0, live:0 });
  
  const [loadingRank,    setLoadingRank]    = useState(true);
  const [loadingTourneys,setLoadingTourneys] = useState(true);
  const [loadingBlog,    setLoadingBlog]    = useState(true);
  const [selectedTournament, setSelectedTournament] = useState<TournamentWithDetails | null>(null);

  useEffect(() => {
    // Top 5 Jugadores
    getPlayers({ page:1, pageSize:10, orderBy:"elo_rating", orderDir:"desc" })
      .then(res => {
        setPlayers(res.data.slice(0,10)); // Ampliado a Top 10
      }).finally(() => setLoadingRank(false));

    // Torneos Próximos
    getUpcomingTournaments()
      .then(d => {
        const now = new Date();
        const filtered = d.filter(t => {
          if (t.status === "live" || t.status === "late_registration") return true;
          if (t.status === "completed" || t.status === "cancelled") return false;
          if (t.status === "scheduled") return new Date(t.start_datetime) > now;
          return true;
        });
        setTournaments(filtered.slice(0,5));
      }).finally(() => setLoadingTourneys(false));

    // Últimos Posts del Blog + Promociones Estáticas (Ordenados por fecha de forma segura)
    getBlogPosts().then(posts => {
      const combined = [...staticPromos, ...posts];
      // Ordenamos de más reciente a más antiguo, asegurándonos de manejar valores nulos
      combined.sort((a, b) => {
        const timeA = a.published_at ? new Date(a.published_at).getTime() : 0;
        const timeB = b.published_at ? new Date(b.published_at).getTime() : 0;
        return timeB - timeA;
      });
      setBlogPosts(combined.slice(0, 3));
    }).finally(() => setLoadingBlog(false));

    // Estadísticas
    Promise.all([
      supabase.from("players").select("id", { count:"exact", head:true }),
      supabase.from("tournaments").select("id", { count:"exact", head:true }),
      supabase.from("clubs").select("id", { count:"exact", head:true }).eq("is_approved",true),
      supabase.from("leagues").select("id", { count:"exact", head:true }).eq("status","active"),
      supabase.from("tournaments").select("id", { count:"exact", head:true }).eq("status","live"),
    ]).then(([p,t,c,l,live]) => {
      setStats({ players:p.count??0, tournaments:t.count??0, clubs:c.count??0, leagues:l.count??0, live:live.count??0 });
    });
  }, []);
  const cleanName = (s: string) => s.replace(/^\[DEMO\]\s*/,"").replace(/⚠️ DATOS DEMO.*$/,"").trim();

  return (
    <PageShell>
      <SEOHead title="Inicio" description="Plataforma global de poker competitivo. Rankings ELO, torneos online, análisis de manos y herramientas tácticas para tu club." path="/" />

      {/* ══ HERO & TICKER ══ */}
      <section className="relative min-h-[85vh] flex flex-col items-center justify-center text-center px-6 pt-24 pb-12 overflow-hidden">
        <div className="absolute inset-0 -z-20" style={{ background:"radial-gradient(ellipse 60% 40% at 50% 0%, var(--sk-accent-dim), transparent 70%), radial-gradient(ellipse 40% 30% at 70% 80%, var(--sk-purple-dim), transparent 60%), var(--sk-bg-1)" }} />
        <div className="absolute inset-0 -z-10" style={{ backgroundImage:"linear-gradient(rgba(255,255,255,0.018) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.018) 1px,transparent 1px)", backgroundSize:"64px 64px", maskImage:"radial-gradient(ellipse 70% 60% at 50% 40%, black, transparent)", WebkitMaskImage:"radial-gradient(ellipse 70% 60% at 50% 40%, black, transparent)" }} />
        
        <div className="max-w-[800px] flex-1 flex flex-col justify-center mb-10">
          <div className="inline-flex items-center gap-2 py-1 pl-1 pr-3.5 bg-sk-bg-3 border border-sk-border-2 rounded-full text-[11px] font-medium text-sk-text-2 mb-8 animate-sk-fade-up mx-auto">
            <span className="px-2 py-0.5 bg-sk-accent-dim text-sk-accent rounded-full font-bold text-[10px] tracking-wide">BETA</span>
            Plataforma Global de Poker Competitivo
          </div>
          <h1 className="text-5xl md:text-7xl font-black tracking-[-0.045em] text-sk-text-1 leading-none mb-6 animate-sk-fade-up sk-delay-1 uppercase">
            Juega. Aprende.<br />
            <span className="bg-gradient-to-br from-sk-accent to-blue-400 bg-clip-text text-transparent">Domina las mesas.</span>
          </h1>
          <p className="text-sk-lg text-sk-text-2 leading-relaxed mx-auto animate-sk-fade-up sk-delay-2 max-w-2xl">
            Para ser un verdadero tiburón del póker necesitas dos cosas: volumen de juego y conocimiento táctico. En Sharkania te entregamos el ecosistema para ambas.
          </p>
          <div className="flex justify-center gap-4 mt-8 flex-wrap animate-sk-fade-up sk-delay-3">
            <Link to="/ranking">
              <Button variant="accent" size="xl" className="group relative overflow-hidden font-extrabold tracking-wide shadow-[0_0_20px_rgba(34,211,238,0.25)] hover:shadow-[0_0_35px_rgba(34,211,238,0.5)] transition-all duration-300 border border-sk-accent/50 hover:border-sk-accent">
                <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/30 to-transparent group-hover:translate-x-[200%] transition-transform duration-1000 ease-in-out" />
                <Trophy className="w-5 h-5 mr-2 inline-block group-hover:scale-110 transition-transform duration-300" />
                Ver Ranking Global
              </Button>
            </Link>
            <Link to="/calendar">
              <Button variant="secondary" size="xl" className="group font-bold tracking-wide border-sk-border-2 hover:border-sk-text-2 hover:bg-white/[0.03] transition-all duration-300">
                <CalendarDays className="w-5 h-5 mr-2 inline-block text-sk-text-4 group-hover:text-sk-text-1 transition-colors duration-300" />
                Torneos Online
              </Button>
            </Link>
          </div>
          
          {/* Trust Badges - Salas Afiliadas */}
          <div className="mt-12 animate-sk-fade-up sk-delay-4 border-t border-sk-border-2 pt-6 w-full max-w-2xl mx-auto">
            <p className="text-[10px] font-mono uppercase tracking-widest text-sk-text-3 mb-4">Salas y Clubes Oficiales Afiliados</p>
            <div className="flex justify-center items-center gap-6 md:gap-12 opacity-60 hover:opacity-100 transition-opacity duration-500 flex-wrap">
               <span className="text-lg font-black italic tracking-tighter">WPT <span className="text-sk-accent">GLOBAL</span></span>
               <span className="text-lg font-black italic tracking-tighter">IGNITION <span className="text-orange-500">POKER</span></span>
               <span className="text-lg font-black italic tracking-tighter">LATINALLINPOKER <span className="text-green-500 text-xs tracking-normal align-middle">(Unión CCP)</span></span>
            </div>
          </div>
        </div>
      </section>

      {/* ══ STATS BAR ══ */}
      <div className="bg-sk-bg-0 border-y border-sk-border-2 py-3 overflow-hidden relative">
        <div className="absolute top-0 left-[-100%] w-1/2 h-full bg-gradient-to-r from-transparent via-sk-accent/5 to-transparent animate-[shimmer_3s_infinite]" />
        <div className="max-w-[1200px] mx-auto px-6 relative z-10">
          <div className="flex justify-center items-center gap-6 md:gap-10 flex-wrap">
            {[
              { label:"JUGADORES TRACKEADOS",  value:stats.players.toLocaleString("es") },
              { label:"TORNEOS DISPUTADOS",    value:stats.tournaments.toLocaleString("es") },
              { label:"CLUBES VERIFICADOS", value:stats.clubs.toLocaleString("es") },
            ].map(item => (
              <div key={item.label} className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-sk-text-3 font-semibold group cursor-default">
                <span className="group-hover:text-sk-accent transition-colors duration-300">{item.label}</span>
                <span className="font-mono font-bold text-sk-text-1 text-sk-sm group-hover:text-white transition-colors duration-300">{item.value}</span>
              </div>
            ))}
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-sk-text-3 font-semibold group cursor-default">
              <Badge variant="live" className="shadow-[0_0_10px_rgba(239,68,68,0.4)] animate-pulse">LIVE NOW</Badge>
              <span className="font-mono font-bold text-sk-text-1 text-sk-sm group-hover:text-white transition-colors duration-300">{stats.live} Torneos</span>
            </div>
          </div>
        </div>
      </div>

      {/* ══ ACTION CENTER (Torneos & Ranking) ══ */}
      <section className="py-16 bg-sk-bg-0" id="ranking">
        
        {/* 📰 NOTICIAS DIARIAS */}
        <div className="max-w-[1300px] mx-auto px-6 mb-16">
          <RevealSection>
            <div className="flex items-center justify-between mb-6 border-b border-sk-border-2 pb-4">
              <div>
                <span className="text-[10px] font-mono text-sk-accent uppercase tracking-widest font-bold mb-1 block">
                  Actualidad y Novedades
                </span>
                <h2 className="text-sk-xl font-black text-sk-text-1 uppercase flex items-center gap-2">
                  <Megaphone className="text-sk-accent" size={20} /> Noticias y Promociones de Póker
                </h2>
              </div>
              <Link to="/noticias" className="text-[11px] font-mono text-sk-text-3 hover:text-sk-accent font-bold uppercase transition-colors self-end pb-1">
                Ver todas →
              </Link>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {loadingBlog ? (
                [1,2,3].map(i => <div key={i} className="animate-sk-pulse h-40 bg-sk-bg-2 border border-sk-border-2 rounded-xl" />)
              ) : blogPosts.length === 0 ? (
                <p className="text-sk-sm text-sk-text-3 col-span-3">Cargando noticias de la base de datos...</p>
              ) : (
                blogPosts.map(post => (
                  <Link key={post.id} to={post.isStaticPromo ? post.link : `/noticias/${post.slug}`} className="group relative h-40 rounded-xl overflow-hidden border border-sk-border-2 bg-sk-bg-2 shadow-sk-md hover:border-sk-accent/50 hover:shadow-sk-xl transition-all duration-300 flex items-end p-5">
                    {post.image_thumbnail && (
                      <>
                        <img src={post.image_thumbnail} alt={post.title} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent opacity-90" />
                      </>
                    )}
                    <div className="relative z-10">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={cn(
                          "px-2 py-0.5 text-[9px] font-black uppercase tracking-widest rounded-sm",
                          post.category.toLowerCase() === 'promociones' ? "bg-orange-500 text-white" : 
                          post.category.toLowerCase() === 'noticias' ? "bg-sk-accent text-black" : "bg-sk-purple text-white"
                        )}>
                          {post.category}
                        </span>
                        <span className="text-[10px] font-mono text-gray-300">{formatBlogDate(post.published_at)}</span>
                      </div>
                      <h3 className="text-white font-bold text-sm leading-tight group-hover:text-sk-accent transition-colors line-clamp-2">{post.title}</h3>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </RevealSection>
        </div>

        <div className="max-w-[1300px] mx-auto px-6">
          <RevealSection>
            <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-8">

              {/* Lado Izquierdo: Próximos Torneos */}
              <div className="flex flex-col">
                <SectionHeader overline="Acción Inmediata" title="Agenda de Torneos" desc="Encuentra mesas con registro tardío o por arrancar." />
                <div className="flex flex-col gap-2 flex-1">
                  {loadingTourneys
                    ? [1,2,3,4].map(i => <CardSkeleton key={i} />)
                    : tournaments.length === 0
                      ? <p className="text-sk-sm text-sk-text-3 text-center py-8 bg-sk-bg-2 border border-sk-border-2 rounded-xl">No hay torneos próximos</p>
                      : tournaments.map(t => {
                        const isDemo = (t as any).is_demo;
                        const secs = secsUntil(t.start_datetime);
                        const isLive = t.status === "live";
                        const clubData = t.clubs as any;
                        const startDate = new Date(t.start_datetime);
                        return (
                          <div key={t.id} className={cn("bg-sk-bg-2 border border-sk-border-2 hover:border-sk-accent/40 hover:shadow-sk-md rounded-xl p-4 transition-all duration-300", isLive&&"border-l-2 border-l-sk-green")}>
                            <div className="flex justify-between items-start mb-2">
                              <div className="min-w-0 flex-1 pr-4">
                                <h3 className="font-bold text-sk-text-1 text-sk-md truncate flex items-center gap-2">
                                  {cleanName(t.name)} {isDemo && <DemoBadge />}
                                </h3>
                                <div className="text-[11px] text-sk-text-2 mt-1 flex items-center gap-2">
                                  <span className="font-mono text-sk-text-1 font-medium">{format(startDate, "dd/MM HH:mm")}</span>
                                  <span>·</span>
                                  <span>Buy-in: <span className={cn("font-mono font-semibold", t.buy_in===0?"text-sk-green":"text-sk-text-1")}>{t.buy_in===0?"FREE":`$${t.buy_in}`}</span></span>
                                  <span>·</span>
                                  <span className="text-sk-gold font-bold font-mono">GTD: ${(t.guaranteed_prize??0).toLocaleString("es")}</span>
                                </div>
                              </div>
                              <div className="flex flex-col items-end gap-2 shrink-0">
                                {isLive ? <Badge variant="live">EN VIVO</Badge> : secs>0 ? <CountdownTimer targetSeconds={secs} variant="soon" /> : null}
                                <div className="flex items-center gap-4 mt-1">
                                  <Link to="/como-jugar-en-clubgg" className="text-[10px] uppercase font-bold text-sk-green hover:underline">
                                    Cómo Jugar
                                  </Link>
                                  <button onClick={() => setSelectedTournament(t)} className="text-[10px] uppercase font-bold text-sk-accent hover:underline">
                                    Ver Info →
                                  </button>
                                </div>
                              </div>
                            </div>
                            <div className="mt-2 pt-2 border-t border-sk-border-2 flex justify-between items-center">
                              <Link to={`/clubs/${clubData?.slug ?? clubData?.id}`} className="text-[11px] text-sk-text-3 hover:text-sk-accent font-medium transition-colors flex items-center gap-1.5">
                                <FlagIcon countryCode={clubData?.country_code ?? null} /> Organizador: {cleanName(clubData?.name ?? "")}
                              </Link>
                            </div>
                          </div>
                        );
                      })
                  }
                </div>
                <div className="mt-6">
                  <Link to="/calendar"><Button variant="ghost" size="sm" className="w-full border border-sk-border-2">Ver agenda completa →</Button></Link>
                </div>
              </div>

              {/* Lado Derecho: Ranking Top 10 */}
              <div className="flex flex-col">
                <SectionHeader overline="Leaderboard" title="Top 10 Global" desc="Los reyes del algoritmo de varianza." />
                <div className="bg-sk-bg-2 border border-sk-border-2 rounded-xl overflow-hidden shadow-sk-xl flex-1">
                  <table className="w-full border-collapse text-sk-sm">
                    <thead>
                      <tr>
                        {["#","Jugador","ELO","ITM%"].map((h,i) => (
                          <th key={h} className={cn("bg-sk-bg-3 font-mono text-[11px] font-semibold tracking-wide uppercase text-sk-text-2 py-3 px-4 border-b border-sk-border-2 whitespace-nowrap", i===0&&"w-[40px]", i>=2&&"text-right")}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {loadingRank
                        ? [1,2,3,4,5,6,7,8,9,10].map(i => <RowSkeleton key={i} />)
                        : players.map((p, idx) => {
                          const rank = idx+1;
                          const itm = p.total_tournaments > 0 ? ((p.total_cashes/p.total_tournaments)*100).toFixed(1) : "0.0";
                          const isDemo = (p as any).is_demo;
                          return (
                            <tr key={p.id} className={cn("hover:bg-white/[0.02] transition-colors", rank===1&&"bg-[rgba(251,191,36,0.03)]", rank===2&&"bg-[rgba(203,213,225,0.02)]", rank===3&&"bg-[rgba(217,119,6,0.02)]")}>
                              <td className="py-3 px-4 border-b border-sk-border-2"><RankBadge rank={rank} /></td>
                              <td className="py-3 px-4 border-b border-sk-border-2">
                                <Link to={`/ranking/${p.slug}`} className="flex items-center gap-2 min-w-0 group">
                                  <div className="w-7 h-7 rounded-full bg-sk-bg-4 border border-sk-border-2 flex items-center justify-center text-[11px] font-bold text-sk-text-3 shrink-0 group-hover:border-sk-accent/40 transition-colors">
                                    {cleanName(p.nickname).charAt(0).toUpperCase()}
                                  </div>
                                  <div className="flex flex-col">
                                    <span className="font-bold text-sk-text-1 truncate group-hover:text-sk-accent transition-colors leading-tight">
                                      {cleanName(p.nickname)} {isDemo && <DemoBadge />}
                                    </span>
                                    {p.country_code && <span className="text-[9px] text-sk-text-4 flex items-center gap-1"><FlagIcon countryCode={p.country_code} /> {(p as any).poker_rooms?.name}</span>}
                                  </div>
                                </Link>
                              </td>
                              <td className="py-3 px-4 border-b border-sk-border-2 text-right font-mono font-black text-sk-accent text-sk-md">{Math.round(p.elo_rating).toLocaleString("es")}</td>
                              <td className={cn("py-3 px-4 border-b border-sk-border-2 text-right font-mono font-semibold", Number(itm)>20?"text-sk-green":"text-sk-text-2")}>{itm}%</td>
                            </tr>
                          );
                        })
                      }
                    </tbody>
                  </table>
                  <div className="p-4 bg-sk-bg-1 border-t border-sk-border-2 text-center">
                    <Link to="/ranking"><Button variant="ghost" size="sm" className="w-full">Ver posiciones 11-1000+ →</Button></Link>
                  </div>
                </div>
              </div>

            </div>
          </RevealSection>
        </div>
      </section>

      {/* ══ SOCIOS ESTRATÉGICOS ══ */}
      <section className="py-20 bg-sk-bg-1 border-t border-sk-border-2" id="partners">
        <div className="max-w-[1300px] mx-auto px-6">
          <RevealSection>
            <SectionHeader 
              overline="Alianzas" 
              title="Socios Estratégicos" 
              desc="Herramientas y plataformas de élite verificadas por Sharkania para llevar tu juego al siguiente nivel." 
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              
              {/* SOCIO 1: MindEV */}
              <div className="group bg-sk-bg-2 border border-sk-border-2 rounded-2xl overflow-hidden hover:border-[#d4af37]/50 shadow-sk-md hover:shadow-[0_0_30px_rgba(212,175,55,0.1)] transition-all duration-500 flex flex-col">
                <Link to="/mindev" className="block relative w-full h-[300px] overflow-hidden bg-sk-bg-3">
                  {/* Imagen destacada (Asegúrate de guardar la imagen generada como mindev-featured.webp en public/bg/) */}
                  <img 
                    src="/bg/mindev-featured.webp" 
                    alt="MindEV Inteligencia Artificial para Poker" 
                    className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-700"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-sk-bg-2 via-transparent to-transparent opacity-90" />
                  
                  <div className="absolute top-4 left-4 bg-[#0a1128]/80 backdrop-blur-md border border-[#d4af37]/30 px-3 py-1.5 rounded-lg flex items-center gap-2">
                     <Brain size={14} className="text-[#d4af37]" />
                     <span className="text-[10px] font-black uppercase tracking-widest text-[#d4af37]">MindEV IA</span>
                  </div>
                </Link>
                
                <div className="p-8 flex flex-col flex-1">
                  <h3 className="text-2xl font-black text-white mb-3 group-hover:text-[#d4af37] transition-colors leading-tight">
                    Tu EV+ empieza en tu mente
                  </h3>
                  
                  {/* Descripción de 42 palabras enfocada en la experiencia y dolor del usuario */}
                  <p className="text-sk-sm text-sk-text-3 leading-relaxed mb-8 flex-1">
                    Acelera tu aprendizajede torneos de póker sin horas de estudio aburrido. MindEV analiza las manos que jugaste en torneos y te explica tus aciertos y errores en idioma simple, sin GTO. Diseñado para jugadores de póker que buscan feedback inmediato de una IA para volver a ganar.
                  </p>
                  
                  <Link to="/mindev">
                    <Button className="w-full bg-[#d4af37] text-black hover:bg-[#b5952f] font-black shadow-[0_0_15px_rgba(212,175,55,0.2)]">
                      Quiero saber más
                    </Button>
                  </Link>
                </div>
              </div>

              {/* SOCIO 2: FullNuts */}
              <div className="group bg-sk-bg-2 border border-sk-border-2 rounded-2xl overflow-hidden hover:border-orange-500/50 shadow-sk-md hover:shadow-[0_0_30px_rgba(249,115,22,0.1)] transition-all duration-500 flex flex-col">
                <Link to="/fullnuts" className="block relative w-full h-[300px] overflow-hidden bg-sk-bg-3">
                  <img 
                    src="/bg/fullnuts-featured.webp" 
                    alt="FullNuts Ropa de Poker" 
                    className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-700"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-sk-bg-2 via-transparent to-transparent opacity-90" />
                  
                  <div className="absolute top-4 right-4 bg-black/80 backdrop-blur-md border border-orange-500/30 px-3 py-1.5 rounded-lg flex items-center gap-2">
                     <span className="text-[10px] font-black uppercase tracking-widest text-orange-500">FullNuts</span>
                     <Flame size={14} className="text-orange-500" />
                  </div>
                </Link>
                
                <div className="p-8 flex flex-col flex-1">
                  <h3 className="text-2xl font-black text-white mb-3 group-hover:text-orange-500 transition-colors leading-tight italic">
                    Viste como juegas.
                  </h3>
                  
                  <p className="text-sk-sm text-sk-text-3 leading-relaxed mb-8 flex-1">
                    La actitud en la mesa importa. FullNuts diseña streetwear exclusivo para verdaderos tiburones. Combina comodidad para tus sesiones más largas con el estilo agresivo que te define. Calidad premium con envíos a todo Chile.
                  </p>
                  
                  <Link to="/fullnuts">
                    <Button className="w-full bg-gradient-to-r from-orange-500 to-red-600 text-white hover:from-orange-400 hover:to-red-500 border-none font-black shadow-[0_0_15px_rgba(249,115,22,0.2)]">
                      Ver Colección
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </RevealSection>
        </div>
      </section>

      <TournamentDetailModal
        tournament={selectedTournament}
        isOpen={!!selectedTournament}
        onClose={() => setSelectedTournament(null)}
      />
    </PageShell>
  );
}