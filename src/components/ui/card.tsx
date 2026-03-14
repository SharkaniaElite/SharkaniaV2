// src/components/ui/card.tsx
import { type HTMLAttributes, type ReactNode } from "react";
import { cn } from "../../lib/cn";

type CardVariant = "default" | "interactive" | "featured" | "glow";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  children: ReactNode;
}

const variantClasses: Record<CardVariant, string> = {
  default:
    "bg-sk-bg-2 border border-sk-border-2 rounded-lg hover:border-sk-border-3",
  interactive:
    "bg-sk-bg-2 border border-sk-border-2 rounded-lg cursor-pointer hover:border-sk-border-3 hover:shadow-sk-md hover:-translate-y-px",
  featured:
    "bg-sk-bg-2 border border-sk-border-2 rounded-lg border-t-2 border-t-sk-accent",
  glow:
    "bg-sk-bg-2 border border-sk-border-2 rounded-lg hover:border-[rgba(34,211,238,0.15)] hover:shadow-sk-glow",
};

export function Card({
  variant = "default",
  children,
  className,
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        "p-6 transition-all duration-sk-base ease-sk-ease",
        variantClasses[variant],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
