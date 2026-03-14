// src/components/ranking/rank-badge.tsx
import { cn } from "../../lib/cn";

interface RankBadgeProps {
  rank: number;
}

export function RankBadge({ rank }: RankBadgeProps) {
  const cls =
    rank === 1
      ? "bg-sk-gold-dim text-sk-gold"
      : rank === 2
        ? "bg-[rgba(203,213,225,0.1)] text-sk-silver"
        : rank === 3
          ? "bg-[rgba(217,119,6,0.1)] text-sk-bronze"
          : "text-sk-text-2";

  return (
    <span
      className={cn(
        "font-mono font-bold text-sk-sm w-7 h-7 inline-flex items-center justify-center rounded-xs",
        cls
      )}
    >
      {rank}
    </span>
  );
}
