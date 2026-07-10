import { type ReactNode, useState } from "react";
import { Navbar } from "./navbar";
import { Footer } from "./footer";
import { AdminAccessBanner } from "./admin-access-banner";
import { X } from "lucide-react";
import { useBanners } from "../../hooks/use-banners";
import { cn } from "../../lib/cn";
import { GlobalChampionsTicker } from "./global-champions-ticker";

interface PageShellProps {
  children: ReactNode;
}

export function PageShell({ children }: PageShellProps) {
  const banners = useBanners();
  
  // 1. TOP GLOBAL (Destacado Principal)
  const topGlobal = banners?.slots?.top_global;
  const hasTopDesktop = !!(topGlobal?.desktop?.src || topGlobal?.desktop?.href);
  const hasTopMobile = !!(topGlobal?.mobile?.src || topGlobal?.mobile?.href);
  const hasTopBanner = hasTopDesktop || hasTopMobile;

  // 2. SUPER IZQUIERDO
  const superLeft = banners?.slots?.super_left;
  const hasLeftDesktop = !!(superLeft?.desktop?.src || superLeft?.desktop?.href);
  const hasLeftMobile = !!(superLeft?.mobile?.src || superLeft?.mobile?.href);
  const hasLeftBanner = hasLeftDesktop || hasLeftMobile;

  // 3. SUPER DERECHO
  const superRight = banners?.slots?.super_right;
  const hasRightDesktop = !!(superRight?.desktop?.src || superRight?.desktop?.href);
  const hasRightMobile = !!(superRight?.mobile?.src || superRight?.mobile?.href);
  const hasRightBanner = hasRightDesktop || hasRightMobile;

  const [showWhatsapp, setShowWhatsapp] = useState(() => {
    if (typeof window !== "undefined") return !sessionStorage.getItem("hide_whatsapp");
    return true;
  });

  const handleDismissWhatsapp = () => {
    sessionStorage.setItem("hide_whatsapp", "true");
    setShowWhatsapp(false);
  };

  return (
    <div className="min-h-screen bg-sk-bg-1 flex flex-col relative">
      <Navbar />
      <div style={{ height: "56px", flexShrink: 0 }} />

      <div className="relative left-0 right-0 w-full z-[90] flex flex-col bg-sk-bg-0">
        <GlobalChampionsTicker />

        {/* 🔥 TOP GLOBAL BANNER */}
        {hasTopBanner && (
          <div className="w-full bg-sk-bg-0 border-b border-sk-border-2 shadow-md flex justify-center py-3 relative z-[45]">
            <div className="w-full max-w-[1520px] px-2 flex justify-center items-center">
              {hasTopDesktop && (
                <a href={topGlobal.desktop?.href || "#"} target="_blank" rel="noopener noreferrer" className={cn("w-full flex justify-center bg-black rounded-xl overflow-hidden border border-white/5 shadow-sm hover:opacity-90 transition-opacity", hasTopMobile ? "hidden md:flex" : "flex")}>
                  <img src={topGlobal.desktop?.src} alt="Destacado Principal" className="w-full h-auto max-h-[150px] object-contain" />
                </a>
              )}
              {hasTopMobile && (
                <a href={topGlobal.mobile?.href || "#"} target="_blank" rel="noopener noreferrer" className={cn("w-full flex justify-center bg-black rounded-xl overflow-hidden border border-white/5 shadow-sm hover:opacity-90 transition-opacity", hasTopDesktop ? "md:hidden" : "flex")}>
                  <img src={topGlobal.mobile?.src} alt="Destacado Principal Mobile" className="w-full h-auto max-h-[200px] object-contain" />
                </a>
              )}
            </div>
          </div>
        )}

        {/* 🌟 BANNERS SECUNDARIOS (Izquierdo y Derecho) */}
        {(hasLeftBanner || hasRightBanner) && (
          <div className="w-full bg-sk-bg-1 border-b border-sk-border-2 overflow-hidden shadow-sm flex justify-center py-3 relative z-40">
            <div className="w-full max-w-[1520px] px-2 flex flex-col xl:flex-row items-center justify-center gap-4">
              
              {hasLeftBanner && (
                <div className="w-full xl:w-[728px] h-auto flex justify-center shrink-0">
                  {hasLeftDesktop && (
                    <a href={superLeft.desktop?.href || "#"} target="_blank" rel="noopener noreferrer" className={cn("w-full max-w-[728px] h-auto flex justify-center bg-black rounded-md overflow-hidden shadow-sm hover:opacity-90 transition-opacity", hasLeftMobile ? "hidden md:flex" : "flex")}>
                      <img src={superLeft.desktop?.src} alt="Banner Izquierdo" className="w-full h-auto max-h-[90px] object-contain xl:object-cover" />
                    </a>
                  )}
                  {hasLeftMobile && (
                    <a href={superLeft.mobile?.href || "#"} target="_blank" rel="noopener noreferrer" className={cn("w-full max-w-[728px] h-auto flex justify-center bg-black rounded-md overflow-hidden shadow-sm hover:opacity-90 transition-opacity", hasLeftDesktop ? "md:hidden" : "flex")}>
                      <img src={superLeft.mobile?.src} alt="Banner Izquierdo Mobile" className="w-full h-auto object-contain" />
                    </a>
                  )}
                </div>
              )}

              {hasRightBanner && (
                <div className="w-full xl:w-[728px] h-auto flex justify-center shrink-0">
                  {hasRightDesktop && (
                    <a href={superRight.desktop?.href || "#"} target="_blank" rel="noopener noreferrer" className={cn("w-full max-w-[728px] h-auto flex justify-center bg-black rounded-md overflow-hidden shadow-sm border border-white/5 hover:opacity-90 transition-opacity", hasRightMobile ? "hidden md:flex" : "flex")}>
                      <img src={superRight.desktop?.src} alt="Banner Derecho" className="w-full h-auto max-h-[90px] object-contain xl:object-cover" />
                    </a>
                  )}
                  {hasRightMobile && (
                    <a href={superRight.mobile?.href || "#"} target="_blank" rel="noopener noreferrer" className={cn("w-full max-w-[728px] h-auto flex justify-center bg-black rounded-md overflow-hidden shadow-sm border border-white/5 hover:opacity-90 transition-opacity", hasRightDesktop ? "md:hidden" : "flex")}>
                      <img src={superRight.mobile?.src} alt="Banner Derecho Mobile" className="w-full h-auto object-contain" />
                    </a>
                  )}
                </div>
              )}

            </div>
          </div>
        )}
      </div>

      <main className="flex-1">{children}</main>
      <Footer />
      <AdminAccessBanner />

      {/* WHATSAPP */}
      {showWhatsapp && (
        <div className="fixed bottom-6 right-6 z-[9999] flex flex-col items-end gap-2 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <button onClick={handleDismissWhatsapp} className="w-5 h-5 rounded-full bg-sk-bg-3 border border-sk-border-2 flex items-center justify-center text-sk-text-3 hover:text-white hover:bg-sk-bg-4 transition-colors shadow-sm"><X size={12} strokeWidth={3} /></button>
          <a href="https://wa.me/56977910256?text=Hola!%20Necesito%20ayuda%20con%20Sharkania" target="_blank" rel="noopener noreferrer" className="w-[52px] h-[52px] bg-[#25D366] hover:bg-[#20b858] text-white rounded-full shadow-[0_4px_14px_rgba(37,211,102,0.3)] flex items-center justify-center group">
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="currentColor" className="group-hover:scale-110 transition-transform"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/></svg>
          </a>
        </div>
      )}
    </div>
  );
}