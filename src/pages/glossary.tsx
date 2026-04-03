// src/pages/glossary.tsx
import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { PageShell } from "../components/layout/page-shell";
import { Input } from "../components/ui/input";
import { Spinner } from "../components/ui/spinner";
import { EmptyState } from "../components/ui/empty-state";
import { useGlossaryTerms } from "../hooks/use-glossary";
import { GLOSSARY_CATEGORIES } from "../lib/api/glossary";
import type { GlossaryCategory } from "../lib/api/glossary";
import { SEOHead } from "../components/seo/seo-head";
import { cn } from "../lib/cn";
import { ChevronRight, BookOpen } from "lucide-react";

export function GlossaryPage() {
  const { data: terms, isLoading } = useGlossaryTerms();
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<GlossaryCategory | "all">("all");

  const filtered = useMemo(() => {
    if (!terms) return [];
    return terms.filter((t) => {
      const matchesSearch =
        search.length < 2 ||
        t.term.toLowerCase().includes(search.toLowerCase()) ||
        t.short_definition.toLowerCase().includes(search.toLowerCase());
      const matchesCategory =
        activeCategory === "all" || t.category === activeCategory;
      return matchesSearch && matchesCategory;
    });
  }, [terms, search, activeCategory]);

  const grouped = useMemo(() => {
    const map = new Map<string, typeof filtered>();
    for (const term of filtered) {
      const list = map.get(term.category) ?? [];
      list.push(term);
      map.set(term.category, list);
    }
    return map;
  }, [filtered]);

  const categories = Object.entries(GLOSSARY_CATEGORIES) as [GlossaryCategory, { label: string; icon: string }][];

  return (
    <PageShell>
      <SEOHead
        title="Glosario de Poker"
        description="Diccionario completo de términos de poker: ELO, ICM, GTO, ROI, ITM, bankroll, tilt y más. Aprende el vocabulario del poker competitivo en clubes privados."
        path="/glosario"
      />
      <div className="pt-20 pb-16">
        <div className="max-w-[900px] mx-auto px-6">
          {/* Header */}
          <div className="mb-8">
            <p className="font-mono text-[11px] font-bold tracking-[0.08em] uppercase text-sk-accent mb-3">
              Glosario
            </p>
            <h1 className="text-sk-3xl font-extrabold tracking-tight text-sk-text-1 mb-2 flex items-center gap-3">
              <BookOpen className="text-sk-accent" size={32} />
              Glosario de Poker
            </h1>
            <p className="text-sk-base text-sk-text-2">
              {terms?.length ?? 0} términos esenciales del poker competitivo en clubes privados
            </p>
          </div>

          {/* Search */}
          <div className="mb-6 max-w-md">
            <Input
              variant="search"
              placeholder="Buscar término..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Category pills */}
          <div className="flex gap-2 flex-wrap mb-8">
            <button
              onClick={() => setActiveCategory("all")}
              className={cn(
                "px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all duration-150",
                activeCategory === "all"
                  ? "bg-sk-accent text-sk-bg-0"
                  : "bg-sk-bg-3 text-sk-text-2 border border-sk-border-2 hover:border-sk-border-3 hover:text-sk-text-1"
              )}
            >
              Todos ({terms?.length ?? 0})
            </button>
            {categories.map(([key, { label, icon }]) => {
              const count = terms?.filter((t) => t.category === key).length ?? 0;
              if (count === 0) return null;
              return (
                <button
                  key={key}
                  onClick={() => setActiveCategory(key)}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all duration-150",
                    activeCategory === key
                      ? "bg-sk-accent text-sk-bg-0"
                      : "bg-sk-bg-3 text-sk-text-2 border border-sk-border-2 hover:border-sk-border-3 hover:text-sk-text-1"
                  )}
                >
                  {icon} {label} ({count})
                </button>
              );
            })}
          </div>

          {/* Content */}
          {isLoading ? (
            <div className="flex justify-center py-20">
              <Spinner size="lg" />
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon="📖"
              title="No se encontraron términos"
              description="Intenta buscar con otra palabra."
            />
          ) : (
            <div className="space-y-10">
              {Array.from(grouped.entries()).map(([category, categoryTerms]) => {
                const catInfo = GLOSSARY_CATEGORIES[category as GlossaryCategory];
                return (
                  <div key={category}>
                    <h2 className="text-sk-md font-bold text-sk-text-1 mb-4 flex items-center gap-2">
                      <span>{catInfo?.icon}</span>
                      {catInfo?.label ?? category}
                    </h2>
                    <div className="grid grid-cols-1 gap-2">
                      {categoryTerms.map((term) => (
                        <Link
                          key={term.slug}
                          to={`/glosario/${term.slug}`}
                          className="group flex items-start gap-4 px-5 py-4 rounded-lg border border-sk-border-2 bg-sk-bg-2 hover:border-sk-accent/30 hover:bg-white/[0.02] transition-all duration-200"
                        >
                          <div className="flex-1 min-w-0">
                            <h3 className="text-sk-sm font-bold text-sk-text-1 group-hover:text-sk-accent transition-colors mb-1">
                              {term.term}
                            </h3>
                            <p className="text-[12px] text-sk-text-2 leading-relaxed line-clamp-2">
                              {term.short_definition}
                            </p>
                          </div>
                          <ChevronRight
                            size={16}
                            className="text-sk-text-4 group-hover:text-sk-accent transition-colors mt-1 shrink-0"
                          />
                        </Link>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Internal links */}
          <div className="mt-12 flex flex-col sm:flex-row gap-3">
            <Link
              to="/blog"
              className="flex-1 flex items-center gap-3 px-4 py-3 rounded-lg border border-sk-border-2 bg-sk-bg-2 hover:border-sk-accent/30 hover:bg-white/[0.02] transition-all group"
            >
              <span className="text-lg">📝</span>
              <div className="flex-1 min-w-0">
                <p className="text-sk-sm font-semibold text-sk-text-1 group-hover:text-sk-accent transition-colors">
                  Blog de Estrategia
                </p>
                <p className="text-[11px] text-sk-text-3">Artículos sobre GTO, ICM, mental game y más</p>
              </div>
            </Link>
            <Link
              to="/tools"
              className="flex-1 flex items-center gap-3 px-4 py-3 rounded-lg border border-sk-border-2 bg-sk-bg-2 hover:border-sk-accent/30 hover:bg-white/[0.02] transition-all group"
            >
              <span className="text-lg">🧮</span>
              <div className="flex-1 min-w-0">
                <p className="text-sk-sm font-semibold text-sk-text-1 group-hover:text-sk-accent transition-colors">
                  Herramientas de Poker
                </p>
                <p className="text-[11px] text-sk-text-3">Calculadora ICM, simulador ELO, bankroll</p>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
