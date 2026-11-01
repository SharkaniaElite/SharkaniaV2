// src/hooks/use-tournaments.ts
import { useQuery } from "@tanstack/react-query";
import {
  getUpcomingTournaments,
  getAllTournaments,
  getCompletedTournaments,
  getTournamentsByClub,
  getTournamentsByLeague,
  getTournamentResults,
  getTournamentById,
} from "../lib/api/tournaments";

export function useUpcomingTournaments() {
  return useQuery({
    queryKey: ["tournaments", "upcoming"],
    queryFn: getUpcomingTournaments,
  });
}

export function useCompletedTournaments(options?: {
  page?: number;
  pageSize?: number;
  clubId?: string;
  leagueId?: string;
  roomId?: string;
}) {
  return useQuery({
    queryKey: ["tournaments", "completed", options],
    queryFn: () => getCompletedTournaments(options),
    placeholderData: (prev) => prev, // keep previous data while loading next page
  });
}

export function useAllTournaments() {
  return useQuery({
    queryKey: ["tournaments", "all"],
    queryFn: getAllTournaments,
  });
}

export function useTournamentsByClub(clubId: string, publicOnly = false) {
  return useQuery({
    queryKey: ["tournaments", "club", clubId, publicOnly],
    queryFn: () => getTournamentsByClub(clubId, publicOnly),
    enabled: !!clubId,
  });
}

export function useTournamentsByLeague(leagueId: string, publicOnly = false) {
  return useQuery({
    queryKey: ["tournaments", "league", leagueId, publicOnly],
    queryFn: () => getTournamentsByLeague(leagueId, publicOnly),
    enabled: !!leagueId,
  });
}

export function useTournamentResults(tournamentId: string) {
  return useQuery({
    queryKey: ["tournament-results", tournamentId],
    queryFn: () => getTournamentResults(tournamentId),
    enabled: !!tournamentId,
  });
}

export function useTournamentById(id: string) {
  return useQuery({
    queryKey: ["tournament", id],
    queryFn: () => getTournamentById(id),
    enabled: !!id,
  });
}
