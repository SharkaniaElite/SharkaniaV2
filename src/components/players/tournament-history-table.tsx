import { Link } from "react-router-dom";
import { cn } from "../../lib/cn";
import { formatCurrency, formatEloChange } from "../../lib/format";
import { format } from "date-fns";
import { Lock } from "lucide-react"; // 👈 Nuevo import

interface TournamentHistoryEntry {
  id: string;
  position: number;
  prize_won: number;
  elo_change: number | null;
  tournaments: {
    id: string;
    name: string;
    slug: string;
    buy_in: number;
    start_datetime: string;
    clubs: { id: string; name: string; slug?: string } | null; // 👈 Le decimos que puede venir nulo
  };
}

interface TournamentHistoryTableProps {
  results: TournamentHistoryEntry[];
  isLoading: boolean;
  hasAccess?: boolean; // 👈 Prop de monetización
}

export function TournamentHistoryTable({
  results,
  isLoading,
  hasAccess = false, // 👈 Por defecto bloqueado
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

  // Si no tiene acceso, solo mostramos 5 filas, difuminando desde la 3ra
  const displayResults = hasAccess ? results : results.slice(0, 5);

  return (
    <div className="relative border border-sk-border-2 rounded-lg bg-sk-bg-2 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sk-sm min-w-[600px]">
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
            {displayResults.map((r, index) => {
              // Si no tiene acceso, aplicamos blur a partir de la fila 3
              const isBlurred = !hasAccess && index >= 2;

              return (
                <tr
                  key={r.id}
                  className={cn(
                    "transition-colors duration-100 hover:bg-white/[0.02]",
                    isBlurred && "blur-[4px] select-none pointer-events-none opacity-50"
                  )}
                >
                  <td className="py-3 px-4 border-b border-sk-border-2 font-mono text-sk-text-2 text-sk-xs">
                    {format(new Date(r.tournaments.start_datetime), "dd/MM/yy")}
                  </td>
                  <td className="py-3 px-4 border-b border-sk-border-2">
                    <Link
                      to={`/tournament/${r.tournaments.slug}`}
                      className="font-semibold text-sk-text-1 hover:text-sk-accent transition-colors"
                    >
                      {r.tournaments.name}
                    </Link>
                  </td>
                  <td className="py-3 px-4 border-b border-sk-border-2">
                    {/* 👇 Verificamos si existe el club antes de intentar armar el Link */}
                    {r.tournaments.clubs ? (
                      <Link
                        to={`/clubs/${r.tournaments.clubs.slug ?? r.tournaments.clubs.id}`}
                        className="text-sk-accent text-sk-xs hover:opacity-80 transition-opacity"
                      >
                        {r.tournaments.clubs.name}
                      </Link>
                    ) : (
                      <span className="text-sk-text-3 text-sk-xs italic">—</span>
                    )}
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
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Overlay con gradiente y botón si no tiene acceso */}
      {!hasAccess && results.length > 2 && (
        <div className="absolute bottom-0 left-0 right-0 h-[140px] bg-gradient-to-t from-sk-bg-2 via-sk-bg-2/80 to-transparent flex items-end justify-center pb-6">
          <div className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-sk-bg-0 border border-sk-border-3 text-sk-sm font-bold text-sk-text-1 shadow-lg">
            <Lock size={14} className="text-sk-accent" />
            Historial protegido
          </div>
        </div>
      )}
    </div>
  );
}