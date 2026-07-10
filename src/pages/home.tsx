import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PageShell } from "../components/layout/page-shell";
import { RevealSection } from "../components/landing/reveal-section";
import { Button } from "../components/ui/button";
import { cn } from "../lib/cn";
import { getPlayers } from "../lib/api/players";
import { getBlogPosts, formatBlogDate } from "../lib/api/blog";
import { supabase } from "../lib/supabase";
import { FlagIcon } from "../components/ui/flag-icon";
import { Megaphone, Zap, Brain, Flame, CalendarDays, BookOpen } from "lucide-react";
import type { PlayerWithRoom, TournamentWithDetails } from "../types";
import { SEOHead } from "../components/seo/seo-head";
import { useBanners } from "../hooks/use-banners";
import { TournamentCard } from "../components/calendar/tournament-card";
import { TournamentDetailModal } from "../components/calendar/tournament-detail-modal";
import { getUpcomingTournaments } from "../lib/api/tournaments";

// ── Helpers ───────────────────────────────────────────────────────────────────

function DemoBadge() {
  return <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-sk-gold-dim text-sk-gold uppercase tracking-wider shrink-0">⚠ Demo</span>;
}

function RankBadge({ rank }: { rank: number }) {
  const cls = rank === 1 ? "bg-sk-gold-dim text-sk-gold" : rank === 2 ? "bg-[rgba(203,213,225,0.1)] text-sk-silver" : rank === 3 ? "bg-[rgba(217,119,6,0.1)] text-sk-bronze" : "text-sk-text-2";
  return <span className={cn("font-mono font-bold text-sk-sm w-7 h-7 inline-flex items-center justify-center rounded-xs", cls)}>{rank}</span>;
}

function SectionHeader({ overline, title, desc }: { overline: string; title: string; desc?: string }) {
  return (
    <div className="mb-8 px-4 flex flex-col md:flex-row items-start md:items-end justify-between gap-4 border-b border-sk-border-2 pb-4">
      <div>
        <p className="font-mono text-[11px] font-bold tracking-[0.08em] uppercase text-sk-accent mb-2 flex items-center gap-2"><Zap size={14} /> {overline}</p>
        <h2 className="text-sk-2xl font-extrabold tracking-tight text-sk-text-1">{title}</h2>
        {desc && <p className="text-sk-sm text-sk-text-3 mt-2 max-w-2xl">{desc}</p>}
      </div>
    </div>
  );
}

function RowSkeleton() {
  return (
    <tr className="animate-sk-pulse">
      {[40,120,60,50,60,60].map((w,i) => <td key={i} className="py-3 px-4 border-b border-sk-border-2"><div className="h-4 rounded bg-sk-bg-4" style={{ width: w }} /></td>)}
    </tr>
  );
}

