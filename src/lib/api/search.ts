// src/lib/api/search.ts
import { supabase } from "../supabase";
import type { SearchResult } from "../../types";

export async function searchAll(query: string): Promise<SearchResult[]> {
  if (query.length < 2) return [];

  const pattern = `%${query}%`;

  const [playersRes, clubsRes, leaguesRes, tournamentsRes] = await Promise.all([
    supabase
      .from("players")
      // 👇 Pedimos explícitamente el slug
      .select("id, slug, nickname, country_code")
      .ilike("nickname", pattern)
      .limit(5),
    supabase
      .from("clubs")
      // 👇 Pedimos explícitamente el slug
      .select("id, slug, name, country_code")
      .eq("is_approved", true)
      .ilike("name", pattern)
      .limit(5),
    supabase
      .from("leagues")
      // 👇 Pedimos explícitamente el slug
      .select("id, slug, name, status")
      .ilike("name", pattern)
      .limit(5),
    supabase
      .from("tournaments")
      // 👇 Pedimos explícitamente el slug (por si en un futuro los torneos tienen perfil propio)
      .select("id, slug, name, status")
      .ilike("name", pattern)
      .limit(5),
  ]);

  const results: any[] = []; // Usamos any[] aquí para evitar que TypeScript llore si SearchResult aún no tiene "slug" en tu archivo types.ts

  if (playersRes.data) {
    for (const p of playersRes.data) {
      results.push({
        type: "player",
        id: p.id,
        slug: p.slug, // 👈 Enviamos el slug al frontend
        title: p.nickname,
        subtitle: p.country_code,
        icon: "🎮",
      });
    }
  }

  if (clubsRes.data) {
    for (const c of clubsRes.data) {
      results.push({
        type: "club",
        id: c.id,
        slug: c.slug, // 👈 Enviamos el slug al frontend
        title: c.name,
        subtitle: c.country_code,
        icon: "🏛️",
      });
    }
  }

  if (leaguesRes.data) {
    for (const l of leaguesRes.data) {
      results.push({
        type: "league",
        id: l.id,
        slug: l.slug, // 👈 Enviamos el slug al frontend
        title: l.name,
        subtitle: l.status,
        icon: "🏆",
      });
    }
  }

  if (tournamentsRes.data) {
    for (const t of tournamentsRes.data) {
      results.push({
        type: "tournament",
        id: t.id,
        slug: t.slug, // 👈 Enviamos el slug al frontend
        title: t.name,
        subtitle: t.status,
        icon: "📅",
      });
    }
  }

  return results as SearchResult[];
}