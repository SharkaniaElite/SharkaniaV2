// src/lib/api/elo-engine.ts
import { supabase } from "../supabase";

interface PlayerEloData {
  id: string;
  profile_id?: string | null;
  elo_rating: number;
  elo_peak: number;
  total_tournaments: number;
  total_cashes: number;
  total_wins: number;
  total_prize_won: number;
  total_buy_ins_spent: number;
}

// ═══════════════════════════════════════════════════
// CALCULATE ELO
// ═══════════════════════════════════════════════════

export async function calculateElo(tournamentId: string): Promise<{ success: boolean; message: string }> {
  try {
    const { data: tournament, error: tError } = await supabase
      .from("tournaments")
      .select("id, buy_in, league_id")
      .eq("id", tournamentId)
      .single();

    if (tError || !tournament) return { success: false, message: "Torneo no encontrado" };

    const { data: results, error: rError } = await supabase
      .from("tournament_results")
      .select("player_id, position, prize_won, bounties_won")
      .eq("tournament_id", tournamentId)
      .order("position", { ascending: true });

    if (rError || !results || results.length < 2) return { success: false, message: "Mínimo 2 jugadores" };

    const playerIds = results.map((r) => r.player_id);
    const N = results.length;
    const buyIn = Number(tournament.buy_in) || 0;

    const { data: players } = await supabase.from("players").select("*").in("id", playerIds);
    if (!players) return { success: false, message: "Error jugadores" };

    const playerMap = new Map<string, PlayerEloData>();
    players.forEach((p) => playerMap.set(p.id, p as PlayerEloData));

    const sumAllElos = players.reduce((sum, p) => sum + Number(p.elo_rating), 0);
    const weight = (sumAllElos / N) / 1200;

    const eloChanges = [];

    for (const result of results) {
      const player = playerMap.get(result.player_id);
      if (!player) continue;

      const eloI = Number(player.elo_rating);
      const score = (N - result.position) / (N - 1);
      const avgOpp = (sumAllElos - eloI) / (N - 1);
      const expected = 1 / (1 + Math.pow(10, (avgOpp - eloI) / 400));

      const kBase = player.total_tournaments < 30 ? 40 : 20;
      const K = kBase * (1 + Math.log10(buyIn + 1) * 0.1) * (1 + Math.log10(N) * 0.15);

      const eloChange = K * weight * (score - expected);
      const newElo = Math.max(100, eloI + eloChange);

      eloChanges.push({
        playerId: result.player_id,
        eloBefore: eloI,
        eloAfter: Math.round(newElo * 100) / 100,
        eloChange: Math.round(eloChange * 100) / 100,
        position: result.position,
        prizeTotal: (Number(result.prize_won) || 0) + (Number(result.bounties_won) || 0),
      });
    }

    for (const change of eloChanges) {
      const player = playerMap.get(change.playerId)!;
      const newPeak = Math.max(Number(player.elo_peak), change.eloAfter);

      await supabase.from("players").update({
        elo_rating: change.eloAfter,
        elo_peak: newPeak,
        total_tournaments: player.total_tournaments + 1,
        total_cashes: player.total_cashes + (change.prizeTotal > 0 ? 1 : 0),
        total_wins: player.total_wins + (change.position === 1 ? 1 : 0),
        total_prize_won: Number(player.total_prize_won) + change.prizeTotal,
        total_buy_ins_spent: Number(player.total_buy_ins_spent) + buyIn,
      }).eq("id", change.playerId);

      await supabase.from("elo_history").insert({
        player_id: change.playerId,
        tournament_id: tournamentId,
        elo_before: change.eloBefore,
        elo_after: change.eloAfter,
        elo_change: change.eloChange,
      });

      await supabase.from("tournament_results").update({
        elo_before: change.eloBefore,
        elo_after: change.eloAfter,
        elo_change: change.eloChange,
      }).eq("tournament_id", tournamentId).eq("player_id", change.playerId);
    }

    // 👇 MAGIA UNIFICADA: Identificamos qué perfiles reales jugaron y actualizamos su ELO unificado automáticamente
    const uniqueProfileIds = [...new Set(
      Array.from(playerMap.values())
        .map(p => p.profile_id)
        .filter(Boolean)
    )];

    for (const pid of uniqueProfileIds) {
      if (pid) await syncUnifiedEloForProfile(pid);
    }

    await supabase.from("tournaments").update({ results_uploaded: true, status: "completed" }).eq("id", tournamentId);
    return { success: true, message: "ELO calculado" };
  } catch (err) {
    return { success: false, message: "Error interno" };
  }
}

