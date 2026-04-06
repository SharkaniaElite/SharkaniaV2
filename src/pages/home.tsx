// src/pages/home.tsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PageShell } from "../components/layout/page-shell";
import { RevealSection } from "../components/landing/reveal-section";
import { CountdownTimer } from "../components/landing/countdown-timer";
import { TournamentDetailModal } from "../components/calendar/tournament-detail-modal";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { StatCard } from "../components/ui/stat-card";
import { Chip } from "../components/ui/chip";
import { cn } from "../lib/cn";
import { GlobalSearch } from "../components/search/global-search";
import { getPlayers } from "../lib/api/players";
import { getClubs } from "../lib/api/clubs";
import { getUpcomingTournaments } from "../lib/api/tournaments";
import { supabase } from "../lib/supabase";
import { FlagIcon } from "../components/ui/flag-icon";
import { Trophy, CalendarDays, Settings, LineChart, Globe, Building } from "lucide-react";
import { format } from "date-fns";
import type { PlayerWithRoom, ClubWithRooms, TournamentWithDetails } from "../types";
import { SEOHead } from "../components/seo/seo-head";


// ── Helpers ───────────────────────────────────────────────────────────────────

// FUNCIÓN AGREGADA PARA CALCULAR EL ESTADO REAL
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
    <div className="text-center mb-12 max-w-[600px] mx-auto px-4">
      <p className="font-mono text-[11px] font-bold tracking-[0.08em] uppercase text-sk-accent mb-3">{overline}</p>
      <h2 className="text-sk-3xl font-extrabold tracking-tight text-sk-text-1 mb-4">{title}</h2>
      {desc && <p className="text-sk-md text-sk-text-2 leading-relaxed">{desc}</p>}
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

const ROOMS = ["♠️ PPPoker","♦️ PokerBros","♣️ ClubGG","♥️ Suprema Poker","🃏 X-Poker","♠️ Pokerrrr 2"];

// ── Main Page ─────────────────────────────────────────────────────────────────

