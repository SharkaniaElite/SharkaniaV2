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

export async function getLeagueBySlug(
  slug: string
): Promise<LeagueWithClubs | null> {
  const { data, error } = await supabase
    .from("leagues")
    .select(
      "*, league_clubs(is_primary, clubs(id, name, country_code)), league_rooms(poker_rooms(id, name))"
    )
    .eq("slug", slug)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }

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
    .select("*, players(id, nickname, slug, country_code, elo_rating)")
    .eq("league_id", leagueId)
    .order("total_points", { ascending: false })
    .order("best_position", { ascending: true }) // 👇 Obliga a que el 5° (E) vaya antes que el 6° (F)
    .order("tournaments_played", { ascending: false }); // 👇 Por si acaso tienen la misma posición en distintos torneos

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
export async function forceRecalculateStandings(leagueId: string): Promise<boolean> {
  const { error } = await supabase.rpc('recalculate_league_standings', {
    p_league_id: leagueId
  });

  if (error) {
    console.error("Error recalculando posiciones de liga:", error);
    throw error;
  }
  
  return true;
}

// ── 👯‍♂️ MOTOR DE CLONACIÓN DE LIGAS ──
export async function duplicateLeague(leagueId: string): Promise<boolean> {
  // 1. Obtener la liga original con sus relaciones (clubes y salas)
  const { data: original, error: fetchError } = await supabase
    .from("leagues")
    .select("*, league_clubs(club_id, is_primary), league_rooms(room_id)")
    .eq("id", leagueId)
    .single();

  if (fetchError || !original) throw fetchError || new Error("Liga no encontrada");

  // 2. Limpiar datos únicos y preparar la copia
  const randomSuffix = Math.floor(Math.random() * 10000);
  const newSlug = `${original.slug}-copia-${randomSuffix}`;
  
  // Extraemos lo que NO queremos clonar (id, fechas de creación, texto de búsqueda)
  const { id, created_at, updated_at, fts, league_clubs, league_rooms, ...leagueData } = original;

  const newLeague = {
    ...leagueData,
    name: `${original.name} (Copia)`,
    slug: newSlug,
    status: "upcoming" // Reseteamos el estado para la nueva liga
  };

  // 3. Insertar la nueva liga en la base de datos
  const { data: insertedLeague, error: insertError } = await supabase
    .from("leagues")
    .insert(newLeague)
    .select("id")
    .single();

  if (insertError) throw insertError;

  const newId = insertedLeague.id;

  // 4. Clonar relaciones (Clubes participantes)
  if (league_clubs && league_clubs.length > 0) {
    const newClubs = league_clubs.map((lc: any) => ({
      league_id: newId,
      club_id: lc.club_id,
      is_primary: lc.is_primary
    }));
    await supabase.from("league_clubs").insert(newClubs);
  }

  // 5. Clonar relaciones (Salas vinculadas)
  if (league_rooms && league_rooms.length > 0) {
    const newRooms = league_rooms.map((lr: any) => ({
      league_id: newId,
      room_id: lr.room_id
    }));
    await supabase.from("league_rooms").insert(newRooms);
  }

  return true;
}
