// src/components/search/global-search.tsx
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Search, X } from "lucide-react";
import { cn } from "../../lib/cn";
import { useGlobalSearch } from "../../hooks/use-search";
import { Spinner } from "../ui/spinner";
import type { SearchResult } from "../../types";

const TYPE_LABELS: Record<SearchResult["type"], string> = {
  player: "Jugadores",
  club: "Clubes",
  league: "Ligas",
  tournament: "Torneos",
};

const TYPE_ROUTES: Record<SearchResult["type"], string> = {
  player: "/ranking",
  club: "/clubs",
  league: "/leagues",
  tournament: "/calendar",
};

interface GlobalSearchProps {
  variant?: "full" | "compact";
}

export function GlobalSearch({ variant = "full" }: GlobalSearchProps) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const { data: results, isLoading } = useGlobalSearch(query);
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Group results by type
  const grouped = (results ?? []).reduce(
    (acc, r) => {
      if (!acc[r.type]) acc[r.type] = [];
      acc[r.type]!.push(r);
      return acc;
    },
    {} as Partial<Record<SearchResult["type"], SearchResult[]>>
  );

  const hasResults = (results ?? []).length > 0;
  const showDropdown = isOpen && query.length >= 2;

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ⌘K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      }
      if (e.key === "Escape") {
        setIsOpen(false);
        inputRef.current?.blur();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const handleSelect = (result: SearchResult) => {
    const route = result.type === "player"
      ? `/ranking/${result.id}`
      : result.type === "club"
        ? `/clubs/${result.id}`
        : result.type === "league"
          ? `/leagues/${result.id}`
          : "/calendar";

    navigate(route);
    setQuery("");
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className={cn("relative", variant === "full" ? "max-w-[560px] w-full" : "w-64")}>
      {/* Input */}
      <div className="relative">
        <Search
          size={16}
          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sk-text-2 pointer-events-none"
        />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder="Buscar jugador, club, liga o torneo..."
          className={cn(
            "w-full bg-sk-bg-4 border border-sk-border-3 rounded-lg",
            "py-[11px] pl-[42px] pr-20 text-sk-sm text-sk-text-1",
            "placeholder:text-sk-text-2",
            "transition-all duration-200 ease-out",
            "focus:outline-none focus:border-sk-accent",
            "focus:shadow-[0_0_0_3px_var(--sk-accent-dim)]",
            "focus:bg-sk-bg-3"
          )}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
          {query && (
            <button
              onClick={() => {
                setQuery("");
                inputRef.current?.focus();
              }}
              className="text-sk-text-3 hover:text-sk-text-1 transition-colors"
            >
              <X size={14} />
            </button>
          )}
          <span className="font-mono text-[11px] text-sk-text-3 bg-sk-bg-4 border border-sk-border-2 px-1.5 py-0.5 rounded-xs leading-tight">
            ⌘K
          </span>
        </div>
      </div>

      {/* Dropdown */}
      {showDropdown && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-sk-bg-2 border border-sk-border-2 rounded-lg shadow-sk-xl overflow-hidden z-[50]">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Spinner size="sm" />
            </div>
          ) : !hasResults ? (
            <div className="py-8 text-center text-sk-sm text-sk-text-2">
              Sin resultados para "{query}"
            </div>
          ) : (
            <div className="max-h-[400px] overflow-y-auto">
              {(["player", "club", "league", "tournament"] as const).map((type) => {
                const items = grouped[type];
                if (!items || items.length === 0) return null;

                return (
                  <div key={type}>
                    <div className="px-4 py-2 bg-sk-bg-3 font-mono text-[11px] font-semibold tracking-wide uppercase text-sk-text-2">
                      {TYPE_LABELS[type]}
                    </div>
                    {items.map((item) => (
                      <button
                        key={`${item.type}-${item.id}`}
                        onClick={() => handleSelect(item)}
                        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.03] transition-colors border-b border-sk-border-2 last:border-b-0"
                      >
                        <span className="text-base">{item.icon}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sk-sm font-semibold text-sk-text-1 truncate">
                            {item.title}
                          </p>
                        </div>
                        {item.subtitle && (
                          <span className="text-[11px] text-sk-text-2 shrink-0">
                            {item.type === "player"
                              ? item.subtitle?.toUpperCase()
                              : item.subtitle}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
