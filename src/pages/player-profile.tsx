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
  usePlayerBySlug,
  usePlayerEloHistory,
  usePlayerTournamentResults,
  useUnifiedPlayerStats,
  useUnifiedEloHistory,
  useUnifiedTournamentResults,
} from "../hooks/use-players";
import { useFeatureAccess } from "../hooks/use-shop";
import { getCountryName } from "../lib/countries";
import { FlagIcon } from "../components/ui/flag-icon";
import { formatElo } from "../lib/format";
import { ArrowLeft, Info, ShieldCheck, Link2 } from "lucide-react";
import { SEOHead } from "../components/seo/seo-head";
import { useAuthStore } from "../stores/auth-store";

export function PlayerProfilePage() {
  const { playerSlug } = useParams<{ playerSlug: string }>();
  const topRef = useRef<HTMLDivElement>(null);

  // 🔑 Obtenemos el perfil del usuario activo para ver sus privilegios
  const userProfile = useAuthStore((s) => s.profile);
  const isSuperAdmin = userProfile?.role === "super_admin";

  const { data: spyAccess } = useFeatureAccess("cosmetic_extended_stats");

  const hasFullAccess = isSuperAdmin || !!spyAccess?.has_access;
  // Datos del player individual
  const { data: player, isLoading, error } = usePlayerBySlug(playerSlug);

  // Datos unificados (solo retorna algo si tiene aliases vinculados)
  const { data: unifiedStats } = useUnifiedPlayerStats(playerSlug);

  // Decidir si usar historial unificado o individual
  const hasAliases = !!unifiedStats && unifiedStats.alias_count > 1;

  // ELO History: unificado si tiene aliases, individual si no
  const { data: unifiedEloHistory, isLoading: unifiedEloLoading } =
    useUnifiedEloHistory(hasAliases ? playerSlug : undefined);
  const { data: individualEloHistory, isLoading: individualEloLoading } =
    usePlayerEloHistory(!hasAliases ? player?.id : undefined);

  // Tournament Results: unificado si tiene aliases, individual si no
  const { data: unifiedResults, isLoading: unifiedResultsLoading } =
    useUnifiedTournamentResults(
      hasAliases ? unifiedStats?.profile_id : undefined
    );
  const { data: individualResults, isLoading: individualResultsLoading } =
    usePlayerTournamentResults(!hasAliases ? player?.id : undefined);

  // Seleccionar los datos correctos
  const eloHistory = hasAliases
    ? (unifiedEloHistory ?? []).map((e) => ({
        id: `${e.recorded_at}-${e.nickname}`,
        player_id: "",
        tournament_id: "",
        elo_before: Number(e.elo_after) - Number(e.elo_change),
        elo_after: Number(e.elo_after),
        elo_change: Number(e.elo_change),
        recorded_at: e.recorded_at,
      }))
    : individualEloHistory ?? [];

  const eloLoading = hasAliases ? unifiedEloLoading : individualEloLoading;

  const tournamentResults = hasAliases
    ? unifiedResults ?? []
    : individualResults ?? [];
  const resultsLoading = hasAliases
    ? unifiedResultsLoading
    : individualResultsLoading;

  // 🔥 CÁLCULO DE GASTO REAL (ROI & PROFIT FIX)
  // Recorremos el historial y multiplicamos el costo del torneo por las reentradas
  const calculatedBuyInsSpent = tournamentResults.reduce((sum, r: any) => {
    const cost = Number(r.tournaments?.buy_in || 0);
    const count = Number(r.buy_ins_count || 1); // Si no hay dato en torneos antiguos, asume 1 entrada
    return sum + (cost * count);
  }, 0);

  // Si por alguna razón el historial no trae datos (ej: freerolls), hacemos un fallback al dato de la DB
  const dbBuyInsSpent = hasAliases && unifiedStats ? unifiedStats.total_buy_ins_spent : player?.total_buy_ins_spent ?? 0;
  const finalBuyInsSpent = calculatedBuyInsSpent > 0 ? calculatedBuyInsSpent : dbBuyInsSpent;

  // Stats del player: unificadas o individuales
  const displayStats = player
    ? {
        ...player,
        ...(hasAliases && unifiedStats ? {
          total_tournaments: unifiedStats.total_tournaments,
          total_cashes: unifiedStats.total_cashes,
          total_wins: unifiedStats.total_wins,
          total_prize_won: unifiedStats.total_prize_won,
        } : {}),
        elo_rating: hasAliases && eloHistory.length > 0
          ? eloHistory[eloHistory.length - 1]!.elo_after
          : player.elo_rating,
        total_buy_ins_spent: finalBuyInsSpent, // 🔥 Inyectamos el gasto financiero real
      }
    : player;

  // ELO peak unificado
  const unifiedEloPeak = hasAliases && eloHistory.length > 0
    ? Math.max(...eloHistory.map((e) => Number(e.elo_after)))
    : undefined;

  // Scroll to top when playerSlug changes
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    const raf = requestAnimationFrame(() => {
      topRef.current?.scrollIntoView({ block: "start", behavior: "instant" });
    });
    return () => cancelAnimationFrame(raf);
  }, [playerSlug]);

  if (isLoading) {
    return (
      <PageShell>
        <div
          ref={topRef}
          className="pt-20 min-h-screen flex items-center justify-center"
        >
          <Spinner size="lg" />
        </div>
      </PageShell>
    );
  }

  if (error || !player) {
    return (
      <PageShell>
        <div
          ref={topRef}
          className="pt-20 min-h-screen flex flex-col items-center justify-center gap-4"
        >
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

  const profileData = (player as unknown as Record<string, unknown>).profiles as
    | { avatar_url: string | null; display_name: string | null }
    | undefined;
  const avatarUrl = profileData?.avatar_url ?? null;
  const displayName = profileData?.display_name ?? null;
  const cleanNickname = player.nickname.replace(/^\[DEMO\]\s*/, "");

  // ELO a mostrar: unificado o individual
  const displayElo = displayStats?.elo_rating ?? player.elo_rating;
  const displayEloPeak = unifiedEloPeak ?? player.elo_peak;

  return (
    <PageShell>
      <SEOHead
        title={`${cleanNickname} — Perfil`}
        description={`Perfil de ${cleanNickname}. ELO ${Math.round(Number(displayElo)).toLocaleString()}, ${displayStats?.total_tournaments ?? player.total_tournaments} torneos. ${getCountryName(player.country_code)}.`}
        path={`/ranking/${playerSlug}`}
      />
      <div ref={topRef} className="pt-20 pb-16">
        <div className="max-w-[1200px] mx-auto px-6">
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

                {/* Badge de nicknames vinculados */}
                {hasAliases && (
                  <div className="mt-2 flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-sk-accent-dim text-sk-accent text-[11px] font-semibold">
                      <Link2 size={11} />
                      {unifiedStats.alias_count} nicknames vinculados
                    </span>
                    {unifiedStats.aliases.map((alias) => (
                      <Link
                        key={alias.player_id}
                        to={`/ranking/${alias.slug}`}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-sk-bg-4 border border-sk-border-2 text-[10px] font-mono font-semibold text-sk-text-2 hover:text-sk-accent hover:border-sk-accent/30 transition-all"
                      >
                        {alias.nickname}
                        <span className="text-sk-text-4">
                          ({alias.room_name})
                        </span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              <div className="text-right">
                <div className="font-mono text-sk-3xl font-extrabold text-sk-accent tracking-tight leading-none">
                  {formatElo(displayElo)}
                </div>
                {hasAliases && (
                  <span className="text-[10px] font-mono text-sk-accent/60 block mt-0.5">
                    ELO UNIFICADO
                  </span>
                )}
                <Link
                  to="/sistema-elo"
                  className="inline-flex items-center justify-end gap-1.5 font-mono text-[11px] font-semibold text-sk-text-3 hover:text-sk-accent transition-colors mt-1.5 group"
                >
                  <Info
                    size={12}
                    className="group-hover:scale-110 transition-transform"
                  />
                  ¿Qué significa esto?
                </Link>
              </div>
            </div>
          </div>

          {/* Stats Grid con indicador de ByPass para SuperAdmin */}
          <div className="mb-6 relative">
            {isSuperAdmin && (
              <div className="absolute -top-3 right-2 z-10 flex items-center gap-1.5 px-2 py-1 bg-sk-bg-0 border border-sk-border-2 text-sk-text-2 rounded-full text-[9px] font-bold uppercase tracking-widest shadow-sm pointer-events-none">
                <ShieldCheck size={10} className="text-sk-accent" />
                Admin Bypass Activo
              </div>
            )}
            <PlayerStatsGrid
              player={
                displayStats
                  ? {
                      ...displayStats,
                      elo_peak: displayEloPeak,
                    }
                  : player
              }
              hasAccess={hasFullAccess}
            />
          </div>

          {/* ELO Chart */}
          <div className="mb-6">
            {hasAliases && (
              <p className="text-[11px] font-mono text-sk-accent/60 mb-2">
                📈 Gráfica de ELO unificada — combina{" "}
                {unifiedStats.aliases.map((a) => a.nickname).join(" + ")}
              </p>
            )}
            <EloChart history={eloHistory} isLoading={eloLoading} />
          </div>

          {/* Tournament History */}
          <div className="relative">
            {isSuperAdmin && (
              <div className="absolute top-0 right-2 z-10 flex items-center gap-1.5 px-2 py-1 bg-sk-bg-0 border border-sk-border-2 text-sk-text-2 rounded-full text-[9px] font-bold uppercase tracking-widest shadow-sm pointer-events-none">
                <ShieldCheck size={10} className="text-sk-accent" />
                Admin Bypass Activo
              </div>
            )}
            <h3 className="text-sk-md font-bold text-sk-text-1 mb-4">
              🎯 Historial de Torneos
              {hasAliases && (
                <span className="text-sk-xs text-sk-text-3 font-normal ml-2">
                  ({unifiedStats.total_tournaments} torneos combinados)
                </span>
              )}
            </h3>
            <TournamentHistoryTable
              results={tournamentResults as never[]}
              isLoading={resultsLoading}
              hasAccess={hasFullAccess}
            />
          </div>
        </div>
      </div>
    </PageShell>
  );
}
