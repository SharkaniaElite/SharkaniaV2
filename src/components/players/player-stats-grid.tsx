// src/components/players/player-stats-grid.tsx
import { StatCard } from "../ui/stat-card";
import { formatElo, formatCurrency, formatPercent, formatNumber, calcItm, calcRoi } from "../../lib/format";
import type { PlayerWithRoom } from "../../types";

interface PlayerStatsGridProps {
  player: PlayerWithRoom;
}

export function PlayerStatsGrid({ player }: PlayerStatsGridProps) {
  const itm = calcItm(player.total_cashes, player.total_tournaments);
  const roi = calcRoi(player.total_prize_won, player.total_buy_ins_spent);
  const profit = player.total_prize_won - player.total_buy_ins_spent;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        label="ELO Actual"
        value={formatElo(player.elo_rating)}
        accent="accent"
      />
      <StatCard
        label="ELO Peak"
        value={formatElo(player.elo_peak)}
        accent="gold"
      />
      <StatCard
        label="Torneos"
        value={formatNumber(player.total_tournaments)}
      />
      <StatCard
        label="Cashes"
        value={formatNumber(player.total_cashes)}
      />
      <StatCard
        label="ITM %"
        value={formatPercent(itm)}
        accent="green"
      />
      <StatCard
        label="ROI"
        value={`${roi >= 0 ? "+" : ""}${formatPercent(roi)}`}
        accent={roi >= 0 ? "green" : "default"}
      />
      <StatCard
        label="Profit"
        value={formatCurrency(Math.abs(profit))}
        delta={profit >= 0 ? "Positivo" : "Negativo"}
        deltaDirection={profit >= 0 ? "up" : "down"}
      />
      <StatCard
        label="Victorias"
        value={formatNumber(player.total_wins)}
        accent="gold"
      />
    </div>
  );
}
