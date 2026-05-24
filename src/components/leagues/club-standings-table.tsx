// src/components/leagues/club-standings-table.tsx
import { useState, useMemo } from "react";
import { RankBadge } from "../ranking/rank-badge";
import { EmptyState } from "../ui/empty-state";
import { formatNumber } from "../../lib/format";
import { Info, X, Trophy } from "lucide-react";
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

  const tourneyMap = useMemo(() => {
    return tournaments.reduce((acc, t) => {
      acc[t.id] = t;
      return acc;
    }, {} as Record<string, TournamentWithDetails>);
  }, [tournaments]);

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
    <>
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
              <th className="bg-sk-bg-3 font-mono text-[11px] font-semibold tracking-wide uppercase text-sk-text-2 py-3 px-4 border-b border-sk-border-2 text-center">
                Jugadores
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
                  <span title="Suma del mejor puntaje del club por cada fecha jugada." className="cursor-help flex items-center">
                    <Info size={12} className="text-sk-purple/60 hover:text-sk-purple transition-colors" />
                  </span>
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {standings.map((club, i) => (
              <tr 
                key={club.clubName} 
                onClick={() => setSelectedClub(club)}
                className="hover:bg-white/[0.04] transition-colors cursor-pointer group"
                title="Haz clic para ver el detalle de puntos"
              >
                <td className="py-3 px-4 border-b border-sk-border-2">
                  <RankBadge rank={i + 1} />
                </td>
                <td className="py-3 px-4 border-b border-sk-border-2">
                  <span className="font-bold text-sk-text-1 tracking-wide group-hover:text-sk-accent transition-colors">
                    {club.clubName}
                  </span>
                </td>
                <td className="py-3 px-4 border-b border-sk-border-2 text-center">
                  <span className="bg-sk-bg-4 border border-sk-border-2 px-2 py-0.5 rounded font-mono text-sk-xs text-sk-accent font-bold">
                    {club.playerCount}
                  </span>
                </td>
                <td className="py-3 px-4 border-b border-sk-border-2 text-right font-mono text-sk-text-2">
                  {club.datesScored}
                </td>
                <td className="py-3 px-4 border-b border-sk-border-2 text-right font-mono font-black text-sk-purple drop-shadow-[0_0_8px_rgba(168,85,247,0.3)] text-base group-hover:scale-105 transition-transform origin-right">
                  {formatNumber(club.totalPoints)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 🔥 MODAL DE DETALLES MEJORADO (z-[100] en lugar de z-50) */}
      {selectedClub && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 animate-in fade-in duration-200"
          onClick={() => setSelectedClub(null)} 
        >
          <div 
            className="bg-sk-bg-1 border border-sk-border-2 rounded-xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()} 
          >
            {/* Cabecera del Modal */}
            <div className="flex justify-between items-center p-5 border-b border-sk-border-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded bg-sk-bg-3 border border-sk-border-2 flex items-center justify-center text-sk-accent">
                  <Trophy size={20} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-sk-text-1 leading-tight">{selectedClub.clubName}</h3>
                  <p className="text-xs text-sk-text-3 font-mono uppercase tracking-wider">Desglose de Puntos</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedClub(null)}
                className="text-sk-text-3 hover:text-white bg-sk-bg-3 hover:bg-sk-bg-4 p-2 rounded-full transition-colors"
                title="Cerrar"
              >
                <X size={18} />
              </button>
            </div>

            {/* Contenido desplazable */}
            <div className="p-5 overflow-y-auto">
              <div className="bg-sk-bg-2 rounded-lg border border-sk-border-2 overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead className="bg-sk-bg-3 font-mono text-[10px] uppercase text-sk-text-3 border-b border-sk-border-2">
                    <tr>
                      <th className="py-2.5 px-4 font-semibold">Fecha / Torneo</th>
                      <th className="py-2.5 px-4 font-semibold">Mejor Puntaje Aportado Por</th>
                      <th className="py-2.5 px-4 font-semibold text-right text-sk-purple">Puntos</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-sk-border-2">
                    {selectedClub.scoreHistory
                      .sort((a, b) => {
                        const dateA = tourneyMap[a.tournamentId]?.start_datetime || "";
                        const dateB = tourneyMap[b.tournamentId]?.start_datetime || "";
                        return new Date(dateB).getTime() - new Date(dateA).getTime();
                      })
                      .map((score, idx) => {
                        const tInfo = tourneyMap[score.tournamentId];
                        const dateStr = tInfo?.start_datetime 
                          ? new Date(tInfo.start_datetime).toLocaleDateString("es-CL", { day: '2-digit', month: 'short' })
                          : "Fecha N/A";
                        
                        return (
                          <tr key={idx} className="hover:bg-sk-bg-3/50 transition-colors">
                            <td className="py-3 px-4">
                              <div className="flex flex-col">
                                <span className="font-bold text-sk-text-1">{tInfo?.name || "Torneo Desconocido"}</span>
                                <span className="text-[10px] font-mono text-sk-text-3">{dateStr}</span>
                              </div>
                            </td>
                            <td className="py-3 px-4 font-medium text-sk-text-2">
                              {playersMap[score.playerId] || "Jugador Desconocido"}
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-black text-sk-purple">
                              +{formatNumber(score.points)}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                  <tfoot className="bg-sk-bg-3 border-t border-sk-border-2">
                    <tr>
                      <td colSpan={2} className="py-3 px-4 text-right font-bold text-sk-text-2 uppercase text-xs">Total Confirmado:</td>
                      <td className="py-3 px-4 text-right font-mono font-black text-sk-purple text-base">
                        {formatNumber(selectedClub.totalPoints)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Pie del Modal con botón visible de cerrar */}
            <div className="p-4 border-t border-sk-border-2 bg-sk-bg-2 rounded-b-xl flex justify-end">
              <button 
                onClick={() => setSelectedClub(null)}
                className="px-6 py-2 bg-sk-bg-3 hover:bg-sk-bg-4 text-sk-text-1 text-sm font-bold rounded-lg transition-colors border border-sk-border-2"
              >
                Cerrar Detalle
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}