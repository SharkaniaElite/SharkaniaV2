import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useAuthStore } from "../stores/auth-store";
import {
  getStatsSpyHistoryPage,
  STATS_SPY_HISTORY_PAGE_SIZE,
  getStatsSpySummary,
  SECURE_STATS_SPY_MODE,
} from "../lib/api/stats-spy";

/** API authorization is still enforced in PostgreSQL, never in this hook. */
export function useSecureStatsSpySummary(slug: string | undefined, hasFeatureAccess: boolean) {
  const viewerId = useAuthStore(s => s.user?.id ?? null);
  return useQuery({
    queryKey: ["stats-spy-v1-summary", slug, viewerId],
    queryFn: () => getStatsSpySummary(slug!),
    enabled: SECURE_STATS_SPY_MODE && !!slug && !!viewerId && hasFeatureAccess,
    staleTime: 60_000,
    retry: false,
  });
}

export function useSecureStatsSpyHistory(slug: string | undefined, hasFeatureAccess: boolean) {
  const viewerId = useAuthStore(s => s.user?.id ?? null);
  return useInfiniteQuery({
    queryKey: ["stats-spy-v1-history-pages", slug, viewerId],
    initialPageParam: 0,
    queryFn: ({ pageParam }) => getStatsSpyHistoryPage(slug!, pageParam, STATS_SPY_HISTORY_PAGE_SIZE),
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length === STATS_SPY_HISTORY_PAGE_SIZE
        ? allPages.length * STATS_SPY_HISTORY_PAGE_SIZE
        : undefined,
    enabled: SECURE_STATS_SPY_MODE && !!slug && !!viewerId && hasFeatureAccess,
    staleTime: 60_000,
    retry: false,
  });
}
