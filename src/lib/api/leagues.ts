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
    .order("total_points", { ascending: false })          // 1° Instancia: Mayor cantidad de puntos
    .order("tournaments_played", { ascending: false })    // 2° Instancia: Más participaciones
    .order("best_position", { ascending: true })          // 3° Instancia: Mejor resultado individual
    .order("final_tables_count", { ascending: false });   // 4° Instancia: Más mesas finales

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
  
  // 🔥 PARCHE: El RPC borra el ccp_club y buyins al recrear la tabla.
  // Vamos a restaurarlos leyendo directamente desde los torneos de esta liga.
  // Modificamos para traer los torneos ORDENADOS POR FECHA
  const { data: tourneys } = await supabase.from("tournaments").select("id, start_datetime").eq("league_id", leagueId).order("start_datetime", { ascending: true });
  if (tourneys && tourneys.length > 0) {
    const tIds = tourneys.map(t => t.id);
    const { data: results } = await supabase
      .from("tournament_results")
      .select("tournament_id, player_id, ccp_club, buy_ins_count")
      .in("tournament_id", tIds)
      .not("ccp_club", "is", null);

    if (results && results.length > 0) {
      // Agrupamos por torneo para procesar en orden cronológico estricto
      const resultsByTid = results.reduce((acc: any, r: any) => {
        acc[r.tournament_id] = acc[r.tournament_id] || [];
        acc[r.tournament_id].push(r);
        return acc;
      }, {});

      const playerMap = new Map();
      for (const t of tourneys) {
        const tourneyResults = resultsByTid[t.id] || [];
        for (const r of tourneyResults) {
          const ex = playerMap.get(r.player_id) || { ccp: null, buyins: 0 };
          // 🔥 MAGIA: Solo asigna el club si NO tiene uno previo. (Primer club queda bloqueado)
          if (r.ccp_club && !ex.ccp) ex.ccp = r.ccp_club; 
          ex.buyins += (Number(r.buy_ins_count) || 1);
          playerMap.set(r.player_id, ex);
        }
      }

      // Guardamos los datos de vuelta en la tabla de posiciones
      for (const [pid, data] of playerMap.entries()) {
        await supabase
          .from("league_standings")
          .update({ ccp_club: data.ccp, total_buy_ins_spent: data.buyins })
          .eq("league_id", leagueId)
          .eq("player_id", pid);
      }
    }
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
export interface CCPClubRanking {
  clubName: string;
  totalPoints: number;
  datesScored: number;
  playerCount: number; // 🔥 NUEVO CAMPO
}

// (Busca la parte final de tu archivo leagues.ts y reemplaza desde la interfaz CCPClubRanking hacia abajo)

export interface ScoreDetail {
  tournamentId: string;
  playerId: string;
  points: number;
}

export interface CCPClubRanking {
  clubName: string;
  totalPoints: number;
  datesScored: number;
  playerCount: number;
  scoreHistory: ScoreDetail[]; // 🔥 NUEVO: Historial de puntajes que sumaron
}

export async function getLeagueCCPStandings(leagueId: string): Promise<CCPClubRanking[]> {
  // 1. Obtener los torneos de la liga
  const { data: tournaments } = await supabase
    .from("tournaments")
    .select("id")
    .eq("league_id", leagueId);

  if (!tournaments || tournaments.length === 0) return [];
  const tournamentIds = tournaments.map((t) => t.id);

  // 2. Buscamos la fuente de la verdad: el club oficial bloqueado del jugador
  const { data: standings } = await supabase
    .from("league_standings")
    .select("player_id, ccp_club")
    .eq("league_id", leagueId)
    .not("ccp_club", "is", null);
  
  const lockedClubs = new Map(standings?.map(s => [s.player_id, s.ccp_club]) || []);

  // 3. Obtener los resultados (ahora también pedimos datos del jugador y fecha)
  const { data: results } = await supabase
    .from("tournament_results")
    .select("tournament_id, player_id, league_points_earned, ccp_club") 
    .in("tournament_id", tournamentIds);

  if (!results || results.length === 0) return [];

  const clubTotals: Record<string, number> = {};
  const clubDatesScored: Record<string, Set<string>> = {};
  const clubPlayers: Record<string, Set<string>> = {}; 
  const clubHistory: Record<string, ScoreDetail[]> = {}; // 🔥 Diccionario para guardar los detalles

  // 4. Agrupar por torneo y luego por club
  const resultsByTournament = results.reduce((acc, curr) => {
    const tId = curr.tournament_id;
    const pId = curr.player_id;
    const points = Number(curr.league_points_earned || 0);
    
    const rawClub = lockedClubs.get(pId);
    if (!rawClub) return acc; 

    const clubName = rawClub.toUpperCase().trim();

    const playerSet = clubPlayers[clubName] ?? (clubPlayers[clubName] = new Set());
    playerSet.add(pId);

    const tournamentData = acc[tId] ?? (acc[tId] = {});
    const clubData = tournamentData[clubName] ?? (tournamentData[clubName] = []);
    
    clubData.push({ playerId: pId, points: points, tournamentId: tId });
    return acc;
  }, {} as Record<string, Record<string, {playerId: string, points: number, tournamentId: string}[]>>);

  // 5. Sumar solo el mejor puntaje por torneo para cada club y guardar el detalle
  for (const tId in resultsByTournament) {
    const tournamentData = resultsByTournament[tId]!;
    for (const club in tournamentData) {
      const recordsArray = tournamentData[club]!;
      // Ordenamos para sacar el registro con más puntos
      recordsArray.sort((a, b) => b.points - a.points);
      
      const bestRecord = recordsArray[0];
      if (!bestRecord || bestRecord.points === 0) continue;

      clubTotals[club] = (clubTotals[club] ?? 0) + bestRecord.points;
      
      const datesSet = clubDatesScored[club] ?? (clubDatesScored[club] = new Set());
      datesSet.add(tId);

      // Guardamos el detalle de la persona que aportó el punto en esta fecha
      const historyList = clubHistory[club] ?? (clubHistory[club] = []);
      historyList.push(bestRecord);
    }
  }

  // 6. Convertir a array y ordenar
  return Object.keys(clubTotals).map(club => ({
    clubName: club,
    totalPoints: clubTotals[club] ?? 0,
    datesScored: clubDatesScored[club]?.size ?? 0,
    playerCount: clubPlayers[club]?.size ?? 0,
    scoreHistory: clubHistory[club] ?? [] // 🔥 Añadimos el historial al objeto
  })).sort((a, b) => b.totalPoints - a.totalPoints || a.clubName.localeCompare(b.clubName));
}

// ── NUEVO: Función para desglosar puntos de un jugador ───────────────────
export interface PlayerPointsBreakdown {
  id: string;
  tournament_name: string;
  date: string;
  position: number;
  points: number;
}

export async function getPlayerLeaguePointsBreakdown(leagueId: string, playerId: string): Promise<PlayerPointsBreakdown[]> {
  const { data, error } = await supabase
    .from("tournament_results")
    .select(`
      id,
      position,
      league_points_earned,
      tournaments!inner (
        name,
        start_datetime,
        league_id
      )
    `)
    .eq("player_id", playerId)
    .eq("tournaments.league_id", leagueId)
    .gt("league_points_earned", 0);

  if (error) throw error;

  // Mapeamos los datos y los ordenamos por fecha (del más reciente al más antiguo)
  const breakdown = (data || []).map((row: any) => ({
    id: row.id,
    tournament_name: row.tournaments.name,
    date: row.tournaments.start_datetime,
    position: row.position,
    points: Number(row.league_points_earned)
  }));

  return breakdown.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}
