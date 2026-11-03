// src/hooks/use-shop.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getShopProducts,
  getShopProductBySlug,
  purchaseProduct,
  checkFeatureAccess,
  checkProductAccess, // 👈 NUEVO
  getUserPurchases,
  getCreditTransactions,
  getSharkCoinsBalance,
} from "../lib/api/shop";
import { useAuthStore } from "../stores/auth-store";
import type { ProductCategory, SpendCreditsResult } from "../types";

// ── Productos ──

export function useShopProducts(category?: ProductCategory) {
  return useQuery({
    queryKey: ["shop-products", category],
    queryFn: () => getShopProducts(category),
    staleTime: 1000 * 60 * 10, // 10 min — el catálogo no cambia seguido
  });
}

export function useShopProduct(slug: string) {
  return useQuery({
    queryKey: ["shop-product", slug],
    queryFn: () => getShopProductBySlug(slug),
    enabled: !!slug,
  });
}

// ── Comprar producto ──

export function usePurchaseProduct() {
  const queryClient = useQueryClient();
  const refreshProfile = useAuthStore((s) => s.refreshProfile);

  return useMutation({
    mutationFn: (productSlug: string) => purchaseProduct(productSlug),
    onSuccess: (result: SpendCreditsResult) => {
      if (result.success) {
        // Invalidar todo lo relacionado con el balance y accesos
        queryClient.invalidateQueries({ queryKey: ["shark-coins-balance"] });
        queryClient.invalidateQueries({ queryKey: ["user-purchases"] });
        queryClient.invalidateQueries({ queryKey: ["credit-transactions"] });
        queryClient.invalidateQueries({ queryKey: ["feature-access"] });
        queryClient.invalidateQueries({ queryKey: ["product-access"] }); // 👈 FIX: Esto refresca las tarjetas al instante
        // Refrescar el profile del auth store (tiene shark_coins_balance)
        refreshProfile();
      }
    },
  });
}

// ── Verificar acceso a feature ──

export function useFeatureAccess(featureKey: string) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const viewerId = useAuthStore((s) => s.user?.id ?? null);

  return useQuery({
    queryKey: ["feature-access", featureKey, viewerId],
    queryFn: () => checkFeatureAccess(featureKey),
    enabled: isAuthenticated && !!viewerId && !!featureKey,
    staleTime: 1000 * 60 * 2, // 2 min — chequear relativamente seguido
  });
}

// ── Verificar acceso a Producto ──

export function useProductAccess(productId: string) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const viewerId = useAuthStore((s) => s.user?.id ?? null);

  return useQuery({
    queryKey: ["product-access", productId, viewerId],
    queryFn: () => checkProductAccess(productId),
    enabled: isAuthenticated && !!viewerId && !!productId,
    staleTime: 1000 * 60 * 2, // 2 min
  });
}

// ── Historial de compras ──

export function useUserPurchases() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const viewerId = useAuthStore((s) => s.user?.id ?? null);

  return useQuery({
    queryKey: ["user-purchases", viewerId],
    queryFn: getUserPurchases,
    enabled: isAuthenticated && !!viewerId,
  });
}

// ── Historial de transacciones ──

export function useCreditTransactions() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const viewerId = useAuthStore((s) => s.user?.id ?? null);

  return useQuery({
    queryKey: ["credit-transactions", viewerId],
    queryFn: getCreditTransactions,
    enabled: isAuthenticated && !!viewerId,
  });
}

// ── Balance (fresh) ──

export function useSharkCoinsBalance() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const viewerId = useAuthStore((s) => s.user?.id ?? null);

  return useQuery({
    queryKey: ["shark-coins-balance", viewerId],
    queryFn: getSharkCoinsBalance,
    enabled: isAuthenticated && !!viewerId,
    staleTime: 1000 * 30, // 30 seg — el balance puede cambiar seguido
  });
}