// src/components/ui/stat-card.tsx
import { cn } from "../../lib/cn";

type StatAccent = "default" | "accent" | "green" | "gold";

interface StatCardProps {
  label: string;
  value: string;
  delta?: string;
  deltaDirection?: "up" | "down";
  accent?: StatAccent;
  className?: string;
}

const accentClasses: Record<StatAccent, string> = {
  default: "text-sk-text-1",
  accent: "text-sk-accent",
  green: "text-sk-green",
  gold: "text-sk-gold",
};

export function StatCard({
  label,
  value,
  delta,
  deltaDirection = "up",
  accent = "default",
  className,
}: StatCardProps) {
  return (
    <div
      className={cn(
        "bg-sk-bg-2 border border-sk-border-2 rounded-md p-5",
        className
      )}
    >
      <div className="font-mono text-[11px] font-semibold tracking-[0.05em] uppercase text-sk-text-2 mb-2">
        {label}
      </div>
      <div
        className={cn(
          "font-mono text-sk-2xl font-bold tracking-tight leading-none",
          accentClasses[accent]
        )}
      >
        {value}
      </div>
      {delta && (
        <span
          className={cn(
            "inline-flex items-center gap-0.5 font-mono text-[11px] font-semibold mt-2 px-1.5 py-0.5 rounded-xs",
            deltaDirection === "up"
              ? "text-sk-green bg-sk-green-dim"
              : "text-sk-red bg-sk-red-dim"
          )}
        >
          {deltaDirection === "up" ? "↑" : "↓"} {delta}
        </span>
      )}
    </div>
  );
}
