import { supabase } from "../supabase";
import { GUARDED_INDEPENDENT_RESULTS_RPC_ENABLED } from "./guarded-independent-results";

/**
 * QA-only coordinated cutover: PR #95 + #96 + #97 must all be installed,
 * official FX source pre-captured, v2 DB activation approved, and all 3 flags
 * set deliberately. Default false. This code cannot activate anything alone.
 */
export const GUARDED_ELO_V2_RPC_ENABLED =
  GUARDED_INDEPENDENT_RESULTS_RPC_ENABLED &&
  import.meta.env.VITE_ELO_USD_V2_RPC === "true";

export interface V2InitialResult {
  position: number;
  nickname: string;
  prizeWon: number;
  leaguePoints?: number | null;
  ccpClub?: string | null;
  buyInsCount: number;
}

export interface V2Receipt {
  status: "published";
  currency: "USD" | "CLP" | "EUR";
  buyInUsd: number;
  newPlayers: number;
  atomic: true;
  algorithmVersion: "elo-v2-usd-normalized";
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Server chooses the entire exchange-rate observation; browser sends NONE. */
export async function publishInitialResultsV2(
  tournamentId: string,
  hasLeague: boolean,
  rows: readonly V2InitialResult[],
): Promise<V2Receipt> {
  if (!GUARDED_ELO_V2_RPC_ENABLED) {
    throw new Error("ELO v2 protegido todavía no está habilitado.");
  }
  if (!UUID.test(tournamentId) || rows.length < 2 || rows.length > 1000) {
    throw new Error("Identificador de torneo o participantes inválidos.");
  }

  const names = new Set<string>();
  const positions = new Set<number>();
  const p_results = rows.map((row) => {
    const nickname = row.nickname.trim();
    const normalized = nickname.toLocaleLowerCase("en");
    if (!nickname || nickname.length > 80 || names.has(normalized)) {
      throw new Error("Nicknames vacíos, duplicados o demasiado largos.");
    }
    if (!Number.isSafeInteger(row.position) || row.position < 1 ||
      row.position > rows.length || positions.has(row.position)) {
      throw new Error("Posiciones inválidas o no consecutivas.");
    }
    if (!Number.isFinite(row.prizeWon) || row.prizeWon < 0 ||
      row.prizeWon > 100000000 ||
      !Number.isSafeInteger(row.buyInsCount) ||
      row.buyInsCount < 1 || row.buyInsCount > 100) {
      throw new Error("Premios y número de entradas inválidos.");
    }
    const leaguePoints = hasLeague ? Number(row.leaguePoints ?? 0) : 0;
    if (!Number.isFinite(leaguePoints) || leaguePoints < 0) {
      throw new Error("Puntos de liga inválidos.");
    }
    const ccpClub = hasLeague ? row.ccpClub?.trim() || null : null;
    if (ccpClub && ccpClub.length > 120) {
      throw new Error("Club CCP demasiado largo.");
    }
    names.add(normalized);
    positions.add(row.position);
    return {
      nickname,
      position: row.position,
      prize_won: row.prizeWon,
      bounties_won: 0,
      league_points_earned: leaguePoints,
      ccp_club: ccpClub,
      buy_ins_count: row.buyInsCount,
      // No currency, buy-in, fx_rate, rate ID, USD equivalent or player ID.
    };
  });

  const endpoint = hasLeague
    ? "publish_league_nickname_results_v2_guarded"
    : "publish_independent_nickname_results_v2_guarded";
  const { data, error } = await supabase.rpc(endpoint, {
    p_tournament_id: tournamentId,
    p_results,
  });
  if (error) {
    if (error.code === "42501") {
      throw new Error("Solo el club organizador autorizado puede publicar.");
    }
    if (error.code === "PT409") {
      throw new Error(
        "Publicación bloqueada: falta una cotización oficial anterior al torneo, " +
        "el evento es histórico o existen resultados previos. No se aplicaron cambios."
      );
    }
    if (error.code === "PT422") {
      throw new Error("El servidor rechazó los resultados o los importes.");
    }
    // RPC missing / network failure MUST NEVER fall back to the v1 browser path.
    throw new Error("No se confirmó ELO v2. Verifica el torneo antes de reintentar.");
  }

  const receipt = data as Record<string, unknown> | null;
  if (!receipt || receipt.status !== "published" ||
    receipt.atomic !== true || receipt.algorithm_version !== "elo-v2-usd-normalized" ||
    !["CLP", "EUR", "USD"].includes(String(receipt.currency)) ||
    typeof receipt.buy_in_usd !== "number" ||
    !Number.isFinite(receipt.buy_in_usd) ||
    receipt.buy_in_usd < 0 ||
    !Number.isSafeInteger(receipt.new_players)) {
    throw new Error("Recibo de ELO v2 incompleto. Comprueba el torneo; no reintentes a ciegas.");
  }
  return {
    status: "published",
    currency: receipt.currency as V2Receipt["currency"],
    buyInUsd: receipt.buy_in_usd,
    newPlayers: receipt.new_players as number,
    atomic: true,
    algorithmVersion: "elo-v2-usd-normalized",
  };
}
