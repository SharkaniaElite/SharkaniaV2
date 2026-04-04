// src/pages/glossary-term.tsx
import { useParams, Link } from "react-router-dom";
import { PageShell } from "../components/layout/page-shell";
import { Spinner } from "../components/ui/spinner";
import { Button } from "../components/ui/button";
import { useGlossaryTerm, useGlossaryTerms } from "../hooks/use-glossary";
import { GLOSSARY_CATEGORIES } from "../lib/api/glossary";
import type { GlossaryCategory } from "../lib/api/glossary";
import { SEOHead } from "../components/seo/seo-head";
import { ArrowLeft, ChevronRight, BookOpen, ExternalLink } from "lucide-react";
import { useDefinedTermSchema, useBreadcrumbSchema } from "../components/seo/structured-data";
import { useMemo } from "react";

export function GlossaryTermPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data: term, isLoading } = useGlossaryTerm(slug);
  const { data: allTerms } = useGlossaryTerms();

  const relatedTermObjects = useMemo(() => {
    if (!term?.related_terms || !allTerms) return [];
    return allTerms.filter((t) => term.related_terms.includes(t.slug));
  }, [term, allTerms]);

  const categoryInfo = term
    ? GLOSSARY_CATEGORIES[term.category as GlossaryCategory]
    : null;

  useDefinedTermSchema({
    term: term?.term ?? "",
    description: term?.short_definition ?? "",
    slug: term?.slug ?? "",
  });

  useBreadcrumbSchema([
    { name: "Inicio", url: "https://sharkania.com" },
    { name: "Glosario", url: "https://sharkania.com/glosario" },
    { name: term?.term ?? "Término", url: `https://sharkania.com/glosario/${term?.slug ?? ""}` },
  ]);

  if (isLoading) {
    return (
      <PageShell>
        <div className="pt-20 min-h-screen flex items-center justify-center">
          <Spinner size="lg" />
        </div>
      </PageShell>
    );
  }

  if (!term) {
    return (
      <PageShell>
        <div className="pt-20 min-h-screen flex flex-col items-center justify-center gap-4">
          <span className="text-5xl">📖</span>
          <h1 className="text-sk-2xl font-bold text-sk-text-1">
            Término no encontrado
          </h1>
          <p className="text-sk-text-2">
            El término que buscas no existe en el glosario.
          </p>
          <Link to="/glosario">
            <Button variant="accent" size="md">
              <ArrowLeft size={16} />
              Volver al glosario
            </Button>
          </Link>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <SEOHead
        title={`${term.term} — Glosario de Poker`}
        description={term.short_definition}
        path={`/glosario/${term.slug}`}
      />
      <div className="pt-20 pb-16">
        <div className="max-w-[760px] mx-auto px-6">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-1.5 text-[11px] text-sk-text-4 mb-8">
            <Link to="/" className="hover:text-sk-text-2 transition-colors">
              Inicio
            </Link>
            <ChevronRight size={10} />
            <Link to="/glosario" className="hover:text-sk-text-2 transition-colors">
              Glosario
            </Link>
            <ChevronRight size={10} />
            <span className="text-sk-text-3">{term.term}</span>
          </nav>

          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-3">
              <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-sk-accent-dim text-sk-accent text-[11px] font-semibold uppercase tracking-wider">
                {categoryInfo?.icon} {categoryInfo?.label ?? term.category}
              </span>
            </div>
            <h1 className="text-sk-3xl font-extrabold tracking-tight text-sk-text-1 mb-4">
              {term.term}
            </h1>
            <p className="text-sk-lg text-sk-text-2 leading-relaxed border-l-2 border-sk-accent pl-5">
              {term.short_definition}
            </p>
          </div>

          <div className="h-px bg-sk-border-2 mb-8" />

          {/* Full definition */}
          <div className="mb-10">
            <h2 className="text-sk-md font-bold text-sk-text-1 mb-4 flex items-center gap-2">
              <BookOpen size={18} className="text-sk-accent" />
              Definición completa
            </h2>
            <div className="text-sk-base text-sk-text-2 leading-relaxed space-y-4">
              {term.full_definition.split("\n").map((paragraph, i) => (
                <p key={i}>{paragraph}</p>
              ))}
            </div>
          </div>

          {/* Related Links (herramientas, artículos) */}
          {term.related_links && term.related_links.length > 0 && (
            <div className="mb-10">
              <h2 className="text-sk-md font-bold text-sk-text-1 mb-4">
                🔗 Recursos relacionados
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {term.related_links.map((link, i) => (
                  <Link
                    key={i}
                    to={link.href}
                    className="group flex items-center gap-3 px-4 py-3 rounded-lg border border-sk-border-2 bg-sk-bg-2 hover:border-sk-accent/30 hover:bg-white/[0.02] transition-all"
                  >
                    <ExternalLink
                      size={14}
                      className="text-sk-accent shrink-0"
                    />
                    <span className="text-sk-sm font-semibold text-sk-text-1 group-hover:text-sk-accent transition-colors">
                      {link.label}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Related Terms */}
          {relatedTermObjects.length > 0 && (
            <div className="mb-10">
              <h2 className="text-sk-md font-bold text-sk-text-1 mb-4">
                📚 Términos relacionados
              </h2>
              <div className="flex flex-wrap gap-2">
                {relatedTermObjects.map((rt) => (
                  <Link
                    key={rt.slug}
                    to={`/glosario/${rt.slug}`}
                    className="px-3 py-1.5 rounded-full text-[12px] font-semibold bg-sk-bg-3 border border-sk-border-2 text-sk-text-2 hover:text-sk-accent hover:border-sk-accent/30 transition-all"
                  >
                    {rt.term}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Back to glossary */}
          <div className="pt-8 border-t border-sk-border-2">
            <Link
              to="/glosario"
              className="inline-flex items-center gap-2 text-sk-sm text-sk-text-2 hover:text-sk-accent transition-colors"
            >
              <ArrowLeft size={14} />
              Ver todos los términos del glosario
            </Link>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
