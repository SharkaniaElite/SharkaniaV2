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
  
  // 👇 INICIALIZACIÓN LAZY: Leemos el estado directamente al inicializar.
  // Esto elimina la advertencia de ESLint y evita un re-render innecesario.
  const [showWhatsapp, setShowWhatsapp] = useState(() => {
    if (typeof window !== "undefined") {
      return !sessionStorage.getItem("hide_whatsapp");
    }
    return true;
  });

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
    // Ya no leemos el sessionStorage del WhatsApp aquí.
  }, []);

  const handleDismiss = () => {
    if (champion) {
      sessionStorage.setItem(`hide_champ_${champion.id}`, "true");
      setDismissed(true);
    }
  };

  const handleDismissWhatsapp = () => {
    sessionStorage.setItem("hide_whatsapp", "true");
    setShowWhatsapp(false);
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

      {/* 👇 NUEVO WIDGET WHATSAPP MINIMALISTA CON BOTÓN DE CERRAR */}
      {showWhatsapp && (
        <div className="fixed bottom-6 right-6 z-[9999] flex flex-col items-end gap-2 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Botón de cerrar (X) */}
          <button
            onClick={handleDismissWhatsapp}
            className="w-5 h-5 rounded-full bg-sk-bg-3 border border-sk-border-2 flex items-center justify-center text-sk-text-3 hover:text-white hover:bg-sk-bg-4 transition-colors shadow-sm"
            aria-label="Cerrar chat de ayuda"
            title="Cerrar"
          >
            <X size={12} strokeWidth={3} />
          </button>
          
          {/* Botón de WhatsApp Circular */}
          <a
            href="https://wa.me/56977910256?text=Hola!%20Necesito%20ayuda%20con%20Sharkania"
            target="_blank"
            rel="noopener noreferrer"
            title="Soporte Sharkania"
            className="w-[52px] h-[52px] bg-[#25D366] hover:bg-[#20b858] text-white rounded-full shadow-[0_4px_14px_rgba(37,211,102,0.3)] hover:shadow-[0_6px_20px_rgba(37,211,102,0.45)] hover:-translate-y-1 transition-all duration-300 flex items-center justify-center group"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="group-hover:scale-110 transition-transform"
            >
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/>
            </svg>
          </a>
        </div>
      )}
    </div>
  );
}