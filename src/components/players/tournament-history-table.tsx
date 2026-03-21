// src/components/players/tournament-history-table.tsx
import { Link } from "react-router-dom";
import { cn } from "../../lib/cn";
import { formatCurrency, formatEloChange } from "../../lib/format";
import { format } from "date-fns";

interface TournamentHistoryEntry {
  id: string;
  position: number;
  prize_won: number;
  elo_change: number | null;
  tournaments: {
    id: string;
    name: string;
    buy_in: number;
    start_datetime: string;
    clubs: { id: string; name: string };
  };
}

interface TournamentHistoryTableProps {
  results: TournamentHistoryEntry[];
  isLoading: boolean;
}

export function TournamentHistoryTable({
  results,
  isLoading,
}: TournamentHistoryTableProps) {
  if (isLoading) {
    return (
      <div className="h-40 bg-sk-bg-2 border border-sk-border-2 rounded-lg animate-pulse" />
    );
  }

  if (results.length === 0) {
    return (
      <div className="bg-sk-bg-2 border border-sk-border-2 rounded-lg p-8 text-center">
        <p className="text-sk-text-3 text-sk-sm">
          Sin historial de torneos aún
        </p>
      </div>
    );
  }

  return (
    <div className="border border-sk-border-2 rounded-lg bg-sk-bg-2 overflow-x-auto">
      <table className="w-full border-collapse text-sk-sm">
        <thead>
          <tr>
            {["Fecha", "Torneo", "Club", "Buy-in", "Pos.", "Premio", "ΔELO"].map(
              (h, i) => (
                <th
                  key={h}
                  className={`bg-sk-bg-3 font-mono text-[11px] font-semibold tracking-wide uppercase text-sk-text-2 py-3 px-4 border-b border-sk-border-2 whitespace-nowrap ${
                    i >= 3 ? "text-right" : "text-left"
                  }`}
                >
                  {h}
                </th>
              )
            )}
          </tr>
        </thead>
        <tbody>
          {results.map((r) => (
            <tr
              key={r.id}
              className="transition-colors duration-100 hover:bg-white/[0.02]"
            >
              <td className="py-3 px-4 border-b border-sk-border-2 font-mono text-sk-text-2 text-sk-xs">
                {format(new Date(r.tournaments.start_datetime), "dd/MM/yy")}
              </td>
              <td className="py-3 px-4 border-b border-sk-border-2">
                <Link
                  to={`/tournament/${r.tournaments.id}`}
                  className="font-semibold text-sk-text-1 hover:text-sk-accent transition-colors"
                >
                  {r.tournaments.name}
                </Link>
              </td>
              <td className="py-3 px-4 border-b border-sk-border-2">
                <Link
                  to={`/clubs/${r.tournaments.clubs.id}`}
                  className="text-sk-accent text-sk-xs hover:opacity-80 transition-opacity"
                >
                  {r.tournaments.clubs.name}
                </Link>
              </td>
              <td className="py-3 px-4 border-b border-sk-border-2 text-right font-mono text-sk-text-2">
                {formatCurrency(r.tournaments.buy_in)}
              </td>
              <td className="py-3 px-4 border-b border-sk-border-2 text-right">
                <span
                  className={cn(
                    "font-mono font-bold",
                    r.position === 1
                      ? "text-sk-gold"
                      : r.position <= 3
                        ? "text-sk-text-1"
                        : "text-sk-text-2"
                  )}
                >
                  {r.position}°
                </span>
              </td>
              <td className="py-3 px-4 border-b border-sk-border-2 text-right">
                <span
                  className={cn(
                    "font-mono font-semibold",
                    r.prize_won > 0 ? "text-sk-green" : "text-sk-text-3"
                  )}
                >
                  {r.prize_won > 0 ? formatCurrency(r.prize_won) : "—"}
                </span>
              </td>
              <td className="py-3 px-4 border-b border-sk-border-2 text-right">
                {r.elo_change !== null ? (
                  <span
                    className={cn(
                      "font-mono text-[11px] font-semibold py-0.5 px-1.5 rounded-xs",
                      r.elo_change >= 0
                        ? "text-sk-green bg-sk-green-dim"
                        : "text-sk-red bg-sk-red-dim"
                    )}
                  >
                    {formatEloChange(r.elo_change)}
                  </span>
                ) : (
                  <span className="text-sk-text-3">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
