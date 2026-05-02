// src/components/leagues/club-standings-table.tsx
import { RankBadge } from "../ranking/rank-badge";
import { EmptyState } from "../ui/empty-state";
import { formatNumber } from "../../lib/format";
import { Info } from "lucide-react";
import type { CCPClubRanking } from "../../lib/api/leagues";

interface ClubStandingsTableProps {
  standings: CCPClubRanking[];
  isLoading: boolean;
}

export function ClubStandingsTable({ standings, isLoading }: ClubStandingsTableProps) {
  if (isLoading) {
    return <div className="h-40 bg-sk-bg-2 border border-sk-border-2 rounded-lg animate-pulse" />;
  }

  if (standings.length === 0) {
    return (
      <EmptyState
        icon="🛡️"
        title="Sin registros de clubes"
        description="Aún no hay puntos registrados por equipos en esta liga."
      />
    );
  }

  return (
    <div className="border border-sk-border-2 rounded-lg bg-sk-bg-2 overflow-x-auto">
      <table className="w-full border-collapse text-sk-sm min-w-[600px]">
        <thead>
          <tr>
            <th className="bg-sk-bg-3 font-mono text-[11px] font-semibold tracking-wide uppercase text-sk-text-2 py-3 px-4 border-b border-sk-border-2 text-left w-16">
              #
            </th>
            <th className="bg-sk-bg-3 font-mono text-[11px] font-semibold tracking-wide uppercase text-sk-text-2 py-3 px-4 border-b border-sk-border-2 text-left">
              Club CCP
            </th>
            <th className="bg-sk-bg-3 font-mono text-[11px] font-semibold tracking-wide uppercase text-sk-text-2 py-3 px-4 border-b border-sk-border-2 text-right">
              <div className="flex items-center justify-end gap-1.5">
                Fechas Puntuadas
                <span title="Cantidad de torneos donde el club sumó puntos." className="cursor-help flex items-center">
                  <Info size={12} className="text-sk-text-4 hover:text-sk-text-2 transition-colors" />
                </span>
              </div>
            </th>
            <th className="bg-sk-bg-3 font-mono text-[11px] font-semibold tracking-wide uppercase text-sk-purple py-3 px-4 border-b border-sk-border-2 text-right">
              <div className="flex items-center justify-end gap-1.5">
                Puntos de Club
                <span title="Suma de los 3 mejores puntajes del club en cada fecha." className="cursor-help flex items-center">
                  <Info size={12} className="text-sk-purple/60 hover:text-sk-purple transition-colors" />
                </span>
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          {standings.map((club, i) => (
            <tr key={club.clubName} className="hover:bg-white/[0.02] transition-colors">
              <td className="py-3 px-4 border-b border-sk-border-2">
                <RankBadge rank={i + 1} />
              </td>
              <td className="py-3 px-4 border-b border-sk-border-2">
                <span className="font-bold text-sk-text-1 tracking-wide">
                  {club.clubName}
                </span>
              </td>
              <td className="py-3 px-4 border-b border-sk-border-2 text-right font-mono text-sk-text-2">
                {club.datesScored}
              </td>
              <td className="py-3 px-4 border-b border-sk-border-2 text-right font-mono font-black text-sk-purple drop-shadow-[0_0_8px_rgba(168,85,247,0.3)] text-base">
                {formatNumber(club.totalPoints)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}