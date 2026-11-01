// src/lib/api/tournaments.ts
import { supabase } from "../supabase";
import { isPublicTournamentVisible, publicTournamentCutoffIso } from "../tournament-lifecycle";
import type {
  TournamentWithDetails,
  TournamentResultWithPlayer,
} from "../../types";

// 🕒 Motor de estado en tiempo real
export function deriveTournamentStatus(t: any): "scheduled" | "live" | "late_registration" | "completed" | "cancelled" {
  if (t.status === "cancelled") return "cancelled";
  if (t.status === "completed" || t.results_uploaded) return "completed";
  const now = new Date().getTime();
  const start = new Date(t.start_datetime).getTime();
  const lateRegMs = (t.late_registration_minutes || 0) * 60000;
  const endLateReg = start + lateRegMs;
  if (now < start) return "scheduled";
  if (now >= start && now <= endLateReg) return "late_registration";
  if (now > endLateReg) return "completed";
  return t.status;
}

// 🛠️ Función de ensamblaje manual para evitar errores de ambigüedad en Supabase
async function attachClubsToTournaments(tournaments: any[]): Promise<TournamentWithDetails[]> {
  if (!tournaments || tournaments.length === 0) return [];
  
  const clubIds = [...new Set(tournaments.map(t => t.club_id).filter(Boolean))];
  let clubsMap = new Map();
  
  if (clubIds.length > 0) {
    const { data: clubs } = await supabase.from("clubs").select("id, name, country_code, slug").in("id", clubIds);
    if (clubs) clubsMap = new Map(clubs.map(c => [c.id, c]));
  }

  return tournaments.map(t => {
    const mapped = {
      ...t,
      late_reg_end: t.late_registration_minutes 
        ? new Date(new Date(t.start_datetime).getTime() + t.late_registration_minutes * 60000).toISOString()
        : null
    };
    mapped.status = deriveTournamentStatus(mapped);
    mapped.clubs = clubsMap.get(t.club_id) || null;
    return mapped as TournamentWithDetails;
  });
}

// Read beyond PostgREST's default 1,000-row limit. Admins must be able to
// recover every archived event (CCP already has more than 1,000 tournaments).
async function fetchAllTournamentPages(query: any): Promise<any[]> {
  const pageSize = 500;
  const rows: any[] = [];
  for (let offset = 0; offset < 5000; offset += pageSize) {
    const { data, error } = await query.range(offset, offset + pageSize - 1);
    if (error) throw error;
    const batch: any[] = data ?? [];
    rows.push(...batch);
    if (batch.length < pageSize) return rows;
  }
  throw new Error("Se alcanzó el límite de paginación de torneos (5000).");
}

// ── 1. GETTERS (ADMIN & WEB) ──

export async function getAllTournaments(): Promise<TournamentWithDetails[]> {
  // Esta función es la que usa el SUPER ADMIN
  const query = supabase.from("tournaments")
    .select("*, leagues(id, name, slug), poker_rooms(name)")
    .order("start_datetime", { ascending: false });
  const rows = await fetchAllTournamentPages(query);
  return await attachClubsToTournaments(rows);
}

// Club membership can exceed both PostgREST's 1,000-row default and URL-size
// limits. Query primary events and linked co-host events in safe batches.
export async function getTournamentsByClub(clubId: string, publicOnly = false): Promise<TournamentWithDetails[]> {
  const linkRows = await fetchAllTournamentPages(
    supabase.from("tournament_clubs")
      .select("tournament_id")
      .eq("club_id", clubId)
      .order("tournament_id", { ascending: true }),
  );
  const linkedIds = [...new Set(linkRows.map(link => link.tournament_id as string))];

  const publicFilter = (query: any) => publicOnly
    ? query.or(`results_uploaded.eq.true,and(start_datetime.gte.${publicTournamentCutoffIso()},status.neq.cancelled)`)
    : query;

  const primary = await fetchAllTournamentPages(
    publicFilter(supabase.from("tournaments")
      .select("*, leagues(id, name, slug), poker_rooms(name)")
      .eq("club_id", clubId))
      .order("start_datetime", { ascending: false }),
  );

  const byId = new Map<string, any>(primary.map(t => [t.id, t]));
  // 120 UUIDs per query avoids 40 kB URLs when CCP shares >1,000 tournaments.
  const batchSize = 120;
  for (let offset = 0; offset < linkedIds.length; offset += batchSize) {
    const ids = linkedIds.slice(offset, offset + batchSize).filter(id => !byId.has(id));
    if (!ids.length) continue;
    const linked = await fetchAllTournamentPages(
      publicFilter(supabase.from("tournaments")
        .select("*, leagues(id, name, slug), poker_rooms(name)")
        .in("id", ids))
        .order("start_datetime", { ascending: false }),
    );
    for (const tournament of linked) byId.set(tournament.id, tournament);
  }
  const rows = [...byId.values()].sort(
    (a, b) => new Date(b.start_datetime).getTime() - new Date(a.start_datetime).getTime(),
  );
  const attached = await attachClubsToTournaments(rows);
  return publicOnly ? attached.filter(t => isPublicTournamentVisible(t)) : attached;
}

