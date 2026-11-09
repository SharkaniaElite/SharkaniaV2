/**
 * SHARKANIA — PURE QA ELO preview, never a historical database writer.
 * Each player requires an independently verified snapshot immediately before
 * their FIRST event in the transitive impact closure. Never assume ELO 1200.
 * Mirrors current src/lib/api/elo-engine.ts arithmetic, not a new ranking.
 */
import type { ReplayPlan } from "./elo-replay-preflight";

export interface EloCheckpoint {
  playerId: string;
  atEvent: string;
  eloRating: number;
  eloPeak: number;
  totalTournaments: number;
  totalCashes: number;
  totalWins: number;
  totalPrizeWon: number;
  totalBuyInsSpent: number;
}
export interface EloFinish {
  playerId: string;
  position: number;
  prizeWon: number;
  bountiesWon: number;
}
export interface EloHistoryObservation {
  playerId: string;
  eloBefore: number;
  eloAfter: number;
  eloChange: number;
}
export interface EloEvent {
  tournamentId: string;
  buyIn: number;
  currency: "USD";
  results: readonly EloFinish[];
  /** Needed to assert unchanged parity; not a source of initial states. */
  observed?: readonly EloHistoryObservation[];
}
export interface EloScenario {
  plan: ReplayPlan;
  events: readonly EloEvent[];
  checkpoints: readonly EloCheckpoint[];
  operation: "unchanged" | "edit" | "delete";
  /** For edit, exactly the same player ID set as original target results. */
  replacement?: readonly EloFinish[];
}
export interface EloProjectedRow extends EloHistoryObservation {
  tournamentId: string;
  position: number;
}
export interface EloSimulation {
  readonlyOnly: true;
  safeToApply: false;
  operation: EloScenario["operation"];
  calculated: EloProjectedRow[];
  finalPlayers: EloCheckpoint[];
  parityDifferences: Array<{
    tournamentId: string;
    playerId: string;
    field: "eloBefore" | "eloAfter" | "eloChange";
    recorded: number;
    simulated: number;
  }>;
  warnings: string[];
}

const finite=(x:number)=>Number.isFinite(x);
const round2=(x:number)=>Math.round(x*100)/100;
function assertResults(rows:readonly EloFinish[],id:string):void {
  if(rows.length<2 || rows.length>1000) throw Error("Invalid field size: "+id);
  const players=new Set<string>(),places=new Set<number>();
  for(const r of rows){
    if(!r.playerId?.trim() || players.has(r.playerId) ||
      !Number.isSafeInteger(r.position) || r.position<1 ||
      places.has(r.position) ||
      !finite(r.prizeWon) || r.prizeWon<0 ||
      !finite(r.bountiesWon) || r.bountiesWon<0)
      throw Error("Invalid or duplicate finish: "+id);
    players.add(r.playerId);places.add(r.position);
  }
  for(let i=1;i<=rows.length;i++)
    if(!places.has(i))throw Error("Noncontiguous positions: "+id);
}
function validCheckpoint(p:EloCheckpoint):boolean {
  return Boolean(p.playerId?.trim()&&p.atEvent?.trim()) &&
    [p.eloRating,p.eloPeak,p.totalTournaments,p.totalCashes,
     p.totalWins,p.totalPrizeWon,p.totalBuyInsSpent].every(finite) &&
    p.eloRating>=100 && p.eloPeak>=p.eloRating &&
    [p.totalTournaments,p.totalCashes,p.totalWins].every(
      x=>Number.isSafeInteger(x)&&x>=0) &&
    p.totalCashes<=p.totalTournaments &&
    p.totalWins<=p.totalTournaments &&
    p.totalPrizeWon>=0 && p.totalBuyInsSpent>=0;
}

