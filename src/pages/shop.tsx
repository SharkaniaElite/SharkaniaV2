import { useState } from "react";
import { PageShell } from "../components/layout/page-shell";
import { SEOHead } from "../components/seo/seo-head";
import { ProductCard } from "../components/shop/product-card";
import { useShopProducts } from "../hooks/use-shop";
import { useAuthStore } from "../stores/auth-store";
import { SkeletonCard } from "../components/ui/skeleton";
import { Link } from "react-router-dom";
import { ShieldAlert } from "lucide-react"; 
import { SharkCoin } from "../components/ui/shark-coin"; // 👈 Importamos el componente oficial
import type { ProductCategory } from "../types";

const TABS: { label: string; value: ProductCategory | "all" }[] = [
  { label: "Todo", value: "all" },
  { label: "🧮 Herramientas", value: "tool" },
  { label: "🎨 Cosméticos", value: "cosmetic" },
  { label: "🦈 Bundles", value: "bundle" },
  { label: "📋 Reportes", value: "report" },
];

export function ShopPage() {
  const [activeTab, setActiveTab] = useState<ProductCategory | "all">("all");
  const { data: products, isLoading } = useShopProducts(
    activeTab === "all" ? undefined : activeTab
  );
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const profile = useAuthStore((s) => s.profile);

  const handleDemoClick = (e: React.MouseEvent) => {
    e.preventDefault();
    alert("🚧 ¡Hola Tiburón! La pasarela de pagos oficial está en proceso de verificación. La recarga de SharkCoins estará disponible muy pronto.");
  };

  return (
    <PageShell>
      <SEOHead
        title="Tienda SharkCoins — Sharkania"
        description="Desbloquea herramientas premium, cosméticos y reportes con SharkCoins."
      />

      <div className="pt-24 pb-16 px-4 sm:px-6">
        <div className="max-w-[1100px] mx-auto">
          
          {/* Banner Beta */}
          <div className="mb-10 bg-sk-accent-dim border border-sk-accent/30 rounded-lg p-4 flex flex-col sm:flex-row items-center justify-center gap-3 text-center sm:text-left shadow-[0_0_15px_rgba(0,255,204,0.1)]">
            <ShieldAlert className="text-sk-accent shrink-0" size={24} />
            <div>
              <p className="text-sk-sm text-sk-text-1 font-bold">Fase Beta: Bóveda en Construcción</p>
              <p className="text-[12px] text-sk-text-2 mt-0.5">Podrás ver el catálogo, pero las compras y recargas están desactivadas hasta el lanzamiento oficial.</p>
            </div>
          </div>

          {/* Header */}
          <div className="text-center mb-10">
            <h1 className="text-sk-3xl font-extrabold text-sk-text-1 mb-3 flex items-center justify-center gap-3">
              {/* 👇 Usamos el componente oficial con tamaño grande */}
              <SharkCoin size={48} />
              Tienda SharkCoins
            </h1>
            <p className="text-sk-text-2 max-w-lg mx-auto text-sm">
              Usa tus SharkCoins para desbloquear herramientas de análisis, personalizar tu perfil
              y obtener reportes exclusivos.
            </p>

            {/* Balance */}
            <div className="flex items-center justify-center mt-6">
              {isAuthenticated && profile ? (
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-3 bg-sk-bg-3 border border-sk-border-2 rounded-xl px-4 py-2.5 shadow-inner">
                    <SharkCoin size={24} />
                    <span className="font-mono text-lg font-bold text-sk-text-1">
                      {profile.shark_coins_balance.toLocaleString()}
                    </span>
                    <span className="text-[10px] uppercase tracking-widest text-sk-text-3 font-bold">Disponibles</span>
                  </div>
                  <button
                    onClick={handleDemoClick}
                    className="text-xs text-sk-accent hover:text-sk-accent-hover font-bold transition-all uppercase tracking-tight"
                  >
                    Recargar →
                  </button>
                </div>
              ) : (
                <Link
                  to="/register"
                  className="text-sm text-sk-accent hover:underline font-semibold flex items-center gap-2"
                >
                  Regístrate y recibe 100 
                  <SharkCoin size={20} /> 
                  gratis →
                </Link>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1 bg-sk-bg-2 border border-sk-border-1 rounded-lg p-1 mb-8 overflow-x-auto">
            {TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setActiveTab(tab.value)}
                className={`px-4 py-2 rounded-md text-xs font-semibold whitespace-nowrap transition-colors ${
                  activeTab === tab.value
                    ? "bg-sk-bg-4 text-sk-text-1"
                    : "text-sk-text-3 hover:text-sk-text-2"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Grid de productos */}
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          ) : products && products.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <div className="text-center py-16 text-sk-text-3 text-sm">
              No hay productos disponibles en esta categoría.
            </div>
          )}

          {/* Info section */}
          <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-6 border-t border-sk-border-1 pt-12">
            <div className="text-center">
              <div className="text-2xl mb-2">🎯</div>
              <h4 className="text-sm font-bold text-sk-text-1 mb-1">Prueba Gratis</h4>
              <p className="text-xs text-sk-text-3">Cada herramienta tiene un tier gratuito. Prueba antes de comprar.</p>
            </div>
            <div className="text-center">
              <div className="text-2xl mb-2">⚡</div>
              <h4 className="text-sm font-bold text-sk-text-1 mb-1">Acceso Instantáneo</h4>
              <p className="text-xs text-sk-text-3">Compra y accede inmediatamente. Sin esperas.</p>
            </div>
            <div className="text-center">
              <div className="text-2xl mb-2">🏆</div>
              <h4 className="text-sm font-bold text-sk-text-1 mb-1">Gana Coins Gratis</h4>
              <p className="text-xs text-sk-text-3">Completa misiones y logros para ganar SharkCoins sin pagar.</p>
            </div>
          </div>
        </div>
      </div>
    </PageShell>
  );
}