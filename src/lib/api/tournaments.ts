// src/lib/api/tournaments.ts
import { supabase } from "../supabase";
import type {
  TournamentWithDetails,
  TournamentResultWithPlayer,
} from "../../types";

// 🔥 NUEVO: Motor de cálculo de estado en tiempo real
export function deriveTournamentStatus(t: any): "scheduled" | "live" | "late_registration" | "completed" | "cancelled" {
  if (t.status === "cancelled") return "cancelled";
  if (t.status === "completed" || t.results_uploaded) return "completed";

  const now = new Date().getTime();
  const start = new Date(t.start_datetime).getTime();
  const lateRegMs = (t.late_registration_minutes || 0) * 60000;
  const endLateReg = start + lateRegMs;

  if (now < start) return "scheduled";
  if (now >= start && now <= endLateReg) return "late_registration";
  if (now > endLateReg) return "completed"; // Si ya pasó su registro tardío, es historial

  return t.status;
}

const mapTournamentWithLateReg = (t: any): TournamentWithDetails => {
  const mapped = {
    ...t,
    late_reg_end: t.late_registration_minutes 
      ? new Date(new Date(t.start_datetime).getTime() + t.late_registration_minutes * 60000).toISOString()
      : null
  };
  mapped.status = deriveTournamentStatus(mapped);
  return mapped;
};

// ── 1. GETTERS ──

export async function getUpcomingTournaments(): Promise<TournamentWithDetails[]> {
  const { data, error } = await supabase
    .from("tournaments")
    .select("*, clubs!club_id(id, name, country_code, slug), leagues(id, name, slug), poker_rooms(name)")
    .in("status", ["scheduled", "live", "late_registration"]); // Trae los abiertos en DB

  if (error) throw error;
  
  // 1. Mapea y calcula el estado real
  // 2. Filtra solo los que sigan activos
  // 3. Ordena ASCENDENTE (el más próximo primero)
  return (data || [])
    .map(mapTournamentWithLateReg)
    .filter((t) => ["scheduled", "live", "late_registration"].includes(t.status))
    .sort((a, b) => new Date(a.start_datetime).getTime() - new Date(b.start_datetime).getTime());
}

export async function getCompletedTournaments(options?: {
  page?: number; pageSize?: number; clubId?: string; leagueId?: string; roomId?: string;
}): Promise<{ data: TournamentWithDetails[]; count: number }> {
  const page = options?.page ?? 1;
  const pageSize = options?.pageSize ?? 20;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  
  // 🔥 SOLUCIÓN DE AMBIGÜEDAD
  let selectStr = "*, clubs!club_id(id, name, country_code, slug), leagues(id, name, slug), poker_rooms(name)";
  
  if (options?.clubId) {
    selectStr += ", tournament_clubs!inner(club_id)";
  }

  // 🔥 ESTRATEGIA ANTIBALAS: Trae completados, cancelados, y aquellos cuya fecha ya pasó
  let query = supabase.from("tournaments").select(selectStr, { count: "exact" })
    .or(`status.in.(completed,cancelled),results_uploaded.eq.true,start_datetime.lt.${new Date().toISOString()}`);

  if (options?.clubId) query = query.eq("tournament_clubs.club_id", options.clubId);
  if (options?.leagueId) query = query.eq("league_id", options.leagueId);
  if (options?.roomId) query = query.eq("room_id", options.roomId);
  
  const { data, error, count } = await query.order("start_datetime", { ascending: false }).range(from, to);
  if (error) throw error;
  return { 
    data: (data || []).map(mapTournamentWithLateReg), 
    count: count ?? 0 
  };
}

export async function getAllTournaments(): Promise<TournamentWithDetails[]> {
  const { data, error } = await supabase.from("tournaments").select("*, clubs!club_id(id, name, country_code, slug), leagues(id, name, slug), poker_rooms(name)").order("start_datetime", { ascending: false });
  if (error) throw error;
  return (data || []).map(mapTournamentWithLateReg);
}

export async function getTournamentsByClub(clubId: string): Promise<TournamentWithDetails[]> {
  const { data, error } = await supabase
    .from("tournaments")
    // 🔥 SOLUCIÓN DE AMBIGÜEDAD + FILTRO MANY-TO-MANY
    .select("*, clubs!club_id(id, name, country_code, slug), leagues(id, name, slug), poker_rooms(name), tournament_clubs!inner(club_id)")
    .eq("tournament_clubs.club_id", clubId)
    .order("start_datetime", { ascending: false });

  if (error) throw error;
  return (data || []).map(mapTournamentWithLateReg);
}

