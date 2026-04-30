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
import { getBlogPosts, formatBlogDate, type BlogPost } from "../lib/api/blog";
import { supabase } from "../lib/supabase";
import { FlagIcon } from "../components/ui/flag-icon";
import { Trophy, CalendarDays, Building, Play, FileText, Megaphone, Zap, MonitorPlay } from "lucide-react";
import { format } from "date-fns";
import type { PlayerWithRoom, TournamentWithDetails } from "../types";
import { SEOHead } from "../components/seo/seo-head";


// ── Helpers ───────────────────────────────────────────────────────────────────

const getLeagueStatus = (startDate: string | null | undefined, endDate: string | null | undefined): "upcoming" | "active" | "finished" => {
  if (!startDate || !endDate) return "upcoming";
  const now = new Date();
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (now < start) return "upcoming";
  if (now > end) return "finished";
  return "active";
};

const statusBadge = {
  upcoming: { label: "Próxima", variant: "accent" as const },
  active: { label: "Activa", variant: "green" as const },
  finished: { label: "Finalizada", variant: "muted" as const },
};

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

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
  const [leagues,     setLeagues]     = useState<any[]>([]);
  const [blogPosts,   setBlogPosts]   = useState<BlogPost[]>([]);
  const [stats,       setStats]       = useState({ players:0, tournaments:0, clubs:0, leagues:0, live:0 });
  const [compA,       setCompA]       = useState<PlayerWithRoom|null>(null);
  const [compB,       setCompB]       = useState<PlayerWithRoom|null>(null);
  
  const [loadingRank,    setLoadingRank]    = useState(true);
  const [loadingTourneys,setLoadingTourneys] = useState(true);
  const [loadingLeagues, setLoadingLeagues] = useState(true);
  const [loadingBlog,    setLoadingBlog]    = useState(true);
  const [selectedTournament, setSelectedTournament] = useState<TournamentWithDetails | null>(null);

