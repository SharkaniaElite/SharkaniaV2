// src/pages/calendar.tsx
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { PageShell } from "../components/layout/page-shell";
import { TournamentCard } from "../components/calendar/tournament-card";
import { TournamentDetailModal } from "../components/calendar/tournament-detail-modal";
import { Spinner } from "../components/ui/spinner";
import { EmptyState } from "../components/ui/empty-state";
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


type TabKey = "upcoming" | "history";

export function CalendarPage() {
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
          {/* Header */}
          <div className="mb-8">
            <p className="font-mono text-[11px] font-bold tracking-[0.08em] uppercase text-sk-accent mb-3">
              Calendario de Torneos
            </p>
            <h1 className="text-sk-3xl font-extrabold tracking-tight text-sk-text-1 mb-2">
              📅 Torneos
            </h1>
            <p className="text-sk-base text-sk-text-2">
              {tab === "upcoming"
                ? `${upcomingFiltered.length} torneos próximos${liveCount > 0 ? ` · ${liveCount} en vivo` : ""}`
                : `${historyTotal.toLocaleString("es")} torneos completados`}
            </p>
          </div>

          {/* Internal links */}
          <div className="mb-6 flex flex-col sm:flex-row gap-3">
            <Link
              to="/clubs"
              className="flex-1 flex items-center gap-3 px-4 py-3 rounded-lg border border-sk-border-2 bg-sk-bg-2 hover:border-sk-accent/30 hover:bg-white/[0.02] transition-all group"
            >
              <span className="text-lg">🏛️</span>
              <div className="flex-1 min-w-0">
                <p className="text-sk-sm font-semibold text-sk-text-1 group-hover:text-sk-accent transition-colors">
                  Ver todos los clubes
                </p>
                <p className="text-[11px] text-sk-text-3">Encuentra tu próxima mesa</p>
              </div>
            </Link>
            <Link
              to="/register"
              className="flex-1 flex items-center gap-3 px-4 py-3 rounded-lg border border-sk-accent/20 bg-sk-accent-dim hover:bg-sk-accent-glow transition-all group"
            >
              <span className="text-lg">🦈</span>
              <div className="flex-1 min-w-0">
                <p className="text-sk-sm font-semibold text-sk-accent">
                  ¿Administras un club?
                </p>
                <p className="text-[11px] text-sk-text-2">Publica tu calendario gratis</p>
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
                <option value="">🌎 Todos los países</option>
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
                <option value="">🏛️ Todos los clubes</option>
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
                <option value="">🏆 Todas las ligas</option>
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
                <option value="">♠️ Todas las salas</option>
                {rooms?.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>
          </div>

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
                <EmptyState
                  icon="📅"
                  title="No hay torneos próximos"
                  description={
                    roomFilter || clubFilter || leagueFilter || countryFilter
                      ? "No se encontraron torneos con los filtros seleccionados."
                      : "No hay torneos programados por el momento. Vuelve pronto."
                  }
                />
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
                <EmptyState
                  icon="🏆"
                  title="Sin historial"
                  description="No hay torneos completados con los filtros seleccionados."
                />
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
                                  to={`/tournament/${t.slug}`}
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
                                    to={`/clubs/${clubData.id}`}
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
                                    to={`/tournament/${t.slug}`}
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