/** Pure deterministic preview. Never returns a write plan or authorization. */
export function simulateHistoricalEloScenario(input:EloScenario):EloSimulation {
  const {plan,events,checkpoints,operation,replacement}=input;
  if(!plan.readonlyOnly || !plan.historicalDataCandidate || plan.blockers.length)
    throw Error("Historical data blocked by preflight");
  if(!["unchanged","edit","delete"].includes(operation))
    throw Error("Unsupported operation");
  if(operation==="edit" && !replacement)throw Error("Complete replacement required");
  if(operation!=="edit" && replacement!==undefined)throw Error("Unexpected replacement");
  const ids=plan.affectedTournamentIds;
  if(!ids.length || ids[0]!==plan.targetTournamentId ||
    ids.length!==events.length || events.some((e,i)=>e.tournamentId!==ids[i]))
    throw Error("Untrusted historical event order");

  const first=new Map<string,string>(),uniqueEvents=new Set<string>();
  for(const e of events){
    if(uniqueEvents.has(e.tournamentId))throw Error("Duplicate tournament");
    uniqueEvents.add(e.tournamentId);
    if(!finite(e.buyIn)||e.buyIn<0||e.currency!=="USD")
      throw Error("Unsupported currency or buy-in");
    assertResults(e.results,e.tournamentId);
    for(const r of e.results)if(!first.has(r.playerId))
      first.set(r.playerId,e.tournamentId);
  }
  const impacted=[...first.keys()].sort();
  if(impacted.length!==plan.affectedPlayerIds.length ||
    impacted.some((p,i)=>p!==plan.affectedPlayerIds[i]))
    throw Error("Player closure differs from approved preflight");
  if(replacement){
    assertResults(replacement,plan.targetTournamentId);
    const original=events[0]!.results.map(r=>r.playerId).sort();
    const proposed=replacement.map(r=>r.playerId).sort();
    if(JSON.stringify(original)!==JSON.stringify(proposed))
      throw Error("New or removed players require a new dependency plan");
  }

  const checkpointMap=new Map<string,EloCheckpoint>();
  for(const p of checkpoints){
    if(!validCheckpoint(p)||checkpointMap.has(p.playerId)||
      first.get(p.playerId)!==p.atEvent)
      throw Error("Invalid or ambiguous pre-event checkpoint");
    checkpointMap.set(p.playerId,{...p});
  }
  if(checkpointMap.size!==impacted.length)
    throw Error("A verified checkpoint is required for each affected player");

  const players=new Map<string,EloCheckpoint>();
  const calculated:EloProjectedRow[]=[];
  const parityDifferences:EloSimulation["parityDifferences"]=[];
  for(const event of events){
    if(operation==="delete" && event.tournamentId===plan.targetTournamentId){
      for(const r of event.results)
        players.set(r.playerId,{...checkpointMap.get(r.playerId)!});
      continue;
    }
    const results=event.tournamentId===plan.targetTournamentId && replacement
      ?replacement:event.results;
    const before=new Map<string,EloCheckpoint>();
    for(const r of results){
      const p=players.get(r.playerId)??checkpointMap.get(r.playerId);
      if(!p)throw Error("Missing checkpoint during simulation");
      before.set(r.playerId,{...p});
    }
    const N=results.length;
    const sum=[...before.values()].reduce((acc,p)=>acc+p.eloRating,0);
    const weight=(sum/N)/1200;
    const rows:EloProjectedRow[]=[];
    for(const r of results){
      const p=before.get(r.playerId)!;
      const score=(N-r.position)/(N-1);
      const avgOpp=(sum-p.eloRating)/(N-1);
      const expected=1/(1+Math.pow(10,(avgOpp-p.eloRating)/400));
      const kBase=p.totalTournaments<30?40:20;
      const K=kBase*(1+Math.log10(event.buyIn+1)*0.1)*
        (1+Math.log10(N)*0.15);
      const rawChange=K*weight*(score-expected);
      rows.push({
        tournamentId:event.tournamentId,playerId:r.playerId,
        position:r.position,eloBefore:p.eloRating,
        eloAfter:round2(Math.max(100,p.eloRating+rawChange)),
        eloChange:round2(rawChange)
      });
    }
    // One snapshot for ALL opponents, then apply state transitions.
    for(const row of rows){
      const p=before.get(row.playerId)!;
      const r=results.find(x=>x.playerId===row.playerId)!;
      players.set(row.playerId,{
        ...p,eloRating:row.eloAfter,
        eloPeak:Math.max(p.eloPeak,row.eloAfter),
        totalTournaments:p.totalTournaments+1,
        totalCashes:p.totalCashes+(r.prizeWon+r.bountiesWon>0?1:0),
        totalWins:p.totalWins+(r.position===1?1:0),
        totalPrizeWon:p.totalPrizeWon+r.prizeWon+r.bountiesWon,
        // Historical frontend increments a single buy-in, NOT reentry count.
        totalBuyInsSpent:p.totalBuyInsSpent+event.buyIn
      });
    }
    calculated.push(...rows);
    if(operation==="unchanged"){
      if(!event.observed||event.observed.length!==rows.length)
        throw Error("Missing complete observed ELO for historical parity");
      const observed=new Map(event.observed.map(x=>[x.playerId,x]));
      if(observed.size!==rows.length)throw Error("Duplicated observed ELO");
      for(const row of rows){
        const source=observed.get(row.playerId);
        if(!source)throw Error("Observed ELO missing a participant");
        for(const field of ["eloBefore","eloAfter","eloChange"] as const){
          if(!finite(source[field]))throw Error("Non-numeric stored ELO");
          if(Math.abs(source[field]-row[field])>0.011)
            parityDifferences.push({
              tournamentId:row.tournamentId,playerId:row.playerId,
              field,recorded:source[field],simulated:row[field]
            });
        }
      }
    }
  }
  // Deleted tournament's participants still retain their old checkpoint.
  for(const pid of impacted)if(!players.has(pid))
    players.set(pid,{...checkpointMap.get(pid)!});
  return {
    readonlyOnly:true,safeToApply:false,operation,
    calculated,
    finalPlayers:impacted.map(pid=>({...players.get(pid)!})),
    parityDifferences,
    warnings:[
      "Preview only; no database changes allowed",
      "Historical unified profile ELO and league standings require separate parity",
      "Snapshots are externally verified; never initialize missing values to 1200"
    ]
  };
}
