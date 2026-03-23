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
  const [players, setPlayers] = useState(0);
  const [config, setConfig] = useState<FloatingConfig | null>(null);

  // Cargar config desde Supabase (con fallback al config estático)
  useEffect(() => {
    supabase
      .from("site_settings")
      .select("value")
      .eq("key", "banners_config")
      .single()
      .then(({ data }) => {
        const floatingCta = data?.value?.floatingCta;
        if (floatingCta) setConfig(floatingCta);
      })
      .catch(() => {
        // fallback silencioso — usa WPT_PROMO
      });
  }, []);

  // Valores efectivos: Supabase > WPT_PROMO
  const title         = config?.title         ?? WPT_PROMO.title;
  const description   = config?.description   ?? WPT_PROMO.description;
  const image         = config?.image         ?? WPT_PROMO.image;
  const link          = config?.link          ?? WPT_PROMO.link;
  const delay         = config?.delay         ?? WPT_PROMO.delay;
  const scrollTrigger = config?.scrollTrigger ?? WPT_PROMO.scrollTrigger;
  const active        = config?.active        ?? true;

  // Contador social
  useEffect(() => {
    const base = 180;
    const random = Math.floor(Math.random() * 60);
    setPlayers(base + random);
  }, []);

  // Lógica de aparición con cooldown
  useEffect(() => {
    if (!active) return;

    // Verificar cooldown — no mostrar si fue visto hace menos de 5 días
    const COOLDOWN_DAYS = 5;
    const CLICKED_COOLDOWN_DAYS = 30;
    const lastShown   = localStorage.getItem("wpt_cta_last_shown");
    const lastClicked = localStorage.getItem("wpt_cta_last_clicked");
    const now = Date.now();

    if (lastClicked) {
      const daysSince = (now - Number(lastClicked)) / (1000 * 60 * 60 * 24);
      if (daysSince < CLICKED_COOLDOWN_DAYS) return;
    }

    if (lastShown) {
      const daysSince = (now - Number(lastShown)) / (1000 * 60 * 60 * 24);
      if (daysSince < COOLDOWN_DAYS) return;
    }

    const show = () => {
      setVisible(true);
      localStorage.setItem("wpt_cta_last_shown", String(now));
    };

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
            <img src={image} alt="WPT Global" className="w-full h-auto" />
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
