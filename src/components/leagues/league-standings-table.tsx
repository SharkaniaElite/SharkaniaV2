// src/components/leagues/league-standings-table.tsx
import { Link } from "react-router-dom";
import { cn } from "../../lib/cn";
import { getFlag } from "../../lib/countries";
import { FlagIcon } from "../ui/flag-icon";
import { formatElo, formatNumber } from "../../lib/format";
import { RankBadge } from "../ranking/rank-badge";
import { EmptyState } from "../ui/empty-state";
import type { LeagueStandingWithPlayer } from "../../types";

interface LeagueStandingsTableProps {
  standings: LeagueStandingWithPlayer[];
  isLoading: boolean;
}

export function LeagueStandingsTable({ standings, isLoading }: LeagueStandingsTableProps) {
  if (isLoading) {
    return <div className="h-40 bg-sk-bg-2 border border-sk-border-2 rounded-lg animate-pulse" />;
  }

  if (standings.length === 0) {
    return (
      <EmptyState
        icon="📊"
        title="Sin posiciones aún"
        description="La tabla de posiciones se generará cuando se jueguen torneos."
      />
    );
  }

  return (
    <div className="border border-sk-border-2 rounded-lg bg-sk-bg-2 overflow-x-auto">
      <table className="w-full border-collapse text-sk-sm">
        <thead>
          <tr>
            {["#", "Jugador", "Puntos", "Torneos", "Mejor Pos.", "ELO"].map((h, i) => (
              <th
                key={h}
                className={`bg-sk-bg-3 font-mono text-[11px] font-semibold tracking-wide uppercase text-sk-text-2 py-3 px-4 border-b border-sk-border-2 whitespace-nowrap ${
                  i >= 2 ? "text-right" : "text-left"
                }`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {standings.map((s, i) => (
            <tr key={s.id} className="hover:bg-white/[0.02] transition-colors">
              <td className="py-3 px-4 border-b border-sk-border-2">
                <RankBadge rank={i + 1} />
              </td>
              <td className="py-3 px-4 border-b border-sk-border-2">
                <Link
                  to={`/ranking/${s.player_id}`}
                  className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                >
                  <span><FlagIcon countryCode={s.players?.country_code ?? null} /></span>
                  <span className="font-semibold text-sk-text-1">
                    {s.players?.nickname ?? "—"}
                  </span>
                </Link>
              </td>
              <td className="py-3 px-4 border-b border-sk-border-2 text-right font-mono font-bold text-sk-gold">
                {formatNumber(s.total_points)}
              </td>
              <td className="py-3 px-4 border-b border-sk-border-2 text-right font-mono text-sk-text-1">
                {s.tournaments_played}
              </td>
              <td className="py-3 px-4 border-b border-sk-border-2 text-right font-mono text-sk-text-1">
                {s.best_position ? `${s.best_position}°` : "—"}
              </td>
              <td className="py-3 px-4 border-b border-sk-border-2 text-right font-mono text-sk-accent">
                {s.players?.elo_rating ? formatElo(s.players.elo_rating) : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
