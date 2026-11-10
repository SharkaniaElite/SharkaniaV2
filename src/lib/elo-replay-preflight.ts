/**
 * SHARKANIA ELO replay preflight — pure, read-only planning engine.
 *
 * IMPORTANT: this code DOES NOT update a database, does NOT recalculate
 * historical ELO and must not be interpreted as permission to replay.
 * Correcting a tournament propagates through every later published event
 * sharing a player (including opponents in that event), transitively.
 *
 * Historical ELO was assigned at UPLOAD time, not tournament start time.
 * Only recorded_at windows provide a defensible candidate event order.
 * Ambiguous event overlap, missing history or discontinuous player chains
 * prevent an automatic historical replay.
 */

export interface ReplayEloRecord {
  playerId: string;
  recordedAt: string;
  eloBefore: number;
  eloAfter: number;
  eloChange: number;
}

export interface ReplayTournament {
  id: string;
  scheduledAt: string;
  /** Exact player IDs from tournament_results, not names or profiles. */
  resultPlayerIds: string[];
  /** Exact player history rows from elo_history for this tournament. */
  elo: ReplayEloRecord[];
}

export type ReplayBlockerKind =
  | "invalid_data"
  | "missing_elo"
  | "duplicate_player"
  | "ambiguous_publication_order"
  | "elo_chain_break";

export interface ReplayIssue {
  kind: ReplayBlockerKind;
  tournamentId: string;
  playerId?: string;
  detail: string;
}

export interface ReplayPlan {
  targetTournamentId: string;
  /** Every tournament that could require new Elo, in upload order. */
  affectedTournamentIds: string[];
  /** Transitive participant closure, not only players in target. */
  affectedPlayerIds: string[];
  /** First history eloBefore for each potentially affected player. */
  initialRecordedEloByPlayer: Record<string, number>;
  /** Earliest recorded event timestamp for each affected tournament. */
  eventOrder: Array<{ tournamentId: string; firstRecordedAt: string }>;
  blockers: ReplayIssue[];
  warnings: string[];
  /**
   * All source checks passed; DOES NOT authorize writes or prove historic
   * parity. Production replay also needs approved baseline stats, replay
   * semantics, ownership, isolation, audit log, backups and cutover.
   */
  historicalDataCandidate: boolean;
  readonlyOnly: true;
}

const isFiniteNumber = (x: number): boolean => typeof x === "number" && Number.isFinite(x);
const isValidDate = (x: string): boolean => typeof x === "string" &&
  x.trim().length > 0 && Number.isFinite(Date.parse(x));

function issue(kind: ReplayBlockerKind, tournamentId: string, detail: string, playerId?: string): ReplayIssue {
  return { kind, tournamentId, detail, ...(playerId ? { playerId } : {}) };
}

interface NormalizedEvent {
  tournament: ReplayTournament;
  firstMs: number;
  lastMs: number;
  scheduledMs: number;
}

