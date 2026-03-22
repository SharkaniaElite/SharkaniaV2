// src/components/replayer/card-svg.tsx
import type { Card } from "../../types/replayer";
import { RANK_DISPLAY } from "../../types/replayer";

export interface CardSVGProps {
  card: Card | null;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  highlighted?: boolean;
  winning?: boolean;
  dimmed?: boolean;
  faceDown?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export interface CardGroupProps {
  cards: (Card | null)[];
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  highlighted?: boolean;
  winning?: boolean;
  dimmed?: boolean;
  fanned?: boolean;
}

const SIZES = {
  xs: { w: 28,  h: 40  },
  sm: { w: 38,  h: 54  },
  md: { w: 52,  h: 73  },
  lg: { w: 68,  h: 95  },
  xl: { w: 90,  h: 126 },
} as const;

export function CardSVG({
  card,
  size = "md",
  highlighted = false,
  winning = false,
  dimmed = false,
  faceDown = false,
  className = "",
  style,
}: CardSVGProps) {
  const { w, h } = SIZES[size];

  // null card OR faceDown prop => show back
  const showBack = faceDown || card === null;
  const filename = showBack ? "back.svg" : `${card.rank}${card.suit}.svg`;
  const src = `/cards/${filename}`;

  const borderColor = winning
    ? "rgba(251,191,36,0.80)"
    : highlighted
    ? "rgba(34,211,238,0.75)"
    : showBack
    ? "rgba(34,211,238,0.15)"
    : "rgba(0,0,0,0.12)";

  const shadow = winning
    ? "0 0 16px rgba(251,191,36,0.50), 0 0 32px rgba(251,191,36,0.22), 0 4px 10px rgba(0,0,0,0.6)"
    : highlighted
    ? "0 0 16px rgba(34,211,238,0.45), 0 0 32px rgba(34,211,238,0.20), 0 4px 10px rgba(0,0,0,0.6)"
    : showBack
    ? "0 2px 12px rgba(0,0,0,0.7), inset 0 0 0 1px rgba(34,211,238,0.08)"
    : "0 3px 10px rgba(0,0,0,0.55), 0 1px 3px rgba(0,0,0,0.4)";

  const rx = Math.round(w * 0.085);

  return (
    <span
      className={className}
      style={{
        display: "inline-block",
        width: `${w}px`,
        height: `${h}px`,
        flexShrink: 0,
        borderRadius: `${rx}px`,
        overflow: "hidden",
        outline: `1.5px solid ${borderColor}`,
        boxShadow: shadow,
        opacity: dimmed ? 0.20 : 1,
        transition: "opacity 0.3s ease, box-shadow 0.3s ease",
        filter: (highlighted || winning) ? "brightness(1.08)" : "none",
        ...style,
      }}
    >
      <img
        src={src}
        width={w}
        height={h}
        alt={showBack ? "carta boca abajo" : `${RANK_DISPLAY[card!.rank]}${card!.suit}`}
        style={{
          display: "block",
          width: "100%",
          height: "100%",
          userSelect: "none",
          pointerEvents: "none",
        }}
        draggable={false}
      />
    </span>
  );
}

export function CardGroup({
  cards,
  size = "md",
  highlighted = false,
  winning = false,
  dimmed = false,
  fanned = false,
}: CardGroupProps) {
  const { w } = SIZES[size];

  if (!fanned) {
    return (
      <div style={{ display: "flex", alignItems: "flex-end", gap: "3px" }}>
        {cards.map((card, i) => (
          <CardSVG
            key={i}
            card={card}
            size={size}
            highlighted={highlighted}
            winning={winning}
            dimmed={dimmed}
          />
        ))}
      </div>
    );
  }

  const count    = cards.length;
  const spreadDeg = count <= 2 ? 10 : 7;
  const midIdx   = (count - 1) / 2;
  const overlapPx = Math.round(w * 0.30);

  return (
    <div style={{ display: "flex", alignItems: "flex-end" }}>
      {cards.map((card, i) => {
        const angle = (i - midIdx) * spreadDeg;
        const lift  = Math.abs(i - midIdx) * 2;
        return (
          <div
            key={i}
            style={{
              marginLeft: i > 0 ? `-${overlapPx}px` : "0",
              zIndex: i,
              position: "relative",
              transform: `rotate(${angle}deg) translateY(${lift}px)`,
              transformOrigin: "bottom center",
              transition: "transform 0.35s cubic-bezier(0.34,1.56,0.64,1)",
            }}
          >
            <CardSVG
              card={card}
              size={size}
              highlighted={highlighted}
              winning={winning}
              dimmed={dimmed}
            />
          </div>
        );
      })}
    </div>
  );
}
