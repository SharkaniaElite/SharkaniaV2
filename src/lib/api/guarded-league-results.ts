import { supabase } from "../supabase";
import { GUARDED_LEAGUE_RPC_ENABLED } from "./guarded-leagues";

/**
 * First publication ONLY. This is a future cutover client; the stable RPC
 * is not installed in production. Never fall back to browser DML.
 *
 * The server owns identity resolution (room + normalized nickname), league
 * ownership, Elo chronology, standings and native-currency postings.
 */
export interface GuardedInitialLeagueResult {
  position: number;
  nickname: string;
  prizeWon: number;
  leaguePoints: number;
  ccpClub: string | null;
  buyInsCount: number;
}

export interface GuardedLeaguePublicationReceipt {
  status: "published";
  newPlayers: number;
  currency: string;
  currencyPostings: number;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function publishInitialLeagueResultsGuarded(
  tournamentId: string,
  rows: readonly GuardedInitialLeagueResult[],
): Promise<GuardedLeaguePublicationReceipt> {
  if (!GUARDED_LEAGUE_RPC_ENABLED) {
    throw new Error("La publicación protegida de ligas todavía no está habilitada.");
  }
  if (!UUID.test(tournamentId)) {
    throw new Error("Identificador del torneo inválido.");
  }
  if (rows.length < 2 || rows.length > 1000) {
    throw new Error("El torneo debe incluir entre 2 y 1000 resultados.");
  }

  const names = new Set<string>();
  const positions = new Set<number>();
  const payload = rows.map(row => {
    const nickname = row.nickname.trim();
    const normalized = nickname.toLowerCase();
    if (!nickname || nickname.length > 80 || names.has(normalized)) {
      throw new Error("Hay nicknames vacíos, duplicados o demasiado largos.");
    }
    if (!Number.isSafeInteger(row.position) || row.position < 1 ||
        row.position > rows.length || positions.has(row.position)) {
      throw new Error("Las posiciones deben ser únicas y consecutivas desde 1.");
    }
    if (![row.prizeWon, row.leaguePoints].every(
      x => Number.isFinite(x) && x >= 0,
    )) {
      throw new Error("Los premios y los puntos deben ser números no negativos.");
    }
    if (!Number.isSafeInteger(row.buyInsCount) ||
        row.buyInsCount < 1 || row.buyInsCount > 100) {
      throw new Error("La cantidad de entradas debe ser un entero entre 1 y 100.");
    }
    const ccpClub = row.ccpClub?.trim() || null;
    if (ccpClub && ccpClub.length > 120) {
      throw new Error("El nombre del club CCP es demasiado largo.");
    }
    names.add(normalized);
    positions.add(row.position);
    return {
      nickname,
      position: row.position,
      prize_won: row.prizeWon,
      bounties_won: 0,
      league_points_earned: row.leaguePoints,
      ccp_club: ccpClub,
      buy_ins_count: row.buyInsCount,
      // Deliberately NEVER include player_id, currency, Elo or auth claims.
    };
  });

  const { data, error } = await supabase.rpc("publish_league_nickname_results_guarded", {
    p_tournament_id: tournamentId,
    p_results: payload,
  });
  if (error) {
    if (error.code === "42501") {
      throw new Error("Solo el club organizador principal puede publicar estos resultados.");
    }
    if (error.code === "PT409") {
      throw new Error("El torneo ya tiene resultados, existe un conflicto de orden ELO o su moneda aún no está autorizada. No se modificó nada.");
    }
    if (error.code === "PT422") {
      throw new Error("El servidor rechazó el archivo: verifica posiciones, nicknames, entradas y premios.");
    }
    // PGRST202 / 42883: backend not deployed, never use REST as fallback.
    throw new Error("No se pudo confirmar la publicación atómica. Comprueba el estado del torneo antes de reintentar.");
  }

  const result = data as Record<string, unknown> | null;
  if (!result || result.status !== "published" ||
      !Number.isSafeInteger(result.new_players) ||
      !Number.isSafeInteger(result.currency_postings) ||
      typeof result.currency !== "string") {
    throw new Error("La respuesta del servidor es inesperada. Verifica el torneo antes de volver a cargar.");
  }
  return {
    status: "published",
    newPlayers: result.new_players as number,
    currency: result.currency,
    currencyPostings: result.currency_postings as number,
  };
}
