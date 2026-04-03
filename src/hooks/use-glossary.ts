// src/hooks/use-glossary.ts
import { useQuery } from "@tanstack/react-query";
import {
  getGlossaryTerms,
  getGlossaryTermBySlug,
} from "../lib/api/glossary";

export function useGlossaryTerms() {
  return useQuery({
    queryKey: ["glossary-terms"],
    queryFn: getGlossaryTerms,
    staleTime: 1000 * 60 * 30, // 30 min — los términos no cambian seguido
  });
}

export function useGlossaryTerm(slug: string | undefined) {
  return useQuery({
    queryKey: ["glossary-term", slug],
    queryFn: () => getGlossaryTermBySlug(slug!),
    enabled: !!slug,
    staleTime: 1000 * 60 * 30,
  });
}
