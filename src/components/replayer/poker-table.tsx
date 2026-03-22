// src/components/replayer/poker-table.tsx
// ══════════════════════════════════════════════════════════
// Poker Table — Oval table with dynamic player positions
// Supports 2-9 seats, community cards, pot display
// ══════════════════════════════════════════════════════════

import type { ReplayState, Card, Street } from "../../types/replayer";
import { PlayerSeat } from "./player-seat";
import { CardGroup } from "./card-svg";

interface PokerTableProps {
  state: ReplayState;
  className?: string;
}

// ── Seat positions around the oval (percentages) ─────────
// Positions are [top%, left%] relative to the table container
// Arranged clockwise starting from bottom-center (hero position)

function getSeatPositions(numPlayers: number): { top: number; left: number }[] {
  const positions: Record<number, { top: number; left: number }[]> = {
    2: [
      { top: 88, left: 50 },  // seat 0 (bottom center — hero)
      { top: 5, left: 50 },   // seat 1 (top center)
    ],
    3: [
      { top: 88, left: 50 },
      { top: 20, left: 15 },
      { top: 20, left: 85 },
    ],
    4: [
      { top: 88, left: 50 },
      { top: 45, left: 5 },
      { top: 5, left: 50 },
      { top: 45, left: 95 },
    ],
    5: [
      { top: 88, left: 50 },
      { top: 60, left: 5 },
      { top: 10, left: 20 },
      { top: 10, left: 80 },
      { top: 60, left: 95 },
    ],
    6: [
      { top: 88, left: 50 },
      { top: 65, left: 5 },
      { top: 12, left: 15 },
      { top: 5, left: 50 },
      { top: 12, left: 85 },
      { top: 65, left: 95 },
    ],
    7: [
      { top: 88, left: 50 },
      { top: 70, left: 5 },
      { top: 30, left: 5 },
      { top: 5, left: 28 },
      { top: 5, left: 72 },
      { top: 30, left: 95 },
      { top: 70, left: 95 },
    ],
    8: [
      { top: 88, left: 50 },
      { top: 75, left: 5 },
      { top: 38, left: 3 },
      { top: 5, left: 22 },
      { top: 5, left: 50 },
      { top: 5, left: 78 },
      { top: 38, left: 97 },
      { top: 75, left: 95 },
    ],
    9: [
      { top: 88, left: 50 },
      { top: 78, left: 5 },
      { top: 45, left: 2 },
      { top: 12, left: 12 },
      { top: 2, left: 35 },
      { top: 2, left: 65 },
      { top: 12, left: 88 },
      { top: 45, left: 98 },
      { top: 78, left: 95 },
    ],
  };

  return positions[numPlayers] ?? positions[6];
}

// ── Street label ─────────────────────────────────────────

const STREET_LABELS: Record<Street, { label: string; color: string }> = {
  preflop:  { label: "PREFLOP", color: "#a1a1aa" },
  flop:     { label: "FLOP", color: "#22d3ee" },
  turn:     { label: "TURN", color: "#fbbf24" },
  river:    { label: "RIVER", color: "#f87171" },
  showdown: { label: "SHOWDOWN", color: "#a78bfa" },
};

// ── Format pot ───────────────────────────────────────────

function formatPot(amount: number): string {
  if (amount === 0) return "0";
  if (amount >= 10000) return `${(amount / 1000).toFixed(1)}K`;
  if (Number.isInteger(amount)) return String(amount);
  return amount.toFixed(2);
}

// ── Main component ───────────────────────────────────────

