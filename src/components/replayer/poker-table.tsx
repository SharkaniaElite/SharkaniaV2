// src/components/replayer/poker-table.tsx
import type { ReplayState, Street } from "../../types/replayer";
import { PlayerSeat } from "./player-seat";
import { CardSVG } from "./card-svg";

interface PokerTableProps {
  state: ReplayState;
  className?: string;
}

const STREET_CFG: Record<Street, { label: string; color: string; glow: string; railOpacity: number }> = {
  preflop:  { label: "PREFLOP",  color: "#94a3b8", glow: "rgba(148,163,184,0.4)", railOpacity: 0.40 },
  flop:     { label: "FLOP",     color: "#22d3ee", glow: "rgba(34,211,238,0.6)",  railOpacity: 0.65 },
  turn:     { label: "TURN",     color: "#fbbf24", glow: "rgba(251,191,36,0.6)",  railOpacity: 0.65 },
  river:    { label: "RIVER",    color: "#f87171", glow: "rgba(248,113,113,0.6)", railOpacity: 0.65 },
  showdown: { label: "SHOWDOWN", color: "#c4b5fd", glow: "rgba(196,181,253,0.6)", railOpacity: 0.65 },
};

function getSeatPositions(n: number): { top: number; left: number }[] {
  const pos: Record<number, { top: number; left: number }[]> = {
    2: [
      { top: 84, left: 50 },
      { top: 16, left: 50 },
    ],
    3: [
      { top: 84, left: 50 },
      { top: 22, left: 12 },
      { top: 22, left: 88 },
    ],
    4: [
      { top: 84, left: 50 },
      { top: 46, left:  5 },
      { top: 16, left: 50 },
      { top: 46, left: 95 },
    ],
    5: [
      { top: 84, left: 50 },
      { top: 63, left:  5 },
      { top: 18, left: 18 },
      { top: 18, left: 82 },
      { top: 63, left: 95 },
    ],
    6: [
      { top: 84, left: 50 },
      { top: 66, left:  4 },
      { top: 20, left: 14 },
      { top: 14, left: 50 },
      { top: 20, left: 86 },
      { top: 66, left: 96 },
    ],
    7: [
      { top: 84, left: 50 },
      { top: 70, left:  4 },
      { top: 36, left:  3 },
      { top: 15, left: 26 },
      { top: 15, left: 74 },
      { top: 36, left: 97 },
      { top: 70, left: 96 },
    ],
    8: [
      { top: 84, left: 50 },
      { top: 74, left:  4 },
      { top: 42, left:  2 },
      { top: 15, left: 20 },
      { top: 14, left: 50 },
      { top: 15, left: 80 },
      { top: 42, left: 98 },
      { top: 74, left: 96 },
    ],
    9: [
      { top: 84, left: 50 },
      { top: 76, left:  4 },
      { top: 47, left:  1 },
      { top: 18, left: 11 },
      { top: 14, left: 35 },
      { top: 14, left: 65 },
      { top: 18, left: 89 },
      { top: 47, left: 99 },
      { top: 76, left: 96 },
    ],
  };
  return pos[n] ?? pos[6];
}

function fmtPot(n: number): string {
  if (n === 0) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000)    return `${(n / 1_000).toFixed(1)}K`;
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(2);
}

