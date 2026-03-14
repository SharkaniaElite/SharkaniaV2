// src/components/landing/reveal-section.tsx
import { type ReactNode } from "react";
import { cn } from "../../lib/cn";
import { useReveal } from "../../hooks/use-reveal";

interface RevealSectionProps {
  children: ReactNode;
  className?: string;
}

export function RevealSection({ children, className }: RevealSectionProps) {
  const ref = useReveal();

  return (
    <div ref={ref} className={cn("sk-reveal", className)}>
      {children}
    </div>
  );
}
