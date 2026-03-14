// src/lib/api/elo-engine.ts
import { supabase } from "../supabase";

interface PlayerResult {
  player_id: string;
  position: number;
  prize_won: number;
}

interface PlayerEloData {
  id: string;
  elo_rating: number;
  elo_peak: number;
  total_tournaments: number;
  total_cashes: number;
  total_wins: number;
  total_prize_won: number;
  total_buy_ins_spent: number;
}

// ═══════════════════════════════════════════════════
// CALCULATE ELO — Called after uploading tournament results
// ═══════════════════════════════════════════════════

export async function calculateElo(tournamentId: string): Promise<{ success: boolean; message: string }> {
  try {
    // 1. Get tournament details
    const { data: tournament, error: tError } = await supabase
      .from("tournaments")
      .select("id, buy_in, league_id, scoring_system_id:leagues(scoring_system_id)")
      .eq("id", tournamentId)
      .single();

    if (tError || !tournament) {
      return { success: false, message: "Torneo no encontrado" };
    }

    // 2. Get all results for this tournament
    const { data: results, error: rError } = await supabase
      .from("tournament_results")
      .select("player_id, position, prize_won")
      .eq("tournament_id", tournamentId)
      .order("position", { ascending: true });

    if (rError || !results || results.length < 2) {
      return { success: false, message: "Se necesitan al menos 2 jugadores para calcular ELO" };
    }

    const playerIds = results.map((r) => r.player_id);
    const N = results.length;
    const buyIn = Number(tournament.buy_in) || 0;

    // 3. Get current ELO data for all players
    const { data: players, error: pError } = await supabase
      .from("players")
      .select("id, elo_rating, elo_peak, total_tournaments, total_cashes, total_wins, total_prize_won, total_buy_ins_spent")
      .in("id", playerIds);

    if (pError || !players) {
      return { success: false, message: "Error obteniendo datos de jugadores" };
    }

    const playerMap = new Map<string, PlayerEloData>();
    for (const p of players) {
      playerMap.set(p.id, p as PlayerEloData);
    }

    // 4. Calculate ELO for each player
    const sumAllElos = players.reduce((sum, p) => sum + Number(p.elo_rating), 0);
    const avgEloField = sumAllElos / N;
    const weight = avgEloField / 1200;

    const eloChanges: Array<{
      playerId: string;
      eloBefore: number;
      eloAfter: number;
      eloChange: number;
      position: number;
      prizeWon: number;
    }> = [];

    for (const result of results) {
      const player = playerMap.get(result.player_id);
      if (!player) continue;

      const eloI = Number(player.elo_rating);
      const position = result.position;

      // Step 1: Normalized score
      const score = (N - position) / (N - 1);

      // Step 2: Expected score
      const avgEloOpponents = (sumAllElos - eloI) / (N - 1);
      const expected = 1 / (1 + Math.pow(10, (avgEloOpponents - eloI) / 400));

      // Step 3: Dynamic K factor
      const kBase = player.total_tournaments < 30 ? 40 : 20;
      let K = kBase * (1 + Math.log10(buyIn + 1) * 0.1);
      K = K * (1 + Math.log10(N) * 0.15);

      // Step 4 & 5: ELO change
      const eloChange = K * weight * (score - expected);
      const newElo = Math.max(100, eloI + eloChange);

      eloChanges.push({
        playerId: result.player_id,
        eloBefore: eloI,
        eloAfter: Math.round(newElo * 100) / 100,
        eloChange: Math.round(eloChange * 100) / 100,
        position: result.position,
        prizeWon: Number(result.prize_won),
      });
    }

    // 5. Save everything in batch
    for (const change of eloChanges) {
      const player = playerMap.get(change.playerId);
      if (!player) continue;

      const newPeak = Math.max(Number(player.elo_peak), change.eloAfter);
      const isCash = change.prizeWon > 0;
      const isWin = change.position === 1;

      // Update player stats
      await supabase
        .from("players")
        .update({
          elo_rating: change.eloAfter,
          elo_peak: newPeak,
          total_tournaments: player.total_tournaments + 1,
          total_cashes: player.total_cashes + (isCash ? 1 : 0),
          total_wins: player.total_wins + (isWin ? 1 : 0),
          total_prize_won: Number(player.total_prize_won) + change.prizeWon,
          total_buy_ins_spent: Number(player.total_buy_ins_spent) + buyIn,
        })
        .eq("id", change.playerId);

      // Save ELO history
      await supabase.from("elo_history").insert({
        player_id: change.playerId,
        tournament_id: tournamentId,
        elo_before: change.eloBefore,
        elo_after: change.eloAfter,
        elo_change: change.eloChange,
      });

      // Update tournament result with ELO data
      await supabase
        .from("tournament_results")
        .update({
          elo_before: change.eloBefore,
          elo_after: change.eloAfter,
          elo_change: change.eloChange,
        })
        .eq("tournament_id", tournamentId)
        .eq("player_id", change.playerId);
    }

    // 6. Mark tournament as results uploaded
    await supabase
      .from("tournaments")
      .update({ results_uploaded: true, status: "completed" })
      .eq("id", tournamentId);

    // 7. Calculate league points if tournament belongs to a league
    // (simplified - uses scoring system if available)
    if (tournament.league_id) {
      await calculateLeaguePoints(tournamentId, tournament.league_id, results);
    }

    return {
      success: true,
      message: `ELO calculado para ${eloChanges.length} jugadores`,
    };
  } catch (err) {
    console.error("ELO calculation error:", err);
    return { success: false, message: "Error interno al calcular ELO" };
  }
}

