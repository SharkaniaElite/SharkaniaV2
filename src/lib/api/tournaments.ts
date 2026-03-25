// src/lib/api/tournaments.ts
import { supabase } from "../supabase";
import type {
  TournamentWithDetails,
  TournamentResultWithPlayer,
} from "../../types";

// ── 1. GETTERS: Necesarios para el Calendario y Perfiles ──

export async function getUpcomingTournaments(): Promise<TournamentWithDetails[]> {
  const now = new Date();
  const nowISO = now.toISOString();
  const { data, error } = await supabase
    .from("tournaments")
    .select("*, clubs(id, name, country_code), leagues(id, name), poker_rooms(name)")
    .or(`and(status.eq.scheduled,start_datetime.gte.${nowISO}),status.eq.live,status.eq.late_registration`)
    .order("start_datetime", { ascending: true });

  if (error) throw error;
  if (!data) return [];
  const MARGIN_MS = 12 * 60 * 60 * 1000;
  return (data as TournamentWithDetails[]).filter((t) => {
    const start = new Date(t.start_datetime).getTime();
    const windowEnd = start + (t.late_registration_minutes ?? 0) * 60 * 1000 + MARGIN_MS;
    return t.status === "scheduled" || now.getTime() < windowEnd;
  });
}

export async function getCompletedTournaments(options?: {
  page?: number; pageSize?: number; clubId?: string; leagueId?: string; roomId?: string;
}): Promise<{ data: TournamentWithDetails[]; count: number }> {
  const page = options?.page ?? 1;
  const pageSize = options?.pageSize ?? 20;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  let query = supabase.from("tournaments").select("*, clubs(id, name, country_code), leagues(id, name), poker_rooms(name)", { count: "exact" })
    .eq("status", "completed").order("start_datetime", { ascending: false }).range(from, to);
  if (options?.clubId) query = query.eq("club_id", options.clubId);
  if (options?.leagueId) query = query.eq("league_id", options.leagueId);
  if (options?.roomId) query = query.eq("room_id", options.roomId);
  const { data, error, count } = await query;
  if (error) throw error;
  return { data: (data as TournamentWithDetails[]) ?? [], count: count ?? 0 };
}

export async function getAllTournaments(): Promise<TournamentWithDetails[]> {
  const { data, error } = await supabase.from("tournaments").select("*, clubs(id, name, country_code), leagues(id, name), poker_rooms(name)").order("start_datetime", { ascending: false });
  if (error) throw error;
  return (data as TournamentWithDetails[]) ?? [];
}

export async function getTournamentsByClub(clubId: string): Promise<TournamentWithDetails[]> {
  const { data, error } = await supabase.from("tournaments").select("*, clubs(id, name, country_code), leagues(id, name), poker_rooms(name)").eq("club_id", clubId).order("start_datetime", { ascending: false });
  if (error) throw error;
  return (data as TournamentWithDetails[]) ?? [];
}

export async function getTournamentsByLeague(leagueId: string): Promise<TournamentWithDetails[]> {
  const { data, error } = await supabase.from("tournaments").select("*, clubs(id, name, country_code), leagues(id, name), poker_rooms(name)").eq("league_id", leagueId).order("start_datetime", { ascending: false });
  if (error) throw error;
  return (data as TournamentWithDetails[]) ?? [];
}

export async function getTournamentById(id: string): Promise<TournamentWithDetails | null> {
  const { data, error } = await supabase.from("tournaments").select("*, clubs(id, name, country_code), leagues(id, name), poker_rooms(name)").eq("id", id).single();
  if (error) return error.code === "PGRST116" ? null : (function() { throw error; })();
  return data as TournamentWithDetails;
}

export async function getTournamentResults(tournamentId: string): Promise<TournamentResultWithPlayer[]> {
  const { data, error } = await supabase.from("tournament_results").select("*, players(id, nickname, country_code)").eq("tournament_id", tournamentId).order("position", { ascending: true });
  if (error) throw error;
  return (data as TournamentResultWithPlayer[]) ?? [];
}

// ── 2. ELIMINACIÓN: Modo Dios RPC (Limpia Fantasmas y Corrige ELO) ──

export async function deleteTournamentSafe(tournamentId: string) {
  console.log("🧨 INICIANDO ELIMINACIÓN RPC:", tournamentId);
  try {
    const { data, error } = await supabase.rpc('delete_tournament_god_mode', {
      tournament_id_to_delete: tournamentId
    });

    if (error) throw error;
    const result = data as { success: boolean; message: string };
    if (!result.success) throw new Error(result.message);

    console.log("✅ SISTEMA SINCRONIZADO TRAS ELIMINACIÓN SQL");
  } catch (err) {
    console.error("💥 FALLO CRÍTICO EN ELIMINACIÓN:", err);
    throw err;
  }
}

// ── 3. PUNTOS DE LIGA ──

export async function applyLeaguePoints(tournamentId: string, leagueId: string) {
  const { data: results } = await supabase.from("tournament_results").select("player_id, league_points_earned, position").eq("tournament_id", tournamentId);
  if (!results || results.length === 0) return;
  const playersMap = new Map();
  for (const r of results) {
    const ex = playersMap.get(r.player_id) || { points: 0, best: r.position };
    ex.points += Number(r.league_points_earned || 0); ex.best = Math.min(ex.best, r.position);
    playersMap.set(r.player_id, ex);
  }
  for (const [pid, d] of playersMap.entries()) {
    const { data: exSt } = await supabase.from("league_standings").select("*").eq("league_id", leagueId).eq("player_id", pid).maybeSingle();
    if (exSt) {
      await supabase.from("league_standings").update({ 
        total_points: Number(exSt.total_points) + d.points, 
        tournaments_played: exSt.tournaments_played + 1, 
        best_position: Math.min(exSt.best_position || 999, d.best), 
        updated_at: new Date().toISOString() 
      }).eq("id", exSt.id);
    } else {
      await supabase.from("league_standings").insert({ 
        league_id: leagueId, player_id: pid, total_points: d.points, 
        tournaments_played: 1, best_position: d.best, rank_position: 0 
      });
    }
  }
  const { data: stand } = await supabase
    .from("league_standings")
    .select("id, total_points")
    .eq("league_id", leagueId)
    .order("total_points", { ascending: false })
    .order("best_position", { ascending: true }); // <-- Esta línea fuerza a respetar el orden de llegada (5° antes que 6°)
  if (stand) { for (let i = 0; i < stand.length; i++) { await supabase.from("league_standings").update({ rank_position: i + 1 }).eq("id", stand[i]!.id); } }
}

// src/lib/api/tournaments.ts

export async function prepareTournamentForReedit(tournamentId: string) {
  console.log("🛠️ Limpiando impacto del torneo para edición:", tournamentId);
  const { data, error } = await supabase.rpc('reset_tournament_impact', {
    tournament_id_to_reset: tournamentId
  });
  if (error) throw error;
  return data;
}