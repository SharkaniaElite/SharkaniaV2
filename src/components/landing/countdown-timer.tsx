// src/components/landing/countdown-timer.tsx
import { useState, useEffect } from "react";
import { cn } from "../../lib/cn";

type CountdownVariant = "soon" | "live" | "late" | "ended";

interface CountdownTimerProps {
  targetSeconds: number;
  variant?: CountdownVariant;
  label?: string;
}

const variantClasses: Record<CountdownVariant, string> = {
  soon: "bg-sk-accent-dim text-sk-accent",
  live: "bg-sk-green-dim text-sk-green",
  late: "bg-sk-orange-dim text-sk-orange",
  ended: "bg-[rgba(113,113,122,0.12)] text-sk-text-3",
};

const variantIcons: Record<CountdownVariant, string> = {
  soon: "⏱",
  live: "🟢",
  late: "⏳",
  ended: "✓",
};

export function CountdownTimer({
  targetSeconds,
  variant = "soon",
  label,
}: CountdownTimerProps) {
  const [remaining, setRemaining] = useState(targetSeconds);

  useEffect(() => {
    const interval = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 0) return targetSeconds;
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [targetSeconds]);

  const h = Math.floor(remaining / 3600);
  const m = Math.floor((remaining % 3600) / 60);
  const s = remaining % 60;
  const pad = (n: number) => String(n).padStart(2, "0");

  const timeStr = h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;

  return (
    <span
      className={cn(
        "font-mono text-[11px] font-semibold py-[3px] px-2 rounded-xs",
        "inline-flex items-center gap-1 whitespace-nowrap",
        variantClasses[variant]
      )}
    >
      {variantIcons[variant]}{" "}
      {label ? `${label}: ${timeStr}` : timeStr}
    </span>
  );
}
