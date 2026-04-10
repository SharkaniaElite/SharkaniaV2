// src/pages/league-detail.tsx
import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { PageShell } from "../components/layout/page-shell";
import { LeagueStandingsTable } from "../components/leagues/league-standings-table";
import { TournamentCard } from "../components/calendar/tournament-card";
import { TournamentDetailModal } from "../components/calendar/tournament-detail-modal";
import { Badge } from "../components/ui/badge";
import { Chip } from "../components/ui/chip";
import { Spinner } from "../components/ui/spinner";
import { Button } from "../components/ui/button";
import { EmptyState } from "../components/ui/empty-state";
import { useLeagueBySlug, useLeagueStandings } from "../hooks/use-leagues";
import { useTournamentsByLeague } from "../hooks/use-tournaments";
import { FlagIcon } from "../components/ui/flag-icon";
import { ArrowLeft, Trophy, Crown } from "lucide-react"; // 👈 Añadido Crown
import type { TournamentWithDetails } from "../types";
import { cn } from "../lib/cn";
import { SEOHead } from "../components/seo/seo-head";
import { formatNumber } from "../lib/format"; // 👈 Importamos formateador de números

type Tab = "standings" | "calendar" | "info";

const statusBadge = {
  upcoming: { label: "Próxima", variant: "accent" as const },
  active: { label: "Activa", variant: "green" as const },
  finished: { label: "Finalizada", variant: "muted" as const },
};

