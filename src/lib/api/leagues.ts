// src/lib/api/leagues.ts
import { supabase } from "../supabase";
import type {
  League,
  LeagueWithClubs,
  LeagueStandingWithPlayer,
} from "../../types";

export async function getLeagues(): Promise<LeagueWithClubs[]> {
  const { data, error } = await supabase
    .from("leagues")
    .select(
      "*, league_clubs(is_primary, clubs(id, name, country_code)), league_rooms(poker_rooms(id, name))"
    )
    .order("status", { ascending: true })
    .order("start_date", { ascending: false });

  if (error) throw error;
  return (data as LeagueWithClubs[]) ?? [];
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

  return data as LeagueWithClubs;
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
  return (data as League[]) ?? [];
}