export function PokerTable({ state, className = "" }: PokerTableProps) {
  const {
    hand, players, pot, communityCards,
    currentStreetIndex, currentActionIndex, isFinished,
  } = state;

  const numPlayers    = players.length;
  const seatPositions = getSeatPositions(numPlayers);
  const currentStreet = hand.streets[currentStreetIndex];
  const streetCfg     = currentStreet ? STREET_CFG[currentStreet.street] : STREET_CFG.preflop;

  const activeIdx = currentStreet
    && currentActionIndex >= 0
    && currentActionIndex < currentStreet.actions.length
    ? currentStreet.actions[currentActionIndex].playerIndex
    : -1;

  const lastActions = players.map((_, idx) => {
    if (!currentStreet) return null;
    for (let i = currentActionIndex; i >= 0; i--) {
      if (currentStreet.actions[i]?.playerIndex === idx) return currentStreet.actions[i];
    }
    return null;
  });

  const isShowdown    = currentStreet?.street === "showdown" || isFinished;
  const winnerIndices = new Set(hand.result?.winners.map((w) => w.playerIndex) ?? []);

  const displayCards: (import("../../types/replayer").Card | null)[] = [
    ...communityCards,
    ...Array(5 - communityCards.length).fill(null),
  ];

  const PH = "12%";
  const PV = "14%";

  return (
    <>
      {/*
        Inyectamos CSS responsivo aquí para evitar props adicionales.
        En mobile (<480px): cartas md→sm, slots más pequeños, aspect ratio más ancho.
      */}
      <style>{`
        .sk-table-root {
          position: relative;
          width: 100%;
          aspect-ratio: 16 / 10;
          overflow: visible;
        }
        .sk-community-card-lg { display: block; }
        .sk-community-card-sm { display: none; }
        .sk-community-slot-lg { display: block; width: 68px; height: 95px; }
        .sk-community-slot-sm { display: none; width: 44px; height: 62px; }

        @media (max-width: 520px) {
          .sk-table-root {
            aspect-ratio: 4 / 3;
          }
          .sk-community-card-lg { display: none; }
          .sk-community-card-sm { display: block; }
          .sk-community-slot-lg { display: none; }
          .sk-community-slot-sm { display: block; }
        }
      `}</style>

      <div className={`sk-table-root ${className}`}>
        {/* Halo ambiental */}
        <div style={{
          position: "absolute",
          top: PV, left: PH, right: PH, bottom: PV,
          borderRadius: "50%",
          background: `radial-gradient(ellipse, ${streetCfg.glow} 0%, transparent 68%)`,
          filter: "blur(32px)",
          opacity: 0.45,
          pointerEvents: "none",
          transition: "background 0.6s ease",
        }} />

        {/* Rail madera */}
        <div style={{
          position: "absolute",
          top: PV, left: PH, right: PH, bottom: PV,
          borderRadius: "50%",
          background: "radial-gradient(ellipse at 50% 25%, #221a08 0%, #110e04 100%)",
          boxShadow: "0 0 50px rgba(0,0,0,0.8), inset 0 2px 0 rgba(255,255,255,0.04)",
        }} />

        {/* Neon rail */}
        <div style={{
          position: "absolute",
          top: `calc(${PV} + 1.5%)`,
          left: `calc(${PH} + 1.5%)`,
          right: `calc(${PH} + 1.5%)`,
          bottom: `calc(${PV} + 1.5%)`,
          borderRadius: "50%",
          border: `2.5px solid ${streetCfg.color}`,
          opacity: streetCfg.railOpacity,
          boxShadow: `0 0 8px ${streetCfg.color}, 0 0 24px ${streetCfg.glow}, 0 0 50px ${streetCfg.glow}, inset 0 0 20px ${streetCfg.glow}`,
          pointerEvents: "none",
          transition: "border-color 0.5s, box-shadow 0.5s, opacity 0.5s",
        }} />

        {/* Felt */}
        <div style={{
          position: "absolute",
          top: `calc(${PV} + 3%)`,
          left: `calc(${PH} + 3%)`,
          right: `calc(${PH} + 3%)`,
          bottom: `calc(${PV} + 3%)`,
          borderRadius: "50%",
          background: "radial-gradient(ellipse at 50% 35%, #1e5c40 0%, #134030 40%, #0a2820 100%)",
          overflow: "hidden",
        }}>
          <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.05 }}>
            <defs>
              <pattern id="felt-grain" width="5" height="5" patternUnits="userSpaceOnUse">
                <line x1="0" y1="0" x2="5" y2="5" stroke="#fff" strokeWidth="0.5"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#felt-grain)"/>
          </svg>
          <div style={{
            position: "absolute", inset: 0,
            background: "radial-gradient(ellipse at 50% 40%, rgba(255,255,255,0.05) 0%, transparent 58%)",
          }} />
        </div>

        {/* Centro: badge + cartas + pot */}
        <div style={{
          position: "absolute",
          top: `calc(${PV} + 3%)`,
          left: `calc(${PH} + 3%)`,
          right: `calc(${PH} + 3%)`,
          bottom: `calc(${PV} + 3%)`,
          borderRadius: "50%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "clamp(3px, 0.8%, 8px)",
          pointerEvents: "none",
        }}>
          {/* Street badge */}
          <div style={{
            padding: "2px 10px",
            borderRadius: "20px",
            background: `${streetCfg.color}18`,
            border: `1px solid ${streetCfg.color}55`,
            fontSize: "clamp(7px, 1vw, 10px)",
            fontFamily: "'JetBrains Mono', monospace",
            fontWeight: 700,
            color: streetCfg.color,
            letterSpacing: "0.18em",
            boxShadow: `0 0 12px ${streetCfg.glow}`,
            transition: "all 0.4s ease",
            whiteSpace: "nowrap",
          }}>
            {streetCfg.label}
          </div>

          {/* Cartas comunitarias — dos versiones por breakpoint */}
          <div style={{ display: "flex", alignItems: "center", gap: "clamp(2px, 0.5%, 5px)" }}>
            {displayCards.map((card, i) => {
              const revealed = i < communityCards.length;
              return (
                <div key={i} style={{
                  transition: "opacity 0.35s ease, transform 0.35s ease",
                  opacity: revealed ? 1 : 0.08,
                  transform: revealed ? "translateY(0) scale(1)" : "translateY(3px) scale(0.97)",
                }}>
                  {revealed ? (
                    <>
                      {/* Desktop: lg */}
                      <span className="sk-community-card-lg">
                        <CardSVG card={card} size="lg" />
                      </span>
                      {/* Mobile: sm */}
                      <span className="sk-community-card-sm">
                        <CardSVG card={card} size="sm" />
                      </span>
                    </>
                  ) : (
                    <>
                      <div className="sk-community-slot-lg" style={{
                        borderRadius: "6px",
                        border: "1px dashed rgba(255,255,255,0.08)",
                        background: "rgba(255,255,255,0.015)",
                      }} />
                      <div className="sk-community-slot-sm" style={{
                        borderRadius: "4px",
                        border: "1px dashed rgba(255,255,255,0.08)",
                        background: "rgba(255,255,255,0.015)",
                      }} />
                    </>
                  )}
                </div>
              );
            })}
          </div>

          {/* Pot */}
          {pot.totalPot > 0 && (
            <div style={{
              display: "flex", alignItems: "center", gap: "5px",
              padding: "3px 12px", borderRadius: "20px",
              background: "#120f00",
              border: "1.5px solid rgba(251,191,36,0.45)",
              boxShadow: "0 0 16px rgba(251,191,36,0.18), 0 2px 8px rgba(0,0,0,0.7)",
              whiteSpace: "nowrap",
            }}>
              <svg width="11" height="11" viewBox="0 0 12 12">
                <circle cx="6" cy="6" r="5.5" fill="#fbbf24"/>
                <circle cx="6" cy="6" r="3.5" fill="none" stroke="#fff" strokeWidth="0.9" opacity="0.45"/>
                <circle cx="6" cy="6" r="1.8" fill="#fff" opacity="0.25"/>
              </svg>
              <span style={{
                fontSize: "clamp(10px, 1.2vw, 15px)",
                fontFamily: "'JetBrains Mono', monospace",
                fontWeight: 700, color: "#fbbf24", letterSpacing: "-0.3px",
              }}>
                {fmtPot(pot.totalPot)}
              </span>
              {pot.sidePots.length > 0 && (
                <span style={{ fontSize: "8px", fontFamily: "'JetBrains Mono', monospace", color: "rgba(251,191,36,0.50)" }}>
                  +{pot.sidePots.length} side
                </span>
              )}
            </div>
          )}
        </div>

        {/* Asientos */}
        {players.map((player, idx) => {
          const pos = seatPositions[idx];
          if (!pos) return null;
          return (
            <div key={idx} style={{
              position: "absolute",
              top: `${pos.top}%`,
              left: `${pos.left}%`,
              transform: "translate(-50%, -50%)",
              zIndex: idx === activeIdx ? 20 : 5,
            }}>
              <PlayerSeat
                player={player}
                lastAction={lastActions[idx]}
                isActive={idx === activeIdx}
                showCards={isShowdown}
                isWinner={winnerIndices.has(idx)}
              />
            </div>
          );
        })}

        {/* Overlay ganador */}
        {isFinished && hand.result && hand.result.winners.length > 0 && (
          <div style={{
            position: "absolute",
            top: "50%", left: "50%",
            transform: "translate(-50%, -50%)",
            textAlign: "center", pointerEvents: "none", zIndex: 30,
            whiteSpace: "nowrap",
          }}>
            <div style={{
              padding: "10px 20px", borderRadius: "12px",
              background: "#0d0d00",
              border: "1.5px solid rgba(251,191,36,0.55)",
              boxShadow: "0 0 30px rgba(251,191,36,0.22), 0 8px 30px rgba(0,0,0,0.8)",
            }}>
              {hand.result.winners.map((w, i) => (
                <div key={i}>
                  <div style={{
                    fontSize: "8px", fontFamily: "'JetBrains Mono', monospace",
                    fontWeight: 700, color: "#fbbf24", letterSpacing: "0.22em", marginBottom: "3px",
                  }}>★ GANADOR</div>
                  <div style={{
                    fontSize: "clamp(12px, 1.5vw, 17px)",
                    fontFamily: "Inter, system-ui, sans-serif",
                    fontWeight: 700, color: "#fafafa",
                  }}>
                    {players[w.playerIndex]?.name ?? "???"}
                  </div>
                  <div style={{
                    fontSize: "clamp(10px, 1.2vw, 14px)",
                    fontFamily: "'JetBrains Mono', monospace",
                    fontWeight: 700, color: "#fbbf24", marginTop: "2px",
                  }}>
                    +{fmtPot(w.amount)}
                  </div>
                  {w.handDescription && (
                    <div style={{ fontSize: "10px", color: "rgba(251,191,36,0.65)", marginTop: "3px" }}>
                      {w.handDescription}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