export function LeagueDetailPage() {
  const { leagueSlug } = useParams<{ leagueSlug: string }>();
  const { data: league, isLoading } = useLeagueBySlug(leagueSlug);
  const { data: standings, isLoading: standingsLoading } = useLeagueStandings(league?.id);
  const { data: tournaments, isLoading: tournamentsLoading } = useTournamentsByLeague(league?.id ?? '');
  const [tab, setTab] = useState<Tab>("standings");
  const [selectedTournament, setSelectedTournament] = useState<TournamentWithDetails | null>(null);

  if (isLoading) {
    return (
      <PageShell>
        <div className="pt-20 min-h-screen flex items-center justify-center">
          <Spinner size="lg" />
        </div>
      </PageShell>
    );
  }

  if (!league) {
    return (
      <PageShell>
        <div className="pt-20 min-h-screen flex flex-col items-center justify-center gap-4">
          <span className="text-5xl">🏆</span>
          <h1 className="text-sk-2xl font-bold text-sk-text-1">Liga no encontrada</h1>
          <Link to="/leagues">
            <Button variant="accent" size="md">
              <ArrowLeft size={16} /> Volver a ligas
            </Button>
          </Link>
        </div>
      </PageShell>
    );
  }

  const currentStatus = league.status as "upcoming" | "active" | "finished";
  const status = statusBadge[currentStatus] || { label: league.status, variant: "muted" };
  const clubs = league.league_clubs ?? [];

  const directRooms = league.league_rooms?.map((lr) => lr.poker_rooms?.name).filter(Boolean) ?? [];
  const tournamentRooms = Array.from(new Set((tournaments ?? []).map(t => t.poker_rooms?.name).filter(Boolean)));
  const rooms = directRooms.length > 0 ? directRooms : tournamentRooms;

  // 👑 Detectamos al campeón (El primero en la lista de posiciones)
  const champion = standings && standings.length > 0 ? standings[0] : null;

  const TABS: { key: Tab; label: string }[] = [
    { key: "standings", label: "Tabla de Posiciones" },
    { key: "calendar", label: "Calendario" },
    { key: "info", label: "Información" },
  ];

  return (
    <PageShell>
      <SEOHead
        title={`${league.name} — Liga`}
        description={`Liga de poker ${league.name}. Tabla de posiciones, calendario y resultados.`}
        path={`/leagues/${leagueSlug}`}
      />
      <div className="pt-20 pb-16">
        <div className="max-w-[1200px] mx-auto px-6">
          <Link
            to="/leagues"
            className="inline-flex items-center gap-2 text-sk-sm text-sk-text-2 hover:text-sk-text-1 transition-colors mb-6"
          >
            <ArrowLeft size={14} /> Volver a ligas
          </Link>

          {/* Header */}
          <div className="bg-sk-bg-2 border border-sk-border-2 rounded-lg p-6 mb-6">
            <div className="flex justify-between items-start mb-3">
              <h1 className="text-sk-2xl font-extrabold text-sk-text-1 tracking-tight">
                {league.name}
              </h1>
              <Badge variant={status.variant}>{status.label}</Badge>
            </div>
            {league.description && (
              <p className="text-sk-sm text-sk-text-2 mb-4">{league.description}</p>
            )}
            <div className="flex items-center gap-3 flex-wrap mb-3">
              {league.start_date && league.end_date && (
                <span className="font-mono text-[11px] text-sk-text-2">
                  📅 {league.start_date} — {league.end_date}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap mb-3">
              {clubs.map((lc) => (
                <Link
                  key={lc.clubs?.id}
                  to={`/clubs/${(lc.clubs as any)?.slug ?? lc.clubs?.id}`}
                  className="text-sk-xs text-sk-accent hover:opacity-80 transition-opacity"
                >
                  <FlagIcon countryCode={lc.clubs?.country_code ?? null} /> {lc.clubs?.name}
                  {lc.is_primary && " ★"}
                </Link>
              ))}
            </div>
            <div className="flex gap-2 flex-wrap">
              {rooms.map((r) => (
                <Chip key={r}>{r}</Chip>
              ))}
            </div>
          </div>

          {/* 👑 NUEVO: BANNER DE CAMPEÓN (Solo si la liga terminó) */}
          {currentStatus === "finished" && champion && (
            <div className="bg-gradient-to-r from-sk-gold/10 via-sk-gold/5 to-transparent border border-sk-gold/30 rounded-xl p-6 mb-6 flex items-center gap-5 sm:gap-6 animate-in fade-in zoom-in-95 duration-500 shadow-[0_4px_30px_rgba(250,212,25,0.05)]">
              <div className="w-14 h-14 sm:w-16 sm:h-16 shrink-0 rounded-full bg-sk-bg-0 border-2 border-sk-gold flex items-center justify-center shadow-[0_0_15px_rgba(250,212,25,0.3)] relative overflow-hidden">
                <div className="absolute inset-0 bg-sk-gold/20 animate-pulse" />
                <Crown className="text-sk-gold relative z-10" size={28} />
              </div>
              <div>
                <h2 className="text-[10px] sm:text-sk-xs font-bold text-sk-gold uppercase tracking-widest mb-1 sm:mb-1.5">
                  ¡Liga Finalizada! Campeón Oficial
                </h2>
                <div className="text-sk-xl sm:text-3xl font-extrabold text-sk-text-1 flex items-center gap-3">
                  <FlagIcon countryCode={champion.players?.country_code ?? null} />
                  {/* SEO: Internal link al perfil del jugador */}
                  <Link 
                    to={`/ranking/${(champion.players as any)?.slug ?? champion.player_id}`} 
                    className="hover:text-sk-gold transition-colors"
                  >
                    {champion.players?.nickname}
                  </Link>
                </div>
                <p className="text-[11px] sm:text-sk-sm text-sk-text-2 mt-1.5">
                  Coronado con <strong className="text-sk-text-1">{formatNumber(champion.total_points)} puntos</strong> tras {champion.tournaments_played} fechas jugadas.
                </p>
              </div>
            </div>
          )}

          {/* Mensaje de Regla de Descartes */}
          {league.best_dates_to_count && league.total_dates && (
            <div className="flex items-center gap-3 bg-sk-gold/10 border border-sk-gold/20 text-sk-gold rounded-lg p-3.5 px-5 mb-6 text-sk-sm">
              <Trophy size={18} className="shrink-0" />
              <p>
                <strong className="font-bold mr-1">Regla de Liga:</strong> 
                Se consideran los mejores <strong className="font-extrabold text-sk-text-1">{league.best_dates_to_count} puntajes</strong> de un total de <strong className="font-extrabold text-sk-text-1">{league.total_dates} fechas</strong>.
              </p>
            </div>
          )}

          {/* Tabs */}
          <div className="flex gap-px bg-sk-bg-0 rounded-md p-0.5 border border-sk-border-2 mb-6 overflow-x-auto">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  "text-sk-sm font-medium px-4 py-2 rounded-sm whitespace-nowrap transition-all duration-100",
                  tab === t.key
                    ? "bg-sk-bg-3 text-sk-text-1 shadow-sk-xs"
                    : "text-sk-text-2 hover:text-sk-text-1"
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          {tab === "standings" && (
            <LeagueStandingsTable
              standings={standings ?? []}
              isLoading={standingsLoading}
            />
          )}

          {tab === "calendar" && (
            tournamentsLoading ? (
              <Spinner size="md" />
            ) : (tournaments ?? []).length === 0 ? (
              <EmptyState icon="📅" title="Sin torneos en esta liga" />
            ) : (
              <div className="flex flex-col gap-2">
                {/* 🕒 Torneos Activos (Orden ASCENDENTE: Más próximo arriba) */}
                {(tournaments ?? [])
                  .filter(t => 
                    !["completed", "cancelled"].includes(t.status) && 
                    !(t.status === "late_registration" && t.late_reg_end && new Date(t.late_reg_end) <= new Date())
                  )
                  .sort((a, b) => new Date(a.start_datetime || 0).getTime() - new Date(b.start_datetime || 0).getTime())
                  .map((t) => (
                    <TournamentCard key={t.id} tournament={t} onInfoClick={() => setSelectedTournament(t)} />
                  ))}
                
                {/* ✅ Torneos Finalizados (Orden DESCENDENTE: Más reciente terminado arriba) */}
                {(tournaments ?? [])
                  .filter(t => 
                    t.status === "completed" || 
                    (t.status === "late_registration" && t.late_reg_end && new Date(t.late_reg_end) <= new Date())
                  )
                  .sort((a, b) => new Date(b.start_datetime || 0).getTime() - new Date(a.start_datetime || 0).getTime())
                  .map((t) => (
                    <div key={t.id} className="opacity-60">
                      <TournamentCard tournament={t} onInfoClick={() => setSelectedTournament(t)} />
                    </div>
                  ))}
              </div>
            )
          )}

          {tab === "info" && (
            <div className="bg-sk-bg-2 border border-sk-border-2 rounded-lg p-6">
              <h3 className="text-sk-md font-bold text-sk-text-1 mb-4">Información de la Liga</h3>
              <div className="space-y-3 text-sk-sm text-sk-text-2">
                <p><span className="text-sk-text-1 font-semibold">Nombre:</span> {league.name}</p>
                <p><span className="text-sk-text-1 font-semibold">Estado:</span> {status.label}</p>
                <p><span className="text-sk-text-1 font-semibold">Periodo:</span> {league.start_date} — {league.end_date}</p>
                <p><span className="text-sk-text-1 font-semibold">Clubes:</span> {clubs.map((c) => c.clubs?.name).join(", ")}</p>
                
                {rooms.length > 0 ? (
                  <p><span className="text-sk-text-1 font-semibold">Salas:</span> {rooms.join(", ")}</p>
                ) : (
                  <p><span className="text-sk-text-1 font-semibold">Salas:</span> Por definir</p>
                )}

                {league.rules_url && (
                  <p>
                    <span className="text-sk-text-1 font-semibold">Reglas:</span>{" "}
                    <a href={league.rules_url} target="_blank" rel="noopener noreferrer" className="text-sk-accent hover:opacity-80">
                      Ver reglas →
                    </a>
                  </p>
                )}
              </div>
            </div>
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