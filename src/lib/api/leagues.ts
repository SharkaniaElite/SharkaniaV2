// src/lib/api/leagues.ts
import { supabase } from "../supabase";
import type {
  League,
  LeagueWithClubs,
  LeagueStandingWithPlayer,
} from "../../types";

// 🔥 INTERCEPTOR: Calcula el estado real basado en la fecha actual
function computeLeagueStatus(league: any): "upcoming" | "active" | "finished" {
  if (!league.start_date || !league.end_date) return league.status;
  
  const now = new Date();
  const start = new Date(league.start_date);
  const end = new Date(league.end_date);
  end.setHours(23, 59, 59, 999); // Expandimos hasta el último segundo del día final

  if (now < start) return "upcoming";
  if (now > end) return "finished";
  return "active";
}

export async function getLeagues(): Promise<LeagueWithClubs[]> {
  const { data, error } = await supabase
    .from("leagues")
    .select(
      "*, league_clubs(is_primary, clubs(id, name, country_code)), league_rooms(poker_rooms(id, name))"
    )
    .order("start_date", { ascending: false });

  if (error) throw error;
  
  // Mapeamos el resultado para sobrescribir el status con la realidad temporal
  return (data || []).map(league => ({
    ...league,
    status: computeLeagueStatus(league)
  })) as LeagueWithClubs[];
}

export async function getLeagueById(
  id: string
): Promise<LeagueWithClubs | null> {
  const { data, error } = await supabase
    .from("leagues")
    .select(
      "*, league_clubs(is_primary, clubs(id, name, country_code)), league_rooms(poker_rooms(id, name))"
    )
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }

  // Sobrescribimos el status
  return {
    ...data,
    status: computeLeagueStatus(data)
  } as LeagueWithClubs;
}

export async function getLeagueStandings(
  leagueId: string
): Promise<LeagueStandingWithPlayer[]> {
  const { data, error } = await supabase
    .from("league_standings")
    .select("*, players(id, nickname, country_code, elo_rating)")
    .eq("league_id", leagueId)
    .order("total_points", { ascending: false });

  if (error) throw error;
  return (data as LeagueStandingWithPlayer[]) ?? [];
}

export async function searchLeagues(
  query: string,
  limit: number = 10
): Promise<League[]> {
  const { data, error } = await supabase
    .from("leagues")
    .select("*")
    .textSearch("fts", query, { type: "websearch" })
    .limit(limit);

  if (error) throw error;
  
  return (data || []).map(league => ({
    ...league,
    status: computeLeagueStatus(league)
  })) as League[];
}