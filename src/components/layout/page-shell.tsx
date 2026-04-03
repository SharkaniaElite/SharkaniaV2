// src/components/layout/page-shell.tsx
import { type ReactNode, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Navbar } from "./navbar";
import { Footer } from "./footer";
import { AdminAccessBanner } from "./admin-access-banner";
import { getLatestChampion, type LeagueChampionNews } from "../../lib/api/champions";
import { Crown, X } from "lucide-react";

interface PageShellProps {
  children: ReactNode;
}

export function PageShell({ children }: PageShellProps) {
  const [champion, setChampion] = useState<LeagueChampionNews | null>(null);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    async function fetchChampion() {
      const data = await getLatestChampion();
      if (data) {
        const isDismissed = sessionStorage.getItem(`hide_champ_${data.id}`);
        if (!isDismissed) {
          setChampion(data);
          setDismissed(false);
        }
      }
    }
    fetchChampion();
  }, []);

  const handleDismiss = () => {
    if (champion) {
      sessionStorage.setItem(`hide_champ_${champion.id}`, "true");
      setDismissed(true);
    }
  };

  return (
    <div className="min-h-screen bg-sk-bg-1 flex flex-col relative">
      <Navbar />

      {/* Spacer para compensar navbar (56px) */}
      <div style={{ height: "56px", flexShrink: 0 }} />

      {/* 👑 CINTILLO GLOBAL DE CAMPEÓN */}
      {!dismissed && champion && (
        <div className="bg-gradient-to-r from-sk-gold/20 via-sk-gold/5 to-sk-bg-1 border-b border-sk-gold/20 relative animate-in slide-in-from-top-2 fade-in duration-500 z-40">
          <div className="max-w-[1200px] mx-auto px-4 py-2.5 sm:px-6 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-sk-gold/10 border border-sk-gold/30 flex items-center justify-center shrink-0">
                <Crown size={14} className="text-sk-gold" />
              </div>
              <p className="text-[11px] sm:text-sk-sm text-sk-text-2 leading-tight">
                <span className="text-sk-gold font-bold uppercase text-[9px] sm:text-[10px] tracking-widest block sm:inline sm:mr-2">
                  Última Hora
                </span>
                ¡Felicidades a{" "}
                <Link 
                  to={`/ranking/${champion.player_slug}`}
                  className="text-sk-text-1 font-bold hover:text-sk-gold transition-colors"
                >
                  {champion.player_nickname}
                </Link>
                , campeón oficial de la{" "}
                <Link 
                  to={`/leagues/${champion.league_slug}`}
                  className="font-semibold text-sk-text-1 hover:text-sk-gold transition-colors"
                >
                  {champion.league_name}
                </Link>
                ! 🏆
              </p>
            </div>
            <button 
              onClick={handleDismiss} 
              className="text-sk-text-4 hover:text-sk-text-1 transition-colors shrink-0 bg-sk-bg-2 hover:bg-sk-bg-3 p-1 rounded-md"
              aria-label="Cerrar anuncio"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      <main className="flex-1">{children}</main>
      <Footer />

      <AdminAccessBanner />

      {/* 👇 WIDGET CENTRO DE AYUDA (WHATSAPP) */}
      <a
        href="https://wa.me/56977910256"
        target="_blank"
        rel="noopener noreferrer"
        title="Chatear con Soporte en WhatsApp"
        className="fixed bottom-[150px] right-6 z-[9999] bg-sk-accent hover:bg-sk-accent/80 text-white px-5 py-3 rounded-full shadow-[0_4px_10px_rgba(0,0,0,0.25)] hover:shadow-[0_6px_15px_rgba(0,0,0,0.3)] hover:-translate-y-1 transition-all duration-300 flex items-center gap-2.5 font-semibold text-sm tracking-wide group"
      >
        <svg xmlns="http://www.w3.org/2000/svg" height="20" viewBox="0 96 960 960" width="20" fill="currentColor" className="group-hover:scale-110 transition-transform">
          <path d="M480 896q-125 0-212.5-87.5T180 596q0-125 87.5-212.5T480 296q125 0 212.5 87.5T780 596q0 125-87.5 212.5T480 896Zm0-60q100 0 170-70t70-170q0-100-70-170t-170-70q-100 0-170 70t-70 170q0 100 70 170t170 70Zm0-240Zm-240-80h480v-40H240v40Z"/>
        </svg>
        Centro de Ayuda
      </a>
    </div>
  );
}