import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { WPT_PROMO } from "../../config/promotions";

export function FloatingCTA() {

  const location = useLocation();

  const [visible, setVisible] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [players, setPlayers] = useState(0);

  // contador social
  useEffect(() => {

    const base = 180;
    const random = Math.floor(Math.random() * 60);

    setPlayers(base + random);

  }, []);

  // lógica de aparición
  useEffect(() => {

    // ranking → trigger por scroll
    if (location.pathname === "/ranking") {

      const handleScroll = () => {

        const scrollTop = window.scrollY;
        const docHeight =
          document.documentElement.scrollHeight - window.innerHeight;

        const percent = scrollTop / docHeight;

        if (percent > WPT_PROMO.scrollTrigger) {
          setVisible(true);
          window.removeEventListener("scroll", handleScroll);
        }

      };

      window.addEventListener("scroll", handleScroll);

      return () => window.removeEventListener("scroll", handleScroll);

    }

    // resto del sitio → delay
    const timer = setTimeout(() => {
      setVisible(true);
    }, WPT_PROMO.delay);

    return () => clearTimeout(timer);

  }, [location.pathname]);

  if (!visible) return null;

  return (
    <div
  className="fixed bottom-6 right-6 z-50 cta-slide"
  onMouseEnter={() => setExpanded(true)}
  onMouseLeave={() => setExpanded(false)}
>

  <div
    className={`relative transition-all duration-300 shadow-2xl rounded-xl border border-white/10 bg-[var(--sk-bg-3)] overflow-hidden ${
      expanded ? "w-[300px]" : "w-[180px]"
    }`}
  >

    {/* BOTÓN CERRAR */}
    <button
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        setVisible(false);
      }}
      className="absolute top-2 right-2 z-50 w-6 h-6 rounded-full bg-black/60 text-white text-xs flex items-center justify-center hover:bg-black"
    >
      ✕
    </button>

    <a
      href={WPT_PROMO.link}
      target="_blank"
      rel="noopener noreferrer"
      className="block"
    >

      {expanded ? (

        <img
          src={WPT_PROMO.image}
          alt="WPT Global"
          className="w-full h-auto"
        />

      ) : (

        <div className="p-3">

          <div className="text-xs font-semibold text-white">
            🎁 Bonus WPT
          </div>

          {location.pathname === "/ranking" ? (

            <div className="text-[11px] text-white/60">
              🔥 {players} jugadores ya juegan
            </div>

          ) : (

            <div className="text-[11px] text-white/60">
              Juega cash y torneos
            </div>

          )}

        </div>

      )}

    </a>

  </div>

</div>
  );
}