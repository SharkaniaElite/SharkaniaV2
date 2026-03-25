// src/lib/api/players.ts
import { supabase } from "../supabase";
import type {
  Player,
  PlayerWithRoom,
  EloHistory,
  TournamentResult,
  PaginatedResponse,
} from "../../types";

interface PlayersFilters {
  page?: number;
  pageSize?: number;
  search?: string;
  countryCode?: string;
  roomId?: string;
  orderBy?: "elo_rating" | "total_tournaments" | "total_wins";
  orderDir?: "asc" | "desc";
}

// 🔥 Query base reutilizable (evita inconsistencias)
const BASE_PLAYER_SELECT = `
  *,
  poker_rooms(name),
  profiles (
    id,
    avatar_url,
    display_name
  )
`;

export async function getPlayers(
  filters: PlayersFilters = {}
): Promise<PaginatedResponse<PlayerWithRoom>> {
  const {
    page = 1,
    pageSize = 20,
    search,
    countryCode,
    roomId,
    orderBy = "elo_rating",
    orderDir = "desc",
  } = filters;

  let query = supabase
    .from("players")
    .select(BASE_PLAYER_SELECT, { count: "exact" });

  if (search) {
    query = query.ilike("nickname", `%${search}%`);
  }

  if (countryCode) {
    query = query.eq("country_code", countryCode);
  }

  if (roomId) {
    query = query.eq("room_id", roomId);
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await query
    .order(orderBy, { ascending: orderDir === "asc" })
    .range(from, to);

  if (error) throw error;

  const total = count ?? 0;

  return {
    data: (data as PlayerWithRoom[]) ?? [],
    count: total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

export async function getPlayerById(
  id: string
): Promise<PlayerWithRoom | null> {
  const { data, error } = await supabase
    .from("players")
    .select(BASE_PLAYER_SELECT)
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }

  return data as PlayerWithRoom;
}

export async function getPlayerEloHistory(
  playerId: string
): Promise<EloHistory[]> {
  const { data, error } = await supabase
    .from("elo_history")
    .select("*")
    .eq("player_id", playerId)
    .order("recorded_at", { ascending: true });

  if (error) throw error;
  return (data as EloHistory[]) ?? [];
}

export async function getPlayerTournamentResults(
  playerId: string
): Promise<
  (TournamentResult & {
    tournaments: {
      id: string;
      name: string;
      buy_in: number;
      start_datetime: string;
      clubs: { id: string; name: string };
    };
  })[]
> {
  const { data, error } = await supabase
    .from("tournament_results")
    .select(
      "*, tournaments(id, name, buy_in, start_datetime, clubs(id, name))"
    )
    .eq("player_id", playerId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function searchPlayers(
  query: string,
  limit: number = 10
): Promise<PlayerWithRoom[]> {
  const { data, error } = await supabase
    .from("players")
    .select(BASE_PLAYER_SELECT)
    .ilike("nickname", `%${query}%`)
    .limit(limit);

  if (error) throw error;
  return (data as PlayerWithRoom[]) ?? [];
}

/**
 * Actualiza los datos de un jugador en la tabla 'players'.
 * Permite corregir nicknames de forma global.
 */
export async function updatePlayer(
  id: string,
  updates: Partial<Player>
): Promise<PlayerWithRoom> {
  const { data, error } = await supabase
    .from("players")
    .update(updates)
    .eq("id", id)
    .select(BASE_PLAYER_SELECT)
    .single();

  if (error) throw error;
  return data as PlayerWithRoom;
}