// src/main.tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./index.css";

// Importamos la telemetría de PostHog
import posthog from 'posthog-js';
import { PostHogProvider } from 'posthog-js/react';

// Sharkania Preview must not contaminate real product funnels or recordings.
// Analytics are enabled only on the canonical production domain.
const productionHost = ["sharkania.com", "www.sharkania.com"].includes(window.location.hostname);
if (productionHost) {
  posthog.init('phc_rkMUXTSGtnQRAqREY2kMwJTZZ3yBCsp7PgiLuKBKNjpi', {
    api_host: 'https://us.i.posthog.com',
    autocapture: true,
    capture_pageview: true,
    capture_pageleave: true,
  });

  // Clarity is not needed to paint the page; load it after the window load
  // event so it does not compete with the hero and leaderboard resources.
  const startClarity = () => {
    void import("@microsoft/clarity")
      .then(({ default: Clarity }) => Clarity.init("w9gk77cgdx"))
      .catch((error: unknown) => {
        if (import.meta.env.DEV) console.warn("Clarity could not initialize", error);
      });
  };
  if (document.readyState === "complete") startClarity();
  else window.addEventListener("load", startClarity, { once: true });
}

// Detector de nuevas versiones de Vite
window.addEventListener('vite:preloadError', (event) => {
  console.warn('Detectada nueva versión de la app. Recargando...', event);
  window.location.reload();
});

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element not found");
}

createRoot(rootElement).render(
  <StrictMode>
    <PostHogProvider client={posthog}>
      <App />
    </PostHogProvider>
  </StrictMode>
);