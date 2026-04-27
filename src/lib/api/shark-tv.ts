// src/lib/api/shark-tv.ts
import { supabase } from "../supabase";

export async function getLatestSharkVideo() {
  const { data, error } = await supabase
    .from('shark_tv_videos')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    console.error("Error fetching latest video:", error);
    return null;
  }
  return data;
}

export async function getAllSharkVideos() {
  const { data, error } = await supabase
    .from('shark_tv_videos')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error("Error fetching videos:", error);
    return [];
  }
  return data || [];
}