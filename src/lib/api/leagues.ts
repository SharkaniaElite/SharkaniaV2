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
      "*, league_clubs(is_primary, clubs(id, name, country_code, slug, banner_url)), league_rooms(poker_rooms(id, name))"
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
      "*, league_clubs(is_primary, clubs(id, name, country_code, slug, banner_url)), league_rooms(poker_rooms(id, name))"
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
      "*, league_clubs(is_primary, clubs(id, name, country_code, slug, banner_url)), league_rooms(poker_rooms(id, name))"
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
    // 👇 Añadimos "profiles(unified_elo)" a la consulta cruzando a través de players
    .select("*, players(id, nickname, slug, country_code, elo_rating, profiles(unified_elo))")
    .eq("league_id", leagueId)
    .order("total_points", { ascending: false })
    .order("best_position", { ascending: true })
    .order("tournaments_played", { ascending: false });

  if (error) throw error;

  // 👇 MAGIA FRONTEND: Interceptamos la respuesta y si el jugador tiene un ELO unificado, 
  // pisamos el elo_rating normal. Así el componente React de la tabla no se entera del cambio.
  const standings = (data || []).map((standing: any) => {
    if (standing.players) {
      const unifiedElo = standing.players.profiles?.unified_elo;
      if (unifiedElo !== undefined && unifiedElo !== null) {
        standing.players.elo_rating = unifiedElo;
      }
    }
    return standing;
  });

  return standings as LeagueStandingWithPlayer[];
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
export async function duplicateLeague(leagueId: string, newName: string): Promise<boolean> {
  // 1. Obtener la liga original con sus relaciones (clubes y salas)
  const { data: original, error: fetchError } = await supabase
    .from("leagues")
    .select("*, league_clubs(club_id, is_primary), league_rooms(room_id)")
    .eq("id", leagueId)
    .single();

  if (fetchError || !original) throw fetchError || new Error("Liga no encontrada");

  // 2. Generar un slug limpio basado en el nuevo nombre
  const baseSlug = newName
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Quita tildes
    .replace(/[^a-z0-9]+/g, "-")     // Reemplaza símbolos por guiones
    .replace(/^-+|-+$/g, "");        // Limpia guiones en los bordes

  let newSlug = baseSlug;
  let isUnique = false;
  let counter = 1;

  // 3. Verificar que el slug no exista en la BD para evitar choques
  while (!isUnique) {
    const { data: existing } = await supabase
      .from("leagues")
      .select("id")
      .eq("slug", newSlug)
      .maybeSingle();

    if (existing) {
      newSlug = `${baseSlug}-${counter}`;
      counter++;
    } else {
      isUnique = true;
    }
  }
  
  // Extraemos lo que NO queremos clonar (id, fechas, texto de búsqueda)
  const { id, created_at, updated_at, fts, league_clubs, league_rooms, ...leagueData } = original;

  const newLeague = {
    ...leagueData,
    name: newName, // 👈 Usamos el nombre limpio elegido por ti
    slug: newSlug, // 👈 Usamos el slug perfecto validado
    status: "upcoming" // Reseteamos el estado para la nueva liga
  };

  // 4. Insertar la nueva liga en la base de datos
  const { data: insertedLeague, error: insertError } = await supabase
    .from("leagues")
    .insert(newLeague)
    .select("id")
    .single();

  if (insertError) throw insertError;

  const newId = insertedLeague.id;

  // 5. Clonar relaciones (Clubes participantes)
  if (league_clubs && league_clubs.length > 0) {
    const newClubs = league_clubs.map((lc: any) => ({
      league_id: newId,
      club_id: lc.club_id,
      is_primary: lc.is_primary
    }));
    await supabase.from("league_clubs").insert(newClubs);
  }

  // 6. Clonar relaciones (Salas vinculadas)
  if (league_rooms && league_rooms.length > 0) {
    const newRooms = league_rooms.map((lr: any) => ({
      league_id: newId,
      room_id: lr.room_id
    }));
    await supabase.from("league_rooms").insert(newRooms);
  }

  return true;
}