/** Pure, deterministic. The caller supplies a complete historical snapshot. */
export function planHistoricalEloReplay(
  targetTournamentId: string,
  tournaments: readonly ReplayTournament[],
  opts: { tolerance?: number } = {},
): ReplayPlan {
  if (!targetTournamentId.trim()) throw new Error("A target tournament ID is required");
  const tolerance = opts.tolerance ?? 0.011;
  if (!isFiniteNumber(tolerance) || tolerance < 0 || tolerance > 1)
    throw new Error("Invalid ELO continuity tolerance");

  const blockers: ReplayIssue[] = [];
  const warnings: string[] = [];
  const seenTournaments = new Set<string>();
  const events: NormalizedEvent[] = [];

  for (const t of tournaments) {
    if (!t.id?.trim() || seenTournaments.has(t.id)) {
      blockers.push(issue("invalid_data", t.id || "", "Duplicate or missing tournament ID"));
      continue;
    }
    seenTournaments.add(t.id);
    const scheduledMs = Date.parse(t.scheduledAt);
    if (!isValidDate(t.scheduledAt)) {
      blockers.push(issue("invalid_data", t.id, "Missing or invalid scheduled tournament date"));
    }
    if (t.resultPlayerIds.length < 2 || t.elo.length < 2) {
      blockers.push(issue("missing_elo", t.id, "At least two results and ELO records are required"));
    }
    const resultSet = new Set(t.resultPlayerIds);
    const eloIds = new Set(t.elo.map(e => e.playerId));
    if (resultSet.size !== t.resultPlayerIds.length ||
        eloIds.size !== t.elo.length || resultSet.has("") || eloIds.has("")) {
      blockers.push(issue("duplicate_player", t.id, "Duplicate or blank player IDs in tournament"));
    }
    if (resultSet.size !== eloIds.size ||
        [...resultSet].some(pid => !eloIds.has(pid))) {
      blockers.push(issue("missing_elo", t.id,
        "Result and ELO player sets do not match: cannot reconstruct complete event"));
    }

    let min = Infinity, max = -Infinity;
    for (const e of t.elo) {
      if (!e.playerId?.trim() || !isValidDate(e.recordedAt) ||
          !isFiniteNumber(e.eloBefore) || !isFiniteNumber(e.eloAfter) ||
          !isFiniteNumber(e.eloChange)) {
        blockers.push(issue("invalid_data", t.id,
          "Invalid player, timestamp or numeric ELO history", e.playerId));
        continue;
      }
      const ms = Date.parse(e.recordedAt);
      min = Math.min(min, ms);
      max = Math.max(max, ms);
    }
    if (Number.isFinite(min) && Number.isFinite(max))
      events.push({ tournament: t, firstMs: min, lastMs: max, scheduledMs });
  }

  events.sort((a, b) => a.firstMs - b.firstMs || a.tournament.id.localeCompare(b.tournament.id));
  let prev: NormalizedEvent | undefined;
  for (const event of events) {
    if (prev && event.firstMs <= prev.lastMs) {
      blockers.push(issue("ambiguous_publication_order", event.tournament.id,
        "ELO write windows overlap or tie; no unambiguous transaction order"));
    }
    if (prev && Number.isFinite(prev.scheduledMs) &&
        Number.isFinite(event.scheduledMs) && event.scheduledMs < prev.scheduledMs) {
      warnings.push("Tournament " + event.tournament.id +
        " was uploaded after an event scheduled later; do not sort replay by start_datetime");
    }
    prev = event;
  }

  const targetIdx = events.findIndex(e => e.tournament.id === targetTournamentId);
  if (targetIdx < 0) throw new Error("Target tournament has no complete recorded ELO event");

  // Any participant whose Elo is changed by the target affects all later
  // opponents; those opponents can carry the change into still later events.
  const impacted = new Set(events[targetIdx]!.tournament.resultPlayerIds);
  const affected = [events[targetIdx]!];
  for (let i = targetIdx + 1; i < events.length; i++) {
    const e = events[i]!;
    if (e.tournament.resultPlayerIds.some(pid => impacted.has(pid))) {
      affected.push(e);
      for (const pid of e.tournament.resultPlayerIds) impacted.add(pid);
    }
  }

  const initialRecordedEloByPlayer: Record<string, number> = Object.create(null);
  const lastEloByPlayer = new Map<string, number>();
  for (const e of events) {
    for (const history of e.tournament.elo) {
      const pid = history.playerId;
      if (!impacted.has(pid)) continue;
      if (!(pid in initialRecordedEloByPlayer))
        initialRecordedEloByPlayer[pid] = history.eloBefore;

      const previous = lastEloByPlayer.get(pid);
      if (previous !== undefined &&
          isFiniteNumber(history.eloBefore) &&
          Math.abs(previous - history.eloBefore) > tolerance) {
        blockers.push(issue("elo_chain_break", e.tournament.id,
          "Stored elo_before does not equal preceding elo_after (within tolerance)", pid));
      }
      lastEloByPlayer.set(pid, history.eloAfter);
    }
  }

  return {
    targetTournamentId,
    affectedTournamentIds: affected.map(e => e.tournament.id),
    affectedPlayerIds: [...impacted].sort(),
    initialRecordedEloByPlayer,
    eventOrder: affected.map(e => ({
      tournamentId: e.tournament.id,
      firstRecordedAt: new Date(e.firstMs).toISOString(),
    })),
    blockers,
    warnings,
    historicalDataCandidate: blockers.length === 0,
    readonlyOnly: true,
  };
}
