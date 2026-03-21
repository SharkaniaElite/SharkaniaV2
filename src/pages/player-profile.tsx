// src/pages/player-profile.tsx
import { useEffect, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { PageShell } from "../components/layout/page-shell";
import { PlayerStatsGrid } from "../components/players/player-stats-grid";
import { EloChart } from "../components/players/elo-chart";
import { TournamentHistoryTable } from "../components/players/tournament-history-table";
import { Button } from "../components/ui/button";
import { Chip } from "../components/ui/chip";
import { Spinner } from "../components/ui/spinner";
import {
  usePlayer,
  usePlayerEloHistory,
  usePlayerTournamentResults,
} from "../hooks/use-players";
import { getFlag, getCountryName } from "../lib/countries";
import { FlagIcon } from "../components/ui/flag-icon";
import { formatElo } from "../lib/format";
import { ArrowLeft } from "lucide-react";
import { SEOHead } from "../components/seo/seo-head";

export function PlayerProfilePage() {
  const { playerId } = useParams<{ playerId: string }>();
  const topRef = useRef<HTMLDivElement>(null);
  const { data: player, isLoading, error } = usePlayer(playerId);
  const { data: eloHistory, isLoading: eloLoading } =
    usePlayerEloHistory(playerId);
  const { data: tournamentResults, isLoading: resultsLoading } =
    usePlayerTournamentResults(playerId);

  // Scroll to top when playerId changes
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    const raf = requestAnimationFrame(() => {
      topRef.current?.scrollIntoView({ block: "start", behavior: "instant" });
    });
    return () => cancelAnimationFrame(raf);
  }, [playerId]);

  if (isLoading) {
    return (
      <PageShell>
        <div ref={topRef} className="pt-20 min-h-screen flex items-center justify-center">
          <Spinner size="lg" />
        </div>
      </PageShell>
    );
  }

  if (error || !player) {
    return (
      <PageShell>
        <div ref={topRef} className="pt-20 min-h-screen flex flex-col items-center justify-center gap-4">
          <span className="text-5xl">🃏</span>
          <h1 className="text-sk-2xl font-bold text-sk-text-1">
            Jugador no encontrado
          </h1>
          <p className="text-sk-text-2">
            El jugador que buscas no existe o fue eliminado.
          </p>
          <Link to="/ranking">
            <Button variant="accent" size="md">
              <ArrowLeft size={16} />
              Volver al ranking
            </Button>
          </Link>
        </div>
      </PageShell>
    );
  }

  // Get avatar and display name from profiles if available
  const profileData = (player as any).profiles;
  const avatarUrl = profileData?.avatar_url ?? null;
  const displayName = profileData?.display_name ?? null;
  const cleanNickname = player.nickname.replace(/^\[DEMO\]\s*/, "");

  return (
    <PageShell>
      <SEOHead
  title={`${cleanNickname} — Perfil`}
  description={`Perfil de ${cleanNickname}. ELO ${Math.round(Number(player.elo_rating)).toLocaleString()}, ${player.total_tournaments} torneos. ${getCountryName(player.country_code)}.`}
  path={`/ranking/${playerId}`}
/>
      <div ref={topRef} className="pt-20 pb-16">
        <div className="max-w-[1200px] mx-auto px-6">
          {/* Back link */}
          <Link
            to="/ranking"
            className="inline-flex items-center gap-2 text-sk-sm text-sk-text-2 hover:text-sk-text-1 transition-colors mb-6"
          >
            <ArrowLeft size={14} />
            Volver al ranking
          </Link>

          {/* Header */}
          <div className="bg-sk-bg-2 border border-sk-border-2 rounded-lg p-6 mb-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              {/* Avatar */}
              <div className="w-16 h-16 rounded-full bg-sk-bg-4 border-2 border-sk-accent flex items-center justify-center text-sk-2xl font-extrabold text-sk-accent shrink-0 overflow-hidden">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={cleanNickname}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  cleanNickname.charAt(0).toUpperCase()
                )}
              </div>

              {/* Info */}
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1">
                  <h1 className="text-sk-2xl font-extrabold text-sk-text-1 tracking-tight">
                    {cleanNickname}
                  </h1>
                  <FlagIcon countryCode={player.country_code} size={32} />
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  <Chip>{player.poker_rooms?.name ?? "—"}</Chip>
                  <span className="text-sk-xs text-sk-text-2">
                    {getCountryName(player.country_code)}
                  </span>
                  {displayName && (
                    <span className="text-sk-xs text-sk-text-3">
                      · {displayName}
                    </span>
                  )}
                </div>
              </div>

              {/* ELO highlight */}
              <div className="text-right">
                <div className="font-mono text-sk-3xl font-extrabold text-sk-accent tracking-tight leading-none">
                  {formatElo(player.elo_rating)}
                </div>
                <p className="font-mono text-[11px] font-semibold text-sk-text-2 mt-1">
                  ELO Rating
                </p>
              </div>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="mb-6">
            <PlayerStatsGrid player={player} />
          </div>

          {/* ELO Chart */}
          <div className="mb-6">
            <EloChart history={eloHistory ?? []} isLoading={eloLoading} />
          </div>

          {/* Tournament History */}
          <div>
            <h3 className="text-sk-md font-bold text-sk-text-1 mb-4">
              🎯 Historial de Torneos
            </h3>
            <TournamentHistoryTable
              results={(tournamentResults as any) ?? []}
              isLoading={resultsLoading}
            />
          </div>
        </div>
      </div>
    </PageShell>
  );
}
