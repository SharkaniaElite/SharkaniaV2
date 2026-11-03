import { supabase } from "../supabase";

/**
 * Opt-in migration switch. OFF until SQL, grants and public API cutover have
 * been validated together. Never fall back to a public RPC if a secure call fails.
 */
export const SECURE_STATS_SPY_MODE = import.meta.env.VITE_STATS_SPY_SECURE_RPC === "true";

export interface StatsSpySummary {
  total_tournaments: number;
  total_cashes: number;
  total_wins: number;
  total_prize_won: number;
  total_buy_ins_spent: number;
  profit: number;
  roi_percent: number | null;
}

export interface StatsSpyHistoryEntry {
  id: string;
  created_at: string;
  position: number;
  prize_won: number;
  buy_ins_count: number | null;
  elo_change: number | null;
  ccp_club: string | null;
  tournaments: {
    id: string;
    name: string;
    slug: string;
    buy_in: number;
    start_datetime: string;
    clubs: { id: string; name: string; slug: string } | null;
  };
  players: { nickname: string };
}

export async function getStatsSpySummary(slug: string): Promise<StatsSpySummary | null> {
  const { data, error } = await supabase.rpc("stats_spy_get_summary_v1", {
    p_slug: slug,
  });
  if (error) throw error;
  return (data as StatsSpySummary | null) ?? null;
}

/**
 * Read only one authorized page at a time. PostgreSQL validates entitlement on
 * every request. There is no fallback to public tournament_results.
 */
export const STATS_SPY_HISTORY_PAGE_SIZE = 30;

export async function getStatsSpyHistoryPage(
  slug: string,
  offset: number,
  limit = STATS_SPY_HISTORY_PAGE_SIZE
): Promise<StatsSpyHistoryEntry[]> {
  if (!Number.isSafeInteger(offset) || offset < 0) throw new Error("Desplazamiento de historial inválido");
  const safeLimit = Math.min(100, Math.max(1, Math.floor(limit)));
  const { data, error } = await supabase.rpc("stats_spy_get_history_v1", {
    p_slug: slug,
    p_limit: safeLimit,
    p_offset: offset,
  });
  if (error) throw error;
  if (!Array.isArray(data)) throw new Error("Respuesta de historial premium inválida");
  return data as StatsSpyHistoryEntry[];
}
