// src/components/leagues/league-standings-table.tsx
import { useState } from "react";
import { Link } from "react-router-dom";
import { FlagIcon } from "../ui/flag-icon";
import { formatElo, formatNumber } from "../../lib/format";
import { RankBadge } from "../ranking/rank-badge";
import { EmptyState } from "../ui/empty-state";
import { Info, X, Loader2 } from "lucide-react";
import type { LeagueStandingWithPlayer } from "../../types";
import { getPlayerLeaguePointsBreakdown, type PlayerPointsBreakdown } from "../../lib/api/leagues";

interface LeagueStandingsTableProps {
  standings: LeagueStandingWithPlayer[];
  isLoading: boolean;
  leagueId?: string; // 🔥 Requerido para buscar el desglose
}

// 🔥 Añadimos Club CCP en la posición deseada
const HEADERS = [
  { label: "#", align: "left" },
  { label: "Jugador", align: "left" },
  { label: "Club CCP", align: "left" }, // 👈 NUEVA COLUMNA
  { label: "Puntos", align: "right" },
  { 
    label: "Torneos Jugados", 
    align: "right", 
    tooltip: "Total de torneos en los que participaste. Para el puntaje final, se suman solo tus mejores resultados según la regla de la liga." 
  },
  { label: "Mejor Pos.", align: "right" },
  { label: "ELO", align: "right" },
];

export function LeagueStandingsTable({ standings, isLoading, leagueId }: LeagueStandingsTableProps) {
  // Estados para controlar el Modal y la data
  const [breakdownModal, setBreakdownModal] = useState<{playerId: string, playerName: string} | null>(null);
  const [breakdownData, setBreakdownData] = useState<PlayerPointsBreakdown[] | null>(null);
  const [isLoadingBreakdown, setIsLoadingBreakdown] = useState(false);

  const handleOpenBreakdown = async (playerId: string, playerName: string) => {
    if (!leagueId) return;
    setBreakdownModal({ playerId, playerName });
    setIsLoadingBreakdown(true);
    try {
      const data = await getPlayerLeaguePointsBreakdown(leagueId, playerId);
      setBreakdownData(data);
    } catch (error) {
      console.error("Error cargando desglose:", error);
    } finally {
      setIsLoadingBreakdown(false);
    }
  };
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
            {HEADERS.map((h) => (
              <th
                key={h.label}
                className={`bg-sk-bg-3 font-mono text-[11px] font-semibold tracking-wide uppercase text-sk-text-2 py-3 px-4 border-b border-sk-border-2 whitespace-nowrap ${
                  h.align === "right" ? "text-right" : "text-left"
                }`}
              >
                <div className={`flex items-center gap-1.5 ${h.align === "right" ? "justify-end" : "justify-start"}`}>
                  {h.label}
                  {h.tooltip && (
                    <span title={h.tooltip} className="cursor-help flex items-center">
                      <Info size={12} className="text-sk-text-4 hover:text-sk-text-2 transition-colors" />
                    </span>
                  )}
                </div>
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
                  to={`/ranking/${(s.players as any)?.slug ?? s.player_id}`}
                  className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                >
                  <span><FlagIcon countryCode={s.players?.country_code ?? null} /></span>
                  <span className="font-semibold text-sk-text-1">
                    {s.players?.nickname ?? "—"}
                  </span>
                </Link>
              </td>
              {/* 🔥 Renderizamos el Club CCP aquí */}
              <td className="py-3 px-4 border-b border-sk-border-2">
                <span className="text-sk-text-2 font-mono text-[11px] bg-sk-bg-3 px-2 py-0.5 rounded border border-sk-border-2">
                  {s.ccp_club || "Sin Club"}
                </span>
              </td>
              <td className="py-3 px-4 border-b border-sk-border-2 text-right font-mono font-bold text-sk-gold">
                {leagueId ? (
                  <button
                    onClick={() => handleOpenBreakdown(s.players!.id, s.players!.nickname)}
                    className="hover:text-sk-accent hover:underline decoration-dotted transition-colors"
                    title="Ver desglose de puntos"
                  >
                    {formatNumber(Math.round(s.total_points))}
                  </button>
                ) : (
                  formatNumber(Math.round(s.total_points))
                )}
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
      {/* 🔥 MODAL DE DESGLOSE DE PUNTOS */}
      {breakdownModal && (
        <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setBreakdownModal(null)}>
          <div className="bg-sk-bg-1 border border-sk-border-2 rounded-xl shadow-2xl w-full max-w-lg flex flex-col max-h-[80vh] animate-fade-in" onClick={(e) => e.stopPropagation()}>
            
            {/* Header del Modal */}
            <div className="flex justify-between items-center p-5 border-b border-sk-border-2 bg-sk-bg-2 rounded-t-xl">
              <h3 className="font-bold text-white text-lg">
                Puntos de <span className="text-sk-accent">{breakdownModal.playerName}</span>
              </h3>
              <button onClick={() => setBreakdownModal(null)} className="text-sk-text-3 hover:text-white transition-colors bg-white/5 hover:bg-white/10 p-1.5 rounded-full">
                <X size={18} />
              </button>
            </div>

            {/* Contenido (Tabla de Torneos) */}
            <div className="p-4 overflow-y-auto custom-scrollbar">
              {isLoadingBreakdown ? (
                <div className="flex flex-col items-center justify-center py-12 text-sk-text-3">
                  <Loader2 size={32} className="animate-spin mb-3 text-sk-accent" />
                  <p className="text-sm font-medium">Buscando auditoría de puntos...</p>
                </div>
              ) : breakdownData && breakdownData.length > 0 ? (
                <table className="w-full text-left text-sk-sm">
                  <thead>
                    <tr className="text-sk-text-3 border-b border-sk-border-2">
                      <th className="pb-3 font-medium px-2">Fecha</th>
                      <th className="pb-3 font-medium">Torneo</th>
                      <th className="pb-3 font-medium text-center">Pos</th>
                      <th className="pb-3 font-medium text-right px-2">Puntos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {breakdownData.map((row) => (
                      <tr key={row.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors">
                        <td className="py-3 px-2 text-sk-text-2">{new Date(row.date).toLocaleDateString()}</td>
                        <td className="py-3 text-white font-medium truncate max-w-[140px] md:max-w-[200px]" title={row.tournament_name}>
                          {row.tournament_name}
                        </td>
                        <td className="py-3 text-sk-text-2 text-center">
                          <span className="bg-sk-bg-3 px-2 py-0.5 rounded">{row.position}°</span>
                        </td>
                        <td className="py-3 text-sk-gold font-bold font-mono text-right px-2">
                          +{formatNumber(row.points)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="text-center text-sk-text-3 py-10">
                  <Info size={40} className="mx-auto mb-3 opacity-20" />
                  <p>No hay puntos registrados o auditables en esta liga.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}