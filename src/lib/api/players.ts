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

  const from = (page - 1) * pageSize;

  // 👇 Llamamos a la función SQL que agrupa los alias y trae el unified_elo
  const { data, error } = await supabase.rpc("get_unified_ranking", {
    p_search: search || null,
    p_country: countryCode || null,
    p_room: roomId || null,
    p_order_by: orderBy,
    p_order_dir: orderDir,
    p_limit: pageSize,
    p_offset: from,
  });

  if (error) throw error;

  // Extraemos el total de jugadores agrupados que viene en la primera fila
  const total = data && data.length > 0 ? Number(data[0].total_count) : 0;

  return {
    data: (data as any) ?? [],
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

export async function getPlayerBySlug(
  slug: string
): Promise<PlayerWithRoom | null> {
  const { data, error } = await supabase
    .from("players")
    .select(BASE_PLAYER_SELECT)
    .eq("slug", slug)
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
      slug: string;
      buy_in: number;
      start_datetime: string;
      clubs: { id: string; name: string; slug: string };
    };
  })[]
> {
  const { data, error } = await supabase
    .from("tournament_results")
    .select(
      "*, tournaments(id, name, slug, buy_in, start_datetime, clubs(id, name, slug))"
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

// ══════════════════════════════════════════════════════════
// UNIFIED PLAYER STATS — Para merge de nicknames vinculados
// ══════════════════════════════════════════════════════════

export interface UnifiedPlayerStats {
  profile_id: string;
  primary_player_id: string;
  alias_count: number;
  total_tournaments: number;
  total_cashes: number;
  total_wins: number;
  total_prize_won: number;
  total_buy_ins_spent: number;
  aliases: Array<{
    player_id: string;
    nickname: string;
    slug: string;
    room_id: string;
    elo_rating: number;
    total_tournaments: number;
    room_name: string;
  }>;
}

export interface UnifiedEloEntry {
  recorded_at: string;
  elo_after: number;
  elo_change: number;
  tournament_name: string;
  nickname: string;
}

/**
 * Obtiene stats unificadas de un jugador que tiene múltiples nicknames vinculados.
 * Retorna null si el jugador solo tiene 1 nickname.
 */
export async function getUnifiedPlayerStats(
  slug: string
): Promise<UnifiedPlayerStats | null> {
  const { data, error } = await supabase.rpc("get_unified_player_stats", {
    p_slug: slug,
  });
  if (error) {
    console.error("Error getting unified stats:", error);
    return null;
  }
  return data;
}

/**
 * Obtiene el historial de ELO unificado para la gráfica.
 * Combina todos los aliases cronológicamente y recalcula el ELO.
 */
export async function getUnifiedEloHistory(
  slug: string
): Promise<UnifiedEloEntry[]> {
  const { data, error } = await supabase.rpc("get_unified_elo_history", {
    p_slug: slug,
  });
  if (error) {
    console.error("Error getting unified elo history:", error);
    return [];
  }
  return data ?? [];
}

/**
 * Obtiene los resultados de torneo de TODOS los aliases vinculados a un profile.
 * Se usa para el historial unificado en el perfil del jugador.
 */
export async function getUnifiedTournamentResults(
  profileId: string
): Promise<
  (TournamentResult & {
    tournaments: {
      id: string;
      name: string;
      slug: string;
      buy_in: number;
      start_datetime: string;
      clubs: { id: string; name: string; slug: string };
    };
    players: { nickname: string };
  })[]
> {
  const { data: playerIds } = await supabase
    .from("players")
    .select("id")
    .eq("profile_id", profileId);

  if (!playerIds || playerIds.length === 0) return [];

  const ids = playerIds.map((p) => p.id);

  const { data, error } = await supabase
    .from("tournament_results")
    .select(
      "*, tournaments(id, name, slug, buy_in, start_datetime, clubs(id, name, slug)), players(nickname)"
    )
    .in("player_id", ids)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

// ══════════════════════════════════════════════════════════
// GAMIFICACIÓN
// ══════════════════════════════════════════════════════════

/**
 * Recompensa al usuario con Shark Coins y XP por leer un artículo.
 */
export async function claimBlogReward(
  userId: string,
  amount: number = 10,
  xpAmount: number = 50
): Promise<void> {
  const { error } = await supabase.rpc("claim_blog_reward", {
    p_user_id: userId,
    p_amount: amount,
    p_xp_amount: xpAmount,
  });

  if (error) throw error;
}