// src/pages/calendar.tsx
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { PageShell } from "../components/layout/page-shell";
import { TournamentCard } from "../components/calendar/tournament-card";
import { TournamentDetailModal } from "../components/calendar/tournament-detail-modal";
import { Spinner } from "../components/ui/spinner";
import { Button } from "../components/ui/button";
import { FlagIcon } from "../components/ui/flag-icon";
import { useUpcomingTournaments, useCompletedTournaments } from "../hooks/use-tournaments";
import { usePokerRooms, useClubs } from "../hooks/use-clubs";
import { useLeagues } from "../hooks/use-leagues";
import { cn } from "../lib/cn";
import { format } from "date-fns";
import { getCountryName } from "../lib/countries";
import type { TournamentWithDetails } from "../types";
import { SEOHead } from "../components/seo/seo-head";
import { useAuthStore } from "../stores/auth-store";
import { useSharkCoinsBalance } from "../hooks/use-shop";
import { Building2, Swords, CalendarOff, History, Sparkles, CalendarDays } from "lucide-react"; // 👈 Nuevos iconos


type TabKey = "upcoming" | "history";

export function CalendarPage() {
  const [mascotId] = useState(() => Math.floor(Math.random() * 10) + 1);
  const user = useAuthStore((s) => s.user);
  const { data: balance } = useSharkCoinsBalance();
  const [tab, setTab] = useState<TabKey>("upcoming");
  const [selectedTournament, setSelectedTournament] = useState<TournamentWithDetails | null>(null);

  // Scroll to top on mount
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // ── Filter state ──
  const [roomFilter, setRoomFilter] = useState("");
  const [clubFilter, setClubFilter] = useState("");
  const [leagueFilter, setLeagueFilter] = useState("");
  const [countryFilter, setCountryFilter] = useState("");

  // ── Filter data ──
  const { data: rooms } = usePokerRooms();
  const { data: clubs } = useClubs();
  const { data: leagues } = useLeagues();

  // Extract unique countries from clubs
  const countries = Array.from(
    new Set((clubs ?? []).map((c) => c.country_code).filter(Boolean))
  ).sort() as string[];

  // ── Upcoming ──
  const { data: upcoming, isLoading: loadingUpcoming } = useUpcomingTournaments();

  const upcomingFiltered = (upcoming ?? []).filter((t) => {
    if (roomFilter && t.room_id !== roomFilter) return false;
    if (clubFilter && t.club_id !== clubFilter) return false;
    if (leagueFilter && t.league_id !== leagueFilter) return false;
    if (countryFilter) {
      const clubData = t.clubs as any;
      if (clubData?.country_code !== countryFilter) return false;
    }
    return true;
  });

  // Sort: live first, then late_reg, then scheduled by date
  const upcomingSorted = [...upcomingFiltered].sort((a, b) => {
    const order = { live: 0, late_registration: 1, scheduled: 2, completed: 3, cancelled: 4 };
    const aOrder = order[a.status] ?? 5;
    const bOrder = order[b.status] ?? 5;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return new Date(a.start_datetime).getTime() - new Date(b.start_datetime).getTime();
  });

  // ── History ──
  const [historyPage, setHistoryPage] = useState(1);
  const PAGE_SIZE = 20;
  const { data: historyData, isLoading: loadingHistory } = useCompletedTournaments({
    page: historyPage,
    pageSize: PAGE_SIZE,
    roomId: roomFilter || undefined,
    clubId: clubFilter || undefined,
    leagueId: leagueFilter || undefined,
  });

  const historyTournaments = historyData?.data ?? [];
  const historyTotal = historyData?.count ?? 0;
  const historyTotalPages = Math.ceil(historyTotal / PAGE_SIZE);

  // History filtered by country (client-side since DB doesn't join on club.country_code easily)
  const historyFiltered = countryFilter
    ? historyTournaments.filter((t) => {
        const clubData = t.clubs as any;
        return clubData?.country_code === countryFilter;
      })
    : historyTournaments;

  const liveCount = upcomingFiltered.filter((t) => t.status === "live").length;

  // Reset pagination when filters change
  const resetFilters = () => {
    setHistoryPage(1);
  };

  return (
    <PageShell>
    <SEOHead
  title="Calendario de Torneos"
  description="Calendario de torneos de poker en vivo. Horarios, buy-ins, garantizados y countdown en tiempo real para clubes privados."
  path="/calendar"
/>
      <div className="pt-20 pb-16">
        <div className="max-w-[1200px] mx-auto px-6">
          {/* ══ HERO SECTION UNIFICADO ══ */}
          <div className="bg-sk-bg-2 border border-sk-accent/20 rounded-2xl p-6 md:p-10 mb-8 flex flex-col md:flex-row items-center gap-8 relative overflow-hidden group shadow-[0_0_40px_rgba(34,211,238,0.05)]">
            <div className="absolute -top-10 -left-10 w-40 h-40 bg-sk-accent/10 blur-[50px] rounded-full pointer-events-none" />
            <div className="absolute bottom-0 left-1/4 right-1/4 h-px bg-gradient-to-r from-transparent via-sk-accent/30 to-transparent" />

            <div className="shrink-0 relative z-10">
              <div className="relative flex items-center justify-center">
                <div className="absolute inset-0 bg-sk-accent/10 blur-xl rounded-full scale-150 group-hover:bg-sk-accent/20 transition-colors duration-500" />
                <img
                  src={`/mascot/shark-${mascotId}.webp`}
                  alt="Sharkania Quartermaster"
                  className="w-32 h-32 md:w-40 md:h-40 object-contain relative z-10 drop-shadow-[0_10px_15px_rgba(0,0,0,0.5)] transition-transform duration-500 group-hover:scale-105"
                />
              </div>
            </div>

            <div className="flex-1 text-center md:text-left relative z-10">
              <div className="flex items-center gap-2 justify-center md:justify-start mb-3">
                <CalendarDays className="text-sk-accent" size={16} />
                <p className="font-mono text-[11px] font-bold tracking-[0.15em] uppercase text-sk-accent">
                  RED DE TORNEOS ACTIVA
                </p>
                <Sparkles className="text-sk-accent animate-pulse" size={16} />
              </div>

              <h1 className="text-sk-3xl md:text-sk-4xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-white via-sk-text-1 to-sk-text-4 mb-4 leading-none">
                Calendario Global
              </h1>

              <p className="text-sk-sm md:text-sk-base text-sk-text-2 leading-relaxed">
                <span className="font-mono text-sk-text-1">
                  {tab === "upcoming" ? upcomingFiltered.length : historyTotal.toLocaleString("es")}
                </span> torneos {tab === "upcoming" ? "programados en la matriz" : "registrados en el archivo"}.
                
                {liveCount > 0 && tab === "upcoming" && (
                  <span className="ml-3 font-mono text-[11px] text-sk-green animate-pulse uppercase tracking-widest">
                    [ {liveCount} EN VIVO ]
                  </span>
                )}
                {(loadingUpcoming || loadingHistory) && (
                  <span className="ml-3 font-mono text-[11px] text-sk-accent animate-pulse uppercase tracking-widest">
                    [ Sincronizando agenda... ]
                  </span>
                )}
              </p>
            </div>

            {user && (
              <div className="shrink-0 bg-sk-bg-0/50 backdrop-blur-md border border-sk-border-2 rounded-xl p-5 text-center min-w-[160px] relative z-10 group-hover:border-sk-accent/40 transition-colors">
                <p className="text-[10px] font-mono text-sk-text-3 font-bold uppercase tracking-widest mb-3">
                  Tu Reserva
                </p>
                <div className="flex items-center justify-center gap-2 text-sk-3xl font-black text-sk-accent tracking-tighter leading-none mb-1">
                  {balance ?? 0}
                  <img
                    src="https://nhpjzywfzljtlqaigzed.supabase.co/storage/v1/object/public/Logos%20Sharkania/shark-coin-pro.avif"
                    alt="SC"
                    className="w-7 h-7 drop-shadow-md"
                  />
                </div>
              </div>
            )}
          </div>

          {/* 🧠 ENLACES TÁCTICOS */}
          <div className="mb-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Link
              to="/clubs"
              className="group relative overflow-hidden flex items-center gap-4 p-4 rounded-xl border border-sk-border-2 bg-sk-bg-2/50 backdrop-blur-sm hover:bg-sk-bg-3 hover:border-sk-accent/40 hover:shadow-[0_4px_30px_rgba(34,211,238,0.1)] transition-all duration-300"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-sk-accent/0 via-sk-accent/5 to-sk-accent/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
              
              <div className="w-12 h-12 rounded-lg bg-sk-bg-0 border border-sk-border-2 flex items-center justify-center shrink-0 group-hover:border-sk-accent/50 group-hover:bg-sk-accent/10 transition-colors duration-300 relative z-10">
                <Building2 size={20} className="text-sk-accent" />
              </div>
              <div className="flex-1 min-w-0 relative z-10">
                <p className="text-sk-sm font-extrabold text-sk-text-1 group-hover:text-sk-accent transition-colors truncate tracking-tight">
                  Explorar Clubes
                </p>
                <p className="text-[11px] text-sk-text-3 mt-0.5 leading-snug">
                  Encuentra mesas activas en la red global
                </p>
              </div>
            </Link>

            <Link
              to="/register"
              className="group relative overflow-hidden flex items-center gap-4 p-4 rounded-xl border border-sk-border-2 bg-sk-bg-2/50 backdrop-blur-sm hover:bg-sk-bg-3 hover:border-sk-purple/40 hover:shadow-[0_4px_30px_rgba(167,139,250,0.1)] transition-all duration-300"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-sk-purple/0 via-sk-purple/5 to-sk-purple/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
              
              <div className="w-12 h-12 rounded-lg bg-sk-bg-0 border border-sk-border-2 flex items-center justify-center shrink-0 group-hover:border-sk-purple/50 group-hover:bg-sk-purple/10 transition-colors duration-300 relative z-10">
                <Swords size={20} className="text-sk-purple" />
              </div>
              <div className="flex-1 min-w-0 relative z-10">
                <p className="text-sk-sm font-extrabold text-sk-text-1 group-hover:text-sk-purple transition-colors truncate tracking-tight">
                  Portal de Organizadores
                </p>
                <p className="text-[11px] text-sk-text-3 mt-0.5 leading-snug">
                  Sincroniza el calendario de tu club
                </p>
              </div>
            </Link>
          </div>

          {/* Tabs */}
          <div className="flex flex-col gap-4 mb-6">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex gap-1 bg-sk-bg-0 border border-sk-border-2 rounded-md p-0.5">
                <button
                  onClick={() => setTab("upcoming")}
                  className={cn(
                    "px-4 py-1.5 rounded-sm text-sk-sm font-medium transition-all",
                    tab === "upcoming"
                      ? "bg-sk-bg-3 text-sk-text-1 shadow-sk-xs"
                      : "text-sk-text-3 hover:text-sk-text-1"
                  )}
                >
                  Próximos
                  {liveCount > 0 && (
                    <span className="ml-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-sk-green-dim text-sk-green">
                      <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                      {liveCount}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => { setTab("history"); setHistoryPage(1); }}
                  className={cn(
                    "px-4 py-1.5 rounded-sm text-sk-sm font-medium transition-all",
                    tab === "history"
                      ? "bg-sk-bg-3 text-sk-text-1 shadow-sk-xs"
                      : "text-sk-text-3 hover:text-sk-text-1"
                  )}
                >
                  Historial
                  <span className="ml-2 font-mono text-[10px] text-sk-text-4">
                    {historyTotal > 0 ? historyTotal.toLocaleString("es") : ""}
                  </span>
                </button>
              </div>

              {/* Clear filters button */}
              {(roomFilter || clubFilter || leagueFilter || countryFilter) && (
                <button
                  onClick={() => {
                    setRoomFilter("");
                    setClubFilter("");
                    setLeagueFilter("");
                    setCountryFilter("");
                    resetFilters();
                  }}
                  className="text-sk-xs text-sk-accent hover:text-sk-accent-hover transition-colors font-medium"
                >
                  ✕ Limpiar filtros
                </button>
              )}
            </div>

            {/* Filters row */}
            <div className="flex flex-wrap gap-3">
              {/* País */}
              <select
                value={countryFilter}
                onChange={(e) => { setCountryFilter(e.target.value); resetFilters(); }}
                className="bg-sk-bg-2 border border-sk-border-2 rounded-md px-3 py-2 text-sk-sm text-sk-text-1 focus:outline-none focus:border-sk-accent min-w-[160px]"
              >
                <option value="">Todos los países</option>
                {countries.map((cc) => (
                  <option key={cc} value={cc}>
                    {getCountryName(cc) || cc}
                  </option>
                ))}
              </select>

              {/* Club */}
              <select
                value={clubFilter}
                onChange={(e) => { setClubFilter(e.target.value); resetFilters(); }}
                className="bg-sk-bg-2 border border-sk-border-2 rounded-md px-3 py-2 text-sk-sm text-sk-text-1 focus:outline-none focus:border-sk-accent min-w-[180px]"
              >
                <option value="">Todos los clubes</option>
                {(clubs ?? [])
                  .filter((c) => !countryFilter || c.country_code === countryFilter)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name.replace(/^\[DEMO\]\s*/, "")}
                    </option>
                  ))}
              </select>

              {/* Liga */}
              <select
                value={leagueFilter}
                onChange={(e) => { setLeagueFilter(e.target.value); resetFilters(); }}
                className="bg-sk-bg-2 border border-sk-border-2 rounded-md px-3 py-2 text-sk-sm text-sk-text-1 focus:outline-none focus:border-sk-accent min-w-[180px]"
              >
                <option value="">Todas las ligas</option>
                {(leagues ?? []).map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name.replace(/^\[DEMO\]\s*/, "")}
                  </option>
                ))}
              </select>

              {/* Sala */}
              <select
                value={roomFilter}
                onChange={(e) => { setRoomFilter(e.target.value); resetFilters(); }}
                className="bg-sk-bg-2 border border-sk-border-2 rounded-md px-3 py-2 text-sk-sm text-sk-text-1 focus:outline-none focus:border-sk-accent min-w-[160px]"
              >
                <option value="">Todas las salas</option>
                {rooms?.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>
          </div> {/* 👈 ¡ESTE ES EL DIV QUE FALTABA! Cierra el bloque de filtros */}

          {/* ════════════════════════════════════════════════════════
              TAB: PRÓXIMOS
              ════════════════════════════════════════════════════════ */}
          {tab === "upcoming" && (
            <>
              {loadingUpcoming ? (
                <div className="flex justify-center py-20">
                  <Spinner size="lg" />
                </div>
              ) : upcomingSorted.length === 0 ? (
                  <div className="bg-sk-bg-2 border border-sk-border-2 rounded-xl p-12 flex flex-col items-center justify-center text-center">
                  <CalendarOff className="text-sk-text-4 mb-4 opacity-50" size={48} />
                  <h3 className="text-sk-lg font-bold text-sk-text-1 mb-2">No hay torneos próximos</h3>
                  <p className="text-sk-text-3 text-sk-sm max-w-md mx-auto">
                    {roomFilter || clubFilter || leagueFilter || countryFilter
                      ? "No se encontraron torneos con los filtros seleccionados."
                      : "No hay torneos programados por el momento. Vuelve pronto."}
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {upcomingSorted.map((t) => (
                    <TournamentCard
                      key={t.id}
                      tournament={t}
                      onInfoClick={() => setSelectedTournament(t)}
                    />
                  ))}
                </div>
              )}
            </>
          )}

          {/* ════════════════════════════════════════════════════════
              TAB: HISTORIAL
              ════════════════════════════════════════════════════════ */}
          {tab === "history" && (
            <>
              {loadingHistory ? (
                <div className="flex justify-center py-20">
                  <Spinner size="lg" />
                </div>
              ) : historyFiltered.length === 0 ? (
                <div className="bg-sk-bg-2 border border-sk-border-2 rounded-xl p-12 flex flex-col items-center justify-center text-center">
                  <History className="text-sk-text-4 mb-4 opacity-50" size={48} />
                  <h3 className="text-sk-lg font-bold text-sk-text-1 mb-2">Sin historial</h3>
                  <p className="text-sk-text-3 text-sk-sm max-w-md mx-auto">
                    No hay torneos completados con los filtros seleccionados.
                  </p>
                </div>
              ) : (
                <>
                  {/* History Table */}
                  <div className="border border-sk-border-2 rounded-lg bg-sk-bg-2 overflow-x-auto">
                    <table className="w-full border-collapse text-sk-sm">
                      <thead>
                        <tr>
                          {["Fecha", "Torneo", "Club", "Buy-in", "GTD", "Prize Pool", "Tipo", ""].map(
                            (h, i) => (
                              <th
                                key={h || `col-${i}`}
                                className={cn(
                                  "bg-sk-bg-3 font-mono text-[11px] font-semibold tracking-wide uppercase text-sk-text-2 py-3 px-4 border-b border-sk-border-2 whitespace-nowrap",
                                  i >= 3 && i <= 5 ? "text-right" : "text-left"
                                )}
                              >
                                {h}
                              </th>
                            )
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {historyFiltered.map((t) => {
                          const clubData = t.clubs as any;
                          const cleanName = (s: string) =>
                            s.replace(/^\[DEMO\]\s*/, "").replace(/⚠️ DATOS DEMO.*$/, "").trim();
                          const isDemo = (t as any).is_demo;
                          return (
                            <tr
                              key={t.id}
                              className="hover:bg-white/[0.015] transition-colors"
                            >
                              <td className="py-3 px-4 border-b border-sk-border-2 font-mono text-sk-text-2 text-sk-xs whitespace-nowrap">
                                {format(new Date(t.start_datetime), "dd/MM/yy")}
                              </td>
                              <td className="py-3 px-4 border-b border-sk-border-2">
                                <Link
                                  to={`/tournament/${t.slug || t.id}`}
                                  className="font-semibold text-sk-text-1 hover:text-sk-accent transition-colors"
                                >
                                  {cleanName(t.name)}
                                </Link>
                                {isDemo && (
                                  <span className="ml-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-sk-gold-dim text-sk-gold uppercase tracking-wider">
                                    Demo
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-4 border-b border-sk-border-2">
                                {clubData?.id ? (
                                  <Link
                                    to={`/clubs/${clubData.slug ?? clubData.id}`}
                                    className="text-sk-accent text-sk-xs hover:opacity-80 transition-opacity flex items-center gap-1.5"
                                  >
                                    <FlagIcon countryCode={clubData.country_code ?? null} />
                                    {cleanName(clubData.name ?? "")}
                                  </Link>
                                ) : (
                                  <span className="text-sk-text-3 text-sk-xs">—</span>
                                )}
                              </td>
                              <td className="py-3 px-4 border-b border-sk-border-2 text-right font-mono text-sk-text-2">
                                {Number(t.buy_in) === 0 ? (
                                  <span className="text-sk-green font-semibold">FREE</span>
                                ) : (
                                  `$${Number(t.buy_in).toLocaleString("es")}`
                                )}
                              </td>
                              <td className="py-3 px-4 border-b border-sk-border-2 text-right font-mono font-bold text-sk-gold">
                                {t.guaranteed_prize
                                  ? `$${Number(t.guaranteed_prize).toLocaleString("es")}`
                                  : "—"}
                              </td>
                              <td className="py-3 px-4 border-b border-sk-border-2 text-right font-mono font-semibold text-sk-text-1">
                                {t.actual_prize_pool
                                  ? `$${Number(t.actual_prize_pool).toLocaleString("es")}`
                                  : "—"}
                              </td>
                              <td className="py-3 px-4 border-b border-sk-border-2">
                                <span className="font-mono text-[11px] text-sk-text-3">
                                  {t.tournament_type} · {t.game_type}
                                </span>
                              </td>
                              <td className="py-3 px-4 border-b border-sk-border-2">
                                {t.results_uploaded ? (
                                  <Link
                                    to={`/tournament/${t.slug || t.id}`}
                                    className="text-sk-accent text-[11px] font-semibold hover:opacity-80 transition-opacity whitespace-nowrap"
                                  >
                                    Ver resultados →
                                  </Link>
                                ) : (
                                  <span className="text-sk-text-4 text-[11px]">Sin resultados</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  {historyTotalPages > 1 && (
                    <div className="flex items-center justify-between mt-6">
                      <p className="text-sk-xs text-sk-text-3 font-mono">
                        Página {historyPage} de {historyTotalPages} · {historyTotal.toLocaleString("es")} torneos
                      </p>
                      <div className="flex gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                          disabled={historyPage <= 1}
                        >
                          ← Anterior
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setHistoryPage((p) => Math.min(historyTotalPages, p + 1))}
                          disabled={historyPage >= historyTotalPages}
                        >
                          Siguiente →
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>

      <TournamentDetailModal
        tournament={selectedTournament}
        isOpen={!!selectedTournament}
        onClose={() => setSelectedTournament(null)}
      />
    </PageShell>
  );
}
