// src/components/leagues/league-standings-table.tsx
import { Link } from "react-router-dom";
import { FlagIcon } from "../ui/flag-icon";
import { formatElo, formatNumber } from "../../lib/format";
import { RankBadge } from "../ranking/rank-badge";
import { EmptyState } from "../ui/empty-state";
import { Info } from "lucide-react";
import type { LeagueStandingWithPlayer } from "../../types";

interface LeagueStandingsTableProps {
  standings: LeagueStandingWithPlayer[];
  isLoading: boolean;
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