// ═══════════════════════════════════════════════════
// REVERSE ELO — Restaurada para compatibilidad del Admin
// ═══════════════════════════════════════════════════

export async function reverseElo(tournamentId: string) {
  // Solo borramos el historial de ELO. 
  // La reconstrucción pesada de perfiles se hace en tournaments.ts
  await supabase.from("elo_history").delete().eq("tournament_id", tournamentId);
  
  await supabase.from("tournaments").update({ 
    results_uploaded: false,
    status: 'scheduled' 
  }).eq("id", tournamentId);

  return { success: true, message: "ELO revertido" };
}

// ═══════════════════════════════════════════════════
// SINCRONIZACIÓN DE ELO UNIFICADO (Dato Materializado)
// ═══════════════════════════════════════════════════

/**
 * Recalcula y guarda el ELO unificado de un solo perfil. 
 * Se dispara automáticamente cada vez que un jugador termina un torneo.
 */
export async function syncUnifiedEloForProfile(profileId: string) {
  const { data: players } = await supabase.from("players").select("slug, elo_rating").eq("profile_id", profileId);
  
  if (!players || players.length === 0) return;
  
  // 👇 Extraemos de forma segura para TypeScript
  const mainPlayer = players[0];
  if (!mainPlayer || !mainPlayer.slug) return;
  
  const { data: history } = await supabase.rpc("get_unified_elo_history", { p_slug: mainPlayer.slug });
  
  let finalElo = Number(mainPlayer.elo_rating);
  if (history && history.length > 0) {
    const lastEntry = history[history.length - 1];
    if (lastEntry) {
      finalElo = Number(lastEntry.elo_after);
    }
  }
  
  await supabase.from("profiles").update({ unified_elo: finalElo }).eq("id", profileId);
}

/**
 * Script masivo de Backfill (Solo para uso del Super Admin).
 * Recorre TODOS los perfiles de la base de datos y materializa su ELO real.
 */
export async function syncAllUnifiedElos(): Promise<{ success: boolean; message: string }> {
  try {
    const { data: profiles, error } = await supabase
      .from("profiles")
      .select("id, players!inner(slug, elo_rating)"); // Trae solo perfiles que tienen jugadores

    if (error || !profiles) return { success: false, message: "Error obteniendo perfiles." };

    let updatedCount = 0;
    for (const p of profiles) {
      if (!p.players) continue;
      
      // 👇 Convertimos a array de forma segura por si Supabase devuelve un objeto singular o un array
      const playersList = Array.isArray(p.players) ? p.players : [p.players];
      const mainPlayer = playersList[0];
      
      if (!mainPlayer || !mainPlayer.slug) continue;
      
      const { data: history } = await supabase.rpc("get_unified_elo_history", { p_slug: mainPlayer.slug });
      
      let finalElo = Number(mainPlayer.elo_rating);
      if (history && history.length > 0) {
        const lastEntry = history[history.length - 1];
        if (lastEntry) {
          finalElo = Number(lastEntry.elo_after);
        }
      }

      await supabase.from("profiles").update({ unified_elo: finalElo }).eq("id", p.id);
      updatedCount++;
    }

    return { success: true, message: `¡Migración completada! ${updatedCount} perfiles actualizados con ELO real.` };
  } catch (err) {
    return { success: false, message: "Error interno en la sincronización." };
  }
}