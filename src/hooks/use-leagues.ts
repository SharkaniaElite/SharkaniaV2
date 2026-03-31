// src/hooks/use-leagues.ts
import { useQuery } from "@tanstack/react-query";
import {
  getLeagues,
  getLeagueById,
  getLeagueBySlug,
  searchLeagues,
  getLeagueStandings, // 🔥 Importamos la función de la API
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

export function useLeagueBySlug(slug: string | undefined) {
  return useQuery({
    queryKey: ["league-slug", slug],
    queryFn: () => getLeagueBySlug(slug!),
    enabled: !!slug,
  });
}

export function useLeagueStandings(leagueId?: string) {
  return useQuery({
    queryKey: ["league-standings", leagueId],
    // 🔥 Delegamos la llamada a la API unificada
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