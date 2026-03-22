// src/components/replayer/player-seat.tsx
import type { PlayerState, Action } from "../../types/replayer";
import { CardGroup } from "./card-svg";

interface PlayerSeatProps {
  player: PlayerState;
  lastAction?: Action | null;
  isActive?: boolean;
  showCards?: boolean;
  isWinner?: boolean;
}

const ACTION_CFG: Record<string, { label: string; color: string; bg: string }> = {
  fold:        { label: "FOLD",   color: "#a1a1aa", bg: "#18181b" },
  check:       { label: "CHECK",  color: "#34d399", bg: "#052016" },
  call:        { label: "CALL",   color: "#34d399", bg: "#052016" },
  bet:         { label: "BET",    color: "#fbbf24", bg: "#1c1400" },
  raise:       { label: "RAISE",  color: "#fb923c", bg: "#1c0e00" },
  "all-in":    { label: "ALL-IN", color: "#f87171", bg: "#1c0505" },
  "post-sb":   { label: "SB",     color: "#c4b5fd", bg: "#130d2e" },
  "post-bb":   { label: "BB",     color: "#93c5fd", bg: "#08102a" },
  "post-ante": { label: "ANTE",   color: "#a1a1aa", bg: "#131316" },
  show:        { label: "SHOW",   color: "#22d3ee", bg: "#041820" },
  muck:        { label: "MUCK",   color: "#71717a", bg: "#111113" },
};

const POS_CFG: Record<string, { color: string; bg: string; glow: string }> = {
  BTN:    { color: "#fbbf24", bg: "#1c1400", glow: "rgba(251,191,36,0.65)"  },
  SB:     { color: "#c4b5fd", bg: "#130d2e", glow: "rgba(196,181,253,0.55)" },
  BB:     { color: "#93c5fd", bg: "#08102a", glow: "rgba(147,197,253,0.55)" },
  CO:     { color: "#34d399", bg: "#052016", glow: "rgba(52,211,153,0.60)"  },
  HJ:     { color: "#22d3ee", bg: "#041820", glow: "rgba(34,211,238,0.55)"  },
  MP:     { color: "#d4d4d8", bg: "#131316", glow: "rgba(212,212,216,0.35)" },
  "MP+1": { color: "#d4d4d8", bg: "#131316", glow: "rgba(212,212,216,0.35)" },
  UTG:    { color: "#fca5a5", bg: "#1c0505", glow: "rgba(252,165,165,0.45)" },
  "UTG+1":{ color: "#fca5a5", bg: "#1c0505", glow: "rgba(252,165,165,0.40)" },
  "UTG+2":{ color: "#fca5a5", bg: "#1c0505", glow: "rgba(252,165,165,0.40)" },
};