export function HomePage() {
  const [players,     setPlayers]     = useState<PlayerWithRoom[]>([]);
  const [clubs,       setClubs]       = useState<ClubWithRooms[]>([]);
  const [tournaments, setTournaments] = useState<TournamentWithDetails[]>([]);
  const [leagues,     setLeagues]     = useState<any[]>([]);
  const [stats,       setStats]       = useState({ players:0, tournaments:0, clubs:0, leagues:0, live:0 });
  const [compA,       setCompA]       = useState<PlayerWithRoom|null>(null);
  const [compB,       setCompB]       = useState<PlayerWithRoom|null>(null);
  const [loadingRank,    setLoadingRank]    = useState(true);
  const [loadingTourneys,setLoadingTourneys] = useState(true);
  const [loadingClubs,   setLoadingClubs]   = useState(true);
  const [loadingLeagues, setLoadingLeagues] = useState(true);
  const [selectedTournament, setSelectedTournament] = useState<TournamentWithDetails | null>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") e.preventDefault();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    getPlayers({ page:1, pageSize:20, orderBy:"elo_rating", orderDir:"desc" })
      .then(res => {
        setPlayers(res.data.slice(0,7));
        if (res.data.length >= 2) {
          const s = shuffle(res.data);
          setCompA(s[0]!); setCompB(s[1]!);
        }
      })
      .catch(console.error)
      .finally(() => setLoadingRank(false));
  }, []);

  useEffect(() => {
    getUpcomingTournaments()
      .then(d => {
        const now = new Date();
        const filtered = d.filter(t => {
          if (t.status === "live" || t.status === "late_registration") return true;
          if (t.status === "completed" || t.status === "cancelled") return false;
          if (t.status === "scheduled") {
            return new Date(t.start_datetime) > now;
          }
          return true;
        });
        setTournaments(filtered.slice(0,4));
      })
      .catch(console.error)
      .finally(() => setLoadingTourneys(false));
  }, []);

  useEffect(() => {
    getClubs()
      .then(d => setClubs(shuffle(d).slice(0,3)))
      .catch(console.error)
      .finally(() => setLoadingClubs(false));
  }, []);

 useEffect(() => {
    // Creamos una función interna asíncrona
    const fetchLeagues = async () => {
      try {
        const { data } = await supabase
          .from("leagues")
          // 👇 Añadimos "banner_url" a los datos que pedimos del club
          .select("*, league_clubs(is_primary, clubs(id,name,country_code,banner_url)), league_rooms(poker_rooms(id,name))")
          .in("status", ["active", "upcoming", "finished"])
          .order("start_date", { ascending: false })
          .limit(20);

        if (data) {
          setLeagues(shuffle(data).slice(0, 2));
        }
      } catch (error) {
        console.error("Error cargando ligas:", error);
      } {
        setLoadingLeagues(false);
      }
    };

    fetchLeagues();
  }, []);

  useEffect(() => {
    Promise.all([
      supabase.from("players").select("id", { count:"exact", head:true }),
      supabase.from("tournaments").select("id", { count:"exact", head:true }),
      supabase.from("clubs").select("id", { count:"exact", head:true }).eq("is_approved",true),
      supabase.from("leagues").select("id", { count:"exact", head:true }).eq("status","active"),
      supabase.from("tournaments").select("id", { count:"exact", head:true }).eq("status","live"),
    ]).then(([p,t,c,l,live]) => {
      setStats({ players:p.count??0, tournaments:t.count??0, clubs:c.count??0, leagues:l.count??0, live:live.count??0 });
    }).catch(console.error);
  }, []);

  const liveCount = tournaments.filter(t => t.status === "live").length;

  const cleanName = (s: string) => s.replace(/^\[DEMO\]\s*/,"").replace(/⚠️ DATOS DEMO.*$/,"").trim();

  return (
   
    <PageShell>
     <SEOHead title="Inicio" description="Ranking ELO global de poker competitivo para clubes privados. Calendarios de torneos en vivo, perfiles de jugador, ligas, estadísticas y herramientas." path="/" />

      {/* ══ HERO ══ */}
      <section className="relative min-h-dvh flex flex-col items-center justify-center text-center px-6 py-24 overflow-hidden max-md:py-16">
        <div className="absolute inset-0 -z-20" style={{
          background:"radial-gradient(ellipse 60% 40% at 50% 0%, var(--sk-accent-dim), transparent 70%), radial-gradient(ellipse 40% 30% at 70% 80%, var(--sk-purple-dim), transparent 60%), var(--sk-bg-1)"
        }} />
        <div className="absolute inset-0 -z-10" style={{
          backgroundImage:"linear-gradient(rgba(255,255,255,0.018) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.018) 1px,transparent 1px)",
          backgroundSize:"64px 64px",
          maskImage:"radial-gradient(ellipse 70% 60% at 50% 40%, black, transparent)",
          WebkitMaskImage:"radial-gradient(ellipse 70% 60% at 50% 40%, black, transparent)",
        }} />
        <div className="max-w-[720px]">
          <div className="inline-flex items-center gap-2 py-1 pl-1 pr-3.5 bg-sk-bg-3 border border-sk-border-2 rounded-full text-[11px] font-medium text-sk-text-2 mb-8 animate-sk-fade-up">
            <span className="px-2 py-0.5 bg-sk-accent-dim text-sk-accent rounded-full font-bold text-[10px] tracking-wide">BETA</span>
            Plataforma Global de Poker Competitivo
          </div>
          <h1 className="text-sk-hero font-black tracking-[-0.045em] text-sk-text-1 leading-none mb-6 animate-sk-fade-up sk-delay-1">
            El ecosistema definitivo<br />
            <span className="bg-gradient-to-br from-sk-accent to-sk-purple bg-clip-text text-transparent">del poker competitivo.</span>
          </h1>
          <p className="text-sk-lg text-sk-text-2 leading-relaxed max-w-[600px] mx-auto animate-sk-fade-up sk-delay-2">
            Mucho más que un ranking. Únete a la élite mundial: explora clubes exclusivos, compite en ligas internacionales, analiza estadísticas avanzadas y forja tu legado en las mesas.
          </p>
          <div className="flex justify-center gap-4 mt-10 flex-wrap animate-sk-fade-up sk-delay-3">
            <Link to="/ranking">
              <Button 
                variant="accent" 
                size="xl" 
                className="group relative overflow-hidden font-extrabold tracking-wide shadow-[0_0_20px_rgba(34,211,238,0.25)] hover:shadow-[0_0_35px_rgba(34,211,238,0.5)] transition-all duration-300 border border-sk-accent/50 hover:border-sk-accent"
              >
                {/* Reflejo de luz interior (Efecto cristal/holograma) */}
                <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/30 to-transparent group-hover:translate-x-[200%] transition-transform duration-1000 ease-in-out" />
                
                <Trophy className="w-5 h-5 mr-2 inline-block group-hover:scale-110 transition-transform duration-300" />
                Ver Ranking Global
              </Button>
            </Link>
            
            <Link to="/calendar">
              <Button 
                variant="secondary" 
                size="xl" 
                className="group font-bold tracking-wide border-sk-border-2 hover:border-sk-text-2 hover:bg-white/[0.03] transition-all duration-300"
              >
                <CalendarDays className="w-5 h-5 mr-2 inline-block text-sk-text-4 group-hover:text-sk-text-1 transition-colors duration-300" />
                Calendario de Torneos
              </Button>
            </Link>
          </div>
        </div>
        <div className="absolute bottom-8 left-1/2 flex flex-col items-center gap-2 text-sk-text-4 text-[11px] animate-sk-scroll-bounce max-md:hidden">
          <span>Scroll</span>
          <div className="w-px h-6 bg-gradient-to-b from-sk-text-4 to-transparent" />
        </div>
      </section>

      {/* ══ STATS BAR ══ */}
      <div className="bg-sk-bg-0 border-y border-sk-border-2 py-3 overflow-hidden relative">
        {/* Efecto sutil de luz de escáner */}
        <div className="absolute top-0 left-[-100%] w-1/2 h-full bg-gradient-to-r from-transparent via-sk-accent/5 to-transparent animate-[shimmer_3s_infinite]" />
        <div className="max-w-[1200px] mx-auto px-6 relative z-10">
          <div className="flex justify-center items-center gap-6 md:gap-10 flex-wrap">
            {[
              { label:"JUGADORES TRACKEADOS",  value:stats.players.toLocaleString("es") },
              { label:"TORNEOS DISPUTADOS",    value:stats.tournaments.toLocaleString("es") },
              { label:"CLUBES VERIFICADOS", value:stats.clubs.toLocaleString("es") },
              { label:"LIGAS EN CURSO",      value:stats.leagues.toLocaleString("es") },
            ].map(item => (
              <div key={item.label} className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-sk-text-3 font-semibold group cursor-default">
                <span className="group-hover:text-sk-accent transition-colors duration-300">{item.label}</span>
                <span className="font-mono font-bold text-sk-text-1 text-sk-sm group-hover:text-white transition-colors duration-300">{item.value}</span>
              </div>
            ))}
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-sk-text-3 font-semibold group cursor-default">
              <Badge variant="live" className="shadow-[0_0_10px_rgba(239,68,68,0.4)] animate-pulse">LIVE NOW</Badge>
              <span className="font-mono font-bold text-sk-text-1 text-sk-sm group-hover:text-white transition-colors duration-300">{stats.live}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ══ ROOMS ══ */}
      <section className="py-10 border-b border-sk-border-2 bg-[radial-gradient(ellipse_at_center,_var(--sk-bg-2)_0%,_var(--sk-bg-0)_100%)]">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="flex items-center justify-center gap-4 mb-6">
            <div className="h-px bg-gradient-to-r from-transparent to-sk-border-3 flex-1 max-w-[100px]" />
            <p className="text-center text-[10px] font-bold tracking-[0.15em] uppercase text-sk-text-3">Integración Total Garantizada</p>
            <div className="h-px bg-gradient-to-l from-transparent to-sk-border-3 flex-1 max-w-[100px]" />
          </div>
          <div className="flex justify-center items-center gap-8 md:gap-14 flex-wrap">
            {/* Quitamos los emojis del string original usando JS replace y estilizamos */}
            {ROOMS.map(r => {
              // Limpiamos los emojis por un lado, y el selector de variante (FE0F) por otro para no enojar a ESLint
              const cleanName = r
                .replace(/[\u{1F000}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1F300}-\u{1F5FF}]/gu, '')
                .replace(/\uFE0F/g, '')
                .trim();
              return (
                <span key={r} className="font-mono text-sk-sm md:text-sk-base font-bold text-sk-text-3 tracking-widest uppercase hover:text-sk-accent hover:shadow-[0_0_15px_rgba(34,211,238,0.3)] hover:scale-105 transition-all duration-300 cursor-default">
                  {cleanName}
                </span>
              );
            })}
          </div>
        </div>
      </section>

      {/* ══ SEARCH ══ */}
      <section className="py-12" id="search">
        <div className="max-w-[1200px] mx-auto px-6 flex flex-col items-center">
          <p className="font-mono text-[11px] font-bold tracking-[0.08em] uppercase text-sk-accent mb-4">Búsqueda Instantánea</p>
          <GlobalSearch variant="full" />
        </div>
      </section>

      {/* ══ RANKING + CALENDAR ══ */}
      <section className="py-20 bg-sk-bg-0" id="ranking">
        <div className="max-w-[1300px] mx-auto px-6">
          <RevealSection>
            <SectionHeader overline="Ranking ELO Global" title="Los mejores jugadores del mundo"
              desc="Un sistema de puntuación único adaptado al poker competitivo. Como el ajedrez, pero diseñado para la varianza del MTT." />
          </RevealSection>
          <RevealSection>
            <div className="bg-sk-bg-2 border border-sk-border-2 rounded-xl overflow-hidden shadow-sk-xl">
              <div className="flex items-center p-3 px-4 border-b border-sk-border-2 gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-sk-red" />
                <div className="w-2.5 h-2.5 rounded-full bg-sk-gold" />
                <div className="w-2.5 h-2.5 rounded-full bg-sk-green" />
                <div className="ml-4 font-mono text-[11px] text-sk-text-4 bg-sk-bg-0 px-3 py-1 rounded-sm border border-sk-border-2 flex-1 max-w-[300px]">sharkania.com/ranking</div>
              </div>
              <div className="grid grid-cols-[1.2fr_1fr] max-lg:grid-cols-1">

                {/* Ranking */}
                <div className="p-5 border-r border-sk-border-2 max-lg:border-r-0 max-lg:border-b overflow-hidden">
                  <h3 className="text-sk-md font-bold text-sk-text-1 mb-4">🏆 Ranking Global</h3>
                  <div className="rounded-md overflow-hidden">
                    <table className="w-full border-collapse text-sk-sm">
                      <thead>
                        <tr>
                          {["#","Jugador","ELO","Torneos","ITM%","Wins"].map((h,i) => (
                            <th key={h} className={cn("bg-sk-bg-3 font-mono text-[11px] font-semibold tracking-wide uppercase text-sk-text-2 py-3 px-4 border-b border-sk-border-2 whitespace-nowrap", i===0&&"w-[50px]", i>=2&&"text-right")}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {loadingRank
                          ? [1,2,3,4,5,6,7].map(i => <RowSkeleton key={i} />)
                          : players.map((p, idx) => {
                            const rank = idx+1;
                            const itm = p.total_tournaments > 0 ? ((p.total_cashes/p.total_tournaments)*100).toFixed(1) : "0.0";
                            const isDemo = (p as any).is_demo;
                            return (
                              <tr key={p.id} className={cn("hover:bg-white/[0.015] transition-colors", rank===1&&"bg-[rgba(251,191,36,0.03)]", rank===2&&"bg-[rgba(203,213,225,0.02)]", rank===3&&"bg-[rgba(217,119,6,0.02)]")}>
                                <td className="py-3 px-4 border-b border-sk-border-2"><RankBadge rank={rank} /></td>
                                <td className="py-3 px-4 border-b border-sk-border-2">
                                  <Link to={`/ranking/${p.slug}`} className="flex items-center gap-2 min-w-0 group">
                                    <div className="w-7 h-7 rounded-full bg-sk-bg-4 border border-sk-border-2 flex items-center justify-center text-[11px] font-bold text-sk-text-3 shrink-0 group-hover:border-sk-accent/40 transition-colors">
                                      {cleanName(p.nickname).charAt(0).toUpperCase()}
                                    </div>
                                    {p.country_code && <FlagIcon countryCode={p.country_code} />}
                                    <span className="font-semibold text-sk-text-1 truncate group-hover:text-sk-accent transition-colors">
                                      {cleanName(p.nickname)}
                                    </span>
                                    {isDemo && <DemoBadge />}
                                  </Link>
                                </td>
                                <td className="py-3 px-4 border-b border-sk-border-2 text-right font-mono font-bold text-sk-accent">{Math.round(p.elo_rating).toLocaleString("es")}</td>
                                <td className="py-3 px-4 border-b border-sk-border-2 text-right text-sk-text-1">{p.total_tournaments}</td>
                                <td className={cn("py-3 px-4 border-b border-sk-border-2 text-right font-mono font-semibold", Number(itm)>20?"text-sk-green":"text-sk-text-2")}>{itm}%</td>
                                <td className="py-3 px-4 border-b border-sk-border-2 text-right text-sk-text-1">{p.total_wins}</td>
                              </tr>
                            );
                          })
                        }
                      </tbody>
                    </table>
                  </div>
                  <div className="text-center py-4">
                    <Link to="/ranking"><Button variant="ghost" size="sm">Ver ranking completo →</Button></Link>
                  </div>
                </div>

                {/* Calendar */}
                <div className="p-5 overflow-hidden" id="calendar">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-sk-md font-bold text-sk-text-1">📅 Próximos Torneos</h3>
                    {liveCount > 0 && <Badge variant="live">{liveCount} EN VIVO</Badge>}
                  </div>
                  <div className="flex flex-col gap-2">
                    {loadingTourneys
                      ? [1,2,3,4].map(i => <CardSkeleton key={i} />)
                      : tournaments.length === 0
                        ? <p className="text-sk-sm text-sk-text-3 text-center py-8">No hay torneos próximos</p>
                        : tournaments.map(t => {
                          const isDemo = (t as any).is_demo;
                          const secs = secsUntil(t.start_datetime);
                          const isLive = t.status === "live";
                          const clubData = t.clubs as any;
                          const startDate = new Date(t.start_datetime);
                          return (
                            <div key={t.id} className={cn("bg-sk-bg-3 border border-sk-border-2 rounded-md p-3 px-4", isLive&&"border-l-2 border-l-sk-green")}>
                              <div className="flex justify-between items-center mb-1">
                                <span className="font-semibold text-sk-text-1 text-sk-sm flex items-center gap-2 min-w-0">
                                  <span className="truncate">{cleanName(t.name)}</span>
                                  <button
                                    onClick={() => setSelectedTournament(t)}
                                    className="w-[18px] h-[18px] rounded-full bg-white/[0.04] text-sk-text-4 text-[11px] flex items-center justify-center hover:bg-sk-accent-dim hover:text-sk-accent transition-all shrink-0"
                                    aria-label="Ver detalles del torneo"
                                  >
                                    ℹ️
                                  </button>
                                  {isDemo && <DemoBadge />}
                                </span>
                                <div className="flex items-center gap-2 shrink-0">
                                  {isLive ? <Badge variant="live">EN VIVO</Badge> : secs>0 ? <CountdownTimer targetSeconds={secs} variant="soon" /> : null}
                                </div>
                              </div>
                              <div className="flex justify-between items-center">
                                <div className="flex gap-4 text-[11px] text-sk-text-2">
                                  <span>Buy-in: <span className={cn("font-mono font-semibold", t.buy_in===0?"text-sk-green":"text-sk-text-1")}>{t.buy_in===0?"FREE":`$${t.buy_in}`}</span></span>
                                  <span>GTD: <span className="font-mono font-bold text-sk-gold">${(t.guaranteed_prize??0).toLocaleString("es")}</span></span>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <span className="font-mono text-[11px] text-sk-text-1 font-medium">
                                    {format(startDate, "dd/MM")} · {format(startDate, "HH:mm")}
                                  </span>
                                  <FlagIcon countryCode={clubData?.country_code ?? null} />
                                </div>
                              </div>
                              <div className="mt-1 flex justify-between items-center">
                                <Link to={`/clubs/${clubData?.slug ?? clubData?.id}`} className="text-[11px] text-sk-accent font-medium hover:opacity-80 transition-opacity flex items-center gap-1">
                                  <FlagIcon countryCode={clubData?.country_code ?? null} /> {cleanName(clubData?.name ?? "")}
                                </Link>
                                {(t as any).leagues?.name && (
                                  <span className="text-[10px] font-mono text-sk-text-4">
                                    Liga: {cleanName((t as any).leagues.name)}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })
                    }
                  </div>
                  <div className="text-center py-4">
                    <Link to="/calendar"><Button variant="ghost" size="sm">Ver calendario completo →</Button></Link>
                  </div>
                </div>
              </div>
            </div>
          </RevealSection>
        </div>
      </section>

      {/* ══ STATS GRID ══ */}
      <section className="py-12 border-b border-sk-border-2">
        <div className="max-w-[1200px] mx-auto px-6">
          <RevealSection>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
              <StatCard label="Jugadores registrados"   value={stats.players.toLocaleString("es")}     accent="accent" />
              <StatCard label="Torneos en plataforma"   value={stats.tournaments.toLocaleString("es")} accent="gold" />
              <StatCard label="Clubes activos"           value={stats.clubs.toLocaleString("es")}       accent="green" />
              <StatCard label="Ligas activas"            value={stats.leagues.toLocaleString("es")} />
            </div>
          </RevealSection>
        </div>
      </section>

      {/* ══ FEATURES ══ */}
      <section className="py-20" id="features">
        <div className="max-w-[1200px] mx-auto px-6">
          <RevealSection>
            <SectionHeader overline="Plataforma Completa" title="Todo lo que necesitas en un solo lugar"
              desc="Diseñado por jugadores de poker, para jugadores de poker. Cada feature existe porque resuelve un problema real." />
          </RevealSection>
          <RevealSection>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                { bgClass:"sk-feature-ranking", title:"Ranking ELO Adaptado", desc:"Sistema de puntuación único que considera buy-in, field size, varianza y rendimiento relativo.", link:"/ranking" },
                { bgClass:"sk-feature-calendar", title:"Calendario en Vivo", desc:"Todos los torneos de los clubes en un solo lugar. Countdown en vivo y late registration.", link:"/calendar" },
                { bgClass:"sk-feature-clubs", title:"Clubes & Ligas", desc:"Encuentra clubes por país o sala. Únete a ligas con tablas de posiciones y premios.", link:"/clubs" },
                { bgClass:"sk-feature-compare", title:"Comparador de Jugadores", desc:"Enfrenta a dos jugadores y analiza su historial ELO, torneos en común y rendimiento.", link:"/compare" },
                { bgClass:"sk-feature-missions", title:"Misiones & Logros", desc:"Gamificación real: completa misiones, gana XP, desbloquea insignias y sube de nivel.", link:"/register" },
                { bgClass:"sk-feature-search", title:"Búsqueda Instantánea", desc:"Encuentra a cualquier jugador, club, liga o torneo al instante mientras escribes.", link:"#search" },
              ].map(f => {
                const isAnchor = f.link.startsWith("#");
                const cardClasses = cn(
                  "relative group p-8 rounded-xl border border-sk-border-2 transition-all duration-500 ease-out overflow-hidden min-h-[240px] flex flex-col justify-end cursor-pointer block",
                  "hover:border-sk-accent/50 hover:shadow-[0_8px_30px_rgba(34,211,238,0.15)] hover:-translate-y-1",
                  f.bgClass
                );

                const cardContent = (
                  <>
                    {/* Overlay cinemático oscuro para garantizar legibilidad */}
                    <div className="absolute inset-0 bg-gradient-to-t from-sk-bg-1/95 via-sk-bg-1/80 to-sk-bg-1/20 z-0 group-hover:from-sk-bg-1/90 transition-colors duration-500" />
                    
                    {/* Contenido textual */}
                    <div className="relative z-10 transform group-hover:-translate-y-2 transition-transform duration-500">
                      {/* 👇 Añadimos group-hover:text-sk-accent para dar feedback visual de que es clickeable */}
                      <h3 className="text-sk-lg font-extrabold text-sk-text-1 mb-2 tracking-tight drop-shadow-md group-hover:text-sk-accent transition-colors duration-300">{f.title}</h3>
                      <p className="text-sk-sm text-sk-text-2 leading-relaxed opacity-90 group-hover:opacity-100 transition-opacity duration-500">{f.desc}</p>
                    </div>
                  </>
                );

                // Si el link es un ancla (como #search), usamos <a> para saltar ahí mismo
                if (isAnchor) {
                  return (
                    <a key={f.title} href={f.link} className={cardClasses}>
                      {cardContent}
                    </a>
                  );
                }

                // Si es una página interna, usamos el <Link> de React Router
                return (
                  <Link key={f.title} to={f.link} className={cardClasses}>
                    {cardContent}
                  </Link>
                );
              })}
            </div>
          </RevealSection>
        </div>
      </section>

      {/* ══ CLUBS ══ */}
      <section className="py-20 bg-sk-bg-0" id="clubs">
        <div className="max-w-[1200px] mx-auto px-6">
          <RevealSection>
            <SectionHeader overline="Clubes Activos" title="Únete a los mejores clubes"
              desc="Clubes de poker online verificados de toda Latinoamérica y el mundo." />
          </RevealSection>
          <RevealSection>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {loadingClubs
                ? [1,2,3].map(i => <div key={i} className="animate-sk-pulse bg-sk-bg-2 border border-sk-border-2 rounded-lg p-6 h-40" />)
                : clubs.map(c => {
                  const isDemo = (c as any).is_demo;
                  const rooms = c.club_rooms?.map(cr => (cr as any).poker_rooms?.name).filter(Boolean) ?? [];
                  
                  // 👇 Extraemos la posición y la URL limpia
                  const bgPos = c.banner_url ? (c.banner_url.match(/#pos=(\d+)/)?.[1] ?? 50) : 50;
                  const cleanUrl = c.banner_url?.split('#')[0];

                  return (
                    <Link 
                      key={c.id} 
                      to={`/clubs/${c.slug}`} 
                      className="relative overflow-hidden bg-sk-bg-2 border border-sk-border-2 rounded-lg p-6 cursor-pointer transition-all duration-300 ease-out hover:border-sk-accent/50 hover:shadow-sk-lg hover:-translate-y-1 flex flex-col gap-4 group"
                      style={c.banner_url ? {
                        // 👇 Aplicamos el degradado para legibilidad y la imagen de fondo centrada a gusto
                        backgroundImage: `linear-gradient(to bottom, rgba(12,13,16,0.35), rgba(12,13,16,0.95)), url('${cleanUrl}')`,
                        backgroundSize: 'cover',
                        backgroundPosition: `center ${bgPos}%`
                      } : undefined}
                    >
                      {/* Envolvemos en relative z-10 para que flote sobre el fondo */}
                      <div className="relative z-10 flex items-start gap-3">
                        <FlagIcon countryCode={c.country_code ?? null} size={36} />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-sk-md font-bold text-sk-text-1 tracking-tight group-hover:text-sk-accent transition-colors">{cleanName(c.name)}</h3>
                            {isDemo && <DemoBadge />}
                          </div>
                          <div className="flex gap-2 mt-1 flex-wrap">
                            {rooms.map(r => <Chip key={r}>{cleanName(r)}</Chip>)}
                          </div>
                        </div>
                      </div>
                      <p className="relative z-10 text-sk-sm text-sk-text-2 leading-relaxed line-clamp-2 group-hover:text-sk-text-1 transition-colors">
                        {cleanName(c.description ?? "Club de poker online verificado.")}
                      </p>
                    </Link>
                  );
                })
              }
            </div>
          </RevealSection>
          <RevealSection className="text-center mt-8">
            <Link to="/clubs"><Button variant="secondary" size="lg">Ver todos los clubes →</Button></Link>
          </RevealSection>
        </div>
      </section>

      {/* ══ HOW IT WORKS ══ */}
      <section className="py-20">
        <div className="max-w-[1200px] mx-auto px-6">
          <RevealSection><SectionHeader overline="Cómo Funciona" title="De torneo a ranking en 3 pasos" /></RevealSection>
          <RevealSection>
            <div className="flex gap-8 relative pt-4 max-md:flex-col max-md:gap-4">
              <div className="absolute top-6 left-6 right-6 h-px bg-sk-border-1 max-md:hidden" />
              {[
                { n:"01", title:"Un club sube resultados",  desc:"El admin carga los resultados desde su panel de administración." },
                { n:"02", title:"ELO se calcula",            desc:"Nuestro algoritmo procesa el resultado considerando field, buy-in, varianza y fuerza del campo." },
                { n:"03", title:"Rankings se actualizan",    desc:"El ranking global y de liga se actualizan al instante." },
              ].map(step => (
                <div key={step.n} className="flex-1 text-center relative z-[1]">
                  <div className="w-12 h-12 rounded-full bg-sk-bg-4 border-2 border-sk-border-3 flex items-center justify-center font-mono font-extrabold text-sk-md text-sk-accent mx-auto mb-4">{step.n}</div>
                  <p className="font-bold text-sk-sm text-sk-text-1 mb-2">{step.title}</p>
                  <p className="text-sk-xs text-sk-text-2 leading-relaxed max-w-[200px] mx-auto">{step.desc}</p>
                </div>
              ))}
            </div>
          </RevealSection>
        </div>
      </section>

      {/* ══ COMPARATOR ══ */}
      <section className="py-20 bg-sk-bg-0" id="compare">
        <div className="max-w-[900px] mx-auto px-6">
          <RevealSection>
            <SectionHeader overline="Head to Head" title="Compara jugadores"
              desc="Enfrenta a dos jugadores y descubre quién domina en los números. ELO, ITM, ROI y torneos en común." />
          </RevealSection>
          <RevealSection>
            <div className="relative border border-sk-border-2 rounded-2xl p-6 md:p-10 overflow-hidden shadow-[0_0_40px_rgba(34,211,238,0.05)] sk-comparator-bg group">
              {/* Overlay cinemático oscuro para no interrumpir la info */}
              <div className="absolute inset-0 bg-sk-bg-0/85 backdrop-blur-[2px] z-0 group-hover:bg-sk-bg-0/70 transition-all duration-700" />
              
              {/* Contenido flotando sobre el fondo */}
              <div className="relative z-10">
                {!compA || !compB
                  ? <div className="animate-sk-pulse h-48 rounded bg-sk-bg-3/50" />
                  : <>
                    <div className="grid grid-cols-[1fr_60px_1fr] gap-4 items-center">
                    {/* Player A */}
                    <div className="text-center">
                      <div className="w-16 h-16 rounded-full bg-sk-bg-4 border-2 border-sk-accent flex items-center justify-center text-sk-xl font-extrabold text-sk-accent mx-auto mb-3">
                        {cleanName(compA.nickname).charAt(0).toUpperCase()}
                      </div>
                      <div className="flex items-center justify-center gap-2 flex-wrap">
                        <div className="flex items-center justify-center gap-2 flex-wrap">
                          <FlagIcon countryCode={compA.country_code} />
                          <span className="font-bold text-sk-text-1 text-sk-md">{cleanName(compA.nickname)}</span>
                        </div>
                        {(compA as any).is_demo && <DemoBadge />}
                      </div>
                      <div className="font-mono font-bold text-sk-lg mt-2 text-sk-accent">
                        {Math.round(compA.elo_rating).toLocaleString("es")}
                      </div>
                      <div className="text-[11px] text-sk-text-2">ELO Rating</div>
                    </div>

                    {/* VS */}
                    <div className="text-center">
                      <div className="text-sk-2xl font-black text-sk-text-3 tracking-tight">VS</div>
                    </div>

                    {/* Player B */}
                    <div className="text-center">
                      <div className="w-16 h-16 rounded-full bg-sk-bg-4 border-2 border-sk-purple flex items-center justify-center text-sk-xl font-extrabold text-sk-purple mx-auto mb-3">
                        {cleanName(compB.nickname).charAt(0).toUpperCase()}
                      </div>
                      <div className="flex items-center justify-center gap-2 flex-wrap">
                        <div className="flex items-center justify-center gap-2 flex-wrap">
                          <FlagIcon countryCode={compB.country_code} />
                          <span className="font-bold text-sk-text-1 text-sk-md">{cleanName(compB.nickname)}</span>
                        </div>
                        {(compB as any).is_demo && <DemoBadge />}
                      </div>
                      <div className="font-mono font-bold text-sk-lg mt-2 text-sk-purple">
                        {Math.round(compB.elo_rating).toLocaleString("es")}
                      </div>
                      <div className="text-[11px] text-sk-text-2">ELO Rating</div>
                    </div>
                  </div>
                  <div className="w-full h-px my-6 bg-gradient-to-r from-transparent via-sk-accent-dim to-transparent" />
                  <div className="flex flex-col gap-0.5">
                    {[
                      { label:"Torneos",  a:compA.total_tournaments,  b:compB.total_tournaments,  aWins:compA.total_tournaments > compB.total_tournaments },
                      { label:"ITM %",    a:compA.total_tournaments>0?((compA.total_cashes/compA.total_tournaments)*100).toFixed(1)+"%":"0%", b:compB.total_tournaments>0?((compB.total_cashes/compB.total_tournaments)*100).toFixed(1)+"%":"0%", aWins:compA.total_cashes/Math.max(1,compA.total_tournaments) > compB.total_cashes/Math.max(1,compB.total_tournaments) },
                      { label:"Victorias", a:compA.total_wins,         b:compB.total_wins,         aWins:compA.total_wins > compB.total_wins },
                    ].map(row => (
                      <div key={row.label} className="grid grid-cols-[1fr_auto_1fr] gap-4 items-center py-2">
                        <div className={cn("text-right font-mono font-bold", row.aWins?"text-sk-green":"text-sk-text-1")}>{String(row.a)}</div>
                        <div className="text-[11px] text-sk-text-2 text-center min-w-[100px]">{row.label}</div>
                        <div className={cn("font-mono font-bold", !row.aWins?"text-sk-green":"text-sk-text-1")}>{String(row.b)}</div>
                      </div>
                    ))}
                  </div>
                  <div className="text-center pt-4">
                    <Link to="/compare"><Button variant="accent" size="lg">⚔️ Comparar jugadores</Button></Link>
                  </div>
                </>
              }
              </div> {/* CIERRE de relative z-10 */}
            </div> {/* CIERRE de relative border sk-comparator-bg */}
          </RevealSection>
        </div>
      </section>

      {/* ══ LEAGUES ══ */}
      <section className="py-20" id="leagues">
        <div className="max-w-[1200px] mx-auto px-6">
          <RevealSection>
            <SectionHeader overline="Ligas Activas" title="Compite en ligas organizadas"
              desc="Temporadas con tabla de posiciones, puntos de liga y premios. Encuentra tu próximo desafío." />
          </RevealSection>
          <RevealSection>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {loadingLeagues
                ? [1,2].map(i => <div key={i} className="animate-sk-pulse bg-sk-bg-2 border border-sk-border-2 rounded-lg p-6 h-40" />)
                : leagues.length === 0
                  ? <div className="col-span-2 text-center py-12 text-sk-sm text-sk-text-3">No hay ligas activas por el momento.</div>
                  : leagues.map((lg) => {
                    // --- CAMBIOS PARA CALCULAR EL ESTADO REAL ---
                    const currentStatus = getLeagueStatus(lg.start_date, lg.end_date);
                    const status = statusBadge[currentStatus];
                    const borderColor = currentStatus === "active" ? "border-t-sk-gold" : "border-t-sk-purple";
                    // --------------------------------------------

                    const isDemo = lg.is_demo;
                    const primaryClubObj = lg.league_clubs?.find((lc:any) => lc.is_primary)?.clubs;
                    const primaryClub = primaryClubObj?.name;
                    // 👇 Extraemos la URL y calculamos la posición
                    const bannerUrl = primaryClubObj?.banner_url;
                    const bgPos = bannerUrl ? (bannerUrl.match(/#pos=(\d+)/)?.[1] ?? 50) : 50;
                    const cleanUrl = bannerUrl?.split('#')[0];
                    
                    const rooms = lg.league_rooms?.map((lr:any) => lr.poker_rooms?.name).filter(Boolean) ?? [];
                    
                    return (
                      <Link 
                        key={lg.id} 
                        to={`/leagues/${lg.slug ?? lg.id}`} 
                        className={cn(
                          "relative overflow-hidden bg-sk-bg-2 border border-sk-border-2 rounded-lg p-6 border-t-2 flex flex-col gap-4 cursor-pointer hover:border-sk-accent/50 hover:shadow-sk-md hover:-translate-y-1 transition-all duration-300 group",
                          borderColor
                        )}
                        // 👇 Aplicamos el fondo con el degradado para mantener legibilidad
                        style={bannerUrl ? {
                          backgroundImage: `linear-gradient(to bottom, rgba(12,13,16,0.4), rgba(12,13,16,0.95)), url('${cleanUrl}')`,
                          backgroundSize: 'cover',
                          backgroundPosition: `center ${bgPos}%`
                        } : undefined}
                      >
                        {/* Envolvemos en relative z-10 para flotar sobre la imagen */}
                        <div className="relative z-10 flex justify-between items-start">
                          <div className="min-w-0 flex-1 pr-4">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="text-sk-md font-bold text-sk-text-1 tracking-tight group-hover:text-sk-accent transition-colors">
                                {currentStatus === "active" ? "🏆 " : "🌎 "}{cleanName(lg.name)}
                              </h3>
                              {isDemo && <DemoBadge />}
                            </div>
                            <div className="font-mono text-[11px] text-sk-text-2 mt-1 group-hover:text-sk-text-1 transition-colors">
                              📅 {lg.start_date?.slice(0,10)} — {lg.end_date?.slice(0,10)}{primaryClub ? ` · ${cleanName(primaryClub)}` : ""}
                            </div>
                          </div>
                          <Badge variant={status.variant}>{status.label}</Badge>
                        </div>
                        <div className="relative z-10 flex gap-2 flex-wrap">
                          {rooms.slice(0,3).map((r:string) => <Chip key={r}>{cleanName(r)}</Chip>)}
                          <Chip>NLH</Chip><Chip>MTT</Chip>
                        </div>
                      </Link>
                    );
                  })
              }
            </div>
          </RevealSection>
          <RevealSection className="text-center mt-8">
            <Link to="/leagues"><Button variant="secondary" size="lg">Ver todas las ligas →</Button></Link>
          </RevealSection>
        </div>
      </section>

      {/* ══ FOR CLUBS ══ */}
      <section className="py-24 bg-sk-bg-0 relative overflow-hidden">
        {/* Luz de ambiente de fondo */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[800px] h-[300px] bg-sk-accent/5 blur-[120px] rounded-full pointer-events-none" />

        <div className="max-w-[1200px] mx-auto px-6 relative z-10">
          <RevealSection>
            <SectionHeader overline="Para Clubes & Organizadores" title="Haz crecer tu club con Sharkania"
              desc="Herramientas profesionales para gestionar tu club, crear ligas y atraer jugadores." />
          </RevealSection>
          
          <RevealSection>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { 
                  icon: <Settings className="text-sk-accent" size={24} />, 
                  title: "Panel de Administración", 
                  desc: "Crea y gestiona torneos, sube resultados y configura ligas desde un dashboard intuitivo.",
                  bgClass: "sk-club-admin" 
                },
                { 
                  icon: <LineChart className="text-sk-gold" size={24} />, 
                  title: "Ranking Personalizable",   
                  desc: "Crea sistemas de puntos propios. Simple o complejo — tú decides.",
                  bgClass: "sk-club-ranking" 
                },
                { 
                  icon: <Globe className="text-sk-purple" size={24} />, 
                  title: "Visibilidad Global",        
                  desc: "Tu club aparece en el calendario global. Jugadores de todo el mundo pueden encontrarte.",
                  bgClass: "sk-club-global" 
                },
              ].map(f => (
                // 👇 La clase de la imagen ahora va en el contenedor principal, igual que en Features
                <div key={f.title} className={cn(
  "group relative overflow-hidden rounded-2xl border border-sk-border-2 min-h-[320px] flex flex-col justify-end p-8 transition-all duration-500 hover:border-sk-accent/40 hover:shadow-[0_8px_30px_rgba(34,211,238,0.12)] hover:-translate-y-2",
  f.bgClass
)}>
                  
                  {/* 👇 OVERLAY DEGRADADO (Cinemático y claro, idéntico a las Features) */}
                  <div className="absolute inset-0 bg-gradient-to-t from-sk-bg-1/95 via-sk-bg-1/80 to-sk-bg-1/20 z-0 group-hover:from-sk-bg-1/90 transition-colors duration-500" />

                  {/* CONTENIDO TEXTUAL */}
                  <div className="relative z-10 transform group-hover:-translate-y-2 transition-transform duration-500">
                    <div className="w-12 h-12 rounded-xl bg-sk-bg-4/80 backdrop-blur-sm border border-sk-border-2 flex items-center justify-center mb-6 shadow-lg group-hover:border-sk-accent/50 group-hover:bg-sk-accent/10 transition-colors duration-500">
                      {f.icon}
                    </div>
                    <h3 className="text-sk-lg font-extrabold text-sk-text-1 mb-3 tracking-tight group-hover:text-sk-accent transition-colors duration-300">{f.title}</h3>
                    <p className="text-sk-sm text-sk-text-2 leading-relaxed opacity-90 group-hover:opacity-100 transition-opacity duration-500">{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </RevealSection>

          <RevealSection className="flex justify-center mt-14">
            {/* BOTÓN ULTRA MODERNO (Con efecto Neon Underglow y sin emojis) */}
            <Link 
              to="/register" 
              className="relative inline-flex items-center justify-center gap-3 px-10 py-5 bg-sk-bg-1 border border-sk-border-2 rounded-2xl font-extrabold text-sk-md text-sk-text-1 overflow-hidden group transition-all duration-300 hover:border-sk-accent hover:text-sk-bg-0 hover:bg-sk-accent hover:shadow-[0_0_40px_rgba(34,211,238,0.4)] hover:-translate-y-1"
            >
              <Building className="text-sk-text-3 group-hover:text-sk-bg-0 transition-colors" size={22} />
              <span className="relative z-10 tracking-wide">Registrar mi Club</span>
              
              {/* Brillo interno que cruza el botón al pasar el mouse */}
              <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent group-hover:translate-x-[200%] transition-transform duration-1000 ease-in-out" />
            </Link>
          </RevealSection>
        </div>
      </section>

      {/* ══ CTA FINAL ══ */}
      <section className="py-16 px-6 bg-sk-bg-0 border-t border-sk-border-2 text-center">
        <RevealSection className="max-w-[600px] mx-auto">
          <div className="mb-4">
            <svg width="48" height="48" viewBox="0 0 40 40" fill="none" className="mx-auto">
              <path d="M7,36 L18,4 L38,24 L33,36 Z" fill="#22d3ee"/>
            </svg>
          </div>
          <h2 className="text-sk-2xl font-extrabold text-sk-text-1 tracking-tight mb-3">Empieza a construir tu legado</h2>
          <p className="text-sk-md text-sk-text-2 mb-8">
            Únete a miles de jugadores rankeados. Completa misiones, gana <span className="text-sk-accent font-bold">Shark Coins</span> y desbloquea herramientas tácticas en La Bóveda. Tu dedicación financia tu progreso.
          </p>
          <div className="flex gap-3 justify-center flex-wrap">
            <Link to="/register"><Button variant="accent" size="xl">Crear cuenta gratis</Button></Link>
            <Link to="/register"><Button variant="secondary" size="xl">Registrar mi club</Button></Link>
          </div>
          <p className="mt-5 text-[10px] text-sk-text-3 font-mono uppercase tracking-widest">
            Economía meritocrática · Cero Pay-to-win · Setup en 2 minutos
          </p>
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