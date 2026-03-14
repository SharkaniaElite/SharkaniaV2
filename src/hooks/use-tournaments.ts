// src/hooks/use-tournaments.ts
import { useQuery } from "@tanstack/react-query";
import {
  getUpcomingTournaments,
  getAllTournaments,
  getTournamentsByClub,
  getTournamentsByLeague,
  getTournamentById,
  getTournamentResults,
} from "../lib/api/tournaments";

export function useUpcomingTournaments() {
  return useQuery({
    queryKey: ["tournaments", "upcoming"],
    queryFn: getUpcomingTournaments,
  });
}

export function useAllTournaments() {
  return useQuery({
    queryKey: ["tournaments", "all"],
    queryFn: getAllTournaments,
  });
}

export function useTournamentsByClub(clubId: string | undefined) {
  return useQuery({
    queryKey: ["tournaments", "club", clubId],
    queryFn: () => getTournamentsByClub(clubId!),
    enabled: !!clubId,
  });
}

export function useTournamentsByLeague(leagueId: string | undefined) {
  return useQuery({
    queryKey: ["tournaments", "league", leagueId],
    queryFn: () => getTournamentsByLeague(leagueId!),
    enabled: !!leagueId,
  });
}

export function useTournament(id: string | undefined) {
  return useQuery({
    queryKey: ["tournament", id],
    queryFn: () => getTournamentById(id!),
    enabled: !!id,
  });
}

export function useTournamentResults(tournamentId: string | undefined) {
  return useQuery({
    queryKey: ["tournament-results", tournamentId],
    queryFn: () => getTournamentResults(tournamentId!),
    enabled: !!tournamentId,
  });
}
