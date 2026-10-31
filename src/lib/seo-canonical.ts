// Canonical URL for the current public route.
// Do not allow the default empty path to point every SPA page at the homepage.
// Query strings (including shared-hand tokens) and fragments are never canonical.
const SITE_URL = "https://sharkania.com";

export function getCanonicalUrl(
  explicitPath?: string,
  pathname = typeof window !== "undefined" ? window.location.pathname : "/",
): string {
  const supplied = explicitPath ?? pathname;
  const path = supplied.split(/[?#]/, 1)[0] || "/";
  // Enforce an on-site, root-relative path even if a caller supplies a URL.
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) {
    return SITE_URL + "/";
  }
  return SITE_URL + path;
}
