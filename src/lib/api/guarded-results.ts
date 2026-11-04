import { supabase } from "../supabase";
import { GUARDED_ELO_RPC_ENABLED } from "./guarded-elo";

/**
 * Feature switch for the proposed ONE-RPC tournament publication workflow.
 *
 * This module can safely ship in a draft branch before the SQL proposal exists:
 * it never falls back to browser writes, and both switches must be enabled.
 * Do NOT activate until server SQL + grants + admin E2E have passed on QA.
 */
export const GUARDED_RESULTS_RPC_ENABLED =
  import.meta.env.VITE_TOURNAMENT_PUBLISH_RPC === "true";

export interface GuardedTournamentResultInput {
  playerId?: string | null;
  nickname: string;
  countryCode?: string | null;
  position: number;
  prizeWon: number;
  bountiesWon?: number;
  leaguePoints?: number | null;
  ccpClub?: string | null;
  buyInsCount: number;
}

export type GuardedTournamentPublication =
  | { success: true; message: string; playersProcessed: number }
  | { success: false; message: string };

export function buildGuardedTournamentResults(
  rows: readonly GuardedTournamentResultInput[],
): Array<Record<string, string | number | null>> {
  if (rows.length < 2 || rows.length > 1000) {
    throw new Error("La publicación requiere entre 2 y 1.000 jugadores.");
  }

  const nicknames = new Set<string>();
  const ids = new Set<string>();
  const positions = new Set<number>();

  return rows.map((row) => {
    const nickname = row.nickname.trim();
    if (nickname.length < 2 || nickname.length > 80) {
      throw new Error("Hay nicknames inválidos (entre 2 y 80 caracteres).");
    }
    const nicknameKey = nickname.toLocaleLowerCase("es");
    if (nicknames.has(nicknameKey)) {
      throw new Error("Hay nicknames duplicados en los resultados.");
    }
    nicknames.add(nicknameKey);

    if (!Number.isSafeInteger(row.position) ||
        row.position < 1 || row.position > rows.length ||
        positions.has(row.position)) {
      throw new Error("Las posiciones deben ser únicas y consecutivas desde 1.");
    }
    positions.add(row.position);

    const id = row.playerId?.trim() || null;
    if (id !== null) {
      if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id) || ids.has(id)) {
        throw new Error("Hay identificadores de jugador inválidos o duplicados.");
      }
      ids.add(id);
    }

    const country = row.countryCode?.trim().toUpperCase() || null;
    if (country && !/^[A-Z]{2}$/.test(country)) {
      throw new Error("El código de país es inválido.");
    }

    const prize = row.prizeWon;
    const bounties = row.bountiesWon ?? 0;
    const points = row.leaguePoints ?? 0;
    if (![prize, bounties, points].every(
      (n) => typeof n === "number" && Number.isFinite(n) && n >= 0,
    )) {
      throw new Error("Premios, bounties y puntos deben ser valores válidos.");
    }
    if (!Number.isSafeInteger(row.buyInsCount) || row.buyInsCount < 1) {
      throw new Error("Cada jugador requiere una cantidad entera positiva de entradas.");
    }

    // Allowlisted data only. ELO, ratings, history and foreign tournament
    // ownership are calculated / validated by the server, never by the browser.
    return {
      player_id: id,
      nickname,
      country_code: country,
      position: row.position,
      prize_won: prize,
      bounties_won: bounties,
      league_points_earned: points,
      ccp_club: row.ccpClub?.trim() || null,
      buy_ins_count: row.buyInsCount,
    };
  });
}

export async function publishTournamentResultsGuarded(
  tournamentId: string,
  rows: readonly GuardedTournamentResultInput[],
): Promise<GuardedTournamentPublication> {
  // Fail closed even if someone mistakenly enables just one feature switch.
  if (!GUARDED_RESULTS_RPC_ENABLED || !GUARDED_ELO_RPC_ENABLED) {
    return {
      success: false,
      message: "La publicación transaccional todavía no está habilitada. No se modificó el torneo.",
    };
  }

  let payload: ReturnType<typeof buildGuardedTournamentResults>;
  try {
    payload = buildGuardedTournamentResults(rows);
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Resultados inválidos.",
    };
  }

  try {
    const { data, error } = await supabase.rpc("publish_tournament_results_guarded", {
      p_tournament_id: tournamentId,
      p_results: payload,
    });

    if (error) {
      // Do not expose internal database error messages or try legacy writes.
      return {
        success: false,
        message: "El servidor rechazó la publicación. Comprueba permisos, orden cronológico, moneda y resultados; no se hicieron escrituras desde el navegador.",
      };
    }
    const result = data as Record<string, unknown> | null;
    if (!result || result.success !== true ||
        result.tournament_id !== tournamentId ||
        typeof result.players_processed !== "number" ||
        !Number.isSafeInteger(result.players_processed) ||
        result.players_processed !== payload.length) {
      return {
        success: false,
        message: "Respuesta inesperada del servidor. Verifica el estado real del torneo antes de reintentar.",
      };
    }
    return {
      success: true,
      message: "Resultados guardados y estadísticas recalculadas en el servidor.",
      playersProcessed: result.players_processed,
    };
  } catch {
    return {
      success: false,
      message: "No se pudo contactar con la publicación protegida. Revisa el torneo antes de reintentar; no hubo escritura alternativa.",
    };
  }
}