// ═══════════════════════════════════════════════════
// REVERSE ELO — Called when deleting a tournament
// ═══════════════════════════════════════════════════

export async function reverseElo(tournamentId: string): Promise<{ success: boolean; message: string }> {
  try {
    // 1. Get ELO history records for this tournament
    const { data: history, error: hError } = await supabase
      .from("elo_history")
      .select("*")
      .eq("tournament_id", tournamentId);

    if (hError) {
      return { success: false, message: "Error obteniendo historial ELO" };
    }

    if (!history || history.length === 0) {
      return { success: true, message: "No hay ELO que revertir" };
    }

    // 2. Get tournament details for buy-in
    const { data: tournament } = await supabase
      .from("tournaments")
      .select("buy_in")
      .eq("id", tournamentId)
      .single();

    const buyIn = Number(tournament?.buy_in) || 0;

    // 3. Get results to know prize_won per player
    const { data: results } = await supabase
      .from("tournament_results")
      .select("player_id, position, prize_won")
      .eq("tournament_id", tournamentId);

    const resultMap = new Map<string, { position: number; prize_won: number }>();
    for (const r of results ?? []) {
      resultMap.set(r.player_id, { position: r.position, prize_won: Number(r.prize_won) });
    }

    // 4. Restore each player's ELO
    for (const h of history) {
      const result = resultMap.get(h.player_id);
      const isCash = result ? result.prize_won > 0 : false;
      const isWin = result ? result.position === 1 : false;
      const prizeWon = result ? result.prize_won : 0;

      // Get current player data
      const { data: player } = await supabase
        .from("players")
        .select("total_tournaments, total_cashes, total_wins, total_prize_won, total_buy_ins_spent")
        .eq("id", h.player_id)
        .single();

      if (!player) continue;

      // Restore ELO to before state
      await supabase
        .from("players")
        .update({
          elo_rating: h.elo_before,
          total_tournaments: Math.max(0, player.total_tournaments - 1),
          total_cashes: Math.max(0, player.total_cashes - (isCash ? 1 : 0)),
          total_wins: Math.max(0, player.total_wins - (isWin ? 1 : 0)),
          total_prize_won: Math.max(0, Number(player.total_prize_won) - prizeWon),
          total_buy_ins_spent: Math.max(0, Number(player.total_buy_ins_spent) - buyIn),
        })
        .eq("id", h.player_id);

      // Recalculate peak from remaining history
      const { data: remainingHistory } = await supabase
        .from("elo_history")
        .select("elo_after")
        .eq("player_id", h.player_id)
        .neq("tournament_id", tournamentId)
        .order("elo_after", { ascending: false })
        .limit(1);

      const newPeak = remainingHistory?.[0]?.elo_after
        ? Math.max(Number(h.elo_before), Number(remainingHistory[0].elo_after))
        : Number(h.elo_before);

      await supabase
        .from("players")
        .update({ elo_peak: newPeak })
        .eq("id", h.player_id);
    }

    // 5. Delete ELO history records
    await supabase
      .from("elo_history")
      .delete()
      .eq("tournament_id", tournamentId);

    // 6. Delete league standings if applicable
    const { data: tournament2 } = await supabase
      .from("tournaments")
      .select("league_id")
      .eq("id", tournamentId)
      .single();

    if (tournament2?.league_id) {
      // Recalculate league standings would go here
      // For now, just remove the points
    }

    // 7. Reset tournament status
    await supabase
      .from("tournaments")
      .update({ results_uploaded: false })
      .eq("id", tournamentId);

    return {
      success: true,
      message: `ELO revertido para ${history.length} jugadores`,
    };
  } catch (err) {
    console.error("ELO reverse error:", err);
    return { success: false, message: "Error interno al revertir ELO" };
  }
}

