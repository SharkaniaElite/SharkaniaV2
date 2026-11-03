/**
 * Preview isolation: do not allow test sessions to make authenticated writes to
 * the production Supabase project merely because Cloudflare Pages builds can render.
 * The QA route only uses synthetic data and local React state.
 */
export function isArenaPreviewHost(): boolean {
  if (typeof window === "undefined") return false;
  const hostname = window.location.hostname.toLowerCase();
  return hostname === "sharkaniav2.pages.dev" || hostname.endsWith(".sharkaniav2.pages.dev");
}

export function isArenaPreviewAuthBlocked(): boolean {
  return isArenaPreviewHost() && import.meta.env.VITE_ARENA_ALLOW_PREVIEW_AUTH !== "true";
}
