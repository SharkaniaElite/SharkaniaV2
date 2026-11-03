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

export async function getStatsSpyHistory(slug: string): Promise<StatsSpyHistoryEntry[]> {
  const pageSize = 250;
  const maxPages = 40; // 10,000 records; avoid unbounded RPC loops.
  const history: StatsSpyHistoryEntry[] = [];

  for (let page = 0; page < maxPages; page++) {
    const { data, error } = await supabase.rpc("stats_spy_get_history_v1", {
      p_slug: slug,
      p_limit: pageSize,
      p_offset: page * pageSize,
    });
    if (error) throw error;
    if (!Array.isArray(data)) throw new Error("Respuesta de historial premium inválida");
    history.push(...(data as StatsSpyHistoryEntry[]));
    if (data.length < pageSize) return history;
  }

  // Fail visibly rather than presenting a truncated 10,000-row response as complete.
  throw new Error("Historial demasiado extenso para este visor: requiere paginación");
}