// ═══════════════════════════════════════════════════
// LEAGUE POINTS — Simple scoring based on position
// ═══════════════════════════════════════════════════

async function calculateLeaguePoints(
  tournamentId: string,
  leagueId: string,
  results: PlayerResult[]
) {
  // Get scoring system for this league
  const { data: league } = await supabase
    .from("leagues")
    .select("scoring_system_id")
    .eq("id", leagueId)
    .single();

  let pointsConfig: Record<string, number> = {
    "1": 100, "2": 75, "3": 60, "4": 50, "5": 40,
    "6": 30, "7": 25, "8": 20, "9": 15, "10": 10,
  };
  let participationPoints = 5;

  if (league?.scoring_system_id) {
    const { data: scoring } = await supabase
      .from("scoring_systems")
      .select("config")
      .eq("id", league.scoring_system_id)
      .single();

    if (scoring?.config) {
      const config = scoring.config as Record<string, unknown>;
      if (config.positions) {
        pointsConfig = config.positions as Record<string, number>;
      }
      if (typeof config.participation_points === "number") {
        participationPoints = config.participation_points;
      }
    }
  }

  // Assign points and update standings
  for (const result of results) {
    const points = pointsConfig[String(result.position)] ?? participationPoints;

    // Update tournament_results with league points
    await supabase
      .from("tournament_results")
      .update({ league_points_earned: points })
      .eq("tournament_id", tournamentId)
      .eq("player_id", result.player_id);

    // Upsert league standings
    const { data: existing } = await supabase
      .from("league_standings")
      .select("id, total_points, tournaments_played, best_position")
      .eq("league_id", leagueId)
      .eq("player_id", result.player_id)
      .single();

    if (existing) {
      await supabase
        .from("league_standings")
        .update({
          total_points: Number(existing.total_points) + points,
          tournaments_played: existing.tournaments_played + 1,
          best_position: existing.best_position
            ? Math.min(existing.best_position, result.position)
            : result.position,
        })
        .eq("id", existing.id);
    } else {
      await supabase.from("league_standings").insert({
        league_id: leagueId,
        player_id: result.player_id,
        total_points: points,
        tournaments_played: 1,
        best_position: result.position,
        rank_position: null,
      });
    }
  }

  // Update rank positions
  const { data: standings } = await supabase
    .from("league_standings")
    .select("id, total_points")
    .eq("league_id", leagueId)
    .order("total_points", { ascending: false });

  if (standings) {
    for (let i = 0; i < standings.length; i++) {
      await supabase
        .from("league_standings")
        .update({ rank_position: i + 1 })
        .eq("id", standings[i]!.id);
    }
  }
}
