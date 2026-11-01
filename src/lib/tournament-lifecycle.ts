/**
 * Public tournament lifecycle. No database mutation or scheduled deletion:
 * a past tournament without uploaded results is public for seven days,
 * then becomes an admin-only archival record. Uploading results restores
 * permanent public visibility.
 */
export const TOURNAMENT_GRACE_PERIOD_DAYS = 7;
export const TOURNAMENT_GRACE_PERIOD_MS = TOURNAMENT_GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000;

type LifecycleTournament = {
  start_datetime: string;
  results_uploaded: boolean;
  status?: string | null;
};

export type TournamentLifecyclePhase = "upcoming" | "pending" | "archived" | "results";

export function getTournamentLifecyclePhase(
  tournament: LifecycleTournament,
  nowMs: number = Date.now(),
): TournamentLifecyclePhase {
  // Never hide or expire a tournament with uploaded results, regardless of date.
  if (tournament.results_uploaded) return "results";
  if (tournament.status === "cancelled") return "archived";

  const startMs = Date.parse(tournament.start_datetime);
  if (!Number.isFinite(startMs)) return "archived";
  if (startMs + TOURNAMENT_GRACE_PERIOD_MS <= nowMs) return "archived";

  // In-progress tournaments should remain in the public upcoming/live area.
  if (startMs > nowMs || tournament.status === "live" || tournament.status === "late_registration") {
    return "upcoming";
  }
  return "pending";
}

export function isPublicTournamentVisible(
  tournament: LifecycleTournament,
  nowMs: number = Date.now(),
): boolean {
  return getTournamentLifecyclePhase(tournament, nowMs) !== "archived";
}

export function publicTournamentCutoffIso(nowMs: number = Date.now()): string {
  return new Date(nowMs - TOURNAMENT_GRACE_PERIOD_MS).toISOString();
}