export async function getUpcomingTournaments(): Promise<TournamentWithDetails[]> {
  const { data, error } = await supabase
    .from("tournaments")
    .select("*, leagues(id, name, slug), poker_rooms(name)")
    .in("status", ["scheduled", "live", "late_registration"])
    // Avoid the PostgREST first-1000 cap swallowing future tournaments with old schedules.
    .gte("start_datetime", publicTournamentCutoffIso());

  if (error) throw error;
  const attached = await attachClubsToTournaments(data || []);
  
  return attached
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
  
  let query = supabase.from("tournaments").select("*, leagues(id, name, slug), poker_rooms(name)", { count: "exact" });

  // Database-side filtering is critical: apply it BEFORE pagination and exact count.
  // Results are permanent; events without results expire after seven days.
  const nowIso = new Date().toISOString();
  query = query.lte("start_datetime", nowIso)
    .or(`results_uploaded.eq.true,and(start_datetime.gte.${publicTournamentCutoffIso()},status.neq.cancelled)`);

  if (options?.clubId) {
    // Club filtering must include co-hosted tournaments without long IN URLs,
    // and pagination must happen AFTER filtering the complete club membership.
    const clubTournaments = await getTournamentsByClub(options.clubId, true);
    const matches = clubTournaments.filter(t =>
      new Date(t.start_datetime).toISOString() <= nowIso
      && (!options.leagueId || t.league_id === options.leagueId)
      && (!options.roomId || t.room_id === options.roomId),
    );
    return { data: matches.slice(from, to + 1), count: matches.length };
  }

  if (options?.leagueId) query = query.eq("league_id", options.leagueId);
  if (options?.roomId) query = query.eq("room_id", options.roomId);
  
  const { data, error, count } = await query.order("start_datetime", { ascending: false }).range(from, to);
  if (error) throw error;
  
  const attached = await attachClubsToTournaments(data || []);
  return { data: attached, count: count ?? 0 };
}

// ── GETTERS SIMPLES ──

export async function getTournamentsByLeague(leagueId: string, publicOnly = false): Promise<TournamentWithDetails[]> {
  let query = supabase.from("tournaments").select("*, leagues(id, name, slug), poker_rooms(name)").eq("league_id", leagueId);
  if (publicOnly) {
    query = query.or(`results_uploaded.eq.true,and(start_datetime.gte.${publicTournamentCutoffIso()},status.neq.cancelled)`);
  }
  const rows = await fetchAllTournamentPages(query.order("start_datetime", { ascending: false }));
  const attached = await attachClubsToTournaments(rows);
  return publicOnly ? attached.filter(t => isPublicTournamentVisible(t)) : attached;
}

export async function getTournamentById(id: string): Promise<TournamentWithDetails | null> {
  const { data, error } = await supabase.from("tournaments").select("*, leagues(id, name, slug), poker_rooms(name)").eq("id", id).single();
  if (error) return error.code === "PGRST116" ? null : (function() { throw error; })();
  if (!data) return null;
  const attached = await attachClubsToTournaments([data]);
  return attached[0] || null;
}

export async function getTournamentBySlug(slug: string): Promise<TournamentWithDetails | null> {
  const { data, error } = await supabase.from("tournaments").select("*, leagues(id, name, slug), poker_rooms(name)").eq("slug", slug).single();
  if (error) {
    if (error.code === "PGRST116") {
      // Preserve existing links that used the tournament UUID while canonical links use slugs.
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug);
      return isUuid ? getTournamentById(slug) : null;
    }
    throw error;
  }
  if (!data) return null;
  const attached = await attachClubsToTournaments([data]);
  const tournament = attached[0] || null;
  // Direct navigation must follow the same public visibility rule as calendars.
  return tournament && isPublicTournamentVisible(tournament) ? tournament : null;
}

export async function getTournamentResults(tournamentId: string): Promise<TournamentResultWithPlayer[]> {
  const { data, error } = await supabase.from("tournament_results").select("*, players(id, nickname, country_code, slug)").eq("tournament_id", tournamentId).order("position", { ascending: true });
  if (error) throw error;
  return (data as TournamentResultWithPlayer[]) ?? [];
}

// ── UTILIDADES ──

export async function deleteTournamentSafe(tournamentId: string) {
  const { error } = await supabase.rpc('delete_tournament_god_mode', { tournament_id_to_delete: tournamentId });
  if (error) throw error;
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
      // 🔥 MAGIA: exSt.ccp_club tiene prioridad. El club NO se sobrescribe.
      await supabase.from("league_standings").update({ total_points: Number(exSt.total_points) + d.points, tournaments_played: exSt.tournaments_played + 1, best_position: Math.min(exSt.best_position || 999, d.best), total_buy_ins_spent: Number(exSt.total_buy_ins_spent || 0) + d.buy_ins_count, ccp_club: exSt.ccp_club || d.ccp_club, updated_at: new Date().toISOString() }).eq("id", exSt.id);
    } else {
      await supabase.from("league_standings").insert({ league_id: leagueId, player_id: pid, total_points: d.points, tournaments_played: 1, best_position: d.best, rank_position: 0, ccp_club: d.ccp_club, total_buy_ins_spent: d.buy_ins_count });
    }
  }
}

export async function prepareTournamentForReedit(tournamentId: string) {
  const { data, error } = await supabase.rpc('reset_tournament_impact', { tournament_id_to_reset: tournamentId });
  if (error) throw error;
  return data;
}