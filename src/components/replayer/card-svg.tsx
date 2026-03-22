// src/components/replayer/card-svg.tsx
// ══════════════════════════════════════════════════════════
// SVG Playing Card — Renders a single card face-up or face-down
// Dark mode, Sharkania design system
// ══════════════════════════════════════════════════════════

import type { Card } from "../../types/replayer";
import { SUIT_SYMBOLS, SUIT_COLORS, RANK_DISPLAY } from "../../types/replayer";

interface CardSVGProps {
  card: Card | null;   // null = face down
  size?: "sm" | "md" | "lg";
  className?: string;
  highlighted?: boolean;
  dimmed?: boolean;
}

const SIZES = {
  sm: { w: 32, h: 44, fontSize: 11, suitSize: 10, rx: 3 },
  md: { w: 42, h: 58, fontSize: 14, suitSize: 13, rx: 4 },
  lg: { w: 56, h: 78, fontSize: 18, suitSize: 17, rx: 5 },
};

export function CardSVG({ card, size = "md", className = "", highlighted = false, dimmed = false }: CardSVGProps) {
  const s = SIZES[size];

  if (!card) {
    // Face-down card
    return (
      <svg
        width={s.w}
        height={s.h}
        viewBox={`0 0 ${s.w} ${s.h}`}
        className={className}
        style={{ opacity: dimmed ? 0.3 : 1 }}
      >
        <rect
          x="0.5"
          y="0.5"
          width={s.w - 1}
          height={s.h - 1}
          rx={s.rx}
          fill="#1a1b20"
          stroke="rgba(255,255,255,0.12)"
          strokeWidth="1"
        />
        {/* Back pattern — subtle grid */}
        <pattern id={`back-${size}`} width="6" height="6" patternUnits="userSpaceOnUse">
          <rect width="6" height="6" fill="none" />
          <circle cx="3" cy="3" r="0.5" fill="rgba(34,211,238,0.15)" />
        </pattern>
        <rect
          x="3"
          y="3"
          width={s.w - 6}
          height={s.h - 6}
          rx={s.rx - 1}
          fill={`url(#back-${size})`}
          stroke="rgba(34,211,238,0.08)"
          strokeWidth="0.5"
        />
        {/* Sharkania logo hint */}
        <text
          x={s.w / 2}
          y={s.h / 2 + 1}
          textAnchor="middle"
          dominantBaseline="central"
          fill="rgba(34,211,238,0.2)"
          fontSize={s.fontSize - 2}
          fontFamily="system-ui"
          fontWeight="700"
        >
          S
        </text>
      </svg>
    );
  }

  const color = SUIT_COLORS[card.suit];
  const symbol = SUIT_SYMBOLS[card.suit];
  const rank = RANK_DISPLAY[card.rank];
  const isRed = card.suit === "h" || card.suit === "d";

  return (
    <svg
      width={s.w}
      height={s.h}
      viewBox={`0 0 ${s.w} ${s.h}`}
      className={className}
      style={{
        opacity: dimmed ? 0.3 : 1,
        filter: highlighted ? `drop-shadow(0 0 6px ${color}50)` : undefined,
        transition: "opacity 0.2s, filter 0.2s",
      }}
    >
      {/* Card background */}
      <rect
        x="0.5"
        y="0.5"
        width={s.w - 1}
        height={s.h - 1}
        rx={s.rx}
        fill="#f8f8f8"
        stroke={highlighted ? color : "rgba(255,255,255,0.15)"}
        strokeWidth={highlighted ? 1.5 : 1}
      />

      {/* Top-left rank */}
      <text
        x={4}
        y={s.fontSize + 2}
        fill={color}
        fontSize={s.fontSize}
        fontFamily="'JetBrains Mono', monospace"
        fontWeight="700"
      >
        {rank}
      </text>

      {/* Top-left suit */}
      <text
        x={4}
        y={s.fontSize + s.suitSize + 3}
        fill={color}
        fontSize={s.suitSize}
        fontFamily="system-ui"
      >
        {symbol}
      </text>

      {/* Center suit (large) */}
      <text
        x={s.w / 2}
        y={s.h / 2 + 2}
        textAnchor="middle"
        dominantBaseline="central"
        fill={color}
        fontSize={s.suitSize * 1.8}
        fontFamily="system-ui"
        opacity="0.85"
      >
        {symbol}
      </text>

      {/* Bottom-right rank (inverted) */}
      <text
        x={s.w - 4}
        y={s.h - 4}
        textAnchor="end"
        fill={color}
        fontSize={s.fontSize}
        fontFamily="'JetBrains Mono', monospace"
        fontWeight="700"
        transform={`rotate(180 ${s.w - 4} ${s.h - s.fontSize / 2 - 2})`}
      >
        {rank}
      </text>
    </svg>
  );
}

// ── Card group (e.g. hole cards, community cards) ────────

interface CardGroupProps {
  cards: (Card | null)[];
  size?: "sm" | "md" | "lg";
  overlap?: boolean;
  highlighted?: boolean;
  dimmed?: boolean;
}

export function CardGroup({ cards, size = "md", overlap = false, highlighted = false, dimmed = false }: CardGroupProps) {
  const s = SIZES[size];
  const gap = overlap ? -s.w * 0.3 : 3;

  return (
    <div className="inline-flex items-center" style={{ gap: `${gap}px` }}>
      {cards.map((card, i) => (
        <CardSVG
          key={i}
          card={card}
          size={size}
          highlighted={highlighted}
          dimmed={dimmed}
          className={overlap && i > 0 ? "relative" : ""}
        />
      ))}
    </div>
  );
}
