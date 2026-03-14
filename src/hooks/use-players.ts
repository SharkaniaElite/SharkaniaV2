// src/hooks/use-players.ts
import { useQuery } from "@tanstack/react-query";
import {
  getPlayers,
  getPlayerById,
  getPlayerEloHistory,
  getPlayerTournamentResults,
  searchPlayers,
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

export function usePlayers(options: UsePlayersOptions = {}) {
  const { enabled = true, ...filters } = options;

  return useQuery({
    queryKey: ["players", filters],
    queryFn: () => getPlayers(filters),
    enabled,
  });
}

export function usePlayer(id: string | undefined) {
  return useQuery({
    queryKey: ["player", id],
    queryFn: () => getPlayerById(id!),
    enabled: !!id,
  });
}

export function usePlayerEloHistory(playerId: string | undefined) {
  return useQuery({
    queryKey: ["player-elo-history", playerId],
    queryFn: () => getPlayerEloHistory(playerId!),
    enabled: !!playerId,
  });
}

export function usePlayerTournamentResults(playerId: string | undefined) {
  return useQuery({
    queryKey: ["player-tournament-results", playerId],
    queryFn: () => getPlayerTournamentResults(playerId!),
    enabled: !!playerId,
  });
}

export function useSearchPlayers(query: string, limit: number = 10) {
  return useQuery({
    queryKey: ["search-players", query],
    queryFn: () => searchPlayers(query, limit),
    enabled: query.length >= 2,
  });
}
