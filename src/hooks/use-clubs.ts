// src/hooks/use-clubs.ts
import { useQuery } from "@tanstack/react-query";
import {
  getClubs,
  getClubById,
  getClubBySlug,
  searchClubs,
  getPokerRooms,
} from "../lib/api/clubs";

export function useClubs() {
  return useQuery({
    queryKey: ["clubs"],
    queryFn: getClubs,
  });
}

export function useClub(id: string | undefined) {
  return useQuery({
    queryKey: ["club", id],
    queryFn: () => getClubById(id!),
    enabled: !!id,
  });
}

export function useClubBySlug(slug: string | undefined) {
  return useQuery({
    queryKey: ["club-slug", slug],
    queryFn: () => getClubBySlug(slug!),
    enabled: !!slug,
  });
}

export function useSearchClubs(query: string, limit: number = 10) {
  return useQuery({
    queryKey: ["search-clubs", query],
    queryFn: () => searchClubs(query, limit),
    enabled: query.length >= 2,
  });
}

export function usePokerRooms() {
  return useQuery({
    queryKey: ["poker-rooms"],
    queryFn: getPokerRooms,
  });
}
