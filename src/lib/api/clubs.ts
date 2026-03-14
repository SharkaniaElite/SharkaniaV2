// src/lib/api/clubs.ts
import { supabase } from "../supabase";
import type { Club, ClubWithRooms, PokerRoom } from "../../types";

export async function getClubs(): Promise<ClubWithRooms[]> {
  const { data, error } = await supabase
    .from("clubs")
    .select("*, club_rooms(poker_rooms(id, name))")
    .eq("is_approved", true)
    .order("name", { ascending: true });

  if (error) throw error;
  return (data as ClubWithRooms[]) ?? [];
}

export async function getClubById(id: string): Promise<ClubWithRooms | null> {
  const { data, error } = await supabase
    .from("clubs")
    .select("*, club_rooms(poker_rooms(id, name))")
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }

  return data as ClubWithRooms;
}

export async function searchClubs(
  query: string,
  limit: number = 10
): Promise<Club[]> {
  const { data, error } = await supabase
    .from("clubs")
    .select("*")
    .eq("is_approved", true)
    .textSearch("fts", query, { type: "websearch" })
    .limit(limit);

  if (error) throw error;
  return (data as Club[]) ?? [];
}

export async function getPokerRooms(): Promise<PokerRoom[]> {
  const { data, error } = await supabase
    .from("poker_rooms")
    .select("*")
    .order("name", { ascending: true });

  if (error) throw error;
  return (data as PokerRoom[]) ?? [];
}
