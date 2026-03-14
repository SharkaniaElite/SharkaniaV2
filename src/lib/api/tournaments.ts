// src/lib/api/tournaments.ts
import { supabase } from "../supabase";
import type {
  TournamentWithDetails,
  TournamentResultWithPlayer,
} from "../../types";

export async function getUpcomingTournaments(): Promise<
  TournamentWithDetails[]
> {
  const { data, error } = await supabase
    .from("tournaments")
    .select("*, clubs(id, name, country_code), leagues(id, name), poker_rooms(name)")
    .in("status", ["scheduled", "live", "late_registration"])
    .order("start_datetime", { ascending: true });

  if (error) throw error;
  return (data as TournamentWithDetails[]) ?? [];
}

export async function getAllTournaments(): Promise<TournamentWithDetails[]> {
  const { data, error } = await supabase
    .from("tournaments")
    .select("*, clubs(id, name, country_code), leagues(id, name), poker_rooms(name)")
    .order("start_datetime", { ascending: false });

  if (error) throw error;
  return (data as TournamentWithDetails[]) ?? [];
}

export async function getTournamentsByClub(
  clubId: string
): Promise<TournamentWithDetails[]> {
  const { data, error } = await supabase
    .from("tournaments")
    .select("*, clubs(id, name, country_code), leagues(id, name), poker_rooms(name)")
    .eq("club_id", clubId)
    .order("start_datetime", { ascending: false });

  if (error) throw error;
  return (data as TournamentWithDetails[]) ?? [];
}

export async function getTournamentsByLeague(
  leagueId: string
): Promise<TournamentWithDetails[]> {
  const { data, error } = await supabase
    .from("tournaments")
    .select("*, clubs(id, name, country_code), leagues(id, name), poker_rooms(name)")
    .eq("league_id", leagueId)
    .order("start_datetime", { ascending: false });

  if (error) throw error;
  return (data as TournamentWithDetails[]) ?? [];
}

export async function getTournamentById(
  id: string
): Promise<TournamentWithDetails | null> {
  const { data, error } = await supabase
    .from("tournaments")
    .select("*, clubs(id, name, country_code), leagues(id, name), poker_rooms(name)")
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }

  return data as TournamentWithDetails;
}

export async function getTournamentResults(
  tournamentId: string
): Promise<TournamentResultWithPlayer[]> {
  const { data, error } = await supabase
    .from("tournament_results")
    .select("*, players(id, nickname, country_code)")
    .eq("tournament_id", tournamentId)
    .order("position", { ascending: true });

  if (error) throw error;
  return (data as TournamentResultWithPlayer[]) ?? [];
}
