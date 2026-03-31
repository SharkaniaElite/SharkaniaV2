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
    <div className="min-h-screen bg-sk-bg-1 flex flex-col">
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
                  to={`/ranking/${champion.player_slug}`} // 👈 AHORA USA SLUG
                  className="text-sk-text-1 font-bold hover:text-sk-gold transition-colors"
                >
                  {champion.player_nickname}
                </Link>
                , campeón oficial de la{" "}
                {/* 🔗 NUEVO: Enlace SEO directo a la liga */}
                <Link 
                  to={`/leagues/${champion.league_slug}`} // 👈 AHORA USA SLUG
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
    </div>
  );
}