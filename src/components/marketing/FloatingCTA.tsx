// src/components/marketing/FloatingCTA.tsx
import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { WPT_PROMO } from "../../config/promotions";
import { supabase } from "../../lib/supabase";
import { useUserCountry } from "../../hooks/use-geo"; // 👈 El Radar
import type { FloatingConfig } from "../../lib/api/site-settings";

export function FloatingCTA() {
  const location = useLocation();
  const countryCode = useUserCountry();
  const isUS = countryCode === "US"; // 🇺🇸 Condición mágica

  const [visible, setVisible] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [config, setConfig] = useState<FloatingConfig | null>(null);

  // 🛡️ Inicialización perezosa para el contador social
  const [players] = useState(() => {
    const base = 180;
    const random = Math.floor(Math.random() * 60);
    return base + random;
  });

  // 🛡️ Carga de configuración desde Supabase
  useEffect(() => {
    async function loadConfig() {
      try {
        const { data } = await supabase
          .from("site_settings")
          .select("value")
          .eq("key", "banners")
          .maybeSingle();

        const floatingCta = data?.value?.floatingCta;
        if (floatingCta) setConfig(floatingCta);
      } catch (err) {
        // Fallback silencioso
      }
    }
    loadConfig();
  }, []);

  // 🛡️ Lógica de visibilidad y delays
  useEffect(() => {
    const isMobile = window.innerWidth < 768;
    if (isMobile) return;

    const lastClosed = localStorage.getItem("wpt_cta_last_shown");
    const lastClicked = localStorage.getItem("wpt_cta_last_clicked");
    const now = Date.now();
    const isDevelopment = import.meta.env.DEV;

    if (!isDevelopment) {
      if (lastClicked) return;
      if (lastClosed && now - Number(lastClosed) < 1000 * 60 * 60 * 24) return;
    }

    // ── MAGIA GEOGRÁFICA Y DE CONFIGURACIÓN ──
    const active = config?.active ?? true;
    if (!active) return; // Si lo apagaste desde el admin, no hace nada

    const delay = config?.delay ?? WPT_PROMO.delay;
    const scrollTrigger = config?.scrollTrigger ?? WPT_PROMO.scrollTrigger;

    // 👇 AQUÍ ESTÁ LA CORRECCIÓN DE TYPESCRIPT
    let timeoutId: ReturnType<typeof setTimeout>;

    if (location.pathname === "/ranking") {
      const handleScroll = () => {
        const scrollPercent = window.scrollY / (document.documentElement.scrollHeight - window.innerHeight);
        if (scrollPercent > scrollTrigger) {
          setVisible(true);
          window.removeEventListener("scroll", handleScroll);
        }
      };
      window.addEventListener("scroll", handleScroll);
      return () => window.removeEventListener("scroll", handleScroll);
    } else {
      timeoutId = setTimeout(() => {
        setVisible(true);
      }, delay);
    }

    return () => clearTimeout(timeoutId);
  }, [location.pathname, config]);

  if (!visible) return null;

  // ── RESOLUCIÓN FINAL DE VARIABLES ──
  const baseTitle       = config?.title       ?? WPT_PROMO.title;
  const baseDescription = config?.description ?? WPT_PROMO.description;
  const baseImage       = config?.image       ?? WPT_PROMO.image;
  const baseLink        = config?.link        ?? WPT_PROMO.link;

  // Si es USA y el admin llenó el campo, lo usamos. Si no, fallback al default de USA
  const title       = (isUS && config?.us_title) ? config.us_title : (isUS ? "Juega en Americas Cardroom" : baseTitle);
  const description = (isUS && config?.us_description) ? config.us_description : (isUS ? "Jugadores de USA aceptados" : baseDescription);
  const link        = (isUS && config?.us_link) ? config.us_link : (isUS ? "https://go.wpnaffiliates.com/visit/?bta=236696&brand=americascardroom" : baseLink);
  const image       = (isUS && config?.us_image) ? config.us_image : (isUS ? "https://www.acrpoker.eu/wp-content/uploads/2023/05/1200x800px-Promo-Image-WelcomeBonus-2023-2.jpg" : baseImage);

  return (
    <div className="fixed bottom-6 right-6 z-50 animate-fade-in">
      <div
        onMouseEnter={() => setExpanded(true)}
        onMouseLeave={() => setExpanded(false)}
        className={`relative bg-sk-bg-2 border border-sk-border-2 rounded-2xl shadow-[0_10px_40px_-10px_rgba(34,211,238,0.15)] transition-all duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] hover:border-sk-accent hover:shadow-[0_10px_40px_-10px_rgba(34,211,238,0.3)] hover:-translate-y-1 hover:bg-[linear-gradient(180deg,var(--sk-bg-2),var(--sk-bg-3)] overflow-hidden ${
          expanded ? "w-[300px]" : "w-[180px]"
        }`}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            localStorage.setItem("wpt_cta_last_shown", String(Date.now()));
            setVisible(false);
          }}
          className="absolute top-2 right-2 z-50 w-6 h-6 rounded-full bg-black/60 text-white text-xs flex items-center justify-center hover:bg-black"
        >
          ✕
        </button>

        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          className="block"
          onClick={() => localStorage.setItem("wpt_cta_last_clicked", String(Date.now()))}
        >
          {expanded ? (
            <img src={image} alt="Promo" className="w-full h-auto" />
          ) : (
            <div className="p-3">
              <div className="text-xs font-semibold text-white">
                🎁 {title}
              </div>
              {location.pathname === "/ranking" ? (
                <div className="text-[11px] text-white/60">
                  🔥 {players} jugadores ya juegan
                </div>
              ) : (
                <div className="text-[11px] text-white/60">
                  {description}
                </div>
              )}
            </div>
          )}
        </a>
      </div>
    </div>
  );
}