// ── Grilla de Banners (Aparece en Home) ───────────────────────────────────────
function HomeBannerGrid() {
  const banners = useBanners();
  const slots = ["grid_1", "grid_2", "grid_3", "grid_4"] as const;

  return (
    <section className="py-10 bg-sk-bg-0 border-b border-sk-border-2">
      <div className="max-w-[1300px] mx-auto px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {slots.map((slotKey) => {
            const config = banners?.slots?.[slotKey];
            const desk = config?.desktop;
            const mob = config?.mobile;
            
            if (!desk?.src && !mob?.src) return null;
            
            return (
              <a key={slotKey} href={desk?.href || mob?.href || "#"} target="_blank" rel="noopener noreferrer" className="block rounded-xl overflow-hidden border border-sk-border-2 hover:border-sk-accent transition-all hover:-translate-y-1 shadow-md bg-black group">
                <picture>
                  <source media="(max-width: 768px)" srcSet={mob?.src || desk?.src} />
                  <img src={desk?.src || mob?.src} alt={`Promoción ${slotKey}`} className="w-full h-auto aspect-[350/200] md:aspect-[600/250] object-cover hover:opacity-90 transition-opacity" />
                </picture>
              </a>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export function HomePage() {
  const [players, setPlayers] = useState<PlayerWithRoom[]>([]);
  const [blogPosts, setBlogPosts] = useState<any[]>([]);
  const [stats, setStats] = useState({ players:0, tournaments:0, clubs:0, leagues:0, live:0 });
  
  const [loadingRank, setLoadingRank] = useState(true);
  const [loadingBlog, setLoadingBlog] = useState(true);

  // Calendario
  const [tournaments, setTournaments] = useState<TournamentWithDetails[]>([]);
  const [loadingTourneys, setLoadingTourneys] = useState(true);
  const [selectedTournament, setSelectedTournament] = useState<TournamentWithDetails | null>(null);

  useEffect(() => {
    getPlayers({ page:1, pageSize:10, orderBy:"elo_rating", orderDir:"desc" }).then(res => setPlayers(res.data.slice(0,10))).finally(() => setLoadingRank(false));
    
    getBlogPosts().then(posts => {
      posts.sort((a, b) => new Date(b.published_at || 0).getTime() - new Date(a.published_at || 0).getTime());
      setBlogPosts(posts.slice(0, 3));
    }).finally(() => setLoadingBlog(false));

    getUpcomingTournaments().then(d => {
      const now = new Date();
      const filtered = d.filter(t => {
        if (t.status === "live" || t.status === "late_registration") return true;
        if (t.status === "completed" || t.status === "cancelled") return false;
        if (t.status === "scheduled") return new Date(t.start_datetime) > now;
        return true;
      });
      setTournaments(filtered.slice(0, 3));
    }).finally(() => setLoadingTourneys(false));

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
      <SEOHead title="Inicio" description="Plataforma global de poker competitivo." path="/" />

      {/* 📰 NOTICIAS (Arriba de todo) */}
      <section className="pt-8 pb-4 relative z-10 bg-sk-bg-1 border-b border-sk-border-2/50">
        <div className="max-w-[1300px] mx-auto px-6">
          <RevealSection>
            <div className="flex items-center justify-between mb-6 border-b border-sk-border-2 pb-4">
              <div>
                <span className="text-[10px] font-mono text-sk-accent uppercase tracking-widest font-bold mb-1 block">Actualidad y Novedades</span>
                <h2 className="text-sk-xl font-black text-sk-text-1 uppercase flex items-center gap-2"><Megaphone className="text-sk-accent" size={20} /> Noticias y Promociones</h2>
              </div>
              <Link to="/noticias" className="text-[11px] font-mono text-sk-text-3 hover:text-sk-accent font-bold uppercase transition-colors self-end pb-1">Ver todas →</Link>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {loadingBlog ? [1,2,3].map(i => <div key={i} className="animate-sk-pulse h-40 bg-sk-bg-2 border border-sk-border-2 rounded-xl" />) : blogPosts.map(post => (
                <Link key={post.id} to={post.category === 'Promociones' ? `/promociones/${post.slug}` : `/noticias/${post.slug}`} className="group relative h-40 rounded-xl overflow-hidden border border-sk-border-2 bg-sk-bg-2 shadow-sk-md hover:border-sk-accent/50 transition-all duration-300 flex items-end p-5">
                  {post.image_thumbnail && <><img src={post.image_thumbnail} alt={post.title} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" /><div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent opacity-90" /></>}
                  <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={cn("px-2 py-0.5 text-[9px] font-black uppercase tracking-widest rounded-sm", post.category.toLowerCase() === 'promociones' ? "bg-orange-500 text-white" : "bg-sk-accent text-black")}>{post.category}</span>
                      <span className="text-[10px] font-mono text-gray-300">{formatBlogDate(post.published_at)}</span>
                    </div>
                    <h3 className="text-white font-bold text-sm leading-tight group-hover:text-sk-accent transition-colors line-clamp-2">{post.title}</h3>
                  </div>
                </Link>
              ))}
            </div>
          </RevealSection>
        </div>
      </section>

      {/* 🎰 GRILLA 4 SALAS */}
      <HomeBannerGrid />

      {/* ══ HERO & TICKER ══ */}
      <section className="relative min-h-[60vh] flex flex-col items-center justify-center text-center px-6 pt-16 pb-12 overflow-hidden">
        <div className="absolute inset-0 -z-20" style={{ background:"radial-gradient(ellipse 60% 40% at 50% 0%, var(--sk-accent-dim), transparent 70%), radial-gradient(ellipse 40% 30% at 70% 80%, var(--sk-purple-dim), transparent 60%), var(--sk-bg-1)" }} />
        <div className="absolute inset-0 -z-10" style={{ backgroundImage:"linear-gradient(rgba(255,255,255,0.018) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.018) 1px,transparent 1px)", backgroundSize:"64px 64px", maskImage:"radial-gradient(ellipse 70% 60% at 50% 40%, black, transparent)" }} />
        
        <div className="max-w-[800px] flex-1 flex flex-col justify-center mb-10">
          <div className="inline-flex items-center gap-2 py-1 pl-1 pr-3.5 bg-sk-bg-3 border border-sk-border-2 rounded-full text-[11px] font-medium text-sk-text-2 mb-8 mx-auto">
            <span className="px-2 py-0.5 bg-sk-accent-dim text-sk-accent rounded-full font-bold text-[10px] tracking-wide">BETA</span>
            Plataforma Global de Poker Competitivo
          </div>
          <h1 className="text-5xl md:text-7xl font-black tracking-[-0.045em] text-sk-text-1 leading-none mb-6 uppercase">
            Juega. Aprende.<br /><span className="bg-gradient-to-br from-sk-accent to-blue-400 bg-clip-text text-transparent">Domina las mesas.</span>
          </h1>
          <p className="text-sk-lg text-sk-text-2 leading-relaxed mx-auto max-w-2xl">
            Para ser un verdadero tiburón del póker necesitas dos cosas: volumen de juego y conocimiento táctico.
          </p>
          
          <div className="flex flex-col md:flex-row justify-center items-stretch gap-6 mt-10 w-full max-w-3xl mx-auto">
            <div className="flex-1 bg-sk-bg-2/50 backdrop-blur-sm border border-sk-border-2 rounded-2xl p-5 flex flex-col items-center justify-center hover:border-sk-accent/40 transition-colors shadow-sm">
              <p className="text-[10px] font-mono text-sk-text-3 uppercase tracking-widest mb-4">Pilar 1: Volumen</p>
              <Link to="/calendar" className="w-full">
                <Button variant="accent" size="xl" className="w-full font-extrabold shadow-[0_0_20px_rgba(34,211,238,0.15)] hover:shadow-[0_0_35px_rgba(34,211,238,0.4)]">
                  <CalendarDays className="w-5 h-5 mr-2" /> Volumen de Juego
                </Button>
              </Link>
            </div>
            <div className="flex-1 bg-sk-bg-2/50 backdrop-blur-sm border border-sk-border-2 rounded-2xl p-5 flex flex-col items-center justify-center shadow-sm">
              <p className="text-[10px] font-mono text-sk-text-3 uppercase tracking-widest mb-4">Pilar 2: Táctica</p>
              <div className="flex flex-col sm:flex-row gap-3 w-full">
                <Link to="/blog" className="flex-1">
                  <Button variant="secondary" className="w-full py-3.5"><BookOpen className="w-4 h-4 mr-2" /> Blog</Button>
                </Link>
                <Link to="/academy" className="flex-1">
                  <Button variant="secondary" className="w-full py-3.5 hover:text-sk-purple"><Brain className="w-4 h-4 mr-2" /> Academia</Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══ STATS BAR ══ */}
      <div className="bg-sk-bg-0 border-y border-sk-border-2 py-3 overflow-hidden">
        <div className="max-w-[1200px] mx-auto px-6 flex justify-center items-center gap-6 md:gap-10 flex-wrap">
          {[ { label:"JUGADORES", value:stats.players }, { label:"TORNEOS", value:stats.tournaments }, { label:"CLUBES", value:stats.clubs }].map(item => (
            <div key={item.label} className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-sk-text-3 font-semibold">
              <span>{item.label}</span>
              <span className="font-mono font-bold text-sk-text-1 text-sk-sm">{item.value.toLocaleString("es")}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ══ RANKING ══ */}
      <section className="py-16 bg-sk-bg-0" id="ranking">
        <div className="max-w-[900px] mx-auto px-6">
          <RevealSection>
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
                    {loadingRank ? [1,2,3,4,5,6,7,8,9,10].map(i => <RowSkeleton key={i} />) : players.map((p, idx) => {
                      const rank = idx+1;
                      const itm = p.total_tournaments > 0 ? ((p.total_cashes/p.total_tournaments)*100).toFixed(1) : "0.0";
                      const isDemo = (p as any).is_demo;
                      return (
                        <tr key={p.id} className="hover:bg-white/[0.02] transition-colors">
                          <td className="py-3 px-4 border-b border-sk-border-2"><RankBadge rank={rank} /></td>
                          <td className="py-3 px-4 border-b border-sk-border-2">
                            <Link to={`/ranking/${p.slug}`} className="flex items-center gap-2 group">
                              <div className="w-7 h-7 rounded-full bg-sk-bg-4 border border-sk-border-2 flex items-center justify-center text-[11px] font-bold text-sk-text-3 group-hover:border-sk-accent/40">{cleanName(p.nickname).charAt(0).toUpperCase()}</div>
                              <div className="flex flex-col">
                                <span className="font-bold text-sk-text-1 group-hover:text-sk-accent">{cleanName(p.nickname)} {isDemo && <DemoBadge />}</span>
                                {p.country_code && <span className="text-[9px] text-sk-text-4 flex items-center gap-1"><FlagIcon countryCode={p.country_code} /> {(p as any).poker_rooms?.name}</span>}
                              </div>
                            </Link>
                          </td>
                          <td className="py-3 px-4 border-b border-sk-border-2 text-right font-mono font-black text-sk-accent text-sk-md">{Math.round(p.elo_rating).toLocaleString("es")}</td>
                          <td className={cn("py-3 px-4 border-b border-sk-border-2 text-right font-mono font-semibold", Number(itm)>20?"text-sk-green":"text-sk-text-2")}>{itm}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div className="p-4 bg-sk-bg-1 border-t border-sk-border-2 text-center">
                  <Link to="/ranking"><Button variant="ghost" size="sm" className="w-full">Ver posiciones 11-1000+ →</Button></Link>
                </div>
              </div>
            </div>
          </RevealSection>
        </div>
      </section>

      {/* 🗓️ CALENDARIO (Ubicado después del Ranking) */}
      <section className="py-16 bg-sk-bg-2 border-y border-sk-border-2 shadow-inner">
        <div className="max-w-[1300px] mx-auto px-6">
          <SectionHeader overline="Agenda" title="Próximos Torneos" desc="Asegura tu asiento en las próximas fechas de nuestras ligas." />
          <div className="grid md:grid-cols-3 gap-6">
            {loadingTourneys ? (
              <p className="text-sk-text-3 italic col-span-3">Cargando...</p>
            ) : tournaments.map(t => (
               <div key={t.id} onClick={() => setSelectedTournament(t)} className="cursor-pointer transition-transform hover:-translate-y-1">
                 <TournamentCard tournament={t} />
               </div>
            ))}
          </div>
          <div className="mt-8 text-center">
             <Link to="/calendar"><Button variant="accent">Ver Calendario Completo →</Button></Link>
          </div>
        </div>
      </section>

      {/* ══ SOCIOS ESTRATÉGICOS ══ */}
      <section className="py-20 bg-sk-bg-1 border-t border-sk-border-2" id="partners">
        <div className="max-w-[1300px] mx-auto px-6">
          <RevealSection>
            <SectionHeader overline="Alianzas" title="Socios Estratégicos" desc="Herramientas de élite verificadas por Sharkania." />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              
              {/* MindEV */}
              <div className="group bg-sk-bg-2 border border-sk-border-2 rounded-2xl overflow-hidden hover:border-[#d4af37]/50 shadow-sk-md transition-all duration-500 flex flex-col">
                <Link to="/mindev" className="block relative w-full h-[300px] overflow-hidden bg-sk-bg-3">
                  <img src="/bg/mindev-featured.webp" alt="MindEV" className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-700" />
                  <div className="absolute inset-0 bg-gradient-to-t from-sk-bg-2 via-transparent to-transparent opacity-90" />
                  <div className="absolute top-4 left-4 bg-[#0a1128]/80 backdrop-blur-md border border-[#d4af37]/30 px-3 py-1.5 rounded-lg flex items-center gap-2">
                     <Brain size={14} className="text-[#d4af37]" />
                     <span className="text-[10px] font-black uppercase tracking-widest text-[#d4af37]">MindEV IA</span>
                  </div>
                </Link>
                <div className="p-8 flex flex-col flex-1">
                  <h3 className="text-2xl font-black text-white mb-3 group-hover:text-[#d4af37] transition-colors leading-tight">Tu EV+ empieza en tu mente</h3>
                  <p className="text-sk-sm text-sk-text-3 leading-relaxed mb-8 flex-1">Acelera tu aprendizaje sin horas de estudio aburrido. MindEV analiza tus manos y te explica tus aciertos y errores en idioma simple.</p>
                  <Link to="/mindev"><Button className="w-full bg-[#d4af37] text-black hover:bg-[#b5952f] font-black shadow-[0_0_15px_rgba(212,175,55,0.2)]">Quiero saber más</Button></Link>
                </div>
              </div>

              {/* FullNuts */}
              <div className="group bg-sk-bg-2 border border-sk-border-2 rounded-2xl overflow-hidden hover:border-orange-500/50 shadow-sk-md transition-all duration-500 flex flex-col">
                <Link to="/fullnuts" className="block relative w-full h-[300px] overflow-hidden bg-sk-bg-3">
                  <img src="/bg/fullnuts-featured.webp" alt="FullNuts" className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-700" />
                  <div className="absolute inset-0 bg-gradient-to-t from-sk-bg-2 via-transparent to-transparent opacity-90" />
                  <div className="absolute top-4 right-4 bg-black/80 backdrop-blur-md border border-orange-500/30 px-3 py-1.5 rounded-lg flex items-center gap-2">
                     <span className="text-[10px] font-black uppercase tracking-widest text-orange-500">FullNuts</span>
                     <Flame size={14} className="text-orange-500" />
                  </div>
                </Link>
                <div className="p-8 flex flex-col flex-1">
                  <h3 className="text-2xl font-black text-white mb-3 group-hover:text-orange-500 transition-colors leading-tight italic">Viste como juegas.</h3>
                  <p className="text-sk-sm text-sk-text-3 leading-relaxed mb-8 flex-1">La actitud importa. FullNuts diseña streetwear exclusivo para verdaderos tiburones. Calidad premium con envíos a todo Chile.</p>
                  <Link to="/fullnuts"><Button className="w-full bg-gradient-to-r from-orange-500 to-red-600 text-white border-none font-black shadow-[0_0_15px_rgba(249,115,22,0.2)]">Ver Colección</Button></Link>
                </div>
              </div>

            </div>
          </RevealSection>
        </div>
      </section>

      {/* 🔥 Modal Global de Torneos */}
      <TournamentDetailModal
        tournament={selectedTournament}
        isOpen={!!selectedTournament}
        onClose={() => setSelectedTournament(null)}
      />
    </PageShell>
  );
}