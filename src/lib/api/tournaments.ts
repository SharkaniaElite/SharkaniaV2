// src/lib/api/tournaments.ts
import { supabase } from "../supabase";
import type {
  TournamentWithDetails,
  TournamentResultWithPlayer,
} from "../../types";

/**
 * Torneos próximos y en vivo.
 * - scheduled: solo si start_datetime es futuro
 * - live / late_registration: solo si start_datetime + late_reg + 12h no ha pasado
 *   (el filtro grueso lo hace la DB; el filtro fino por late_reg se hace en cliente
 *    porque Supabase no permite aritmética de columnas en .or())
 */
export async function getUpcomingTournaments(): Promise<
  TournamentWithDetails[]
> {
  const now = new Date();
  const nowISO = now.toISOString();

  // Traer scheduled futuros + cualquier live/late_registration
  const { data, error } = await supabase
    .from("tournaments")
    .select(
      "*, clubs(id, name, country_code), leagues(id, name), poker_rooms(name)"
    )
    .or(
      `and(status.eq.scheduled,start_datetime.gte.${nowISO}),status.eq.live,status.eq.late_registration`
    )
    .order("start_datetime", { ascending: true });

  if (error) throw error;
  if (!data) return [];

  // Filtro fino en cliente: excluir live/late_registration cuya ventana real ya expiró
  // Ventana = start_datetime + late_registration_minutes + 12 horas de margen
  const MARGIN_MS = 12 * 60 * 60 * 1000; // 12 horas

  return (data as TournamentWithDetails[]).filter((t) => {
    if (t.status === "scheduled") return true; // ya filtrado por DB
    // Para live / late_registration: verificar que la ventana no haya expirado
    const start = new Date(t.start_datetime).getTime();
    const lateRegMs = (t.late_registration_minutes ?? 0) * 60 * 1000;
    const windowEnd = start + lateRegMs + MARGIN_MS;
    return now.getTime() < windowEnd;
  });
}

/**
 * Torneos completados (historial), paginados.
 * Ordenados por fecha descendente (más reciente primero).
 */
export async function getCompletedTournaments(options?: {
  page?: number;
  pageSize?: number;
  clubId?: string;
  leagueId?: string;
  roomId?: string;
}): Promise<{ data: TournamentWithDetails[]; count: number }> {
  const page = options?.page ?? 1;
  const pageSize = options?.pageSize ?? 20;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("tournaments")
    .select(
      "*, clubs(id, name, country_code), leagues(id, name), poker_rooms(name)",
      { count: "exact" }
    )
    .eq("status", "completed")
    .order("start_datetime", { ascending: false })
    .range(from, to);

  if (options?.clubId) query = query.eq("club_id", options.clubId);
  if (options?.leagueId) query = query.eq("league_id", options.leagueId);
  if (options?.roomId) query = query.eq("room_id", options.roomId);

  const { data, error, count } = await query;

  if (error) throw error;
  return {
    data: (data as TournamentWithDetails[]) ?? [],
    count: count ?? 0,
  };
}

export async function getAllTournaments(): Promise<TournamentWithDetails[]> {
  const { data, error } = await supabase
    .from("tournaments")
    .select(
      "*, clubs(id, name, country_code), leagues(id, name), poker_rooms(name)"
    )
    .order("start_datetime", { ascending: false });

  if (error) throw error;
  return (data as TournamentWithDetails[]) ?? [];
}

export async function getTournamentsByClub(
  clubId: string
): Promise<TournamentWithDetails[]> {
  const { data, error } = await supabase
    .from("tournaments")
    .select(
      "*, clubs(id, name, country_code), leagues(id, name), poker_rooms(name)"
    )
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
    .select(
      "*, clubs(id, name, country_code), leagues(id, name), poker_rooms(name)"
    )
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
    .select(
      "*, clubs(id, name, country_code), leagues(id, name), poker_rooms(name)"
    )
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
