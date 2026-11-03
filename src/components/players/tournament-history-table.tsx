// src/components/players/tournament-history-table.tsx
import { Link } from "react-router-dom";
import { cn } from "../../lib/cn";
import { formatCurrency, formatEloChange } from "../../lib/format";
import { format } from "date-fns";
import { Lock } from "lucide-react"; 

interface TournamentHistoryEntry {
  id: string;
  position: number;
  prize_won: number;
  elo_change: number | null;
  ccp_club?: string | null; 
  buy_ins_count?: number; 
  tournaments: {
    id: string;
    name: string;
    slug: string;
    buy_in: number;
    start_datetime: string;
    clubs: { id: string; name: string; slug?: string } | null; 
  };
}

interface TournamentHistoryTableProps {
  results: TournamentHistoryEntry[];
  isLoading: boolean;
  hasAccess?: boolean;
  hasMoreHistory?: boolean;
  canLoadMore?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
}

export function TournamentHistoryTable({
  results,
  isLoading,
  hasAccess = false,
  hasMoreHistory = false,
  canLoadMore = false,
  isLoadingMore = false,
  onLoadMore,
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

  // 🔥 NUEVO: Ordenamos los resultados por fecha (más reciente primero)
  const sortedResults = [...results].sort((a, b) => {
    return new Date(b.tournaments.start_datetime).getTime() - new Date(a.tournaments.start_datetime).getTime();
  });

  // Do not render restricted history rows in the DOM when access is absent.
  const displayResults = hasAccess ? sortedResults : sortedResults.slice(0, 2);

  return (
    <div className="arena-history-results relative border border-sk-border-2 rounded-lg bg-sk-bg-2 overflow-hidden">
      <p className="arena-history-scroll-hint md:hidden">Desliza la tabla horizontalmente para consultar sus columnas.</p>
      <div className="arena-history-scroll-region overflow-x-auto" role="region" tabIndex={0} aria-label="Historial de torneos del jugador">
        <table className="arena-history-table w-full border-collapse text-sk-sm min-w-[650px]">
          <thead>
            <tr>
              {["Fecha", "Torneo", "Club", "Buy-in", "Compras", "Pos.", "Premio", "ΔELO"].map(
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
            {displayResults.map((r) => {

              return (
                <tr
                  key={r.id}
                  className="transition-colors duration-100 hover:bg-white/[0.02]"
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
                    {r.ccp_club ? (
                      <div className="flex flex-col">
                        <span className="font-mono text-sk-text-1 font-bold text-[12px] tracking-wide">
                          {r.ccp_club}
                        </span>
                        {r.tournaments.clubs && (
                          <Link
                            to="/como-jugar-en-clubgg"
                            className="text-[10px] text-sk-accent hover:text-sk-text-1 hover:underline transition-all mt-0.5 font-medium"
                          >
                            Vía ClubGG (Unión CCP - {r.tournaments.clubs.name})
                          </Link>
                        )}
                      </div>
                    ) : r.tournaments.clubs ? (
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
                  
                  <td className="py-3 px-4 border-b border-sk-border-2 text-right font-mono text-sk-text-2">
                    {r.buy_ins_count ?? 1}
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

      {hasAccess && canLoadMore && onLoadMore && (
        <div className="arena-history-load-more">
          <span>Mostrando {results.length.toLocaleString("es-CL")} resultados</span>
          <button
            type="button"
            disabled={isLoadingMore}
            onClick={onLoadMore}
            aria-label="Cargar más resultados del historial"
          >
            {isLoadingMore ? "Cargando resultados…" : "Ver 30 resultados más"}
          </button>
        </div>
      )}

      {!hasAccess && (hasMoreHistory || results.length > 2) && (
        <div className="arena-history-paywall">
          <div className="arena-history-paywall-icon" aria-hidden="true"><Lock size={19} /></div>
          <div>
            <strong>Historial completo disponible con Stats Espía</strong>
            <p>Los demás resultados no se muestran sin acceso. Consulta el beneficio en la tienda.</p>
          </div>
          <Link to="/shop#stats-espia" className="arena-history-paywall-link">Ver beneficio</Link>
        </div>
      )}
    </div>
  );
}