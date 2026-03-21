// src/components/seo/google-analytics.tsx
import { useEffect } from "react";
import { useLocation } from "react-router-dom";

// ══════════════════════════════════════════════════════════
// INSTRUCCIONES:
// 1. Reemplaza GA_MEASUREMENT_ID con tu ID real de Google Analytics 4
//    (formato: G-XXXXXXXXXX)
// 2. El ID se obtiene de: analytics.google.com → Admin → Data Streams
// ══════════════════════════════════════════════════════════

const GA_MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID || "";

declare global {
  interface Window {
    gtag: (...args: unknown[]) => void;
    dataLayer: unknown[];
  }
}

function loadGAScript(id: string) {
  if (!id || document.querySelector(`script[src*="gtag/js?id=${id}"]`)) return;

  // Load gtag.js
  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${id}`;
  document.head.appendChild(script);

  // Initialize dataLayer
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    window.dataLayer.push(arguments);
  };
  window.gtag("js", new Date());
  window.gtag("config", id, {
    send_page_view: false, // We track manually on route change
  });
}

export function GoogleAnalytics() {
  const location = useLocation();

  // Load script on mount
  useEffect(() => {
    if (GA_MEASUREMENT_ID) {
      loadGAScript(GA_MEASUREMENT_ID);
    }
  }, []);

  // Track page views on route change
  useEffect(() => {
    if (!GA_MEASUREMENT_ID || !window.gtag) return;

    window.gtag("event", "page_view", {
      page_title: document.title,
      page_location: window.location.href,
      page_path: location.pathname + location.search,
    });
  }, [location.pathname, location.search]);

  return null;
}