function initials(name: string): string {
  const p = name.trim().split(/[\s_\-.]+/);
  if (p.length >= 2) return (p[0][0] + p[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000)    return `${(n / 1_000).toFixed(1)}K`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(2)}K`;
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(2);
}

export function PlayerSeat({
  player, lastAction, isActive = false, showCards = false, isWinner = false,
}: PlayerSeatProps) {
  const { name, isFolded, isAllIn, isHero, holeCards, position, isDealer, currentBet, currentStack } = player;

  const actionCfg = lastAction ? ACTION_CFG[lastAction.type] : null;
  const posCfg    = position   ? (POS_CFG[position] ?? POS_CFG["UTG"]) : null;
  const hasCards  = holeCards && holeCards.length > 0;

  const cards: (import("../../types/replayer").Card | null)[] | null = isFolded
    ? null
    : (showCards && hasCards) || (isHero && hasCards)
    ? holeCards!
    : hasCards ? Array(holeCards!.length).fill(null) : null;

  const hudBg     = isWinner ? "#1a1500" : isActive ? "#071820" : isAllIn ? "#1a0808" : "#111214";
  const hudBorder = isActive ? "#22d3ee" : isWinner ? "#fbbf24" : isAllIn ? "#f87171" : "rgba(255,255,255,0.14)";
  const hudGlow   = isActive
    ? "0 0 0 1px rgba(34,211,238,0.18), 0 4px 24px rgba(34,211,238,0.25), 0 2px 8px rgba(0,0,0,0.9)"
    : isWinner
    ? "0 0 0 1px rgba(251,191,36,0.18), 0 4px 24px rgba(251,191,36,0.28), 0 2px 8px rgba(0,0,0,0.9)"
    : isAllIn
    ? "0 0 0 1px rgba(248,113,113,0.12), 0 4px 16px rgba(248,113,113,0.18), 0 2px 8px rgba(0,0,0,0.9)"
    : "0 2px 14px rgba(0,0,0,0.75), 0 1px 4px rgba(0,0,0,0.5)";

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: "3px",
      width: "100px",
      opacity: isFolded ? 0.28 : 1,
      transition: "opacity 0.4s ease",
      position: "relative",
      zIndex: isActive ? 10 : 1,
    }}>

      {/* ── Cartas: tamaño "sm" para que el fan no se salga ── */}
      {/* "sm" = 38x54px, fan ocupa ~46px de alto → total ~50px controlado */}
      <div style={{ height: "48px", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
        {cards && (
          <CardGroup
            cards={cards}
            size="sm"
            highlighted={isActive && isHero}
            winning={isWinner}
            fanned={cards.length >= 2}
          />
        )}
      </div>

      {/* ── HUD box ── */}
      <div style={{
        position: "relative",
        width: "100%",
        background: hudBg,
        border: `1.5px solid ${hudBorder}`,
        borderRadius: "8px",
        padding: "7px 9px 6px",
        boxShadow: hudGlow,
        transition: "background 0.3s, border-color 0.3s, box-shadow 0.3s",
      }}>
        {/* Línea acento top */}
        {(isActive || isWinner) && (
          <div style={{
            position: "absolute", top: -1, left: "12%", width: "76%", height: "2px",
            background: isWinner
              ? "linear-gradient(90deg, transparent, #fbbf24 50%, transparent)"
              : "linear-gradient(90deg, transparent, #22d3ee 50%, transparent)",
          }} />
        )}

        {/* Dealer button */}
        {isDealer && (
          <div style={{
            position: "absolute", top: "-10px", right: "-10px",
            width: "18px", height: "18px", borderRadius: "50%",
            background: "#fbbf24", border: "2px solid #09090b",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "8px", fontFamily: "'JetBrains Mono', monospace",
            fontWeight: 700, color: "#09090b",
            boxShadow: "0 0 10px rgba(251,191,36,0.65), 0 2px 6px rgba(0,0,0,0.7)",
            zIndex: 10,
          }}>D</div>
        )}

        {/* Position badge */}
        {position && posCfg && !isDealer && (
          <div style={{
            position: "absolute", top: "-10px", left: "50%", transform: "translateX(-50%)",
            padding: "1px 7px", borderRadius: "20px",
            background: posCfg.bg, border: `1.5px solid ${posCfg.color}`,
            fontSize: "7px", fontFamily: "'JetBrains Mono', monospace",
            fontWeight: 700, color: posCfg.color, letterSpacing: "0.12em",
            whiteSpace: "nowrap",
            boxShadow: `0 0 10px ${posCfg.glow}, 0 2px 6px rgba(0,0,0,0.7)`,
          }}>{position}</div>
        )}

        {/* Dot activo */}
        {isActive && (
          <span style={{
            position: "absolute", top: "-4px", left: "9px",
            width: "6px", height: "6px", borderRadius: "50%",
            background: "#22d3ee",
            boxShadow: "0 0 8px #22d3ee, 0 0 16px rgba(34,211,238,0.5)",
            animation: "sk-seat-pulse 1.1s ease-in-out infinite",
            display: "block",
          }} />
        )}

        {/* Avatar + nombre */}
        <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
          <div style={{
            width: "20px", height: "20px", borderRadius: "50%", flexShrink: 0,
            background: isHero ? "rgba(34,211,238,0.18)" : "rgba(255,255,255,0.07)",
            border: `1.5px solid ${isHero ? "#22d3ee" : "rgba(255,255,255,0.18)"}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "7px", fontFamily: "Inter, system-ui, sans-serif",
            fontWeight: 700, color: isHero ? "#22d3ee" : "#d4d4d8",
          }}>{initials(name)}</div>
          <span style={{
            fontSize: "9px", fontFamily: "Inter, system-ui, sans-serif",
            fontWeight: 600,
            color: isHero ? "#22d3ee" : isWinner ? "#fbbf24" : "#f4f4f5",
            maxWidth: "60px", overflow: "hidden",
            textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>{name}</span>
        </div>

        {/* Stack */}
        <div style={{
          marginTop: "4px",
          fontSize: "13px", fontFamily: "'JetBrains Mono', monospace",
          fontWeight: 700,
          color: isWinner ? "#fbbf24" : isActive ? "#ffffff" : "#e4e4e7",
          letterSpacing: "-0.5px", lineHeight: 1,
        }}>{fmt(currentStack)}</div>

        {/* ALL-IN */}
        {isAllIn && !isFolded && (
          <div style={{
            marginTop: "3px", display: "inline-block",
            padding: "1px 6px", borderRadius: "4px",
            background: "rgba(248,113,113,0.18)", border: "1.5px solid #f87171",
            fontSize: "7px", fontFamily: "'JetBrains Mono', monospace",
            fontWeight: 700, color: "#fca5a5", letterSpacing: "0.12em",
          }}>ALL-IN</div>
        )}
      </div>

      {/* Action bubble */}
      {actionCfg && !isFolded && (
        <div style={{
          padding: "2px 8px", borderRadius: "20px",
          background: actionCfg.bg,
          border: `1.5px solid ${actionCfg.color}80`,
          fontSize: "8px", fontFamily: "'JetBrains Mono', monospace",
          fontWeight: 700, color: actionCfg.color, letterSpacing: "0.10em",
          whiteSpace: "nowrap",
          boxShadow: `0 0 10px ${actionCfg.color}35, 0 2px 6px rgba(0,0,0,0.7)`,
        }}>
          {actionCfg.label}
          {lastAction && lastAction.amount > 0 && (
            <span style={{ opacity: 0.9 }}> {fmt(lastAction.amount)}</span>
          )}
        </div>
      )}

      {/* Bet chip */}
      {currentBet > 0 && !isFolded && (
        <div style={{
          display: "flex", alignItems: "center", gap: "3px",
          padding: "2px 7px", borderRadius: "20px",
          background: "#120f00", border: "1.5px solid rgba(251,191,36,0.50)",
          boxShadow: "0 0 10px rgba(251,191,36,0.20), 0 2px 6px rgba(0,0,0,0.7)",
        }}>
          <svg width="8" height="8" viewBox="0 0 10 10">
            <circle cx="5" cy="5" r="4.5" fill="#fbbf24"/>
            <circle cx="5" cy="5" r="2.8" fill="none" stroke="#fff" strokeWidth="1.2" opacity="0.45"/>
          </svg>
          <span style={{
            fontSize: "9px", fontFamily: "'JetBrains Mono', monospace",
            fontWeight: 700, color: "#fbbf24",
          }}>{fmt(currentBet)}</span>
        </div>
      )}

      <style>{`
        @keyframes sk-seat-pulse {
          0%,100% { opacity:1; transform:scale(1); }
          50% { opacity:0.2; transform:scale(0.55); }
        }
      `}</style>
    </div>
  );
}
