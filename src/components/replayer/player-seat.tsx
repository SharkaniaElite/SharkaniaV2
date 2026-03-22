// src/components/replayer/player-seat.tsx
// ══════════════════════════════════════════════════════════
// Player Seat — Renders one player's position at the table
// Shows: name, stack, position badge, hole cards, bet, status
// ══════════════════════════════════════════════════════════

import type { PlayerState, Action } from "../../types/replayer";
import { CardGroup } from "./card-svg";

interface PlayerSeatProps {
  player: PlayerState;
  lastAction?: Action | null;
  isActive?: boolean;        // currently acting
  showCards?: boolean;        // reveal hole cards
  style?: React.CSSProperties;
}

const ACTION_LABELS: Record<string, { text: string; color: string }> = {
  fold:       { text: "FOLD", color: "#71717a" },
  check:      { text: "CHECK", color: "#34d399" },
  call:       { text: "CALL", color: "#34d399" },
  bet:        { text: "BET", color: "#fbbf24" },
  raise:      { text: "RAISE", color: "#fb923c" },
  "all-in":   { text: "ALL-IN", color: "#f87171" },
  "post-sb":  { text: "SB", color: "#a1a1aa" },
  "post-bb":  { text: "BB", color: "#a1a1aa" },
  "post-ante": { text: "ANTE", color: "#a1a1aa" },
  show:       { text: "SHOW", color: "#22d3ee" },
  muck:       { text: "MUCK", color: "#71717a" },
};

function formatStack(amount: number): string {
  if (amount >= 10000) return `${(amount / 1000).toFixed(1)}K`;
  if (amount >= 1000) return `${(amount / 1000).toFixed(2)}K`;
  if (Number.isInteger(amount)) return String(amount);
  return amount.toFixed(2);
}

export function PlayerSeat({ player, lastAction, isActive = false, showCards = false, style }: PlayerSeatProps) {
  const actionInfo = lastAction ? ACTION_LABELS[lastAction.type] : null;
  const isFolded = player.isFolded;
  const isAllIn = player.isAllIn;

  // Determine which cards to show
  const hasCards = player.holeCards && player.holeCards.length > 0;
  const cardsToShow = showCards && hasCards
    ? player.holeCards!
    : hasCards && player.isHero && !isFolded
    ? player.holeCards!
    : null;

  return (
    <div
      className="flex flex-col items-center gap-1"
      style={{
        ...style,
        opacity: isFolded ? 0.35 : 1,
        transition: "opacity 0.3s ease",
      }}
    >
      {/* Hole cards */}
      <div className="h-[48px] flex items-end justify-center">
        {cardsToShow ? (
          <CardGroup
            cards={cardsToShow}
            size="sm"
            overlap
            highlighted={isActive}
            dimmed={isFolded}
          />
        ) : !isFolded && hasCards ? (
          <CardGroup cards={[null, null]} size="sm" overlap dimmed={false} />
        ) : null}
      </div>

      {/* Player info box */}
      <div
        className={`relative rounded-lg px-2.5 py-1.5 text-center min-w-[80px] transition-all duration-200 ${
          isActive
            ? "bg-sk-accent/15 border border-sk-accent/40 shadow-[0_0_12px_rgba(34,211,238,0.15)]"
            : isAllIn
            ? "bg-sk-red/10 border border-sk-red/30"
            : "bg-sk-bg-3 border border-sk-border-2"
        }`}
      >
        {/* Position badge */}
        {player.position && (
          <span
            className={`absolute -top-2.5 left-1/2 -translate-x-1/2 font-mono text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full ${
              player.isDealer
                ? "bg-sk-gold text-sk-bg-0"
                : "bg-sk-bg-4 text-sk-text-3 border border-sk-border-2"
            }`}
          >
            {player.isDealer ? "D" : player.position}
          </span>
        )}

        {/* Name */}
        <p
          className={`text-[10px] font-semibold truncate max-w-[72px] ${
            player.isHero ? "text-sk-accent" : "text-sk-text-1"
          }`}
        >
          {player.name}
        </p>

        {/* Stack */}
        <p className="font-mono text-[11px] font-bold text-sk-text-1">
          {formatStack(player.currentStack)}
        </p>

        {/* All-in indicator */}
        {isAllIn && (
          <span className="font-mono text-[8px] font-bold text-sk-red uppercase tracking-wider">
            ALL-IN
          </span>
        )}
      </div>

      {/* Last action bubble */}
      {actionInfo && !isFolded && (
        <div
          className="font-mono text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
          style={{
            background: `${actionInfo.color}15`,
            color: actionInfo.color,
            border: `1px solid ${actionInfo.color}30`,
          }}
        >
          {actionInfo.text}
          {lastAction && lastAction.amount > 0 && ` ${formatStack(lastAction.amount)}`}
        </div>
      )}

      {/* Current bet chip */}
      {player.currentBet > 0 && !isFolded && (
        <div className="font-mono text-[10px] font-bold text-sk-gold bg-sk-gold/10 border border-sk-gold/20 rounded-full px-2 py-0.5">
          {formatStack(player.currentBet)}
        </div>
      )}
    </div>
  );
}
