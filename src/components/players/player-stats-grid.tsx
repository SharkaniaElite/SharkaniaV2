import { Link } from "react-router-dom";
import { StatCard } from "../ui/stat-card";
import { formatElo, formatCurrency, formatPercent, formatNumber, calcItm, calcRoi } from "../../lib/format";
import type { PlayerWithRoom } from "../../types";
import { Lock, ShoppingBag } from "lucide-react";

interface PlayerStatsGridProps {
  player: PlayerWithRoom;
  hasAccess?: boolean;
}

export function PlayerStatsGrid({ player, hasAccess = false }: PlayerStatsGridProps) {
  const itm = calcItm(player.total_cashes, player.total_tournaments);
  const roi = calcRoi(player.total_prize_won, player.total_buy_ins_spent);
  const profit = player.total_prize_won - player.total_buy_ins_spent;

  const renderPremiumValue = (val: string) => {
    if (hasAccess) return val;
    return (
      <span className="arena-private-stat" aria-label="Disponible con Stats Espía" title="Disponible con Stats Espía">
        <Lock size={13} aria-hidden="true" />
        <span>Bloqueado</span>
      </span>
    );
  };

  return (
    <div className="space-y-3">
      <div className="arena-stats-grid grid grid-cols-2 lg:grid-cols-4 gap-4">
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

        {/* PREMIUM */}
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
          delta={hasAccess ? (profit >= 0 ? "Positivo" : "Negativo") : undefined}
          deltaDirection={profit >= 0 ? "up" : "down"}
        />
        <StatCard
          label="Victorias"
          value={renderPremiumValue(formatNumber(player.total_wins))}
          accent="gold"
        />
      </div>

      {/* CTA para desbloquear */}
      {!hasAccess && (
        <Link
          to="/shop#stats-espia"
          className="arena-stats-upgrade flex items-center justify-between gap-3 bg-sk-bg-3 border border-sk-border-2 hover:border-sk-accent/40 rounded-lg px-4 py-3 transition-all group"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-md bg-sk-accent-dim flex items-center justify-center shrink-0">
              <Lock size={14} className="text-sk-accent" />
            </div>
            <div>
              <p className="text-sk-sm font-semibold text-sk-text-1 group-hover:text-sk-accent transition-colors">
                🕵️ Stats Espía — Ve lo que otros no pueden ver
              </p>
              <p className="text-[11px] text-sk-text-3">
                Desbloquea Cashes, ITM%, ROI, Profit y Victorias de todos los jugadores — consulta las condiciones vigentes en la tienda
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0 text-sk-accent text-sk-xs font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
            <ShoppingBag size={13} />
            Ver Tienda
          </div>
        </Link>
      )}
    </div>
  );
}
