// src/components/academy/inline-cards.tsx
//
// Parses poker hand notation and renders mini visual cards inline.
// Usage in lesson body JSON:  "...tu mano es {{A♠K♥}} y el flop trae {{Q♠J♦T♣}}..."
//
// Supported notations:
//   {{A♠K♥}}     → individual cards with suits
//   {{AA}}        → pocket pair (renders as A♠A♥)
//   {{AKs}}      → suited hand (renders as A♠K♠)
//   {{AKo}}      → offsuit hand (renders as A♠K♥)
//   {{JTs}}      → suited connector
//   {{97s}}      → suited gapper

import type { ReactNode } from "react";

// ── Suit mapping ──

const SUIT_SYMBOLS: Record<string, { symbol: string; color: string }> = {
  "♠": { symbol: "♠", color: "text-slate-900" },
  "♣": { symbol: "♣", color: "text-green-800" },
  "♥": { symbol: "♥", color: "text-red-600" },
  "♦": { symbol: "♦", color: "text-blue-600" },
  s: { symbol: "♠", color: "text-slate-900" }, // suited default
  o: { symbol: "", color: "" }, // offsuit marker
};

const RANK_ORDER = "23456789TJQKA";

// ── Single card component ──

function MiniCard({ rank, suit }: { rank: string; suit: string }) {
  const suitInfo = SUIT_SYMBOLS[suit];
  if (!suitInfo) return <span className="font-mono font-bold">{rank}{suit}</span>;

  const isRed = suit === "♥" || suit === "♦";
  const isBlueDiamond = suit === "♦";

  return (
    <span
      className={`
        inline-flex items-center justify-center
        w-[26px] h-[34px] rounded-[3px]
        bg-white border border-slate-200
        shadow-[0_1px_2px_rgba(0,0,0,0.1)]
        font-bold text-[13px] leading-none
        align-middle mx-[1px] relative
        ${isRed ? (isBlueDiamond ? "text-blue-600" : "text-red-600") : "text-slate-900"}
      `}
      style={{ fontFamily: "'JetBrains Mono', monospace" }}
    >
      <span className="flex flex-col items-center gap-0 leading-[1]">
        <span className="text-[11px] font-extrabold">{rank}</span>
        <span className="text-[9px] -mt-[2px]">{suitInfo.symbol}</span>
      </span>
    </span>
  );
}

// ── Parse individual cards from a string like "A♠K♥" ──

function parseExplicitCards(text: string): Array<{ rank: string; suit: string }> {
  const cards: Array<{ rank: string; suit: string }> = [];
  let i = 0;

  while (i < text.length) {
    const char = text[i];

    // Check if this is a rank character
    if (char && RANK_ORDER.includes(char.toUpperCase())) {
      const rank = char.toUpperCase();
      const nextChar = text[i + 1];

      // Check for suit symbol
      if (nextChar && "♠♣♥♦".includes(nextChar)) {
        cards.push({ rank, suit: nextChar });
        i += 2;
        continue;
      }
    }

    i++;
  }

  return cards;
}

// ── Parse shorthand notation like "AKs", "AKo", "AA", "JTs" ──

function parseShorthand(text: string): Array<{ rank: string; suit: string }> | null {
  const clean = text.trim();

  // Pocket pair: "AA", "KK", "TT", "99", etc.
  if (clean.length === 2 && clean[0] === clean[1] && RANK_ORDER.includes(clean[0]!.toUpperCase())) {
    return [
      { rank: clean[0]!.toUpperCase(), suit: "♠" },
      { rank: clean[1]!.toUpperCase(), suit: "♥" },
    ];
  }

  // Suited: "AKs", "JTs", "76s"
  if (clean.length === 3 && clean[2]!.toLowerCase() === "s") {
    const r1 = clean[0]!.toUpperCase();
    const r2 = clean[1]!.toUpperCase();
    if (RANK_ORDER.includes(r1) && RANK_ORDER.includes(r2)) {
      return [
        { rank: r1, suit: "♠" },
        { rank: r2, suit: "♠" },
      ];
    }
  }

  // Offsuit: "AKo", "QJo"
  if (clean.length === 3 && clean[2]!.toLowerCase() === "o") {
    const r1 = clean[0]!.toUpperCase();
    const r2 = clean[1]!.toUpperCase();
    if (RANK_ORDER.includes(r1) && RANK_ORDER.includes(r2)) {
      return [
        { rank: r1, suit: "♠" },
        { rank: r2, suit: "♥" },
      ];
    }
  }

  // Range notation with +: "77+", "A2s+"
  // Just render the named hand, don't expand the range
  if (clean.endsWith("+")) {
    const base = clean.slice(0, -1);
    const parsed = parseShorthand(base);
    if (parsed) return parsed;
    // Single pair like "77+"
    if (base.length === 2 && base[0] === base[1] && RANK_ORDER.includes(base[0]!.toUpperCase())) {
      return [
        { rank: base[0]!.toUpperCase(), suit: "♠" },
        { rank: base[1]!.toUpperCase(), suit: "♥" },
      ];
    }
  }

  return null;
}

// ── Main parse function ──

function parseHandNotation(text: string): Array<{ rank: string; suit: string }> {
  // First try explicit cards (A♠K♥)
  const explicit = parseExplicitCards(text);
  if (explicit.length > 0) return explicit;

  // Then try shorthand (AKs, AKo, AA)
  const shorthand = parseShorthand(text);
  if (shorthand) return shorthand;

  return [];
}

// ── Inline cards group ──

function InlineCardGroup({ notation }: { notation: string }) {
  const cards = parseHandNotation(notation);

  if (cards.length === 0) {
    // Couldn't parse — render as styled text
    return (
      <span className="font-mono font-bold text-sk-accent bg-sk-accent-dim px-1.5 py-0.5 rounded text-[12px]">
        {notation}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-[2px] align-middle">
      {cards.map((card, i) => (
        <MiniCard key={i} rank={card.rank} suit={card.suit} />
      ))}
    </span>
  );
}

// ── Main export: process text and replace {{...}} with card visuals ──

const CARD_NOTATION_REGEX = /\{\{([^}]+)\}\}/g;

/**
 * Takes a ReactNode (could be string or JSX from glossary processing)
 * and replaces any {{card notation}} with visual card components.
 */
export function processInlineCards(node: ReactNode): ReactNode {
  if (typeof node === "string") {
    return processStringForCards(node);
  }

  // If it's an array of nodes, process each
  if (Array.isArray(node)) {
    return node.map((child, i) => {
      const processed = processInlineCards(child);
      // Wrap in fragment with key if needed
      if (processed !== child) {
        return <span key={`card-wrap-${i}`}>{processed}</span>;
      }
      return child;
    });
  }

  // If it's a React element with children, we can't easily process deeper
  // Return as-is — cards in glossary tooltips won't be processed (acceptable tradeoff)
  return node;
}

function processStringForCards(text: string): ReactNode {
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  CARD_NOTATION_REGEX.lastIndex = 0;

  while ((match = CARD_NOTATION_REGEX.exec(text)) !== null) {
    // Add text before the match
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    // Add the card group
    const notation = match[1]!;
    parts.push(<InlineCardGroup key={`cards-${match.index}`} notation={notation} />);

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  if (parts.length === 0) return text;
  if (parts.length === 1 && typeof parts[0] === "string") return text;

  return <>{parts}</>;
}
