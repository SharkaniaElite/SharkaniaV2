import { supabase } from "../supabase";
import { GUARDED_LEAGUE_RPC_ENABLED } from "./guarded-leagues";

/**
 * Candidate only. Intentionally OFF in all existing deployments.
 * The independently guarded writer is installed after Release A and must never
 * run without the matching league RPC/ACL cutover. No REST fallback.
 */
export const GUARDED_INDEPENDENT_RESULTS_RPC_ENABLED =
  GUARDED_LEAGUE_RPC_ENABLED &&
  import.meta.env.VITE_INDEPENDENT_RESULTS_GUARDED_RPC === "true";

export interface GuardedIndependentResult {
  position: number;
  nickname: string;
  prizeWon: number;
  buyInsCount: number;
}

export interface GuardedIndependentReceipt {
  status: "published";
  players: number;
  newPlayers: number;
  currency: "USD";
  atomic: true;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** First publication ONLY; historical edits and non-USD remain blocked. */
export async function publishInitialIndependentResultsGuarded(
  tournamentId: string,
  rows: readonly GuardedIndependentResult[],
): Promise<GuardedIndependentReceipt> {
  if (!GUARDED_INDEPENDENT_RESULTS_RPC_ENABLED) {
    throw new Error("La publicación protegida de torneos independientes no está habilitada.");
  }
  if (!UUID.test(tournamentId)) {
    throw new Error("Identificador de torneo inválido.");
  }
  if (rows.length < 2 || rows.length > 1000) {
    throw new Error("La publicación requiere entre 2 y 1000 jugadores.");
  }

  const nicknames = new Set<string>();
  const positions = new Set<number>();
  const payload = rows.map((row) => {
    const nickname = row.nickname.trim();
    const normalized = nickname.toLocaleLowerCase("en");
    if (!nickname || nickname.length > 80 || nicknames.has(normalized)) {
      throw new Error("Hay nicknames vacíos, repetidos o de longitud inválida.");
    }
    if (!Number.isSafeInteger(row.position) || row.position < 1 ||
      row.position > rows.length || positions.has(row.position)) {
      throw new Error("Las posiciones deben ser únicas y consecutivas.");
    }
    if (!Number.isFinite(row.prizeWon) || row.prizeWon < 0 ||
      row.prizeWon > 100000000) {
      throw new Error("Los premios deben ser montos válidos y no negativos.");
    }
    if (!Number.isSafeInteger(row.buyInsCount) || row.buyInsCount < 1 ||
      row.buyInsCount > 100) {
      throw new Error("Las entradas deben ser un entero de 1 a 100.");
    }

    nicknames.add(normalized);
    positions.add(row.position);
    return {
      nickname,
      position: row.position,
      prize_won: row.prizeWon,
      bounties_won: 0,
      league_points_earned: 0,
      buy_ins_count: row.buyInsCount,
      // Browser never sends player_id, owner, Elo, currency or profile.
    };
  });

  const { data, error } = await supabase.rpc(
    "publish_independent_nickname_results_guarded",
    { p_tournament_id: tournamentId, p_results: payload },
  );
  if (error) {
    if (error.code === "42501") {
      throw new Error("Solo el club organizador o el superadministrador puede publicar.");
    }
    if (error.code === "PT409") {
      throw new Error("La publicación está bloqueada por historial, orden ELO o moneda. No se realizaron cambios.");
    }
    if (error.code === "PT422") {
      throw new Error("Los resultados no superaron las validaciones de servidor.");
    }
    // Missing RPC or network outage: NEVER return to browser-side ELO.
    throw new Error("No se confirmó la publicación. Comprueba el torneo antes de reintentar.");
  }

  const result = data as Record<string, unknown> | null;
  if (!result || result.status !== "published" || result.atomic !== true ||
    result.currency !== "USD" || !Number.isSafeInteger(result.players) ||
    !Number.isSafeInteger(result.new_players)) {
    throw new Error("Respuesta incompleta del servidor. Comprueba el torneo antes de reintentar.");
  }
  return {
    status: "published",
    players: result.players as number,
    newPlayers: result.new_players as number,
    currency: "USD",
    atomic: true,
  };
}
