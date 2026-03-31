// src/pages/tournament-detail.tsx
import { useParams, Link } from "react-router-dom";
import { useEffect, useState } from "react";
import {
  getTournamentById,
  getTournamentResults,
} from "../lib/api/tournaments";
import { PageShell } from "../components/layout/page-shell";
import { Spinner } from "../components/ui/spinner";
import { Badge } from "../components/ui/badge";
import { FlagIcon } from "../components/ui/flag-icon";
import { Button } from "../components/ui/button";
import { formatCurrency } from "../lib/format";
import { cn } from "../lib/cn";
import { ArrowLeft, Clock } from "lucide-react";
import { format } from "date-fns";
import { SEOHead } from "../components/seo/seo-head";

function cleanName(s: string) {
  return s.replace(/^\[DEMO\]\s*/, "").replace(/⚠️ DATOS DEMO.*$/, "").trim();
}

// 🕒 Hook para sincronizar el estado visual
function useTournamentStatus(tournament: any) {
  const [diff, setDiff] = useState(0);

  useEffect(() => {
    if (!tournament) return;
    const targetDate = tournament.status === "late_registration" && tournament.late_reg_end 
      ? tournament.late_reg_end 
      : tournament.start_datetime;

    const update = () => {
      const target = new Date(targetDate).getTime();
      setDiff(Math.max(0, Math.floor((target - Date.now()) / 1000)));
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [tournament]);

  const h = Math.floor(diff / 3600);
  const m = Math.floor((diff % 3600) / 60);
  const s = diff % 60;
  const timeStr = h > 0 
    ? `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` 
    : `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;

  return { timeStr, isExpired: diff <= 0 };
}

export function TournamentDetailPage() {
  const { id } = useParams();

  const [tournament, setTournament] = useState<any>(null);
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // 🛡️ LLAMADA CORRECTA DEL HOOK (Antes de cualquier return)
  const { timeStr, isExpired } = useTournamentStatus(tournament);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      getTournamentById(id),
      getTournamentResults(id),
    ]).then(([tData, rData]) => {
      setTournament(tData);
      setResults(rData);
      setLoading(false);
    });
  }, [id]);

  if (loading) {
    return (
      <PageShell>
        <div className="pt-20 min-h-screen flex items-center justify-center">
          <Spinner size="lg" />
        </div>
      </PageShell>
    );
  }

  if (!tournament) {
    return (
      <PageShell>
        <div className="pt-20 min-h-screen flex flex-col items-center justify-center gap-4">
          <span className="text-5xl">🏆</span>
          <h1 className="text-sk-2xl font-bold text-sk-text-1">Torneo no encontrado</h1>
          <p className="text-sk-text-2">El torneo que buscas no existe.</p>
          <Link to="/calendar">
            <Button variant="accent" size="md"><ArrowLeft size={16} /> Ver calendario</Button>
          </Link>
        </div>
      </PageShell>
    );
  }

  const isLive = tournament.status === "live";
  const isLateReg = tournament.status === "late_registration" && !isExpired;
  const isUpcoming = tournament.status === "scheduled" && !isExpired;

  const isLeague = !!tournament.league_id;
  const isDemo = tournament.is_demo;
  const clubData = tournament.clubs;
  const leagueData = tournament.leagues;
  const startDate = new Date(tournament.start_datetime);

  return (
    <PageShell>
      <SEOHead
  title={`${cleanName(tournament.name)} — Resultados`}
  description={`Resultados del torneo ${cleanName(tournament.name)}. Posiciones, premios y cambios de ELO.`}
  path={`/tournament/${tournament.slug}`} // 👈 ¡El toque maestro!
/>
      <div className="pt-20 pb-16">
        <div className="max-w-[1000px] mx-auto px-6">

          {/* Back link */}
          <Link
            to="/calendar"
            className="inline-flex items-center gap-2 text-sk-sm text-sk-text-2 hover:text-sk-text-1 transition-colors mb-6"
          >
            <ArrowLeft size={14} />
            Volver al calendario
          </Link>

          {/* Header */}
          <div className="bg-sk-bg-2 border border-sk-border-2 rounded-lg p-6 mb-6">
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-sk-2xl font-extrabold text-sk-text-1 tracking-tight">
                  🏆 {cleanName(tournament.name)}
                </h1>
                {isDemo && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-sk-gold-dim text-sk-gold uppercase tracking-wider">
                    ⚠ Demo
                  </span>
                )}
                
                {/* 🛡️ Badges Dinámicos en tiempo real */}
                {isLive ? (
                  <Badge variant="live">EN VIVO</Badge>
                ) : isLateReg ? (
                  <Badge variant="orange" className="gap-1.5 font-mono">
                    <Clock size={12} /> LATE REG: {timeStr}
                  </Badge>
                ) : isUpcoming ? (
                  <Badge variant="accent" className="gap-1.5 font-mono">
                    <Clock size={12} /> INICIA EN: {timeStr}
                  </Badge>
                ) : (
                  <Badge variant="muted">FINALIZADO</Badge>
                )}
              </div>

              {/* Meta info */}
              <div className="flex flex-wrap gap-x-6 gap-y-2 text-sk-xs text-sk-text-2">
                {clubData && (
                  <Link to={`/clubs/${clubData.id}`} className="text-sk-accent hover:opacity-80 transition-opacity flex items-center gap-1.5 font-medium">
                    <FlagIcon countryCode={clubData.country_code ?? null} />
                    {cleanName(clubData.name)}
                  </Link>
                )}
                {leagueData && (
                  <Link to={`/leagues/${tournament.league_id}`} className="text-sk-purple hover:opacity-80 transition-opacity font-medium">
                    🏆 {cleanName(leagueData.name)}
                  </Link>
                )}
                <span className="font-mono text-sk-text-1">
                  📅 {format(startDate, "dd/MM/yyyy · HH:mm")}
                </span>
                {tournament.buy_in !== undefined && (
                  <span className="font-mono">
                    Buy-in: <span className={cn("font-semibold", Number(tournament.buy_in) === 0 ? "text-sk-green" : "text-sk-text-1")}>
                      {Number(tournament.buy_in) === 0 ? "FREE" : formatCurrency(tournament.buy_in)}
                    </span>
                  </span>
                )}
                {tournament.guaranteed_prize && (
                  <span className="font-mono">
                    GTD: <span className="font-bold text-sk-gold">{formatCurrency(tournament.guaranteed_prize)}</span>
                  </span>
                )}
                {tournament.actual_prize_pool && (
                  <span className="font-mono">
                    Prize Pool: <span className="font-bold text-sk-text-1">{formatCurrency(tournament.actual_prize_pool)}</span>
                  </span>
                )}
                <span className="font-mono text-sk-text-3">
                  {tournament.game_type} · {tournament.tournament_type}
                </span>
              </div>

              {!isLeague && (
                <p className="text-sk-xs text-sk-text-3 mt-1">
                  Este torneo no pertenece a una liga — no genera puntos de liga.
                </p>
              )}
            </div>
          </div>

          {/* Results */}
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sk-md font-bold text-sk-text-1">
              🎯 Resultados ({results.length} jugadores)
            </h2>
          </div>

          {results.length === 0 ? (
            <div className="bg-sk-bg-2 border border-sk-border-2 rounded-lg p-8 text-center">
              <p className="text-sk-text-3 text-sk-sm">Sin resultados disponibles para este torneo.</p>
            </div>
          ) : (
            <div className="border border-sk-border-2 rounded-lg bg-sk-bg-2 overflow-x-auto">
              <table className="w-full border-collapse text-sk-sm">
                <thead>
                  <tr>
                    <th className="bg-sk-bg-3 font-mono text-[11px] font-semibold tracking-wide uppercase text-sk-text-2 py-3 px-4 border-b border-sk-border-2 text-left w-[50px]">#</th>
                    <th className="bg-sk-bg-3 font-mono text-[11px] font-semibold tracking-wide uppercase text-sk-text-2 py-3 px-4 border-b border-sk-border-2 text-left">Jugador</th>
                    <th className="bg-sk-bg-3 font-mono text-[11px] font-semibold tracking-wide uppercase text-sk-text-2 py-3 px-4 border-b border-sk-border-2 text-right">Premio</th>
                    <th className="bg-sk-bg-3 font-mono text-[11px] font-semibold tracking-wide uppercase text-sk-text-2 py-3 px-4 border-b border-sk-border-2 text-right">ΔELO</th>
                    {isLeague && (
                      <th className="bg-sk-bg-3 font-mono text-[11px] font-semibold tracking-wide uppercase text-sk-purple py-3 px-4 border-b border-sk-border-2 text-right">Puntos</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {results.map((r) => {
                    const pos = r.position;
                    const eloChange = r.elo_change ? Number(r.elo_change) : null;
                    const prizeWon = r.prize_won ? Number(r.prize_won) : 0;
                    const leaguePoints = r.league_points_earned ? Number(r.league_points_earned) : 0;
                    const playerNickname = r.players?.nickname ?? "—";
                    const playerId = r.players?.id;

                    return (
                      <tr
                        key={r.id || pos}
                        className={cn(
                          "hover:bg-white/[0.015] transition-colors",
                          pos === 1 && "bg-[rgba(251,191,36,0.03)]",
                          pos === 2 && "bg-[rgba(203,213,225,0.02)]",
                          pos === 3 && "bg-[rgba(217,119,6,0.02)]",
                        )}
                      >
                        {/* Position */}
                        <td className="py-3 px-4 border-b border-sk-border-2">
                          <span className={cn(
                            "font-mono font-bold text-sk-sm w-7 h-7 inline-flex items-center justify-center rounded-xs",
                            pos === 1 && "bg-sk-gold-dim text-sk-gold",
                            pos === 2 && "bg-[rgba(203,213,225,0.1)] text-sk-silver",
                            pos === 3 && "bg-[rgba(217,119,6,0.1)] text-sk-bronze",
                            pos > 3 && "text-sk-text-2",
                          )}>
                            {pos}
                          </span>
                        </td>

                        {/* Player */}
                        <td className="py-3 px-4 border-b border-sk-border-2">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-sk-bg-4 border border-sk-border-2 flex items-center justify-center text-[11px] font-bold text-sk-text-3 shrink-0">
                              {cleanName(playerNickname).charAt(0).toUpperCase()}
                            </div>
                            {playerId ? (
                              <Link
                                to={`/ranking/${playerId}`}
                                className="font-semibold text-sk-text-1 hover:text-sk-accent transition-colors"
                              >
                                {cleanName(playerNickname)}
                              </Link>
                            ) : (
                              <span className="font-semibold text-sk-text-1">
                                {cleanName(playerNickname)}
                              </span>
                            )}
                            {r.players?.country_code && (
                              <FlagIcon countryCode={r.players.country_code} />
                            )}
                          </div>
                        </td>

                        {/* Prize */}
                        <td className="py-3 px-4 border-b border-sk-border-2 text-right">
                          <span className={cn("font-mono font-semibold", prizeWon > 0 ? "text-sk-green" : "text-sk-text-3")}>
                            {prizeWon > 0 ? formatCurrency(prizeWon) : "—"}
                          </span>
                        </td>

                        {/* ELO Change */}
                        <td className="py-3 px-4 border-b border-sk-border-2 text-right">
                          {eloChange !== null ? (
                            <span className={cn(
                              "font-mono text-[11px] font-semibold py-0.5 px-1.5 rounded-xs",
                              eloChange >= 0 ? "text-sk-green bg-sk-green-dim" : "text-sk-red bg-sk-red-dim",
                            )}>
                              {eloChange >= 0 ? "+" : ""}{eloChange.toFixed(2)}
                            </span>
                          ) : (
                            <span className="text-sk-text-3">—</span>
                          )}
                        </td>

                        {/* League Points */}
                        {isLeague && (
                          <td className="py-3 px-4 border-b border-sk-border-2 text-right">
                            <span className={cn(
                              "font-mono font-semibold",
                              leaguePoints > 0 ? "text-sk-purple" : "text-sk-text-3"
                            )}>
                              {leaguePoints > 0 ? leaguePoints : "—"}
                            </span>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
}