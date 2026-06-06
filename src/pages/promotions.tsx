import { useEffect, useState } from "react";
import { PageShell } from "../components/layout/page-shell";
import { SEOHead } from "../components/seo/seo-head";
import { Link } from "react-router-dom";
import { Gift, ArrowRight, Zap, Sparkles } from "lucide-react";
import { cn } from "../lib/cn";
import { supabase } from "../lib/supabase"; // Importación de DB agregada

export function PromotionsPage() {
  const [mascotId] = useState(() => Math.floor(Math.random() * 10) + 1);
  const [promotions, setPromotions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Definimos la función asíncrona
    const fetchPromos = async () => {
      const { data } = await supabase
        .from("blog_posts")
        .select("*")
        .eq("category", "Promociones")
        .eq("published", true)
        .order("published_at", { ascending: false });
      
      setPromotions(data || []);
      setLoading(false); // Lo manejamos aquí directamente
    };

    // La ejecutamos
    fetchPromos();
  }, []);

  return (
    <PageShell>
      <SEOHead
        title="Promociones y Freerolls Exclusivos | Sharkania"
        description="Descubre los mejores freerolls, bonos de bienvenida y torneos con entradas garantizadas en los clubes oficiales de Sharkania."
        path="/promociones"
      />
      
      <div className="pt-20 pb-20">
        <div className="max-w-6xl mx-auto px-6">
          
          {/* ══ HERO SECTION CON TIBURÓN ══ */}
          <div className="bg-sk-bg-2 border border-sk-accent/20 rounded-2xl p-6 md:p-10 mb-12 flex flex-col md:flex-row items-center gap-8 relative overflow-hidden group shadow-[0_0_40px_rgba(34,211,238,0.05)]">
            <div className="absolute -top-10 -left-10 w-40 h-40 bg-sk-accent/10 blur-[50px] rounded-full pointer-events-none" />
            <div className="absolute bottom-0 left-1/4 right-1/4 h-px bg-gradient-to-r from-transparent via-sk-accent/30 to-transparent" />

            <div className="shrink-0 relative z-10">
              <div className="relative flex items-center justify-center">
                <div className="absolute inset-0 bg-sk-accent/10 blur-xl rounded-full scale-150 group-hover:bg-sk-accent/20 transition-colors duration-500" />
                <img
                  src={`/mascot/shark-${mascotId}.webp`}
                  alt="Sharkania Mascot"
                  className="w-32 h-32 md:w-40 md:h-40 object-contain relative z-10 drop-shadow-[0_10px_15px_rgba(0,0,0,0.5)] transition-transform duration-500 group-hover:scale-105"
                />
              </div>
            </div>

            <div className="flex-1 text-center md:text-left relative z-10">
              <div className="flex items-center gap-2 justify-center md:justify-start mb-3">
                <Gift className="text-sk-accent" size={16} />
                <p className="font-mono text-[11px] font-bold tracking-[0.15em] uppercase text-sk-accent">
                  ALIANZAS Y RECOMPENSAS
                </p>
                <Sparkles className="text-sk-accent animate-pulse" size={16} />
              </div>

              <h1 className="text-sk-3xl md:text-sk-4xl font-black tracking-tighter text-sk-text-1 mb-4 leading-none">
                Zona de <span className="text-transparent bg-clip-text bg-gradient-to-r from-sk-accent to-blue-400 pr-2">Promociones</span>
              </h1>

              <p className="text-sk-sm md:text-sk-base text-sk-text-2 leading-relaxed">
                Aprovecha nuestras alianzas exclusivas. Desde torneos gratuitos diarios hasta beneficios por bienvenida. Tu bankroll empieza a crecer aquí.
              </p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {loading ? (
              <div className="col-span-full text-center text-sk-text-3 py-10">
                <div className="w-6 h-6 border-2 border-sk-accent/30 border-t-sk-accent rounded-full animate-spin mx-auto mb-3" />
                Cargando promociones...
              </div>
            ) : promotions.length === 0 ? (
              <div className="col-span-full text-center text-sk-text-3 py-10">
                No hay promociones activas en este momento.
              </div>
            ) : (
              promotions.map((promo) => (
                <Link 
                  key={promo.id} 
                  to={`/promociones/${promo.slug}`}
                  className="group flex flex-col bg-sk-bg-2 border border-sk-border-2 rounded-2xl overflow-hidden hover:border-sk-accent/50 transition-all duration-300 shadow-sk-md hover:shadow-[0_0_30px_rgba(34,211,238,0.1)]"
                >
                  <div className="h-48 overflow-hidden relative border-b border-sk-border-2">
                    {/* Etiqueta superior izquierda */}
                    <div className={cn(
                      "absolute top-3 left-3 z-10 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded",
                      promo.slug === "ignition-bonus" 
                        ? "bg-orange-500 text-white" 
                        : "bg-sk-accent text-sk-bg-0"
                    )}>
                      {promo.category}
                    </div>
                    
                    <div className="absolute inset-0 bg-gradient-to-t from-sk-bg-2 to-transparent z-0 opacity-80" />
                    <img 
                      src={promo.image_thumbnail} 
                      alt={promo.title} 
                      className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-700"
                    />
                  </div>
                  
                  <div className="p-6 flex flex-col flex-1">
                    <h3 className={cn(
                      "text-xl font-bold text-sk-text-1 mb-2 transition-colors line-clamp-2",
                      promo.slug === "ignition-bonus" 
                        ? "group-hover:text-orange-500" 
                        : "group-hover:text-sk-accent"
                    )}>
                      {promo.title}
                    </h3>
                    <p className="text-sk-sm text-sk-text-3 mb-6 flex-1 line-clamp-3">
                      {promo.excerpt}
                    </p>
                    
                    <div className="flex items-center justify-between border-t border-sk-border-2 pt-4 mt-auto">
                      <span className="text-[11px] font-mono text-sk-green flex items-center gap-1.5 uppercase font-bold">
                        <Zap size={14} /> Activa
                      </span>
                      <span className={cn(
                        "text-sk-sm font-bold flex items-center gap-1",
                        promo.slug === "ignition-bonus" ? "text-orange-500" : "text-sk-accent"
                      )}>
                        Ver detalles <ArrowRight size={16} className="transform group-hover:translate-x-1 transition-transform" />
                      </span>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>

        </div>
      </div>
    </PageShell>
  );
}