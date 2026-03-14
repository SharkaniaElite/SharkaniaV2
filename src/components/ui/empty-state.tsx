// src/components/ui/empty-state.tsx
import { type ReactNode } from "react";
import { cn } from "../../lib/cn";

interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  icon = "🔍",
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-16 px-6 text-center",
        className
      )}
    >
      <span className="text-4xl mb-4">{icon}</span>
      <h3 className="text-sk-md font-bold text-sk-text-1 mb-2">{title}</h3>
      {description && (
        <p className="text-sk-sm text-sk-text-3 max-w-sm mb-6">
          {description}
        </p>
      )}
      {action}
    </div>
  );
}
