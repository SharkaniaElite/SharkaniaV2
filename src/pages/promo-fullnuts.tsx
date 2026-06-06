// src/pages/promo-fullnuts.tsx
import { PageShell } from "../components/layout/page-shell";
import { SEOHead } from "../components/seo/seo-head";
import { RevealSection } from "../components/landing/reveal-section";
import { Button } from "../components/ui/button";
import { Instagram, ShoppingBag, Shirt, Flame, ChevronRight, Truck } from "lucide-react";

export function PromoFullnutsPage() {
  const instagramUrl = "https://www.instagram.com/fullnuts.cl";
  
  // Array dinámico para las 9 imágenes de la galería (fn1.webp hasta fn9.webp)
  const galleryImages = Array.from({ length: 9 }, (_, i) => `/bg/fn${i + 1}.webp`);

  return (
    <PageShell>
      <SEOHead 
        title="FullNuts | Viste como juegas | Sharkania" 
        description="Ropa exclusiva para jugadores de póker. Estilo, actitud y estrategia en cada prenda. Envíos a todo Chile. Conoce la colección FullNuts." 
        path="/fullnuts"
      />

      {/* ══ BACKGROUND EFFECTS ══ */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-sk-accent/5 blur-[150px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-orange-500/5 blur-[120px] rounded-full" />
      </div>

      <div className="relative z-10 pt-24 pb-20">
        
        {/* ══ HERO SECTION ══ */}
        <section className="max-w-[1000px] mx-auto px-6 text-center mb-20">
          <RevealSection>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-500 text-[10px] font-black uppercase tracking-widest mb-6">
              <Flame size={14} /> Sponsor Oficial
            </div>

            <h1 className="text-5xl md:text-7xl lg:text-8xl font-black text-white tracking-tighter mb-4 leading-none uppercase">
              FULL<span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-red-600">NUTS</span>
            </h1>
            <h2 className="text-2xl md:text-3xl font-extrabold text-sk-text-2 tracking-tight mb-8 italic">
              Viste como juegas.
            </h2>
            
            <p className="text-lg md:text-xl text-sk-text-3 max-w-2xl mx-auto mb-10 leading-relaxed">
              La marca de ropa exclusiva para los verdaderos tiburones de la mesa. Estilo urbano, actitud agresiva y calidad premium para tus sesiones más largas.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <a href={instagramUrl} target="_blank" rel="noopener noreferrer" className="w-full sm:w-auto">
                <Button className="w-full bg-gradient-to-r from-orange-500 to-red-600 text-white hover:from-orange-400 hover:to-red-500 font-black text-lg h-14 px-8 shadow-[0_0_30px_rgba(249,115,22,0.3)] group border-none">
                  <Instagram className="mr-2" size={20} />
                  Ver Catálogo en Instagram
                  <ChevronRight className="ml-2 group-hover:translate-x-1 transition-transform" size={20} />
                </Button>
              </a>
            </div>
            
            <div className="flex items-center justify-center gap-6 mt-8 opacity-60">
              <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-white"><Truck size={16} /> Envíos a todo Chile</span>
              <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-white"><Shirt size={16} /> Calidad Premium</span>
            </div>
          </RevealSection>
        </section>

        {/* ══ GALERÍA DE PRODUCTOS (4:5 Ratio) ══ */}
        <section className="max-w-[1200px] mx-auto px-6 mb-24">
          <RevealSection>
            <div className="flex items-center justify-between mb-8 border-b border-sk-border-2 pb-4">
              <h3 className="text-2xl font-black text-white flex items-center gap-2">
                <ShoppingBag className="text-orange-500" /> Colección Destacada
              </h3>
              <a href={instagramUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-orange-500 hover:text-orange-400 uppercase tracking-widest transition-colors">
                Ver todo →
              </a>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
              {galleryImages.map((src, index) => (
                <a 
                  key={index}
                  href={instagramUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="group block relative overflow-hidden rounded-xl bg-sk-bg-2 border border-sk-border-2 hover:border-orange-500/50 shadow-lg hover:shadow-[0_0_25px_rgba(249,115,22,0.15)] transition-all duration-500"
                >
                  {/* Contenedor con proporción estricta 4:5 */}
                  <div className="aspect-[4/5] w-full relative">
                    <img 
                      src={src} 
                      alt={`Prenda FullNuts ${index + 1}`} 
                      className="absolute inset-0 w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-700"
                      loading="lazy"
                    />
                    {/* Overlay degradado al hacer hover */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-6">
                      <span className="text-white font-black text-lg uppercase tracking-tight flex items-center gap-2 translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
                        <Instagram size={18} className="text-orange-500" /> Lo quiero
                      </span>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          </RevealSection>
        </section>

      </div>
    </PageShell>
  );
}