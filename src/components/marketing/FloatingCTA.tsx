import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { WPT_PROMO } from "../../config/promotions";
import { supabase } from "../../lib/supabase";

type FloatingConfig = {
  active?: boolean;
  title?: string;
  description?: string;
  image?: string;
  link?: string;
  delay?: number;
  scrollTrigger?: number;
};

export function FloatingCTA() {
  const location = useLocation();

  const [visible, setVisible] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [config, setConfig] = useState<FloatingConfig | null>(null);

  // 🛡️ Inicialización perezosa para el contador social (mantiene la pureza del render)
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
        // Fallback silencioso a WPT_PROMO si falla la red
      }
    }
    loadConfig();
  }, []);

  // Valores efectivos: Prioridad a Supabase, luego a la configuración estática
  const title         = config?.title         ?? WPT_PROMO.title;
  const description   = config?.description   ?? WPT_PROMO.description;
  const image         = config?.image         ?? WPT_PROMO.image;
  const link          = config?.link          ?? WPT_PROMO.link;
  const delay         = config?.delay         ?? WPT_PROMO.delay;
  const scrollTrigger = config?.scrollTrigger ?? WPT_PROMO.scrollTrigger;
  const active        = config?.active        ?? true;

  // Lógica de aparición con Cooldown de 24 horas
  useEffect(() => {
    if (!active) return;

    // ── CONFIGURACIÓN DE TIEMPOS ──
    const COOLDOWN_DAYS = 1; // 🕒 Exactamente una vez cada 24 horas
    const CLICKED_COOLDOWN_DAYS = 30; // 🤫 Si hizo clic, ocultar por un mes
    
    const lastShown   = localStorage.getItem("wpt_cta_last_shown");
    const lastClicked = localStorage.getItem("wpt_cta_last_clicked");
    const now = Date.now();

    // Verificación de clic previo
    if (lastClicked) {
      const daysSince = (now - Number(lastClicked)) / (1000 * 60 * 60 * 24);
      if (daysSince < CLICKED_COOLDOWN_DAYS) return;
    }

    // Verificación de última visualización (Cooldown de 24h)
    if (lastShown) {
      const daysSince = (now - Number(lastShown)) / (1000 * 60 * 60 * 24);
      if (daysSince < COOLDOWN_DAYS) return;
    }

    const show = () => {
      setVisible(true);
      // Registramos el momento de la visualización para iniciar el contador de 24h
      localStorage.setItem("wpt_cta_last_shown", String(now));
    };

    // Comportamiento específico para la página de ranking (trigger por scroll)
    if (location.pathname === "/ranking") {
      const handleScroll = () => {
        const scrollTop = window.scrollY;
        const docHeight = document.documentElement.scrollHeight - window.innerHeight;
        const percent = scrollTop / docHeight;
        if (percent > scrollTrigger) {
          show();
          window.removeEventListener("scroll", handleScroll);
        }
      };
      window.addEventListener("scroll", handleScroll);
      return () => window.removeEventListener("scroll", handleScroll);
    }

    // Comportamiento estándar (trigger por tiempo)
    const timer = setTimeout(show, delay);
    return () => clearTimeout(timer);
  }, [location.pathname, active, delay, scrollTrigger]);

  if (!visible || !active) return null;

  return (
    <div
      className="fixed bottom-6 right-6 md:bottom-auto md:top-1/2 md:-translate-y-1/2 md:right-6 z-50 cta-slide"
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
    >
      <div
        className={`relative transition-all duration-300 shadow-2xl rounded-xl border border-white/10 bg-[var(--sk-bg-3)] overflow-hidden ${
          expanded ? "w-[300px]" : "w-[180px]"
        }`}
      >
        {/* Botón de cierre: reinicia el contador para que no vuelva a molestar en 24h */}
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