// src/components/ranking/ranking-table.tsx
import { PlayerRow } from "./player-row";
import { SkeletonTable } from "../ui/skeleton";
import { EmptyState } from "../ui/empty-state";
import type { PlayerWithRoom } from "../../types";

interface RankingTableProps {
  players: PlayerWithRoom[];
  isLoading: boolean;
  startRank?: number;
}

const HEADERS = ["#", "Jugador", "ELO", "Torneos", "Cashes", "ITM%", "Wins"];

export function RankingTable({
  players,
  isLoading,
  startRank = 1,
}: RankingTableProps) {
  if (isLoading) {
    return <SkeletonTable rows={10} />;
  }

  if (players.length === 0) {
    return (
      <EmptyState
        icon="🃏"
        title="No se encontraron jugadores"
        description="Intenta cambiar los filtros o buscar otro jugador."
      />
    );
  }

  return (
    <div className="border border-sk-border-2 rounded-lg bg-sk-bg-2 overflow-x-auto">
      <table className="w-full border-collapse text-sk-sm">
        <thead>
          <tr>
            {HEADERS.map((h, i) => (
              <th
                key={h}
                className={`bg-sk-bg-3 font-mono text-[11px] font-semibold tracking-wide uppercase text-sk-text-2 py-3 px-4 border-b border-sk-border-2 whitespace-nowrap ${
                  i === 0 ? "w-[50px]" : ""
                } ${i >= 2 ? "text-right" : "text-left"}`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {players.map((player, i) => (
            <PlayerRow
              key={player.id}
              player={player}
              rank={startRank + i}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
