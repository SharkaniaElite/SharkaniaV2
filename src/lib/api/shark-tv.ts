import { CLERIGO_EPISODE, mergeLaunchEpisode, type SharkEpisode } from "../shark-tv";
import { supabase } from "../supabase";

export const sharkTvQueryKey = ["shark-tv"] as const;

export async function getAllSharkVideos(): Promise<SharkEpisode[]> {
  const { data, error } = await supabase
    .from("shark_tv_videos")
    .select("*")
    .order("created_at", { ascending: false })
    .returns<SharkEpisode[]>();
  if (error) throw error;
  return data ?? [];
}

export async function getSharkVideo(id: string): Promise<SharkEpisode | null> {
  if (id === CLERIGO_EPISODE.id) return CLERIGO_EPISODE;

  const { data, error } = await supabase.from("shark_tv_videos").select("*")
    .eq("id", id).maybeSingle<SharkEpisode>();
  if (error?.code === "22P02") return null;
  if (error) throw error;
  return data ? mergeLaunchEpisode(data) : null;
}
