// src/components/layout/page-shell.tsx
import { type ReactNode, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Navbar } from "./navbar";
import { Footer } from "./footer";
import { AdminAccessBanner } from "./admin-access-banner";
import { X } from "lucide-react";
import { useBanners } from "../../hooks/use-banners";
import { cn } from "../../lib/cn";
import { GlobalChampionsTicker } from "./global-champions-ticker";
import { getUpcomingTournaments } from "../../lib/api/tournaments";
import type { TournamentWithDetails } from "../../types";
import { TournamentCard } from "../calendar/tournament-card";
import { TournamentDetailModal } from "../calendar/tournament-detail-modal";

interface PageShellProps {
  children: ReactNode;
}

export function PageShell({ children }: PageShellProps) {
  // 🔥 Nuevo estado para el Calendario Superior
  const [tournaments, setTournaments] = useState<TournamentWithDetails[]>([]);
  const [loadingTourneys, setLoadingTourneys] = useState(true);
  const [selectedTournament, setSelectedTournament] = useState<TournamentWithDetails | null>(null);
  
  // 🎯 Obtenemos el banner de Latin Allin (CMS)
  const banners = useBanners();
  
  // CoinPoker Main Sponsor
  const cpBanner = banners?.slots?.coinpoker;
  const hasCpDesktop = !!(cpBanner?.desktop?.src || cpBanner?.desktop?.href);
  const hasCpMobile = !!(cpBanner?.mobile?.src || cpBanner?.mobile?.href);
  const hasCpBanner = hasCpDesktop || hasCpMobile;

  // Secundarios
  const superBanner = banners?.slots?.super;
  const hasSuperDesktop = !!(superBanner?.desktop?.src || superBanner?.desktop?.href);
  const hasSuperMobile = !!(superBanner?.mobile?.src || superBanner?.mobile?.href);
  const hasSuperBanner = hasSuperDesktop || hasSuperMobile;

  // 🔥 NUEVO: Segundo banner secundario (Derecho)
  const super2Banner = banners?.slots?.super2;
  const hasSuper2Desktop = !!(super2Banner?.desktop?.src || super2Banner?.desktop?.href);
  const hasSuper2Mobile = !!(super2Banner?.mobile?.src || super2Banner?.mobile?.href);
  const hasSuper2Banner = hasSuper2Desktop || hasSuper2Mobile;

  const [showWhatsapp, setShowWhatsapp] = useState(() => {
    if (typeof window !== "undefined") {
      return !sessionStorage.getItem("hide_whatsapp");
    }
    return true;
  });

  useEffect(() => {
    getUpcomingTournaments()
      .then(d => {
        const now = new Date();
        const filtered = d.filter(t => {
          if (t.status === "live" || t.status === "late_registration") return true;
          if (t.status === "completed" || t.status === "cancelled") return false;
          if (t.status === "scheduled") return new Date(t.start_datetime) > now;
          return true;
        });
        setTournaments(filtered.slice(0, 3)); // Muestra solo los 3 más cercanos
      }).finally(() => setLoadingTourneys(false));
  }, []);

  const handleDismissWhatsapp = () => {
    sessionStorage.setItem("hide_whatsapp", "true");
    setShowWhatsapp(false);
  };

  return (
    <div className="min-h-screen bg-sk-bg-1 flex flex-col relative">
      <Navbar />

      {/* Spacer para compensar el navbar (56px) */}
      <div style={{ height: "56px", flexShrink: 0 }} />

      {/* 🚀 ZONA BAJO EL NAVBAR (Ticker + Super Banners) */}
      <div className="relative left-0 right-0 w-full z-[90] flex flex-col">
        
        {/* 🏆 1ro: TICKER DE CAMPEONES */}
        <GlobalChampionsTicker />

        {/* 🔥 2do: FILA SUPERIOR DUAL SIMÉTRICA (CALENDARIO + COINPOKER) */}
        <div className="w-full bg-sk-bg-0/95 backdrop-blur-md border-b border-sk-border-2 shadow-md flex justify-center py-3 relative z-[45]">
          <div className="w-full max-w-[1520px] px-2 flex flex-col xl:flex-row items-stretch justify-center gap-4">
            
            {/* 🗓️ Bloque Izquierdo: Calendario de Torneos Sharkania */}
            <div className="w-full xl:w-[480px] shrink-0 bg-sk-bg-1 border border-sk-border-2 rounded-xl p-4 flex flex-col shadow-sm max-h-[300px]">
              <div className="flex items-center justify-between border-b border-sk-border-2 pb-2 shrink-0">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🗓️</span>
                  <h4 className="font-extrabold text-sm text-white uppercase tracking-wider">Calendario de Torneos</h4>
                </div>
                <span className="text-[10px] font-mono bg-red-500/10 text-red-400 px-2 py-0.5 rounded border border-red-500/20 uppercase tracking-widest animate-pulse">En Vivo</span>
              </div>
              
              {/* 🔥 Aquí inyectamos exactamente el mismo componente del sitio de Calendario */}
              <div className="flex-1 flex flex-col gap-3 py-3 overflow-y-auto custom-scrollbar">
                {loadingTourneys ? (
                  <p className="text-xs text-sk-text-3 italic text-center py-4">Cargando próximos eventos...</p>
                ) : tournaments.length === 0 ? (
                  <p className="text-xs text-sk-text-3 text-center py-4">No hay torneos próximos</p>
                ) : (
                  tournaments.map(t => (
                    <div key={t.id} onClick={() => setSelectedTournament(t)} className="cursor-pointer transition-transform hover:-translate-y-0.5">
                      <TournamentCard tournament={t} />
                    </div>
                  ))
                )}
              </div>

              <Link to="/calendar" className="w-full shrink-0 text-center py-1.5 bg-sk-bg-2 border border-sk-border-2 hover:border-sk-accent/50 text-sk-text-2 hover:text-white text-xs font-bold rounded-lg transition-all uppercase tracking-wider mt-2">
                Ver Agenda Completa →
              </Link>
            </div>

            {/* 🎰 Bloque Derecho: Banner CoinPoker (Ratio estricto y redimensionamiento perfecto) */}
            <div className="w-full flex-1 max-w-[1000px] flex justify-center items-center">
              {hasCpBanner && (
                <div className="w-full h-full flex items-center justify-center">
                  {hasCpDesktop && (
                    <a
                      href={cpBanner.desktop?.href || "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn(
                        "w-full aspect-[10/3] flex justify-center bg-black rounded-xl overflow-hidden border border-white/5 shadow-sm hover:opacity-90 transition-opacity",
                        hasCpMobile ? "hidden md:flex" : "flex"
                      )}
                    >
                      <img src={cpBanner.desktop?.src} alt="CoinPoker Principal" className="w-full h-full object-cover" />
                    </a>
                  )}
                  {hasCpMobile && (
                    <a
                      href={cpBanner.mobile?.href || "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn(
                        "w-full aspect-[10/3] flex justify-center bg-black rounded-xl overflow-hidden border border-white/5 shadow-sm hover:opacity-90 transition-opacity",
                        hasCpDesktop ? "md:hidden" : "flex"
                      )}
                    >
                      <img src={cpBanner.mobile?.src} alt="CoinPoker Mobile" className="w-full h-full object-cover" />
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 🌟 3ro: ZONA DUAL DE BANNERS SECUNDARIOS (Latin Allin + Ignition) */}
        <div className="w-full bg-sk-bg-0 border-b border-sk-border-2 overflow-hidden shadow-md flex justify-center py-3 relative z-40">
          <div className="w-full max-w-[1520px] px-2 flex flex-col xl:flex-row items-center justify-center gap-4">
            
            {/* 💻 Banner 1: Latin Allin (Viene de tu CMS) */}
            {hasSuperBanner && (
              <div className="w-full xl:w-[728px] h-auto xl:h-[90px] flex justify-center shrink-0">
                {hasSuperDesktop && (
                  <a
                    href={superBanner.desktop?.href || "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      "w-full max-w-[728px] h-auto xl:h-[90px] flex justify-center bg-sk-bg-1 rounded-md overflow-hidden shadow-sm hover:opacity-90 transition-opacity",
                      hasSuperMobile ? "hidden md:flex" : "flex"
                    )}
                  >
                    <img
                      src={superBanner.desktop?.src}
                      alt="Promoción Principal"
                      className="w-full h-full object-contain xl:object-cover"
                    />
                  </a>
                )}
                {hasSuperMobile && (
                  <a
                    href={superBanner.mobile?.href || "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      "w-full max-w-[728px] h-auto flex justify-center bg-sk-bg-1 rounded-md overflow-hidden shadow-sm hover:opacity-90 transition-opacity",
                      hasSuperDesktop ? "md:hidden" : "flex"
                    )}
                  >
                    <img
                      src={superBanner.mobile?.src}
                      alt="Promoción Principal"
                      className="w-full h-full object-contain"
                    />
                  </a>
                )}
              </div>
            )}

            {/* 🔥 Banner 2: Ignition Poker (Viene de tu CMS) */}
            {hasSuper2Banner && (
              <div className="w-full xl:w-[728px] h-auto xl:h-[90px] flex justify-center shrink-0">
                {hasSuper2Desktop && (
                  <a
                    href={super2Banner.desktop?.href || "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      "w-full max-w-[728px] h-auto xl:h-[90px] flex justify-center bg-black rounded-md overflow-hidden shadow-sm border border-white/5 hover:opacity-90 transition-opacity",
                      hasSuper2Mobile ? "hidden md:flex" : "flex"
                    )}
                  >
                    <img
                      src={super2Banner.desktop?.src}
                      alt="Promoción Secundaria"
                      className="w-full h-full object-contain xl:object-cover"
                    />
                  </a>
                )}
                {hasSuper2Mobile && (
                  <a
                    href={super2Banner.mobile?.href || "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      "w-full max-w-[728px] h-auto flex justify-center bg-black rounded-md overflow-hidden shadow-sm border border-white/5 hover:opacity-90 transition-opacity",
                      hasSuper2Desktop ? "md:hidden" : "flex"
                    )}
                  >
                    <img
                      src={super2Banner.mobile?.src}
                      alt="Promoción Secundaria Mobile"
                      className="w-full h-full object-contain"
                    />
                  </a>
                )}
              </div>
            )}

          </div>
        </div>

      </div>

      <main className="flex-1">{children}</main>
      <Footer />

      <AdminAccessBanner />

      {/* BOTÓN FLOTANTE WHATSAPP */}
      {showWhatsapp && (
        <div className="fixed bottom-6 right-6 z-[9999] flex flex-col items-end gap-2 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <button
            onClick={handleDismissWhatsapp}
            className="w-5 h-5 rounded-full bg-sk-bg-3 border border-sk-border-2 flex items-center justify-center text-sk-text-3 hover:text-white hover:bg-sk-bg-4 transition-colors shadow-sm"
            aria-label="Cerrar chat de ayuda"
            title="Cerrar"
          >
            <X size={12} strokeWidth={3} />
          </button>
          
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

      {/* 🔥 Modal Global de Torneos para que las tarjetas del top sean clickeables */}
      <TournamentDetailModal
        tournament={selectedTournament}
        isOpen={!!selectedTournament}
        onClose={() => setSelectedTournament(null)}
      />
    </div>
  );
}