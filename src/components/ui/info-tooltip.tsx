// src/components/ui/info-tooltip.tsx
import { useState, useRef, useEffect } from "react";

interface InfoTooltipProps {
  content: string;
  title?: string;
  position?: "top" | "bottom" | "left" | "right";
  size?: "sm" | "md";
}

/**
 * Info tooltip with a 3D-style animated icon.
 * Hover on desktop, tap on mobile to show help text.
 * Used throughout the club admin panel to explain each feature.
 */
export function InfoTooltip({ content, title, position = "top", size = "md" }: InfoTooltipProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click (mobile)
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const iconSize = size === "sm" ? 16 : 20;

  const positionClasses: Record<string, string> = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    left: "right-full top-1/2 -translate-y-1/2 mr-2",
    right: "left-full top-1/2 -translate-y-1/2 ml-2",
  };

  const arrowClasses: Record<string, string> = {
    top: "top-full left-1/2 -translate-x-1/2 border-t-[#1a1b1f] border-x-transparent border-b-transparent",
    bottom: "bottom-full left-1/2 -translate-x-1/2 border-b-[#1a1b1f] border-x-transparent border-t-transparent",
    left: "left-full top-1/2 -translate-y-1/2 border-l-[#1a1b1f] border-y-transparent border-r-transparent",
    right: "right-full top-1/2 -translate-y-1/2 border-r-[#1a1b1f] border-y-transparent border-l-transparent",
  };

  return (
    <div ref={ref} className="relative inline-flex">
      {/* 3D Info Icon */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        className="group relative focus:outline-none"
        aria-label="Más información"
      >
        <svg
          width={iconSize}
          height={iconSize}
          viewBox="0 0 24 24"
          fill="none"
          className="transition-transform duration-200 group-hover:scale-110"
        >
          {/* Shadow/depth layer */}
          <circle cx="12" cy="13" r="10" fill="rgba(34,211,238,0.08)" />
          {/* Main circle with gradient effect */}
          <circle cx="12" cy="12" r="10" fill="url(#info-grad)" stroke="rgba(34,211,238,0.3)" strokeWidth="1" />
          {/* Highlight arc for 3D effect */}
          <path
            d="M7 7.5 C8.5 4.5, 15.5 4.5, 17 7.5"
            fill="none"
            stroke="rgba(255,255,255,0.12)"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          {/* "i" letter */}
          <circle cx="12" cy="8.5" r="1.2" fill="#22d3ee" />
          <rect x="11" y="11" width="2" height="5.5" rx="1" fill="#22d3ee" />
          {/* Gradient def */}
          <defs>
            <radialGradient id="info-grad" cx="0.35" cy="0.35" r="0.65">
              <stop offset="0%" stopColor="rgba(34,211,238,0.12)" />
              <stop offset="100%" stopColor="rgba(34,211,238,0.04)" />
            </radialGradient>
          </defs>
        </svg>
      </button>

      {/* Tooltip */}
      {open && (
        <div
          className={`absolute z-50 ${positionClasses[position]}`}
          style={{ width: "max-content", maxWidth: "280px" }}
        >
          <div className="bg-[#1a1b1f] border border-sk-border-3 rounded-lg shadow-xl px-4 py-3">
            {title && (
              <p className="text-sk-xs font-bold text-sk-accent mb-1">{title}</p>
            )}
            <p className="text-sk-xs text-sk-text-2 leading-relaxed">{content}</p>
          </div>
          {/* Arrow */}
          <div
            className={`absolute w-0 h-0 border-[5px] ${arrowClasses[position]}`}
          />
        </div>
      )}
    </div>
  );
}
