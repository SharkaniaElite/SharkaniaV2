// src/components/seo/seo-head.tsx
import { useEffect } from "react";

interface SEOHeadProps {
  title: string;
  description?: string;
  path?: string;
  ogImage?: string;
  ogType?: "website" | "article";
  noIndex?: boolean;
}

const SITE_NAME = "Sharkania";
const SITE_URL = "https://sharkania.com";
const DEFAULT_DESCRIPTION =
  "La plataforma global de poker competitivo. Ranking ELO, calendarios en vivo, clubes, ligas y estadísticas de jugadores.";
const DEFAULT_OG_IMAGE = `${SITE_URL}/og-default.png?v=2`;

function setMetaTag(property: string, content: string, isName = false) {
  const attr = isName ? "name" : "property";
  let el = document.querySelector(`meta[${attr}="${property}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, property);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

export function SEOHead({
  title,
  description = DEFAULT_DESCRIPTION,
  path = "",
  ogImage = DEFAULT_OG_IMAGE,
  ogType = "website",
  noIndex = false,
}: SEOHeadProps) {
  const fullTitle = title === "Inicio"
    ? `${SITE_NAME} — Plataforma Global de Poker Competitivo`
    : `${title} | ${SITE_NAME}`;
  const fullUrl = `${SITE_URL}${path}`;

  useEffect(() => {
    // Title
    document.title = fullTitle;

    // Standard meta
    setMetaTag("description", description, true);

    // Open Graph
    setMetaTag("og:title", fullTitle);
    setMetaTag("og:description", description);
    setMetaTag("og:url", fullUrl);
    setMetaTag("og:image", ogImage);
    setMetaTag("og:image:width", "1200");
    setMetaTag("og:image:height", "630");
    setMetaTag("og:type", ogType);
    setMetaTag("og:site_name", SITE_NAME);
    setMetaTag("og:locale", "es_LA");

    // Twitter
    setMetaTag("twitter:card", "summary_large_image", true);
    setMetaTag("twitter:title", fullTitle, true);
    setMetaTag("twitter:description", description, true);
    setMetaTag("twitter:image", ogImage, true);

    // Robots
    if (noIndex) {
      setMetaTag("robots", "noindex, nofollow", true);
    } else {
      setMetaTag("robots", "index, follow", true);
    }

    // Canonical
    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.setAttribute("rel", "canonical");
      document.head.appendChild(canonical);
    }
    canonical.setAttribute("href", fullUrl);
  }, [fullTitle, description, fullUrl, ogImage, ogType, noIndex]);

  return null;
}
