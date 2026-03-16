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
import { useLeague, useLeagueStandings } from "../hooks/use-leagues";
import { useTournamentsByLeague } from "../hooks/use-tournaments";
import { getFlag } from "../lib/countries";
import { FlagIcon } from "../components/ui/flag-icon";
import { ArrowLeft } from "lucide-react";
import type { TournamentWithDetails } from "../types";
import { cn } from "../lib/cn";

type Tab = "standings" | "calendar" | "info";

const statusBadge = {
  upcoming: { label: "Próxima", variant: "accent" as const },
  active: { label: "Activa", variant: "green" as const },
  finished: { label: "Finalizada", variant: "muted" as const },
};

export function LeagueDetailPage() {
  const { leagueId } = useParams<{ leagueId: string }>();
  const { data: league, isLoading } = useLeague(leagueId);
  const { data: standings, isLoading: standingsLoading } = useLeagueStandings(leagueId);
  const { data: tournaments, isLoading: tournamentsLoading } = useTournamentsByLeague(leagueId);
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

  const status = statusBadge[league.status];
  const clubs = league.league_clubs ?? [];
  const rooms = league.league_rooms?.map((lr) => lr.poker_rooms?.name).filter(Boolean) ?? [];

  const TABS: { key: Tab; label: string }[] = [
    { key: "standings", label: "Tabla de Posiciones" },
    { key: "calendar", label: "Calendario" },
    { key: "info", label: "Información" },
  ];

  return (
    <PageShell>
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
                  to={`/clubs/${lc.clubs?.id}`}
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
                {(tournaments ?? []).map((t) => (
                  <TournamentCard
                    key={t.id}
                    tournament={t}
                    onInfoClick={() => setSelectedTournament(t)}
                  />
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
                <p><span className="text-sk-text-1 font-semibold">Salas:</span> {rooms.join(", ")}</p>
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
