/**
 * SHARKANIA · historial ELO: evidencia de línea base (solo lectura).
 *
 * NO produce checkpoints aprobados ni autoriza modificar ELO.
 * elo_history permite verificar un enlace entre dos eventos registrados,
 * pero no documenta todas las estadísticas pretorneo (peak, partidas previas,
 * ITM, acumulados, correcciones manuales, etc.). Cada checkpoint requiere
 * una fuente independiente y revisión humana.
 */
import type { ReplayPlan, ReplayTournament } from "./elo-replay-preflight";

export type EloCheckpointEvidenceStatus =
  | "continuous_recorded_elo"
  | "recorded_elo_gap"
  | "first_recorded_event"
  | "missing_event_history";

export interface EloCheckpointEvidence {
  playerId: string;
  firstAffectedTournamentId: string | null;
  firstAffectedRecordedEloBefore: number | null;
  previousTournamentId: string | null;
  previousRecordedEloAfter: number | null;
  previousRecordedAt: string | null;
  difference: number | null;
  status: EloCheckpointEvidenceStatus;
  /** Proves ONLY that a previous recorded ELO link agrees. */
  numericLinkMatched: boolean;
  /** Always false: no historical stats checkpoint was independently attested. */
  completeCheckpointVerified: false;
  requiresManualReview: true;
}
export interface EloCheckpointEvidenceAudit {
  readonlyOnly: true;
  safeToApply: false;
  preflightBlocked: boolean;
  entries: EloCheckpointEvidence[];
  counts: Record<EloCheckpointEvidenceStatus,number>;
  missingHistoricalStats: readonly string[];
  warnings: string[];
}
const finite = (n:number) => typeof n==="number" && Number.isFinite(n);

/**
 * The caller supplies a FULL history containing events before the target.
 * This function has no DB/network access and is intentionally conservative.
 */
export function auditEloCheckpointEvidence(
  plan: ReplayPlan,
  tournaments: readonly ReplayTournament[],
  tolerance=0.011
): EloCheckpointEvidenceAudit {
  if (!plan.readonlyOnly || plan.safeToApply === true)
    throw Error("A read-only preflight plan is required");
  if (!finite(tolerance) || tolerance < 0 || tolerance > 0.1)
    throw Error("Invalid ELO continuity tolerance");
  const seenIds=new Set<string>();
  const normalized=tournaments.map(t=>{
    if (!t.id?.trim() || seenIds.has(t.id))
      throw Error("Incomplete or duplicate tournament ID");
    seenIds.add(t.id);
    const at=t.elo.map(x=>Date.parse(x.recordedAt));
    if (at.length!==t.elo.length || !at.length ||
        at.some(x=>!finite(x)))
      throw Error("A complete recorded-at event is required");
    return { t,first:Math.min(...at),last:Math.max(...at) };
  }).sort((a,b)=>a.first-b.first||a.t.id.localeCompare(b.t.id));
  const eventIds=new Set(normalized.map(x=>x.t.id));
  const impactedIds=[...new Set(plan.affectedPlayerIds)].sort();
  const impactedEvents=new Set(plan.affectedTournamentIds);
  const historyByPlayer=new Map<string,Array<{
    eventId:string; recordAt:string;before:number;after:number;
  }>>();
  for (const e of normalized) {
    const eventPlayers=new Set<string>();
    for (const record of e.t.elo) {
      if (!record.playerId?.trim()||eventPlayers.has(record.playerId) ||
          !finite(record.eloBefore)||!finite(record.eloAfter))
        throw Error("Duplicate or invalid recorded ELO");
      eventPlayers.add(record.playerId);
      const stream=historyByPlayer.get(record.playerId)??[];
      stream.push({
        eventId:e.t.id,recordAt:record.recordedAt,
        before:record.eloBefore,after:record.eloAfter
      });
      historyByPlayer.set(record.playerId,stream);
    }
  }
  const counts:Record<EloCheckpointEvidenceStatus,number>={
    continuous_recorded_elo:0,
    recorded_elo_gap:0,
    first_recorded_event:0,
    missing_event_history:0
  };
  const entries:EloCheckpointEvidence[]=[];
  for (const playerId of impactedIds) {
    const stream=historyByPlayer.get(playerId)??[];
    const firstIndex=stream.findIndex(x=>impactedEvents.has(x.eventId));
    const current=firstIndex>=0?stream[firstIndex]:undefined;
    const previous=firstIndex>0?stream[firstIndex-1]:undefined;
    const diff=current&&previous?current.before-previous.after:null;
    const status:EloCheckpointEvidenceStatus=
      !current?"missing_event_history":
      !previous?"first_recorded_event":
      diff!==null && Math.abs(diff)<=tolerance?
        "continuous_recorded_elo":"recorded_elo_gap";
    counts[status]++;
    entries.push({
      playerId,
      firstAffectedTournamentId:current?.eventId??null,
      firstAffectedRecordedEloBefore:current?.before??null,
      previousTournamentId:previous?.eventId??null,
      previousRecordedEloAfter:previous?.after??null,
      previousRecordedAt:previous?.recordAt??null,
      difference:diff,
      status,
      numericLinkMatched:status==="continuous_recorded_elo",
      completeCheckpointVerified:false,
      requiresManualReview:true
    });
  }
  return {
    readonlyOnly:true,safeToApply:false,
    preflightBlocked:!plan.historicalDataCandidate||plan.blockers.length>0,
    entries,counts,
    missingHistoricalStats:[
      "eloPeak before first affected event",
      "totalTournaments and K-threshold state",
      "totalCashes and totalWins",
      "totalPrizeWon and totalBuyInsSpent",
      "manual adjustments or replay audit provenance"
    ],
    warnings:[
      "Agreement between historical ELO rows is not an independently verified checkpoint",
      "Missing previous event cannot imply an initial ELO of 1200",
      "Historical stats are not snapshotted in elo_history",
      ...(normalized.some((e,i)=>i>0&&e.first<=normalized[i-1]!.last)
        ? ["Overlapping ELO event windows; publication order needs review"] : []),
      ...(!eventIds.has(plan.targetTournamentId)
        ? ["Target tournament event is absent from supplied history"] : [])
    ]
  };
}
