// src/lib/api/glossary.ts
import React from "react";
import { supabase } from "../supabase";
import { Link } from "react-router-dom";

export interface GlossaryTerm {
  id: string;
  slug: string;
  term: string;
  short_definition: string;
  full_definition: string;
  category: string;
  related_terms: string[];
  related_links: Array<{ label: string; href: string }>;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export type GlossaryCategory =
  | "estadisticas"
  | "estrategia"
  | "torneos"
  | "mental-game"
  | "jugadores"
  | "plataformas"
  | "formatos"
  | "sharkania";

export const GLOSSARY_CATEGORIES: Record<GlossaryCategory, { label: string; icon: string }> = {
  estadisticas: { label: "Estadísticas", icon: "📊" },
  estrategia: { label: "Estrategia", icon: "🧠" },
  torneos: { label: "Torneos", icon: "🏆" },
  "mental-game": { label: "Mental Game", icon: "🧘" },
  jugadores: { label: "Jugadores", icon: "👤" },
  plataformas: { label: "Plataformas", icon: "📱" },
  formatos: { label: "Formatos", icon: "🃏" },
  sharkania: { label: "Sharkania", icon: "🦈" },
};

export async function getGlossaryTerms(): Promise<GlossaryTerm[]> {
  const { data, error } = await supabase
    .from("glossary_terms")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) throw error;
  return (data ?? []) as GlossaryTerm[];
}

export async function getGlossaryTermBySlug(
  slug: string
): Promise<GlossaryTerm | null> {
  const { data, error } = await supabase
    .from("glossary_terms")
    .select("*")
    .eq("slug", slug)
    .eq("is_active", true)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }

  return data as GlossaryTerm;
}

/**
 * Transforma un texto plano en un array de elementos React, 
 * inyectando links automáticos a los términos del glosario.
 */
export function renderWithLinksAndGlossary(text: string, terms: string[] = []): (string | React.ReactNode)[] | string {
  if (!text || !terms || terms.length === 0) return text;

  // Filtramos términos vacíos y escapamos caracteres especiales para el Regex
  const escapedTerms = terms
    .filter(t => t && t.length > 0)
    .map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|');
    
  if (!escapedTerms) return text;
  
  // Regex que busca los términos exactos (case insensitive)
  const regex = new RegExp(`\\b(${escapedTerms})\\b`, 'gi');
  const parts = text.split(regex);

  return parts.map((part, i) => {
    const isMatch = terms.some(t => t.toLowerCase() === part.toLowerCase());
    
    if (isMatch) {
      return (
        <Link
          key={i}
          to={`/glosario/${part.toLowerCase().replace(/\s+/g, '-')}`}
          className="text-sk-accent hover:underline font-bold transition-all"
        >
          {part}
        </Link>
      );
    }
    return part;
  });
}