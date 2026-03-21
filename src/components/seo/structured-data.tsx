// src/components/seo/structured-data.tsx
import { useEffect } from "react";

const STRUCTURED_DATA = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Sharkania",
  url: "https://sharkania.com",
  description:
    "La plataforma global de poker competitivo. Ranking ELO, calendarios en vivo, clubes, ligas y estadísticas de jugadores.",
  applicationCategory: "SportsApplication",
  operatingSystem: "Web",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
    description: "Gratis para siempre",
  },
  creator: {
    "@type": "Organization",
    name: "Sharkania",
    url: "https://sharkania.com",
  },
  inLanguage: ["es", "en"],
  keywords: [
    "poker ELO ranking",
    "poker online clubs",
    "poker tournament tracker",
    "ranking poker LATAM",
    "clubes poker online",
    "ligas poker",
    "ELO poker",
    "PPPoker ranking",
    "PokerBros ranking",
    "ClubGG ranking",
    "HomeGames PokerStars",
  ],
};

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