export async function getTournamentsByLeague(leagueId: string): Promise<TournamentWithDetails[]> {
  const { data, error } = await supabase.from("tournaments").select("*, clubs!club_id(id, name, country_code, slug), leagues(id, name, slug), poker_rooms(name)").eq("league_id", leagueId).order("start_datetime", { ascending: false });
  if (error) throw error;
  return (data || []).map(mapTournamentWithLateReg);
}

export async function getTournamentById(id: string): Promise<TournamentWithDetails | null> {
  const { data, error } = await supabase.from("tournaments").select("*, clubs!club_id(id, name, country_code, slug), leagues(id, name, slug), poker_rooms(name)").eq("id", id).single();
  if (error) return error.code === "PGRST116" ? null : (function() { throw error; })();
  return data ? mapTournamentWithLateReg(data) : null;
}

export async function getTournamentBySlug(slug: string): Promise<TournamentWithDetails | null> {
  const { data, error } = await supabase
    .from("tournaments")
    .select("*, clubs!club_id(id, name, country_code, slug), leagues(id, name, slug), poker_rooms(name)")
    .eq("slug", slug)
    .single();
    
  if (error) return error.code === "PGRST116" ? null : (function() { throw error; })();
  return data ? mapTournamentWithLateReg(data) : null;
}

export async function getTournamentResults(tournamentId: string): Promise<TournamentResultWithPlayer[]> {
  const { data, error } = await supabase.from("tournament_results").select("*, players(id, nickname, country_code, slug)").eq("tournament_id", tournamentId).order("position", { ascending: true });
  if (error) throw error;
  return (data as TournamentResultWithPlayer[]) ?? [];
}

// ── 2. ELIMINACIÓN Y PUNTOS DE LIGA ──

export async function deleteTournamentSafe(tournamentId: string) {
  const { data, error } = await supabase.rpc('delete_tournament_god_mode', { tournament_id_to_delete: tournamentId });
  if (error) throw error;
  const result = data as { success: boolean; message: string };
  if (!result.success) throw new Error(result.message);
}

export async function applyLeaguePoints(tournamentId: string, leagueId: string) {
  const { data: results } = await supabase.from("tournament_results").select("player_id, league_points_earned, position, ccp_club, buy_ins_count").eq("tournament_id", tournamentId);
  if (!results || results.length === 0) return;
  const playersMap = new Map();
  for (const r of results) {
    const ex = playersMap.get(r.player_id) || { points: 0, best: r.position, ccp_club: null, buy_ins_count: 0 };
    ex.points += Number(r.league_points_earned || 0); 
    ex.best = Math.min(ex.best, r.position);
    if (r.ccp_club) ex.ccp_club = r.ccp_club; 
    ex.buy_ins_count += Number(r.buy_ins_count || 1);
    playersMap.set(r.player_id, ex);
  }
  for (const [pid, d] of playersMap.entries()) {
    const { data: exSt } = await supabase.from("league_standings").select("*").eq("league_id", leagueId).eq("player_id", pid).maybeSingle();
    if (exSt) {
      await supabase.from("league_standings").update({ total_points: Number(exSt.total_points) + d.points, tournaments_played: exSt.tournaments_played + 1, best_position: Math.min(exSt.best_position || 999, d.best), total_buy_ins_spent: Number(exSt.total_buy_ins_spent || 0) + d.buy_ins_count, ccp_club: d.ccp_club || exSt.ccp_club, updated_at: new Date().toISOString() }).eq("id", exSt.id);
    } else {
      await supabase.from("league_standings").insert({ league_id: leagueId, player_id: pid, total_points: d.points, tournaments_played: 1, best_position: d.best, rank_position: 0, ccp_club: d.ccp_club, total_buy_ins_spent: d.buy_ins_count });
    }
  }
  const { data: stand } = await supabase.from("league_standings").select("id, total_points").eq("league_id", leagueId).order("total_points", { ascending: false }).order("best_position", { ascending: true });
  if (stand) { 
    for (let i = 0; i < stand.length; i++) { await supabase.from("league_standings").update({ rank_position: i + 1 }).eq("id", stand[i]!.id); } 
  }
}

export async function prepareTournamentForReedit(tournamentId: string) {
  const { data, error } = await supabase.rpc('reset_tournament_impact', { tournament_id_to_reset: tournamentId });
  if (error) throw error;
  return data;
}