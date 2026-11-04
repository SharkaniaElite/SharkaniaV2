import { useMemo, useState } from "react";
import { ChartNoAxesCombined, Shield } from "lucide-react";
import { RankBadge } from "../ranking/rank-badge";
import { EmptyState } from "../ui/empty-state";
import { formatNumber } from "../../lib/format";
import { ArenaLeagueDialog } from "./arena-league-dialog";
import type { CCPClubRanking } from "../../lib/api/leagues";
import type { TournamentWithDetails } from "../../types";

interface ClubStandingsTableProps {
  standings: CCPClubRanking[];
  tournaments: TournamentWithDetails[];
  playersMap: Record<string, string>;
  isLoading: boolean;
}

export function ClubStandingsTable({ standings, tournaments, playersMap, isLoading }: ClubStandingsTableProps) {
  const [selectedClub, setSelectedClub] = useState<CCPClubRanking | null>(null);
  const tournamentMap = useMemo(() => Object.fromEntries(tournaments.map(t => [t.id, t])) as Record<string, TournamentWithDetails>, [tournaments]);
  const sortedHistory = selectedClub?.scoreHistory.slice().sort((a, b) =>
    new Date(tournamentMap[b.tournamentId]?.start_datetime || 0).getTime() -
    new Date(tournamentMap[a.tournamentId]?.start_datetime || 0).getTime()
  ) ?? [];

  if (isLoading) return <div className="h-40 bg-sk-bg-2 border border-sk-border-2 rounded-lg animate-pulse" aria-label="Cargando clasificación de clubes" />;
  if (standings.length === 0) return (
    <EmptyState icon="🛡️" title="Sin registros de clubes" description="Aún no hay puntos registrados por equipos en esta liga." />
  );

  const openButton = (club: CCPClubRanking) => (
    <button
      type="button"
      className="arena-league-points-button"
      onClick={() => setSelectedClub(club)}
      aria-label={`Ver desglose de ${formatNumber(club.totalPoints)} puntos de ${club.clubName}`}
      title="Consultar puntos aportados por fecha"
    >
      {formatNumber(club.totalPoints)}
      <ChartNoAxesCombined size={14} aria-hidden="true" />
    </button>
  );

  return (
    <section className="arena-league-board" aria-label="Clasificación de clubes de liga">
      <div className="arena-league-board-heading">
        <div>
          <p>POSICIONES / CLUBES CCP</p>
          <h2>Clasificación por equipos</h2>
        </div>
        <span>{formatNumber(standings.length)} clubes</span>
      </div>

      <div className="arena-league-cards md:hidden">
        {standings.map((club, i) => (
          <article className="arena-league-mobile-card" key={club.clubName}>
            <div className="arena-league-card-heading">
              <RankBadge rank={i + 1} />
              <div className="arena-league-card-name">
                <Shield size={19} aria-hidden="true" />
                <strong>{club.clubName}</strong>
              </div>
              <div className="arena-league-mobile-points">
                <small>PUNTOS</small>
                {openButton(club)}
              </div>
            </div>
            <div className="arena-league-card-detail">
              <dl className="arena-league-club-metrics">
                <div><dt>Jugadores</dt><dd>{club.playerCount}</dd></div>
                <div><dt>Fechas puntuadas</dt><dd>{club.datesScored}</dd></div>
                <div><dt>Detalles</dt><dd><button type="button" onClick={() => setSelectedClub(club)} className="arena-league-detail-button">Ver fechas</button></dd></div>
              </dl>
            </div>
          </article>
        ))}
      </div>

      <div className="arena-league-table-region hidden md:block" role="region" tabIndex={0} aria-label="Tabla de clasificación de clubes">
        <table className="arena-league-data-table">
          <thead>
            <tr>
              <th scope="col">#</th>
              <th scope="col">Club CCP</th>
              <th scope="col" className="text-right">Jugadores</th>
              <th scope="col" className="text-right" title="Fechas en las que el club aportó puntos">Fechas puntuadas</th>
              <th scope="col" className="text-right" title="Suma del mejor aporte del club por fecha">Puntos del club</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((club, i) => (
              <tr key={club.clubName}>
                <td><RankBadge rank={i + 1} /></td>
                <td><span className="arena-league-player-link"><Shield size={17} aria-hidden="true" /><strong>{club.clubName}</strong></span></td>
                <td className="text-right">{club.playerCount}</td>
                <td className="text-right">{club.datesScored}</td>
                <td className="text-right">{openButton(club)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedClub && (
        <ArenaLeagueDialog
          title={selectedClub.clubName}
          eyebrow="DESGLOSE / CLUB CCP"
          onClose={() => setSelectedClub(null)}
          footer={<p>Total registrado: <strong>{formatNumber(selectedClub.totalPoints)} puntos</strong></p>}
        >
          {sortedHistory.length ? (
            <div className="arena-league-breakdown-list">
              {sortedHistory.map((score) => {
                const tournament = tournamentMap[score.tournamentId];
                return (
                  <div className="arena-league-breakdown-entry" key={score.tournamentId}>
                    <div>
                      <strong>{tournament?.name ?? "Torneo sin identificar"}</strong>
                      <span>
                        {tournament?.start_datetime
                          ? new Date(tournament.start_datetime).toLocaleDateString("es-CL", {day:"2-digit",month:"short",year:"numeric"})
                          : "Sin fecha"}
                        {" · Aportó: "}{playersMap[score.playerId] ?? "Jugador no identificado"}
                      </span>
                    </div>
                    <b>+{formatNumber(score.points)}</b>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="arena-league-dialog-status">Todavía no hay fechas con puntos disponibles para este club.</p>
          )}
        </ArenaLeagueDialog>
      )}
    </section>
  );
}
