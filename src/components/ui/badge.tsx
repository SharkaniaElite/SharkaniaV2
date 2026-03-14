// src/components/ui/badge.tsx
import { type ReactNode } from "react";
import { cn } from "../../lib/cn";

type BadgeVariant =
  | "accent"
  | "green"
  | "red"
  | "gold"
  | "orange"
  | "purple"
  | "muted"
  | "live";

interface BadgeProps {
  variant?: BadgeVariant;
  children: ReactNode;
  className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
  accent: "bg-sk-accent-dim text-sk-accent",
  green: "bg-sk-green-dim text-sk-green",
  red: "bg-sk-red-dim text-sk-red",
  gold: "bg-sk-gold-dim text-sk-gold",
  orange: "bg-sk-orange-dim text-sk-orange",
  purple: "bg-sk-purple-dim text-sk-purple",
  muted: "bg-[rgba(113,113,122,0.12)] text-sk-text-3",
  live: "bg-sk-green-dim text-sk-green",
};

export function Badge({ variant = "accent", children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 font-mono text-[11px] font-semibold",
        "px-2 py-0.5 rounded-full leading-snug",
        variantClasses[variant],
        className
      )}
    >
      {variant === "live" && (
        <span className="w-1.5 h-1.5 rounded-full bg-current animate-sk-pulse" />
      )}
      {children}
    </span>
  );
}
