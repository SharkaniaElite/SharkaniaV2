import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Info, Loader2, ChartNoAxesCombined } from "lucide-react";
import { FlagIcon } from "../ui/flag-icon";
import { formatElo, formatNumber } from "../../lib/format";
import { RankBadge } from "../ranking/rank-badge";
import { EmptyState } from "../ui/empty-state";
import { ArenaLeagueDialog } from "./arena-league-dialog";
import type { LeagueStandingWithPlayer } from "../../types";
import { getPlayerLeaguePointsBreakdown, type PlayerPointsBreakdown } from "../../lib/api/leagues";

interface LeagueStandingsTableProps {
  standings: LeagueStandingWithPlayer[];
  isLoading: boolean;
  leagueId?: string;
}

const HEADERS = [
  { label: "#", align: "left" },
  { label: "Jugador", align: "left" },
  { label: "Club CCP", align: "left" },
  { label: "Puntos", align: "right" },
  { label: "Torneos jugados", align: "right", tooltip: "Cantidad total de torneos jugados. La liga puede sumar solo los mejores resultados." },
  { label: "Mejor pos.", align: "right" },
  { label: "ELO", align: "right" },
] as const;

export function LeagueStandingsTable({ standings, isLoading, leagueId }: LeagueStandingsTableProps) {
  const [selected, setSelected] = useState<{ playerId: string; name: string } | null>(null);
  const [breakdown, setBreakdown] = useState<PlayerPointsBreakdown[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const requestSeq = useRef(0);
  useEffect(() => () => { requestSeq.current += 1; }, []);

  const closeBreakdown = () => {
    requestSeq.current += 1;
    setSelected(null);
  };

  const openBreakdown = async (playerId: string, name: string) => {
    if (!leagueId) return;
    const seq = ++requestSeq.current;
    setSelected({ playerId, name });
    setBreakdown(null);
    setLoadError(false);
    setLoading(true);
    try {
      const data = await getPlayerLeaguePointsBreakdown(leagueId, playerId);
      if (requestSeq.current === seq) setBreakdown(data);
    } catch {
      if (requestSeq.current === seq) setLoadError(true);
    } finally {
      if (requestSeq.current === seq) setLoading(false);
    }
  };

  if (isLoading) return <div className="h-40 bg-sk-bg-2 border border-sk-border-2 rounded-lg animate-pulse" aria-label="Cargando clasificación" />;
  if (!standings.length) return (
    <EmptyState icon="📊" title="Sin posiciones aún" description="La tabla de posiciones se generará cuando se jueguen torneos." />
  );

  const pointsCell = (s: LeagueStandingWithPlayer) => {
    const points = formatNumber(Math.round(s.total_points));
    return leagueId && s.players?.id ? (
      <button
        type="button"
        className="arena-league-points-button"
        onClick={() => openBreakdown(s.players.id, s.players.nickname)}
        aria-label={`Ver desglose de ${points} puntos de ${s.players.nickname}`}
        title="Ver desglose por torneo"
      >
        {points} <ChartNoAxesCombined size={14} aria-hidden="true" />
      </button>
    ) : <span className="arena-league-points-value">{points}</span>;
  };

  return (
    <section className="arena-league-board" aria-label="Clasificación individual de liga">
      <div className="arena-league-board-heading">
        <div>
          <p>POSICIONES / TEMPORADA</p>
          <h2>Clasificación individual</h2>
        </div>
        <span>{formatNumber(standings.length)} jugadores</span>
      </div>

      <div className="arena-league-cards md:hidden">
        {standings.map((s, i) => (
          <article className="arena-league-mobile-card" key={s.id}>
            <div className="arena-league-card-heading">
              <RankBadge rank={i + 1} />
              <Link to={`/ranking/${s.players?.slug ?? s.player_id}`} className="arena-league-card-name">
                <FlagIcon countryCode={s.players?.country_code ?? null} />
                <strong>{s.players?.nickname ?? "Jugador"}</strong>
              </Link>
              <div className="arena-league-mobile-points">
                <small>PUNTOS</small>
                {pointsCell(s)}
              </div>
            </div>
            <div className="arena-league-card-detail">
              <span className="arena-league-club-tag">{s.ccp_club || "Sin club CCP"}</span>
              <dl>
                <div><dt>Torneos</dt><dd>{s.tournaments_played}</dd></div>
                <div><dt>Mejor pos.</dt><dd>{s.best_position ? `${s.best_position}°` : "—"}</dd></div>
                <div><dt>ELO</dt><dd>{s.players?.elo_rating != null ? formatElo(s.players.elo_rating) : "—"}</dd></div>
              </dl>
            </div>
          </article>
        ))}
      </div>

      <div className="arena-league-table-region hidden md:block" role="region" tabIndex={0} aria-label="Tabla de posiciones individuales">
        <table className="arena-league-data-table">
          <thead><tr>{HEADERS.map(h => (
            <th key={h.label} scope="col" className={h.align === "right" ? "text-right" : "text-left"}>
              <span className="arena-league-th">{h.label}
                {"tooltip" in h && <span title={h.tooltip} aria-label={h.tooltip}><Info size={13} aria-hidden="true" /></span>}
              </span>
            </th>
          ))}</tr></thead>
          <tbody>
            {standings.map((s, i) => (
              <tr key={s.id}>
                <td><RankBadge rank={i + 1} /></td>
                <td><Link to={`/ranking/${s.players?.slug ?? s.player_id}`} className="arena-league-player-link">
                  <FlagIcon countryCode={s.players?.country_code ?? null} />
                  <strong>{s.players?.nickname ?? "Jugador"}</strong>
                </Link></td>
                <td><span className="arena-league-club-tag">{s.ccp_club || "Sin club CCP"}</span></td>
                <td className="text-right">{pointsCell(s)}</td>
                <td className="text-right">{s.tournaments_played}</td>
                <td className="text-right">{s.best_position ? `${s.best_position}°` : "—"}</td>
                <td className="text-right arena-league-elo">{s.players?.elo_rating != null ? formatElo(s.players.elo_rating) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected && (
        <ArenaLeagueDialog
          title={selected.name}
          eyebrow="DESGLOSE / PUNTOS DE LIGA"
          onClose={closeBreakdown}
          footer={<p>Los puntos reflejan los registros disponibles de esta liga.</p>}
        >
          {loading ? (
            <p className="arena-league-dialog-status" role="status"><Loader2 size={22} className="animate-spin" /> Consultando registros…</p>
          ) : loadError ? (
            <div className="arena-league-dialog-status" role="alert">No se pudo consultar el desglose. Puedes cerrar e intentarlo nuevamente.</div>
          ) : breakdown?.length ? (
            <div className="arena-league-breakdown-list">
              {breakdown.map(row => (
                <div className="arena-league-breakdown-entry" key={row.id}>
                  <div>
                    <strong>{row.tournament_name}</strong>
                    <span>{new Date(row.date).toLocaleDateString("es-CL", {day: "2-digit", month: "short", year: "numeric"})} · Posición {row.position}°</span>
                  </div>
                  <b>+{formatNumber(row.points)}</b>
                </div>
              ))}
            </div>
          ) : (
            <p className="arena-league-dialog-status">No hay desglose de puntos disponible.</p>
          )}
        </ArenaLeagueDialog>
      )}
    </section>
  );
}
