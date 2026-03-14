// src/components/ui/chip.tsx
import { type ReactNode } from "react";
import { cn } from "../../lib/cn";

interface ChipProps {
  children: ReactNode;
  className?: string;
}

export function Chip({ children, className }: ChipProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-sk-xs font-medium",
        "px-2.5 py-1 rounded-full",
        "bg-white/[0.04] border border-sk-border-1 text-sk-text-2",
        className
      )}
    >
      {children}
    </span>
  );
}
