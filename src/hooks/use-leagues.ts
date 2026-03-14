// src/hooks/use-leagues.ts
import { useQuery } from "@tanstack/react-query";
import {
  getLeagues,
  getLeagueById,
  getLeagueStandings,
  searchLeagues,
} from "../lib/api/leagues";

export function useLeagues() {
  return useQuery({
    queryKey: ["leagues"],
    queryFn: getLeagues,
  });
}

export function useLeague(id: string | undefined) {
  return useQuery({
    queryKey: ["league", id],
    queryFn: () => getLeagueById(id!),
    enabled: !!id,
  });
}

export function useLeagueStandings(leagueId: string | undefined) {
  return useQuery({
    queryKey: ["league-standings", leagueId],
    queryFn: () => getLeagueStandings(leagueId!),
    enabled: !!leagueId,
  });
}

export function useSearchLeagues(query: string, limit: number = 10) {
  return useQuery({
    queryKey: ["search-leagues", query],
    queryFn: () => searchLeagues(query, limit),
    enabled: query.length >= 2,
  });
}
