import type { BannerConfig } from "./api/site-settings";

// Las piezas comerciales se verifican editorialmente; nunca se interpreta
// el fin de la revisión como la fecha oficial de caducidad del operador.
export function editorialToday(): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Santiago", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const value = (type: string) => parts.find(p => p.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

export function bannerIsReviewed(config: BannerConfig | null | undefined, today = editorialToday()): boolean {
  if (!config?.src || !config?.href || !config?.verified_on || !config?.review_by || !config?.source_url) return false;
  if (config.verified_on > today || config.review_by < today) return false;
  try {
    const url = new URL(config.href, "https://sharkania.com");
    const src = new URL(config.src, "https://sharkania.com");
    const source = new URL(config.source_url);
    return ["http:", "https:"].includes(url.protocol)
      && ["https:"].includes(src.protocol)
      && source.protocol === "https:";
  } catch {
    return false;
  }
}

export function bannerIsExternal(href: string): boolean {
  try { return new URL(href, "https://sharkania.com").origin !== "https://sharkania.com"; }
  catch { return false; }
}
