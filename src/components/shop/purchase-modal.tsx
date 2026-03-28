// src/components/shop/purchase-modal.tsx
import { useState } from "react";
import { Modal } from "../ui/modal";
import { Button } from "../ui/button";
import { usePurchaseProduct } from "../../hooks/use-shop";
import { useAuthStore } from "../../stores/auth-store";
import type { ShopProduct, SpendCreditsResult } from "../../types";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { SharkCoin } from "../ui/shark-coin";

interface PurchaseModalProps {
  product: ShopProduct;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (result: SpendCreditsResult) => void;
}

export function PurchaseModal({ product, isOpen, onClose, onSuccess }: PurchaseModalProps) {
  const profile = useAuthStore((s) => s.profile);
  const { mutateAsync, isPending } = usePurchaseProduct();
  const [result, setResult] = useState<SpendCreditsResult | null>(null);

  const balance = profile?.shark_coins_balance ?? 0;
  const canAfford = balance >= product.price_coins;
  const remaining = balance - product.price_coins;

  const handlePurchase = async () => {
    try {
      const res = await mutateAsync(product.slug);
      setResult(res);
      if (res.success) {
        onSuccess?.(res);
      }
    } catch {
      setResult({ success: false, error: "network_error" });
    }
  };

  const handleClose = () => {
    setResult(null);
    onClose();
  };

  const errorMessages: Record<string, string> = {
    product_not_found: "Este producto no está disponible.",
    already_active: "Ya tienes acceso activo a esta feature.",
    insufficient_balance: "No tienes suficientes SharkCoins.",
    user_not_found: "Error de autenticación. Intenta recargar la página.",
    network_error: "Error de conexión. Intenta de nuevo.",
  };

  // ── Estado: éxito ──
  if (result?.success) {
    return (
      <Modal isOpen={isOpen} onClose={handleClose}>
        <div className="flex flex-col items-center text-center p-2">
          <div className="w-14 h-14 rounded-full bg-sk-green/10 flex items-center justify-center mb-4">
            <CheckCircle2 className="text-sk-green" size={28} />
          </div>
          <h3 className="text-lg font-bold text-sk-text-1 mb-2">¡Compra exitosa!</h3>
          <p className="text-sm text-sk-text-2 mb-1">
            Desbloqueaste <span className="text-sk-text-1 font-semibold">{product.name}</span>
          </p>
          <p className="text-xs text-sk-text-3 mb-6">
            {result.expires_at
              ? `Acceso hasta ${new Date(result.expires_at).toLocaleDateString("es-CL")}`
              : product.access_type === "permanent"
                ? "Acceso permanente"
                : "Uso consumido"}
          </p>
          <div className="flex items-center gap-2 bg-sk-bg-3 rounded-lg px-4 py-2 mb-6">
            <span className="text-sm">🪙</span>
            <span className="font-mono text-sm font-bold text-sk-accent">
              {result.new_balance?.toLocaleString()}
            </span>
            <span className="text-xs text-sk-text-3">restantes</span>
          </div>
          <Button variant="accent" onClick={handleClose} className="w-full">
            Entendido
          </Button>
        </div>
      </Modal>
    );
  }

  // ── Estado: error ──
  if (result && !result.success) {
    return (
      <Modal isOpen={isOpen} onClose={handleClose}>
        <div className="flex flex-col items-center text-center p-2">
          <div className="w-14 h-14 rounded-full bg-sk-red/10 flex items-center justify-center mb-4">
            <AlertCircle className="text-sk-red" size={28} />
          </div>
          <h3 className="text-lg font-bold text-sk-text-1 mb-2">No se pudo completar</h3>
          <p className="text-sm text-sk-text-2 mb-6">
            {errorMessages[result.error ?? ""] ?? "Error inesperado. Intenta de nuevo."}
          </p>
          {result.error === "insufficient_balance" && (
            <Link to="/wallet" className="text-xs text-sk-accent hover:underline mb-4">
              Recargar SharkCoins →
            </Link>
          )}
          <Button variant="ghost" onClick={handleClose} className="w-full">
            Cerrar
          </Button>
        </div>
      </Modal>
    );
  }

  // ── Estado: confirmación ──
  return (
    <Modal isOpen={isOpen} onClose={handleClose}>
      <div className="p-2">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl bg-sk-bg-4 flex items-center justify-center text-2xl">
            {product.icon}
          </div>
          <div>
            <h3 className="text-base font-bold text-sk-text-1">{product.name}</h3>
            <p className="text-xs text-sk-text-3">
              {product.access_type === "per_use" && "Uso único"}
              {product.access_type === "daily" && "Acceso por 24 horas"}
              {product.access_type === "monthly" && `Acceso por ${product.duration_days} días`}
              {product.access_type === "permanent" && "Acceso permanente"}
            </p>
          </div>
        </div>

        {product.premium_description && (
          <p className="text-sm text-sk-text-2 mb-6">{product.premium_description}</p>
        )}

        {/* Resumen de costo */}
        <div className="bg-sk-bg-3 rounded-lg p-4 mb-6 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-sk-text-3">Tu balance</span>
            <span className="font-mono font-bold text-sk-text-1">
              🪙 {balance.toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-sk-text-3">Costo</span>
            <span className="font-mono font-bold text-sk-red">
              − {product.price_coins.toLocaleString()}
            </span>
          </div>
          <div className="border-t border-sk-border-1 pt-2 flex justify-between text-sm">
            <span className="text-sk-text-3">Después</span>
            <span className={`font-mono font-bold ${canAfford ? "text-sk-green" : "text-sk-red"}`}>
              🪙 {canAfford ? remaining.toLocaleString() : "Insuficiente"}
            </span>
          </div>
        </div>

        {/* Botones */}
        <div className="flex gap-3">
          <Button variant="ghost" onClick={handleClose} className="flex-1" disabled={isPending}>
            Cancelar
          </Button>
          {canAfford ? (
            <Button
              variant="accent"
              onClick={handlePurchase}
              className="flex-1"
              disabled={isPending}
            >
              {isPending ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <>🪙 Comprar por {product.price_coins}</>
              )}
            </Button>
          ) : (
            <Button variant="accent" className="flex-1" onClick={() => { handleClose(); window.location.href = "/wallet"; }}>
              Recargar Coins
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}