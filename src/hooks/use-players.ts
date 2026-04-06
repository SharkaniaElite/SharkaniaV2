// src/hooks/use-players.ts
import { useQuery } from "@tanstack/react-query";
import {
  getPlayers,
  getPlayerById,
  getPlayerBySlug,
  getPlayerEloHistory,
  getPlayerTournamentResults,
  searchPlayers,
  getUnifiedPlayerStats,
  getUnifiedEloHistory,
  getUnifiedTournamentResults,
} from "../lib/api/players";

interface UsePlayersOptions {
  page?: number;
  pageSize?: number;
  search?: string;
  countryCode?: string;
  roomId?: string;
  orderBy?: "elo_rating" | "total_tournaments" | "total_wins";
  orderDir?: "asc" | "desc";
  enabled?: boolean;
}

export function usePlayerBySlug(slug: string | undefined) {
  return useQuery({
    queryKey: ["player-slug", slug],
    queryFn: () => getPlayerBySlug(slug!),
    enabled: !!slug,
    staleTime: 1000 * 60 * 5,
  });
}

// 🔥 Helper para queryKey estable
function buildPlayersKey(filters: UsePlayersOptions) {
  return [
    "players",
    filters.page ?? 1,
    filters.pageSize ?? 20,
    filters.search ?? "",
    filters.countryCode ?? "",
    filters.roomId ?? "",
    filters.orderBy ?? "elo_rating",
    filters.orderDir ?? "desc",
  ];
}

export function usePlayers(options: UsePlayersOptions = {}) {
  const { enabled = true, ...filters } = options;

  return useQuery({
    queryKey: buildPlayersKey(filters),

    queryFn: () => getPlayers(filters),

    enabled,

    // 🔥 UX brutal: mantiene data anterior mientras carga nueva
    placeholderData: (previousData) => previousData,

    // 🔥 Evita refetch innecesarios
    staleTime: 1000 * 60 * 2, // 2 min

    // 🔥 Control fino de retry
    retry: 1,
  });
}

export function usePlayer(id: string | undefined) {
  return useQuery({
    queryKey: ["player", id],
    queryFn: () => getPlayerById(id!),
    enabled: !!id,
    staleTime: 1000 * 60 * 5,
  });
}

export function usePlayerEloHistory(playerId: string | undefined) {
  return useQuery({
    queryKey: ["player-elo-history", playerId],
    queryFn: () => getPlayerEloHistory(playerId!),
    enabled: !!playerId,
    staleTime: 1000 * 60 * 5,
  });
}

export function usePlayerTournamentResults(playerId: string | undefined) {
  return useQuery({
    queryKey: ["player-tournament-results", playerId],
    queryFn: () => getPlayerTournamentResults(playerId!),
    enabled: !!playerId,
    staleTime: 1000 * 60 * 2,
  });
}

export function useSearchPlayers(query: string, limit: number = 10) {
  return useQuery({
    queryKey: ["search-players", query, limit],
    queryFn: () => searchPlayers(query, limit),
    enabled: query.length >= 2,

    // 🔥 búsqueda debe ser rápida, poco cache
    staleTime: 1000 * 30,
  });
}
export function useUnifiedPlayerStats(slug: string | undefined) {
  return useQuery({
    queryKey: ["unified-stats", slug],
    queryFn: () => getUnifiedPlayerStats(slug!),
    enabled: !!slug,
    staleTime: 1000 * 60 * 5,
  });
}

export function useUnifiedEloHistory(slug: string | undefined) {
  return useQuery({
    queryKey: ["unified-elo-history", slug],
    queryFn: () => getUnifiedEloHistory(slug!),
    enabled: !!slug,
    staleTime: 1000 * 60 * 5,
  });
}

export function useUnifiedTournamentResults(profileId: string | undefined) {
  return useQuery({
    queryKey: ["unified-tournament-results", profileId],
    queryFn: () => getUnifiedTournamentResults(profileId!),
    enabled: !!profileId,
    staleTime: 1000 * 60 * 2,
  });
}