import { StatCard } from "../ui/stat-card";
import { formatElo, formatCurrency, formatPercent, formatNumber, calcItm, calcRoi } from "../../lib/format";
import type { PlayerWithRoom } from "../../types";
import { Lock } from "lucide-react"; // 👈 Importamos el candadito

interface PlayerStatsGridProps {
  player: PlayerWithRoom;
  hasAccess?: boolean; // 👈 Nueva prop para controlar el pago
}

export function PlayerStatsGrid({ player, hasAccess = false }: PlayerStatsGridProps) {
  const itm = calcItm(player.total_cashes, player.total_tournaments);
  const roi = calcRoi(player.total_prize_won, player.total_buy_ins_spent);
  const profit = player.total_prize_won - player.total_buy_ins_spent;

  // Función mágica: si no hay acceso, renderiza el número con blur y un candado sutil
  const renderPremiumValue = (val: string) => {
    if (hasAccess) return val;
    return (
      <div className="relative inline-flex items-center">
        <span className="blur-[6px] select-none opacity-60 pointer-events-none">
          {val}
        </span>
        <Lock size={14} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-sk-text-1 opacity-80" />
      </div>
    );
  };

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {/* PÚBLICAS */}
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
      
      {/* PREMIUM (Difuminadas si hasAccess es false) */}
      <StatCard
        label="Cashes"
        value={renderPremiumValue(formatNumber(player.total_cashes))}
      />
      <StatCard
        label="ITM %"
        value={renderPremiumValue(formatPercent(itm))}
        accent="green"
      />
      <StatCard
        label="ROI"
        value={renderPremiumValue(`${roi >= 0 ? "+" : ""}${formatPercent(roi)}`)}
        accent={roi >= 0 ? "green" : "default"}
      />
      <StatCard
        label="Profit"
        value={renderPremiumValue(formatCurrency(Math.abs(profit)))}
        delta={hasAccess ? (profit >= 0 ? "Positivo" : "Negativo") : undefined} // Escondemos el texto delta
        deltaDirection={profit >= 0 ? "up" : "down"} // Mantenemos el color (la flecha)
      />
      <StatCard
        label="Victorias"
        value={renderPremiumValue(formatNumber(player.total_wins))}
        accent="gold"
      />
    </div>
  );
}