// Ahora el video viene de la Base de Datos
  const [featuredVideo, setFeaturedVideo] = useState<any>(null);

  useEffect(() => {
    async function loadFeatured() {
      const { data } = await supabase
        .from('shark_tv_videos')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      if (data) setFeaturedVideo(data);
    }
    loadFeatured();
  }, []);

  useEffect(() => {
    // Top 5 Jugadores
    getPlayers({ page:1, pageSize:10, orderBy:"elo_rating", orderDir:"desc" })
      .then(res => {
        setPlayers(res.data.slice(0,10)); // Ampliado a Top 10
        if (res.data.length >= 2) {
          const s = shuffle(res.data);
          setCompA(s[0]!); setCompB(s[1]!);
        }
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


    // Ligas Recientes
    supabase.from("leagues").select("*, league_clubs(is_primary, clubs(id,name,country_code,banner_url)), league_rooms(poker_rooms(id,name))")
      .in("status", ["active", "upcoming", "finished"])
      .order("start_date", { ascending: false }).limit(4)
      .then(({ data }) => { if (data) setLeagues(data.slice(0, 2)); setLoadingLeagues(false); });

    // Últimos Posts del Blog
    getBlogPosts().then(posts => setBlogPosts(posts.slice(0,3))).finally(() => setLoadingBlog(false));

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
          <h1 className="text-sk-hero font-black tracking-[-0.045em] text-sk-text-1 leading-none mb-6 animate-sk-fade-up sk-delay-1">
            El ecosistema definitivo<br />
            <span className="bg-gradient-to-br from-sk-accent to-sk-purple bg-clip-text text-transparent">del poker de clubes.</span>
          </h1>
          <p className="text-sk-lg text-sk-text-2 leading-relaxed mx-auto animate-sk-fade-up sk-delay-2">
            Mucho más que un ranking. Únete a la élite mundial: explora clubes exclusivos, compite en ligas internacionales y forja tu legado en las mesas.
          </p>
          <div className="flex justify-center gap-4 mt-10 flex-wrap animate-sk-fade-up sk-delay-3">
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
        </div>
      </section>

      {/* ══ STATS BAR ══ */}
      <div className="bg-sk-bg-0 border-b border-sk-border-2 py-3 overflow-hidden relative">
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
                                <button onClick={() => setSelectedTournament(t)} className="text-[10px] uppercase font-bold text-sk-accent hover:underline">Ver Info →</button>
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

              {/* Lado Derecho: Ranking Top 5 */}
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

      {/* ══ CONTENT HUB (SharkTV + Blog) ══ */}
      <section className="py-20 border-y border-sk-border-2 bg-[radial-gradient(ellipse_at_center,_var(--sk-bg-2)_0%,_var(--sk-bg-0)_100%)]">
        <div className="max-w-[1300px] mx-auto px-6">
          <SectionHeader overline="Knowledge Base" title="Aprende de los Profesionales" desc="Análisis de manos en video y artículos técnicos para elevar tu winrate." />
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Lado Izquierdo: SharkTV Destacado (Ocupa 2 columnas en Desktop) */}
            {/* Lado Izquierdo: SharkTV Destacado (Ocupa 2 columnas en Desktop) */}
            <div className="lg:col-span-2">
              {!featuredVideo ? (
                <div className="w-full h-[400px] rounded-2xl bg-sk-bg-2 border border-sk-border-2 flex items-center justify-center animate-pulse">
                  <MonitorPlay className="text-sk-text-4 opacity-50" size={48} />
                </div>
              ) : (
                <Link to={`/tv/${featuredVideo.id}`} className="group relative block w-full h-[400px] rounded-2xl overflow-hidden border border-sk-border-2 shadow-sk-xl">
                  {/* Imagen de Fondo */}
                  <img src={featuredVideo.thumbnail_url} alt={featuredVideo.title} className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:opacity-40 transition-opacity duration-700 group-hover:scale-105" />
                  <div className="absolute inset-0 bg-gradient-to-t from-sk-bg-1 via-sk-bg-1/40 to-transparent" />
                  
                  {/* Badge Superior */}
                  <div className="absolute top-6 left-6 z-10 flex gap-2">
                    <Badge variant="accent" className="bg-sk-bg-0/80 backdrop-blur-md px-3 py-1 flex items-center gap-1.5 shadow-lg">
                      <MonitorPlay size={12} /> SharkTV Destacado
                    </Badge>
                    <Badge variant="muted" className="bg-black/80">{featuredVideo.level || "Avanzado"}</Badge>
                  </div>
                  
                  {/* Botón Central Play */}
                  <div className="absolute inset-0 flex items-center justify-center z-10">
                    <div className="w-20 h-20 rounded-full bg-sk-accent/20 flex items-center justify-center border border-sk-accent/50 group-hover:scale-110 group-hover:bg-sk-accent/30 backdrop-blur-sm transition-all duration-300 shadow-[0_0_30px_rgba(34,211,238,0.3)]">
                      <Play className="text-sk-accent fill-sk-accent ml-2" size={32} />
                    </div>
                  </div>

                  {/* Info Inferior */}
                  <div className="absolute bottom-0 left-0 right-0 p-8 z-10">
                    <h3 className="text-2xl md:text-3xl font-black text-white mb-3 tracking-tight drop-shadow-md group-hover:text-sk-accent transition-colors">{featuredVideo.title}</h3>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-sk-bg-4 overflow-hidden border border-sk-border-2">
                        <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(featuredVideo.instructor_name || "Nicolas Fuentes")}&background=14151a&color=22d3ee`} alt="Instructor" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-white drop-shadow-md">{featuredVideo.instructor_name}</p>
                        <p className="text-[11px] text-sk-text-2 font-mono">Duración: {featuredVideo.duration || "00:00"}</p>
                      </div>
                    </div>
                  </div>
                </Link>
              )}
            </div>

            {/* Lado Derecho: Últimos Posts del Blog */}
            <div className="flex flex-col bg-sk-bg-1 border border-sk-border-2 rounded-2xl p-6">
              <h3 className="text-sk-md font-bold text-sk-text-1 mb-6 flex items-center gap-2">
                <FileText className="text-sk-purple" size={18} /> Últimos Artículos
              </h3>
              
              <div className="flex flex-col gap-6 flex-1">
                {loadingBlog ? (
                  [1,2,3].map(i => <div key={i} className="animate-sk-pulse h-20 bg-sk-bg-3 rounded-lg" />)
                ) : blogPosts.length === 0 ? (
                  <p className="text-sk-sm text-sk-text-3 text-center py-8">No hay artículos publicados aún.</p>
                ) : (
                  blogPosts.map(post => (
                    <Link key={post.id} to={`/blog/${post.slug}`} className="group flex gap-4 items-center">
                      <div className="w-20 h-20 rounded-lg overflow-hidden shrink-0 border border-sk-border-2 bg-sk-bg-3">
                        {post.image_thumbnail ? (
                          <img src={post.image_thumbnail} alt={post.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-sk-text-4"><FileText size={20} /></div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-mono text-sk-text-3 uppercase tracking-wider mb-1.5">{post.category} · {formatBlogDate(post.published_at)}</p>
                        <h4 className="text-sk-sm font-bold text-sk-text-1 group-hover:text-sk-purple transition-colors leading-snug line-clamp-2">{post.title}</h4>
                      </div>
                    </Link>
                  ))
                )}
              </div>
              <div className="mt-6 pt-6 border-t border-sk-border-2">
                <Link to="/blog"><Button variant="ghost" size="sm" className="w-full">Leer el Blog completo →</Button></Link>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ══ ECOSISTEMA (Ligas & Clubes Compactos) ══ */}
      <section className="py-20 bg-sk-bg-0" id="ecosystem">
        <div className="max-w-[1200px] mx-auto px-6">
          <RevealSection>
            <SectionHeader overline="El Ecosistema" title="Ligas y Clubes de Élite" desc="Temporadas competitivas organizadas por los clubes más seguros de la red." />
          </RevealSection>
          <RevealSection>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {loadingLeagues
                ? [1,2].map(i => <div key={i} className="animate-sk-pulse bg-sk-bg-2 border border-sk-border-2 rounded-lg p-6 h-32" />)
                : leagues.map((lg) => {
                    const currentStatus = getLeagueStatus(lg.start_date, lg.end_date);
                    const status = statusBadge[currentStatus];
                    const primaryClubObj = lg.league_clubs?.find((lc:any) => lc.is_primary)?.clubs;
                    const bannerUrl = primaryClubObj?.banner_url;
                    const cleanUrl = bannerUrl?.split('#')[0];
                    
                    return (
                      <Link key={lg.id} to={`/leagues/${lg.slug ?? lg.id}`} className="relative overflow-hidden bg-sk-bg-2 border border-sk-border-2 rounded-xl p-6 hover:border-sk-accent/50 hover:-translate-y-1 transition-all duration-300 group" style={bannerUrl ? { backgroundImage: `linear-gradient(to right, rgba(12,13,16,0.95) 40%, rgba(12,13,16,0.2)), url('${cleanUrl}')`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}>
                        <div className="relative z-10">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant={status.variant}>{status.label}</Badge>
                            <span className="font-mono text-[10px] text-sk-text-2">📅 {lg.start_date?.slice(0,10)}</span>
                          </div>
                          <h3 className="text-xl font-bold text-sk-text-1 group-hover:text-sk-accent transition-colors">{cleanName(lg.name)}</h3>
                          <p className="text-sk-xs text-sk-text-3 mt-1 flex items-center gap-1">Organiza: {cleanName(primaryClubObj?.name ?? "Club")}</p>
                        </div>
                      </Link>
                    );
                  })
              }
            </div>
            <div className="text-center mt-8 space-x-4">
              <Link to="/leagues"><Button variant="secondary" size="md">Ver Ligas</Button></Link>
              <Link to="/clubs"><Button variant="ghost" size="md">Explorar Clubes</Button></Link>
            </div>
          </RevealSection>
        </div>
      </section>

      {/* ══ COMPARATOR ══ */}
      <section className="py-20 bg-sk-bg-1 border-t border-sk-border-2" id="compare">
        <div className="max-w-[900px] mx-auto px-6">
          <RevealSection>
            <SectionHeader overline="Análisis de Datos" title="Head to Head" desc="Enfrenta a dos jugadores y descubre quién domina en los números fríos." />
          </RevealSection>
          <RevealSection>
            <div className="relative border border-sk-border-2 rounded-3xl p-6 md:p-10 overflow-hidden shadow-sk-xl sk-comparator-bg group">
              <div className="absolute inset-0 bg-sk-bg-1/90 backdrop-blur-[2px] z-0 group-hover:bg-sk-bg-1/75 transition-all duration-700" />
              <div className="relative z-10">
                {!compA || !compB
                  ? <div className="animate-sk-pulse h-48 rounded bg-sk-bg-3/50" />
                  : <>
                    <div className="grid grid-cols-[1fr_60px_1fr] gap-4 items-center">
                    {/* Player A */}
                    <div className="text-center">
                      <div className="w-16 h-16 rounded-full bg-sk-bg-4 border-2 border-sk-accent flex items-center justify-center text-sk-xl font-extrabold text-sk-accent mx-auto mb-3">{cleanName(compA.nickname).charAt(0).toUpperCase()}</div>
                      <div className="flex items-center justify-center gap-2 flex-wrap mb-2">
                        <FlagIcon countryCode={compA.country_code} />
                        <span className="font-bold text-sk-text-1 text-sk-md">{cleanName(compA.nickname)}</span>
                      </div>
                      <div className="font-mono font-black text-2xl text-sk-accent">{Math.round(compA.elo_rating).toLocaleString("es")}</div>
                    </div>
                    {/* VS */}
                    <div className="text-center"><div className="text-sk-xl font-black text-sk-text-4 tracking-tight italic">VS</div></div>
                    {/* Player B */}
                    <div className="text-center">
                      <div className="w-16 h-16 rounded-full bg-sk-bg-4 border-2 border-sk-purple flex items-center justify-center text-sk-xl font-extrabold text-sk-purple mx-auto mb-3">{cleanName(compB.nickname).charAt(0).toUpperCase()}</div>
                      <div className="flex items-center justify-center gap-2 flex-wrap mb-2">
                        <FlagIcon countryCode={compB.country_code} />
                        <span className="font-bold text-sk-text-1 text-sk-md">{cleanName(compB.nickname)}</span>
                      </div>
                      <div className="font-mono font-black text-2xl text-sk-purple">{Math.round(compB.elo_rating).toLocaleString("es")}</div>
                    </div>
                  </div>
                  <div className="w-full h-px my-8 bg-gradient-to-r from-transparent via-sk-border-3 to-transparent" />
                  <div className="flex flex-col gap-2">
                    {[
                      { label:"Torneos Jugados",  a:compA.total_tournaments,  b:compB.total_tournaments,  aWins:compA.total_tournaments > compB.total_tournaments },
                      { label:"ITM %",    a:compA.total_tournaments>0?((compA.total_cashes/compA.total_tournaments)*100).toFixed(1)+"%":"0%", b:compB.total_tournaments>0?((compB.total_cashes/compB.total_tournaments)*100).toFixed(1)+"%":"0%", aWins:compA.total_cashes/Math.max(1,compA.total_tournaments) > compB.total_cashes/Math.max(1,compB.total_tournaments) },
                      { label:"Victorias (1er lugar)", a:compA.total_wins,         b:compB.total_wins,         aWins:compA.total_wins > compB.total_wins },
                    ].map(row => (
                      <div key={row.label} className="grid grid-cols-[1fr_auto_1fr] gap-4 items-center py-2">
                        <div className={cn("text-right font-mono font-bold text-sk-md", row.aWins?"text-sk-green":"text-sk-text-1")}>{String(row.a)}</div>
                        <div className="text-[11px] font-bold text-sk-text-3 uppercase tracking-widest text-center min-w-[140px]">{row.label}</div>
                        <div className={cn("font-mono font-bold text-sk-md", !row.aWins?"text-sk-green":"text-sk-text-1")}>{String(row.b)}</div>
                      </div>
                    ))}
                  </div>
                  <div className="text-center pt-8">
                    <Link to="/compare"><Button variant="accent" size="lg" className="rounded-full shadow-[0_0_20px_rgba(34,211,238,0.2)]">⚔️ Comparador Avanzado</Button></Link>
                  </div>
                </>
              }
              </div>
            </div>
          </RevealSection>
        </div>
      </section>

      {/* ══ FOR CLUBS ══ */}
      <section className="py-24 bg-sk-bg-0 relative overflow-hidden border-t border-sk-border-2">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[800px] h-[300px] bg-sk-accent/5 blur-[120px] rounded-full pointer-events-none" />
        <div className="max-w-[1200px] mx-auto px-6 relative z-10">
          <RevealSection>
            <SectionHeader overline="Software B2B" title="Herramientas para Clubes" desc="Crea y gestiona torneos, sube resultados, administra jugadores y configura ligas desde un dashboard profesional." />
          </RevealSection>
          <RevealSection className="flex justify-center mt-4">
            <Link to="/register" className="relative inline-flex items-center justify-center gap-3 px-10 py-5 bg-sk-bg-1 border border-sk-border-2 rounded-2xl font-extrabold text-sk-md text-sk-text-1 overflow-hidden group transition-all duration-300 hover:border-sk-accent hover:text-sk-bg-0 hover:bg-sk-accent hover:shadow-[0_0_40px_rgba(34,211,238,0.4)] hover:-translate-y-1">
              <Building className="text-sk-text-3 group-hover:text-sk-bg-0 transition-colors" size={22} />
              <span className="relative z-10 tracking-wide">Dar de alta mi Club gratis</span>
              <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent group-hover:translate-x-[200%] transition-transform duration-1000 ease-in-out" />
            </Link>
          </RevealSection>
        </div>
      </section>

      {/* ══ CTA FINAL ══ */}
      <section className="py-16 px-6 bg-sk-bg-1 border-t border-sk-border-2 text-center">
        <RevealSection className="max-w-[600px] mx-auto">
          <div className="mb-6"><Megaphone className="mx-auto text-sk-accent" size={48} /></div>
          <h2 className="text-sk-3xl font-black text-sk-text-1 tracking-tight mb-4">Empieza tu legado hoy</h2>
          <p className="text-sk-md text-sk-text-2 mb-8 leading-relaxed">
            Únete a la matriz global. Completa misiones, gana <span className="text-sk-accent font-bold">Shark Coins</span> y demuestra que eres el tiburón más fuerte de tu sala.
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Link to="/register"><Button variant="accent" size="xl" className="shadow-lg">Crear Cuenta de Jugador</Button></Link>
          </div>
        </RevealSection>
      </section>

      <TournamentDetailModal
        tournament={selectedTournament}
        isOpen={!!selectedTournament}
        onClose={() => setSelectedTournament(null)}
      />
    </PageShell>
  );
}