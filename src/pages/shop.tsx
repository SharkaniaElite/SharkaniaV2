import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom"; // 👈 Añadido useLocation
import { PageShell } from "../components/layout/page-shell";
import { SEOHead } from "../components/seo/seo-head";
import { ProductCard } from "../components/shop/product-card";
import { useShopProducts } from "../hooks/use-shop";
import { useAuthStore } from "../stores/auth-store";
import { SkeletonCard } from "../components/ui/skeleton";
import { Pickaxe, Lock } from "lucide-react"; 
import { SharkCoin } from "../components/ui/shark-coin"; 
import type { ProductCategory } from "../types";

const TABS: { label: string; value: ProductCategory | "all" }[] = [
  { label: "Arsenal Completo", value: "all" },
  { label: "🧮 Herramientas Tácticas", value: "tool" },
  { label: "🎨 Estatus & Cosméticos", value: "cosmetic" },
  { label: "📋 Reportes de Inteligencia", value: "report" },
];

export function ShopPage() {
  const [activeTab, setActiveTab] = useState<ProductCategory | "all">("all");
  const { data: products, isLoading } = useShopProducts(
    activeTab === "all" ? undefined : activeTab
  );
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const profile = useAuthStore((s) => s.profile);
  const location = useLocation(); // 👈 Hook para leer el #hash de la URL

  // 🪄 EFECTO DE MAGIA: Scroll y Destello (Highlight)
  useEffect(() => {
    if (products && products.length > 0 && location.hash === "#stats-espia") {
      // Pequeño timeout para asegurar que React ya pintó las tarjetas
      setTimeout(() => {
        const el = document.getElementById("stats-espia");
        if (el) {
          // 1. Scroll suave hacia la tarjeta
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          
          // 2. Le inyectamos clases de destello (neón cyan)
          el.classList.add(
            "ring-4", "ring-sk-accent", "ring-offset-4", "ring-offset-sk-bg-0", 
            "shadow-[0_0_40px_rgba(34,211,238,0.5)]", "scale-[1.02]", "z-10"
          );
          
          // 3. Apagamos el destello suavemente después de 2.5 segundos
          setTimeout(() => {
            el.classList.remove(
              "ring-4", "ring-sk-accent", "ring-offset-4", "ring-offset-sk-bg-0", 
              "shadow-[0_0_40px_rgba(34,211,238,0.5)]", "scale-[1.02]", "z-10"
            );
          }, 2500);
        }
      }, 300);
    }
  }, [products, location.hash]);

  return (
    <PageShell>
      <SEOHead
        title="La Bóveda — Sharkania"
        description="El mercado negro del póker. Intercambia tus Shark Coins por ventajas tácticas, reportes y herramientas exclusivas."
      />

      <div className="pt-24 pb-16 px-4 sm:px-6">
        <div className="max-w-[1100px] mx-auto">
          
          {/* Header de Bóveda */}
          <div className="text-center mb-12">
            <h1 className="text-sk-4xl font-extrabold text-sk-text-1 mb-4 flex items-center justify-center gap-3 tracking-tight">
              <Lock className="text-sk-accent" size={36} />
              LA BÓVEDA
            </h1>
            <p className="text-sk-text-2 max-w-2xl mx-auto text-sk-base leading-relaxed">
              El dinero real no sirve aquí. El ecosistema Sharkania funciona bajo estricta meritocracia. 
              <strong> Estudia, compite y farmea Shark Coins</strong> para desbloquear ventajas analíticas sobre tus rivales.
            </p>

            {/* Panel de Economía Interna */}
            <div className="flex flex-col items-center justify-center mt-8">
              {isAuthenticated && profile ? (
                <div className="flex flex-col sm:flex-row items-center gap-4 bg-sk-bg-2 border border-sk-border-2 p-4 rounded-2xl shadow-sk-lg">
                  <div className="flex items-center gap-3 bg-sk-bg-3 border border-sk-border-1 rounded-xl px-5 py-3 shadow-inner">
                    <SharkCoin size={28} />
                    <span className="font-mono text-2xl font-extrabold text-sk-text-1">
                      {profile.shark_coins_balance.toLocaleString()}
                    </span>
                    <span className="text-[10px] uppercase tracking-widest text-sk-text-3 font-bold ml-1 mt-1">
                      En Reserva
                    </span>
                  </div>
                  
                  <Link
                    to="/blog"
                    className="flex items-center gap-2 px-6 py-3.5 bg-sk-bg-1 border border-sk-accent/30 rounded-xl text-sk-sm font-bold text-sk-accent hover:bg-sk-accent hover:text-sk-bg-0 transition-all shadow-[0_0_15px_rgba(0,255,204,0.1)] hover:shadow-[0_0_20px_rgba(0,255,204,0.3)]"
                  >
                    <Pickaxe size={16} />
                    Minar más Monedas
                  </Link>
                </div>
              ) : (
                <Link
                  to="/register"
                  className="flex items-center gap-3 px-8 py-4 bg-sk-accent text-sk-bg-0 rounded-xl font-extrabold text-sk-md hover:scale-105 transition-transform"
                >
                  Registrarte y reclamar 100
                  <SharkCoin size={24} />
                  Gratis
                </Link>
              )}
            </div>
          </div>

          {/* Filtros Tácticos */}
          <div className="flex items-center gap-2 bg-sk-bg-2 border border-sk-border-1 rounded-xl p-1.5 mb-8 overflow-x-auto shadow-sm">
            {TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setActiveTab(tab.value)}
                className={`px-5 py-2.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                  activeTab === tab.value
                    ? "bg-sk-bg-4 text-sk-text-1 shadow-sm"
                    : "text-sk-text-3 hover:text-sk-text-1 hover:bg-sk-bg-3"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Grid de Productos */}
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          ) : products && products.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {products.map((product) => {
                // 👇 Detectamos cuál es la tarjeta "Stats Espía" sin importar su ID en BD
                const isStatsEspia = (product as any).name?.toLowerCase().includes("espía") || (product as any).title?.toLowerCase().includes("espía");
                
                return (
                  <div 
                    key={product.id} 
                    id={isStatsEspia ? "stats-espia" : `product-${product.id}`}
                    className="transition-all duration-700 ease-in-out scroll-mt-24 rounded-2xl relative"
                  >
                    <ProductCard product={product} />
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-20 bg-sk-bg-2 border border-sk-border-2 rounded-2xl">
              <Lock className="mx-auto text-sk-text-4 mb-3" size={32} />
              <p className="text-sk-text-3 font-semibold text-sm">El inventario de esta sección está agotado.</p>
            </div>
          )}

          {/* Manifiesto de la Economía */}
          <div className="mt-20 grid grid-cols-1 sm:grid-cols-3 gap-8 border-t border-sk-border-2 pt-16">
            <div className="text-center px-4">
              <div className="text-3xl mb-4 grayscale opacity-80">📖</div>
              <h4 className="text-sk-sm font-extrabold text-sk-text-1 mb-2 tracking-wide">Proof of Work</h4>
              <p className="text-xs text-sk-text-3 leading-relaxed">
                Lee artículos técnicos hasta el final para que el sistema valide tu análisis y asigne Shark Coins a tu cuenta.
              </p>
            </div>
            <div className="text-center px-4">
              <div className="text-3xl mb-4 grayscale opacity-80">🔥</div>
              <h4 className="text-sk-sm font-extrabold text-sk-text-1 mb-2 tracking-wide">Acceso Inmediato</h4>
              <p className="text-xs text-sk-text-3 leading-relaxed">
                Ejecuta la transacción con tu saldo e integra la herramienta táctica a tu panel de jugador en milisegundos.
              </p>
            </div>
            <div className="text-center px-4">
              <div className="text-3xl mb-4 grayscale opacity-80">💎</div>
              <h4 className="text-sk-sm font-extrabold text-sk-text-1 mb-2 tracking-wide">Cero Pay-to-Win</h4>
              <p className="text-xs text-sk-text-3 leading-relaxed">
                Las ventajas se obtienen invirtiendo tiempo en la plataforma, no con tarjetas de crédito. Tu conocimiento financia tu progreso.
              </p>
            </div>
          </div>
        </div>
      </div>
    </PageShell>
  );
}