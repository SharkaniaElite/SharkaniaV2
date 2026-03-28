import { useState } from "react";
import { Button } from "../ui/button";
import { PurchaseModal } from "./purchase-modal";
import { useFeatureAccess } from "../../hooks/use-shop";
import { useAuthStore } from "../../stores/auth-store";
import type { ShopProduct } from "../../types";
import { Check, Lock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { SharkCoin } from "../ui/shark-coin"; // 👈 Importamos la moneda oficial

interface ProductCardProps {
  product: ShopProduct;
}

const accessLabels: Record<string, string> = {
  per_use: "Por uso",
  daily: "24 horas",
  monthly: "30 días",
  permanent: "Permanente",
};

export function ProductCard({ product }: ProductCardProps) {
  const [showModal, setShowModal] = useState(false);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const navigate = useNavigate();
  const { data: access } = useFeatureAccess(product.feature_key);

  const hasAccess = access?.has_access ?? false;

  const handleClick = () => {
    if (!isAuthenticated) {
      navigate("/login");
      return;
    }
    
    // 🚧 FASE BETA: Bloqueamos la compra real y mostramos alerta
    alert("🚧 Fase Beta: Las compras de herramientas y pases están deshabilitadas temporalmente. ¡Pronto podrás usar tus SharkCoins!");
  };

  return (
    <>
      <div
        className={`flex flex-col bg-sk-bg-2 border rounded-xl p-5 transition-all hover:translate-y-[-2px] hover:border-sk-border-3 ${
          hasAccess ? "border-sk-green/30" : "border-sk-border-1"
        }`}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="w-10 h-10 rounded-lg bg-sk-bg-4 flex items-center justify-center text-xl">
            {product.icon}
          </div>
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-sk-text-4 bg-sk-bg-3 px-2 py-0.5 rounded">
            {accessLabels[product.access_type]}
          </span>
        </div>

        {/* Info */}
        <h3 className="text-sm font-bold text-sk-text-1 mb-1">{product.name}</h3>
        <p className="text-xs text-sk-text-3 leading-relaxed mb-4 flex-1">
          {product.description}
        </p>

        {/* Free tier info */}
        {product.free_tier_description && (
          <div className="text-[11px] text-sk-text-4 mb-3 flex items-center gap-1.5">
            <span className="text-sk-green">✓</span> Gratis: {product.free_tier_description}
          </div>
        )}

        {/* Precio y acción */}
        <div className="mt-auto pt-3 border-t border-sk-border-1">
          {hasAccess ? (
            <div className="flex items-center justify-center gap-2 py-2 text-sk-green">
              <Check size={16} />
              <span className="text-xs font-semibold">Acceso activo</span>
              {access?.expires_at && (
                <span className="text-[10px] text-sk-text-4">
                  hasta {new Date(access.expires_at).toLocaleDateString("es-CL")}
                </span>
              )}
            </div>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-center gap-2 border border-sk-border-2 hover:border-sk-accent transition-colors"
              onClick={handleClick}
            >
              <Lock size={12} className="text-sk-text-3" />
              {/* 👇 REEMPLAZO: Cambiamos el emoji 🪙 por el componente SharkCoin */}
              <SharkCoin size={14} /> 
              <span className="font-mono font-bold text-sk-text-1">{product.price_coins}</span>
            </Button>
          )}
        </div>
      </div>

      <PurchaseModal
        product={product}
        isOpen={showModal}
        onClose={() => setShowModal(false)}
      />
    </>
  );
}