// src/main.tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./index.css";

// 1. Importamos la telemetría de PostHog
import posthog from 'posthog-js';
import { PostHogProvider } from 'posthog-js/react';

// 2. Inicializamos el Radar SOLO en producción (Aislando localhost)
if (typeof window !== 'undefined' && 
    window.location.hostname !== 'localhost' && 
    window.location.hostname !== '127.0.0.1') {
  
  posthog.init('phc_rkMUXTSGtnQRAqREY2kMwJTZZ3yBCsp7PgiLuKBKNjpi', {
    api_host: 'https://us.i.posthog.com',
    autocapture: true,         // Captura clics en botones automáticamente
    capture_pageview: true,    // Captura los cambios de URL dinámicos
    capture_pageleave: true,   // Mide el tiempo exacto que pasan en cada página
  });
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
    {/* 3. Envolvemos la App en el campo de fuerza de PostHog */}
    <PostHogProvider client={posthog}>
      <App />
    </PostHogProvider>
  </StrictMode>
);