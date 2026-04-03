// src/components/blog/glossary-tooltip.tsx
import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { BookOpen } from "lucide-react";

interface GlossaryTooltipProps {
  term: string;
  slug: string;
  shortDefinition: string;
  children: React.ReactNode;
}

export function GlossaryTooltip({
  term,
  slug,
  shortDefinition,
  children,
}: GlossaryTooltipProps) {
  const [open, setOpen] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLSpanElement>(null);

  // Close on outside click (mobile)
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [open]);

  // Close on ESC
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

  const handleMouseEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setOpen(true), 200);
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setOpen(false), 300);
  };

  const handleClick = (e: React.MouseEvent) => {
    // On mobile (no hover), toggle on tap
    e.preventDefault();
    e.stopPropagation();
    setOpen((prev) => !prev);
  };

  return (
    <span
      ref={containerRef}
      className="relative inline"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* The term with underline style */}
      <span
        onClick={handleClick}
        className="text-sk-accent cursor-help border-b border-dashed border-sk-accent/40 hover:border-sk-accent transition-colors"
        role="button"
        tabIndex={0}
        aria-describedby={`glossary-${slug}`}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen((prev) => !prev);
          }
        }}
      >
        {children}
      </span>

      {/* Tooltip popup */}
      {open && (
        <span
          id={`glossary-${slug}`}
          role="tooltip"
          className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 sm:w-80"
          onMouseEnter={() => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
          }}
          onMouseLeave={handleMouseLeave}
        >
          <span className="block bg-sk-bg-3 border border-sk-border-3 rounded-lg shadow-sk-lg p-4 text-left">
            {/* Header */}
            <span className="flex items-center gap-2 mb-2">
              <BookOpen size={12} className="text-sk-accent shrink-0" />
              <span className="font-mono text-[10px] font-bold tracking-wider uppercase text-sk-accent">
                Glosario
              </span>
            </span>

            {/* Term name */}
            <span className="block text-sk-sm font-bold text-sk-text-1 mb-1.5">
              {term}
            </span>

            {/* Short definition */}
            <span className="block text-[12px] text-sk-text-2 leading-relaxed mb-3">
              {shortDefinition}
            </span>

            {/* Link to full definition */}
            <Link
              to={`/glosario/${slug}`}
              className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-sk-accent hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              Ver definición completa →
            </Link>
          </span>

          {/* Arrow */}
          <span className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-x-[6px] border-x-transparent border-t-[6px] border-t-sk-border-3" />
        </span>
      )}
    </span>
  );
}
