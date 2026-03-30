// src/lib/api/champions.ts
import { supabase } from "../supabase";

export interface LeagueChampionNews {
  id: string;
  player_id: string;
  league_id: string;
  player_nickname: string;
  league_name: string;
  created_at: string;
}

export async function getLatestChampion(): Promise<LeagueChampionNews | null> {
  const { data, error } = await supabase
    .from("current_league_champion")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;

  // 🕒 Validamos si han pasado menos de 3 días (72 horas)
  const created = new Date(data.created_at).getTime();
  const now = new Date().getTime();
  const diffHours = (now - created) / (1000 * 60 * 60);

  if (diffHours > 72) return null;

  return data;
}