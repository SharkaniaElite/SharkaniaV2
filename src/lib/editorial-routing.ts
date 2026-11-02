// Única fuente para rutas editoriales visibles, canónicas y datos estructurados.
// Evita que una ficha /promociones o una noticia se declare erróneamente como /blog.
export type EditorialSection = "noticias" | "promociones" | "blog";

export function getEditorialSection(category: string | null | undefined): EditorialSection {
  if (category === "Noticias") return "noticias";
  if (category === "Promociones") return "promociones";
  return "blog";
}

export function getEditorialSectionLabel(category: string | null | undefined): string {
  const section = getEditorialSection(category);
  return section === "noticias" ? "Noticias" : section === "promociones" ? "Promociones" : "Blog";
}

export function getEditorialPath(category: string | null | undefined, slug: string): string {
  return `/${getEditorialSection(category)}/${encodeURIComponent(slug)}`;
}
