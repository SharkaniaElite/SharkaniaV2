// src/hooks/use-shop.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getShopProducts,
  getShopProductBySlug,
  purchaseProduct,
  checkFeatureAccess,
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
        // Refrescar el profile del auth store (tiene shark_coins_balance)
        refreshProfile();
      }
    },
  });
}

// ── Verificar acceso a feature ──

export function useFeatureAccess(featureKey: string) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useQuery({
    queryKey: ["feature-access", featureKey],
    queryFn: () => checkFeatureAccess(featureKey),
    enabled: isAuthenticated && !!featureKey,
    staleTime: 1000 * 60 * 2, // 2 min — chequear relativamente seguido
  });
}

// ── Historial de compras ──

export function useUserPurchases() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useQuery({
    queryKey: ["user-purchases"],
    queryFn: getUserPurchases,
    enabled: isAuthenticated,
  });
}

// ── Historial de transacciones ──

export function useCreditTransactions() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useQuery({
    queryKey: ["credit-transactions"],
    queryFn: getCreditTransactions,
    enabled: isAuthenticated,
  });
}

// ── Balance (fresh) ──

export function useSharkCoinsBalance() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useQuery({
    queryKey: ["shark-coins-balance"],
    queryFn: getSharkCoinsBalance,
    enabled: isAuthenticated,
    staleTime: 1000 * 30, // 30 seg — el balance puede cambiar seguido
  });
}