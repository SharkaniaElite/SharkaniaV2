/**
 * Safe HTML fragments for the editable SHARKANIA newsletter.
 * Plain URLs are linkified by the outbound Worker, never by trusting raw HTML.
 */
export function escapeNewsletterHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export function newsletterTextToHtml(value: string): string {
  return escapeNewsletterHtml(value).replace(/\r\n?|\n/g, "<br/>");
}

/** Only allow explicit HTTPS destination and image links in email templates. */
export function safeNewsletterUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "https:" || !parsed.hostname || parsed.username || parsed.password) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}
