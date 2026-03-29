// src/components/blog/table-of-contents.tsx
import { useMemo } from "react";
import { List } from "lucide-react";
import type { BlogBlock } from "../../lib/api/blog";

interface TableOfContentsProps {
  blocks: BlogBlock[];
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function TableOfContents({ blocks }: TableOfContentsProps) {
  const headings = useMemo(
    () =>
      blocks
        .filter((b) => b.type === "h2" && b.content)
        .map((b, i) => ({
          id: slugify(b.content ?? `seccion-${i}`),
          text: b.content ?? "",
          index: i,
        })),
    [blocks]
  );

  if (headings.length < 3) return null;

  const handleClick = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <nav
      aria-label="Tabla de contenidos"
      className="my-8 rounded-xl border border-sk-border-2 bg-sk-bg-2 p-5"
    >
      <div className="flex items-center gap-2 mb-3">
        <List size={14} className="text-sk-accent" />
        <span className="font-mono text-[11px] font-bold tracking-wider uppercase text-sk-accent">
          En este artículo
        </span>
      </div>
      <ol className="space-y-1.5">
        {headings.map((h) => (
          <li key={h.id}>
            <button
              onClick={() => handleClick(h.id)}
              className="text-left w-full text-sk-sm text-sk-text-2 hover:text-sk-accent transition-colors duration-150 leading-snug py-0.5"
            >
              {h.text}
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}

/**
 * Genera un ID a partir del contenido de un H2.
 * Usar en el BlockRenderer para que los links de la TOC funcionen.
 */
export { slugify };
