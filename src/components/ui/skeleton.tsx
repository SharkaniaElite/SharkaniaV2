// src/components/ui/skeleton.tsx
import { cn } from "../../lib/cn";

interface SkeletonProps {
  className?: string;
}

function SkeletonBase({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-sk-bg-4/50",
        className
      )}
    />
  );
}

export function SkeletonText({ className }: SkeletonProps) {
  return <SkeletonBase className={cn("h-4 w-full", className)} />;
}

export function SkeletonTitle({ className }: SkeletonProps) {
  return <SkeletonBase className={cn("h-7 w-48", className)} />;
}

export function SkeletonAvatar({ className }: SkeletonProps) {
  return <SkeletonBase className={cn("h-7 w-7 rounded-full", className)} />;
}

export function SkeletonCard({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        "bg-sk-bg-2 border border-sk-border-1 rounded-lg p-6 space-y-4",
        className
      )}
    >
      <div className="flex items-center gap-3">
        <SkeletonAvatar />
        <SkeletonText className="w-32" />
      </div>
      <SkeletonText className="w-full" />
      <SkeletonText className="w-3/4" />
      <div className="flex gap-4">
        <SkeletonText className="w-16" />
        <SkeletonText className="w-16" />
        <SkeletonText className="w-16" />
      </div>
    </div>
  );
}

export function SkeletonRow({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-4 py-3 px-4 border-b border-sk-border-1",
        className
      )}
    >
      <SkeletonBase className="h-7 w-7 rounded-xs" />
      <div className="flex items-center gap-3 flex-1">
        <SkeletonAvatar />
        <SkeletonText className="w-32" />
      </div>
      <SkeletonText className="w-16" />
      <SkeletonText className="w-12" />
      <SkeletonText className="w-10" />
    </div>
  );
}

export function SkeletonTable({ rows = 7 }: { rows?: number }) {
  return (
    <div className="bg-sk-bg-2 border border-sk-border-1 rounded-lg overflow-hidden">
      <div className="bg-sk-bg-3 py-3 px-4">
        <SkeletonText className="w-full h-3" />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonRow key={i} />
      ))}
    </div>
  );
}
