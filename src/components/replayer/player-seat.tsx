// src/components/replayer/player-seat.tsx
import type { PlayerState, Action, Card } from "../../types/replayer";
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

  const actionCfg   = lastAction ? ACTION_CFG[lastAction.type] : null;
  const posCfg      = position   ? (POS_CFG[position] ?? POS_CFG["UTG"]) : null;
  const hasKnownCards = holeCards && holeCards.length > 0;

  // Cartas a mostrar — siempre 2 dorsos si activo, aunque no haya holeCards
  const cardsToShow: (Card | null)[] | null = (() => {
    if (isFolded) return null;
    if (hasKnownCards && (showCards || isHero)) return holeCards!;
    if (hasKnownCards) return holeCards!.map(() => null);
    return [null, null]; // villano activo sin holeCards conocidas → 2 dorsos
  })();

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
    <>
      <style>{`
        .sk-seat-root {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 3px;
          width: 100px;
          position: relative;
          z-index: ${isActive ? 10 : 1};
          opacity: ${isFolded ? 0.28 : 1};
          transition: opacity 0.4s ease;
        }
        /* En mobile: HUD más compacto */
        @media (max-width: 520px) {
          .sk-seat-root { width: 72px; gap: 2px; }
          .sk-seat-name { font-size: 7px !important; max-width: 44px !important; }
          .sk-seat-stack { font-size: 10px !important; }
          .sk-seat-action { font-size: 7px !important; padding: 1px 5px !important; }
          .sk-seat-chip { font-size: 8px !important; padding: 1px 5px !important; }
          .sk-seat-cards { height: 34px !important; }
        }
      `}</style>

      <div className="sk-seat-root">
        {/* Cartas: sm en desktop, xs en mobile */}
        <div className="sk-seat-cards" style={{ height: "48px", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          {cardsToShow && (
            <>
              {/* Desktop: sm */}
              <span style={{ display: "block" }} className="sk-cards-desktop">
                <CardGroup
                  cards={cardsToShow}
                  size="sm"
                  highlighted={isActive && isHero}
                  winning={isWinner}
                  fanned={cardsToShow.length >= 2}
                />
              </span>
            </>
          )}
        </div>

        {/* HUD */}
        <div style={{
          position: "relative",
          width: "100%",
          background: hudBg,
          border: `1.5px solid ${hudBorder}`,
          borderRadius: "7px",
          padding: "6px 8px 5px",
          boxShadow: hudGlow,
          transition: "background 0.3s, border-color 0.3s, box-shadow 0.3s",
        }}>
          {/* Línea acento */}
          {(isActive || isWinner) && (
            <div style={{
              position: "absolute", top: -1, left: "12%", width: "76%", height: "2px",
              background: isWinner
                ? "linear-gradient(90deg, transparent, #fbbf24 50%, transparent)"
                : "linear-gradient(90deg, transparent, #22d3ee 50%, transparent)",
            }} />
          )}

          {/* Dealer */}
          {isDealer && (
            <div style={{
              position: "absolute", top: "-9px", right: "-9px",
              width: "17px", height: "17px", borderRadius: "50%",
              background: "#fbbf24", border: "2px solid #09090b",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "7px", fontFamily: "'JetBrains Mono', monospace",
              fontWeight: 700, color: "#09090b",
              boxShadow: "0 0 10px rgba(251,191,36,0.65)",
              zIndex: 10,
            }}>D</div>
          )}

          {/* Position badge */}
          {position && posCfg && !isDealer && (
            <div style={{
              position: "absolute", top: "-10px", left: "50%", transform: "translateX(-50%)",
              padding: "1px 6px", borderRadius: "20px",
              background: posCfg.bg, border: `1.5px solid ${posCfg.color}`,
              fontSize: "7px", fontFamily: "'JetBrains Mono', monospace",
              fontWeight: 700, color: posCfg.color, letterSpacing: "0.10em",
              whiteSpace: "nowrap",
              boxShadow: `0 0 8px ${posCfg.glow}`,
            }}>{position}</div>
          )}

          {/* Dot activo */}
          {isActive && (
            <span style={{
              position: "absolute", top: "-4px", left: "8px",
              width: "6px", height: "6px", borderRadius: "50%",
              background: "#22d3ee",
              boxShadow: "0 0 8px #22d3ee",
              animation: "sk-seat-pulse 1.1s ease-in-out infinite",
              display: "block",
            }} />
          )}

          {/* Avatar + nombre */}
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <div style={{
              width: "18px", height: "18px", borderRadius: "50%", flexShrink: 0,
              background: isHero ? "rgba(34,211,238,0.18)" : "rgba(255,255,255,0.07)",
              border: `1.5px solid ${isHero ? "#22d3ee" : "rgba(255,255,255,0.18)"}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "6px", fontFamily: "Inter, system-ui, sans-serif",
              fontWeight: 700, color: isHero ? "#22d3ee" : "#d4d4d8",
            }}>{initials(name)}</div>
            <span className="sk-seat-name" style={{
              fontSize: "9px", fontFamily: "Inter, system-ui, sans-serif",
              fontWeight: 600,
              color: isHero ? "#22d3ee" : isWinner ? "#fbbf24" : "#f4f4f5",
              maxWidth: "58px", overflow: "hidden",
              textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>{name}</span>
          </div>

          {/* Stack */}
          <div className="sk-seat-stack" style={{
            marginTop: "3px",
            fontSize: "13px", fontFamily: "'JetBrains Mono', monospace",
            fontWeight: 700,
            color: isWinner ? "#fbbf24" : isActive ? "#ffffff" : "#e4e4e7",
            letterSpacing: "-0.5px", lineHeight: 1,
          }}>{fmt(currentStack)}</div>

          {/* ALL-IN */}
          {isAllIn && !isFolded && (
            <div style={{
              marginTop: "2px", display: "inline-block",
              padding: "1px 5px", borderRadius: "3px",
              background: "rgba(248,113,113,0.18)", border: "1.5px solid #f87171",
              fontSize: "7px", fontFamily: "'JetBrains Mono', monospace",
              fontWeight: 700, color: "#fca5a5", letterSpacing: "0.10em",
            }}>ALL-IN</div>
          )}
        </div>

        {/* Action bubble */}
        {actionCfg && !isFolded && (
          <div className="sk-seat-action" style={{
            padding: "2px 7px", borderRadius: "20px",
            background: actionCfg.bg,
            border: `1.5px solid ${actionCfg.color}80`,
            fontSize: "8px", fontFamily: "'JetBrains Mono', monospace",
            fontWeight: 700, color: actionCfg.color, letterSpacing: "0.08em",
            whiteSpace: "nowrap",
            boxShadow: `0 0 8px ${actionCfg.color}30`,
          }}>
            {actionCfg.label}
            {lastAction && lastAction.amount > 0 && (
              <span style={{ opacity: 0.9 }}> {fmt(lastAction.amount)}</span>
            )}
          </div>
        )}

        {/* Bet chip */}
        {currentBet > 0 && !isFolded && (
          <div className="sk-seat-chip" style={{
            display: "flex", alignItems: "center", gap: "3px",
            padding: "2px 6px", borderRadius: "20px",
            background: "#120f00", border: "1.5px solid rgba(251,191,36,0.50)",
            boxShadow: "0 0 8px rgba(251,191,36,0.18)",
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
    </>
  );
}
