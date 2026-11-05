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
  if (!isArenaPreviewHost()) return false;

  // A single flag must never allow preview users to authenticate against
  // production. Require a separately named QA project and Turnstile widget.
  const notApproved = import.meta.env.VITE_ARENA_ALLOW_PREVIEW_AUTH !== "true";
  const configuredQaRef = (import.meta.env.VITE_ARENA_QA_SUPABASE_REF || "").trim();
  const url = import.meta.env.VITE_SUPABASE_URL || "";
  const domainMatch = /^https:\/\/([a-z0-9-]+)\.supabase\.co\/?$/i.exec(url);
  const actualRef = domainMatch?.[1] || "";
  const hasDedicatedQaBackend =
    configuredQaRef.length > 0 &&
    configuredQaRef === actualRef &&
    actualRef !== "nhpjzywfzljtlqaigzed";
  const hasQaTurnstile = Boolean(import.meta.env.VITE_TURNSTILE_SITE_KEY);

  return notApproved || !hasDedicatedQaBackend || !hasQaTurnstile;
}