export function PokerTable({ state, className = "" }: PokerTableProps) {
  const { hand, players, pot, communityCards, currentStreetIndex, currentActionIndex } = state;
  const numPlayers = players.length;
  const seatPositions = getSeatPositions(numPlayers);

  const currentStreet = hand.streets[currentStreetIndex];
  const streetInfo = currentStreet ? STREET_LABELS[currentStreet.street] : STREET_LABELS.preflop;

  // Determine which player is currently acting
  const activePlayerIndex = currentStreet && currentActionIndex >= 0 && currentActionIndex < currentStreet.actions.length
    ? currentStreet.actions[currentActionIndex].playerIndex
    : -1;

  // Get last action for each player (for action bubble display)
  const lastActions = players.map((_, idx) => {
    if (!currentStreet) return null;
    for (let i = currentActionIndex; i >= 0; i--) {
      if (currentStreet.actions[i]?.playerIndex === idx) {
        return currentStreet.actions[i];
      }
    }
    return null;
  });

  // Should we show cards? (showdown or hero)
  const isShowdown = currentStreet?.street === "showdown" || state.isFinished;

  return (
    <div className={`relative w-full max-w-[700px] mx-auto ${className}`} style={{ aspectRatio: "7 / 5" }}>
      {/* Table felt (oval) */}
      <div
        className="absolute inset-[8%] rounded-[50%] border-2"
        style={{
          background: "radial-gradient(ellipse at 50% 40%, #1a3a2a 0%, #0f2a1e 50%, #0a1f15 100%)",
          borderColor: "rgba(34,211,238,0.12)",
          boxShadow: "inset 0 2px 20px rgba(0,0,0,0.5), 0 0 40px rgba(0,0,0,0.3)",
        }}
      >
        {/* Table rail (outer glow) */}
        <div
          className="absolute -inset-[3px] rounded-[50%] -z-10"
          style={{
            background: "linear-gradient(180deg, rgba(60,50,40,0.8) 0%, rgba(40,30,20,0.9) 100%)",
            border: "1px solid rgba(255,255,255,0.04)",
          }}
        />

        {/* Center content: street label + community cards + pot */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
          {/* Street badge */}
          <span
            className="font-mono text-[10px] font-bold uppercase tracking-[0.15em] px-2.5 py-0.5 rounded-full"
            style={{
              color: streetInfo.color,
              background: `${streetInfo.color}12`,
              border: `1px solid ${streetInfo.color}25`,
            }}
          >
            {streetInfo.label}
          </span>

          {/* Community cards */}
          <div className="flex items-center gap-1 min-h-[62px]">
            {communityCards.length > 0 ? (
              <CardGroup cards={communityCards} size="md" />
            ) : (
              <div className="flex gap-1">
                {[0, 1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="w-[42px] h-[58px] rounded border border-dashed"
                    style={{
                      borderColor: "rgba(255,255,255,0.06)",
                      background: "rgba(255,255,255,0.02)",
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Pot */}
          {pot.totalPot > 0 && (
            <div className="flex items-center gap-1.5">
              {/* Chip icon */}
              <svg width="14" height="14" viewBox="0 0 16 16">
                <circle cx="8" cy="8" r="7" fill="#fbbf24" opacity="0.8" />
                <circle cx="8" cy="8" r="5" fill="none" stroke="#fff" strokeWidth="0.8" opacity="0.4" />
                <circle cx="8" cy="8" r="2.5" fill="#fff" opacity="0.3" />
              </svg>
              <span className="font-mono text-[13px] font-bold text-sk-gold">
                {formatPot(pot.totalPot)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Player seats */}
      {players.map((player, idx) => {
        const pos = seatPositions[idx];
        if (!pos) return null;
        return (
          <div
            key={idx}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ top: `${pos.top}%`, left: `${pos.left}%` }}
          >
            <PlayerSeat
              player={player}
              lastAction={lastActions[idx]}
              isActive={idx === activePlayerIndex}
              showCards={isShowdown}
            />
          </div>
        );
      })}

      {/* Winner overlay */}
      {state.isFinished && hand.result && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div
            className="bg-sk-bg-0/80 backdrop-blur-sm border border-sk-gold/30 rounded-xl px-5 py-3 text-center"
            style={{ boxShadow: "0 0 30px rgba(251,191,36,0.1)" }}
          >
            {hand.result.winners.map((w, i) => (
              <div key={i}>
                <p className="font-mono text-[10px] text-sk-gold uppercase tracking-wider">Ganador</p>
                <p className="text-sk-md font-bold text-sk-text-1">
                  {players[w.playerIndex]?.name ?? "???"}
                </p>
                <p className="font-mono text-sk-sm font-bold text-sk-gold">
                  +{formatPot(w.amount)}
                </p>
                {w.handDescription && (
                  <p className="text-[10px] text-sk-text-3 mt-0.5">{w.handDescription}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
