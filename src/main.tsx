// src/main.tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./index.css";

// Importamos la telemetría de PostHog
import posthog from 'posthog-js';
import { PostHogProvider } from 'posthog-js/react';

// 1. Importamos Microsoft Clarity
import Clarity from '@microsoft/clarity';

// 2. Inicializamos el Radar y las Cámaras SOLO en producción (Aislando localhost)
if (typeof window !== 'undefined' && 
    window.location.hostname !== 'localhost' && 
    window.location.hostname !== '127.0.0.1') {
  
  // Encendemos PostHog
  posthog.init('phc_rkMUXTSGtnQRAqREY2kMwJTZZ3yBCsp7PgiLuKBKNjpi', {
    api_host: 'https://us.i.posthog.com',
    autocapture: true,         
    capture_pageview: true,    
    capture_pageleave: true,   
  });

  // Encendemos Microsoft Clarity (Con tu ID de proyecto de Bing)
  Clarity.init("w9gk77cgdx");
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