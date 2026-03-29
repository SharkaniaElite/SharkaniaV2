// src/components/seo/structured-data.tsx
import { useEffect } from "react";

const STRUCTURED_DATA = [
  // ── Organization ──
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": "https://sharkania.com/#organization",
    name: "Sharkania",
    url: "https://sharkania.com",
    logo: "https://sharkania.com/sharkania-icon-dark.svg",
    description:
      "Plataforma global de poker competitivo. Ranking ELO, calendarios, clubes, ligas y estadísticas.",
    foundingDate: "2026",
    sameAs: [],
  },
  // ── WebSite con SearchAction (Sitelinks Search Box) ──
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": "https://sharkania.com/#website",
    name: "Sharkania",
    url: "https://sharkania.com",
    publisher: { "@id": "https://sharkania.com/#organization" },
    inLanguage: "es",
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: "https://sharkania.com/ranking?q={search_term_string}",
      },
      "query-input": "required name=search_term_string",
    },
  },
  // ── WebApplication ──
  {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "@id": "https://sharkania.com/#app",
    name: "Sharkania",
    url: "https://sharkania.com",
    applicationCategory: "SportsApplication",
    operatingSystem: "Web",
    description:
      "Ranking ELO global de poker competitivo para clubes privados. Calendarios de torneos en vivo, perfiles de jugador, ligas y herramientas.",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
      description: "Plan gratuito disponible",
    },
    creator: { "@id": "https://sharkania.com/#organization" },
    inLanguage: ["es", "en"],
    keywords: [
      "poker ELO ranking",
      "ranking poker clubes privados",
      "poker tournament tracker",
      "ranking poker LATAM",
      "clubes poker online",
      "ligas poker",
      "ELO poker",
      "PPPoker ranking",
      "PokerBros ranking",
      "ClubGG ranking",
      "HomeGames PokerStars",
      "poker competitivo Latinoamérica",
      "ICM calculadora",
      "bankroll poker",
    ],
  },
];

export function StructuredData() {
  useEffect(() => {
    const id = "sharkania-jsonld";
    let el = document.getElementById(id);
    if (!el) {
      el = document.createElement("script");
      el.id = id;
      el.setAttribute("type", "application/ld+json");
      document.head.appendChild(el);
    }
    el.textContent = JSON.stringify(STRUCTURED_DATA);
  }, []);

  return null;
}

// ── Helpers para páginas específicas ──

interface ArticleSchemaProps {
  title: string;
  description: string;
  slug: string;
  publishedAt: string;
  category: string;
  imageUrl?: string;
}

export function useArticleSchema({
  title,
  description,
  slug,
  publishedAt,
  category,
  imageUrl,
}: ArticleSchemaProps) {
  useEffect(() => {
    const id = "sharkania-article-jsonld";
    let el = document.getElementById(id);
    if (!el) {
      el = document.createElement("script");
      el.id = id;
      el.setAttribute("type", "application/ld+json");
      document.head.appendChild(el);
    }

    const schema = {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: title,
      description,
      url: `https://sharkania.com/blog/${slug}`,
      datePublished: publishedAt,
      dateModified: publishedAt,
      author: { "@id": "https://sharkania.com/#organization" },
      publisher: { "@id": "https://sharkania.com/#organization" },
      mainEntityOfPage: `https://sharkania.com/blog/${slug}`,
      articleSection: category,
      inLanguage: "es",
      ...(imageUrl
        ? {
            image: {
              "@type": "ImageObject",
              url: imageUrl.startsWith("http")
                ? imageUrl
                : `https://sharkania.com${imageUrl}`,
              width: 1200,
              height: 630,
            },
          }
        : {}),
    };

    el.textContent = JSON.stringify(schema);

    return () => {
      el?.remove();
    };
  }, [title, description, slug, publishedAt, category, imageUrl]);
}

interface BreadcrumbItem {
  name: string;
  url: string;
}

export function useBreadcrumbSchema(items: BreadcrumbItem[]) {
  useEffect(() => {
    const id = "sharkania-breadcrumb-jsonld";
    let el = document.getElementById(id);
    if (!el) {
      el = document.createElement("script");
      el.id = id;
      el.setAttribute("type", "application/ld+json");
      document.head.appendChild(el);
    }

    const schema = {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: items.map((item, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: item.name,
        item: item.url,
      })),
    };

    el.textContent = JSON.stringify(schema);

    return () => {
      el?.remove();
    };
  }, [items]);
}
