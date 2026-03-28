// src/components/shop/feature-paywall.tsx
import { useState } from "react";
import { useFeatureAccess, useShopProducts } from "../../hooks/use-shop";
import { useAuthStore } from "../../stores/auth-store";
import { PurchaseModal } from "./purchase-modal";
import { Button } from "../ui/button";
import { SkeletonTitle, SkeletonText } from "../ui/skeleton";
import { Lock, Zap } from "lucide-react";
import { Link } from "react-router-dom";
import type { ShopProduct } from "../../types";

interface FeaturePaywallProps {
  featureKey: string;
  children: React.ReactNode;
  /** Contenido parcial que se muestra gratis (el "hook") */
  freePreview?: React.ReactNode;
  /** Título que se muestra en el paywall */
  title?: string;
  /** Descripción del paywall */
  description?: string;
}

export function FeaturePaywall({
  featureKey,
  children,
  freePreview,
  title = "Contenido Premium",
  description = "Desbloquea esta herramienta con SharkCoins para acceder al contenido completo.",
}: FeaturePaywallProps) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { data: access, isLoading: accessLoading } = useFeatureAccess(featureKey);
  const { data: products } = useShopProducts();
  const [selectedProduct, setSelectedProduct] = useState<ShopProduct | null>(null);

  // Encontrar los productos asociados a esta feature
  const featureProducts = (products ?? []).filter(
    (p) => p.feature_key === featureKey && p.is_active
  );

  // Loading
  if (isAuthenticated && accessLoading) {
    return (
      <div className="space-y-4 p-6">
        <SkeletonTitle />
        <SkeletonText />
        <SkeletonText className="w-3/4" />
      </div>
    );
  }

  // Si tiene acceso, mostrar el contenido
  if (access?.has_access) {
    return <>{children}</>;
  }

  // Si no está autenticado o no tiene acceso → paywall
  return (
    <div>
      {/* Free preview (el hook) */}
      {freePreview && (
        <div className="relative">
          {freePreview}
          {/* Gradient fade */}
          <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-sk-bg-1 to-transparent pointer-events-none" />
        </div>
      )}

      {/* Paywall card */}
      <div className="relative bg-sk-bg-2 border border-sk-border-2 rounded-xl p-8 text-center max-w-lg mx-auto my-8">
        <div className="w-14 h-14 rounded-full bg-sk-accent/10 flex items-center justify-center mx-auto mb-4">
          <Lock className="text-sk-accent" size={24} />
        </div>

        <h3 className="text-lg font-bold text-sk-text-1 mb-2">{title}</h3>
        <p className="text-sm text-sk-text-3 mb-6 max-w-sm mx-auto">{description}</p>

        {/* Opciones de compra */}
        {featureProducts.length > 0 && (
          <div className="flex flex-col sm:flex-row gap-3 justify-center mb-6">
            {featureProducts.map((product) => (
              <Button
                key={product.id}
                variant={product.access_type === "monthly" ? "accent" : "ghost"}
                size="sm"
                className="gap-2 border border-sk-border-2"
                onClick={() => {
                  if (!isAuthenticated) {
                    window.location.href = "/login";
                    return;
                  }
                  setSelectedProduct(product);
                }}
              >
                <Zap size={14} />
                <span>🪙 {product.price_coins}</span>
                <span className="text-sk-text-3">
                  {product.access_type === "per_use" && "· uso único"}
                  {product.access_type === "daily" && "· 24h"}
                  {product.access_type === "monthly" && "· 30 días"}
                  {product.access_type === "permanent" && "· permanente"}
                </span>
              </Button>
            ))}
          </div>
        )}

        {!isAuthenticated && (
          <p className="text-xs text-sk-text-4">
            <Link to="/register" className="text-sk-accent hover:underline">
              Crea tu cuenta gratis
            </Link>{" "}
            y recibe 100 SharkCoins de bienvenida.
          </p>
        )}

        {/* Modal */}
        {selectedProduct && (
          <PurchaseModal
            product={selectedProduct}
            isOpen={!!selectedProduct}
            onClose={() => setSelectedProduct(null)}
            onSuccess={() => setSelectedProduct(null)}
          />
        )}
      </div>
    </div>
  );
}