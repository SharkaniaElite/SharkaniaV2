import { Link } from "react-router-dom";
import { StatCard } from "../ui/stat-card";
import { formatElo, formatCurrency, formatPercent, formatNumber, calcItm, calcRoi } from "../../lib/format";
import type { PlayerWithRoom } from "../../types";
import { Lock, ShoppingBag } from "lucide-react";

interface PlayerStatsGridProps {
  player: PlayerWithRoom;
  hasAccess?: boolean;
  hideUpsell?: boolean;
  financialComparable?: boolean;
  financialCurrency?: string | null;
}

export function PlayerStatsGrid({
  player, hasAccess = false, hideUpsell = false,
  financialComparable = true, financialCurrency,
}: PlayerStatsGridProps) {
  const itm = calcItm(player.total_cashes, player.total_tournaments);
  const roi = calcRoi(player.total_prize_won, player.total_buy_ins_spent);
  const profit = player.total_prize_won - player.total_buy_ins_spent;
  const money = financialCurrency
    ? `${financialCurrency} ${Math.abs(profit).toLocaleString("es-CL", { maximumFractionDigits: 2 })}`
    : formatCurrency(Math.abs(profit));

  const renderPremiumValue = (val: string) => {
    if (hasAccess) return val;
    return (
      <span className="arena-private-stat" aria-label="Disponible con Stats Espía" title="Disponible con Stats Espía">
        <Lock size={13} aria-hidden="true" />
        <span>Bloqueado</span>
      </span>
    );
  };

  const financialDisplay = (value: string) =>
    hasAccess && !financialComparable
      ? <span title="Se necesitan conversiones verificables para combinar monedas">No comparable</span>
      : renderPremiumValue(value);

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
          value={financialDisplay(`${roi >= 0 ? "+" : ""}${formatPercent(roi)}`)}
          accent={roi >= 0 ? "green" : "default"}
        />
        <StatCard
          label="Profit"
          value={financialDisplay(money)}
          delta={hasAccess && financialComparable ? (profit >= 0 ? "Positivo" : "Negativo") : undefined}
          deltaDirection={profit >= 0 ? "up" : "down"}
        />
        <StatCard
          label="Victorias"
          value={renderPremiumValue(formatNumber(player.total_wins))}
          accent="gold"
        />
      </div>

      {hasAccess && !financialComparable && (
        <p role="status" className="text-sk-xs text-sk-text-3 px-2 py-1">
          El historial incluye resultados en distintas monedas o carece de moneda verificable. ROI y Profit global no se calculan sin conversión documentada.
        </p>
      )}

      {/* CTA para desbloquear */}
      {!hasAccess && !hideUpsell && (
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
                🕵️ Stats Espía — Análisis de rendimiento
              </p>
              <p className="text-[11px] text-sk-text-3">
                Consulta rentabilidad, ROI e historial detallado en un solo panel. Las métricas dependen de los resultados registrados; revisa las condiciones.
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
