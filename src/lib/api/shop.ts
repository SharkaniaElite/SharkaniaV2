// src/lib/api/shop.ts
import { supabase } from "../supabase";
import type {
  ShopProduct,
  UserPurchaseWithProduct,
  SpendCreditsResult,
  ProductCategory,
  FeatureAccess,
  CreditTransaction,
} from "../../types";

// ── Productos ──

export async function getShopProducts(category?: ProductCategory): Promise<ShopProduct[]> {
  let query = supabase
    .from("shop_products")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (category) {
    query = query.eq("category", category);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as ShopProduct[];
}

export async function getShopProductBySlug(slug: string): Promise<ShopProduct | null> {
  const { data, error } = await supabase
    .from("shop_products")
    .select("*")
    .eq("slug", slug)
    .eq("is_active", true)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null; // not found
    throw error;
  }
  return data as ShopProduct;
}

// ── Compras ──

export async function purchaseProduct(productSlug: string): Promise<SpendCreditsResult> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error("Not authenticated");

  const { data, error } = await supabase.rpc("spend_credits", {
    p_user_id: userData.user.id,
    p_product_slug: productSlug,
  });

  if (error) throw error;
  return data as SpendCreditsResult;
}

// ── Verificar acceso a una feature ──

export async function checkFeatureAccess(featureKey: string): Promise<FeatureAccess> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return { has_access: false, expires_at: null, purchase_id: null };
  }

  const { data, error } = await supabase
    .from("user_purchases")
    .select("id, expires_at")
    .eq("user_id", userData.user.id)
    .eq("feature_key", featureKey)
    .eq("is_active", true)
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
    .order("granted_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;

  if (data) {
    return {
      has_access: true,
      expires_at: data.expires_at,
      purchase_id: data.id,
    };
  }

  return { has_access: false, expires_at: null, purchase_id: null };
}

// ── Historial de compras del usuario ──

export async function getUserPurchases(): Promise<UserPurchaseWithProduct[]> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return [];

  const { data, error } = await supabase
    .from("user_purchases")
    .select(`
      *,
      shop_products (name, icon, slug, category)
    `)
    .eq("user_id", userData.user.id)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data as UserPurchaseWithProduct[];
}

// ── Historial de transacciones de créditos ──

export async function getCreditTransactions(): Promise<CreditTransaction[]> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return [];

  const { data, error } = await supabase
    .from("credit_transactions")
    .select("*")
    .eq("user_id", userData.user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw error;
  return data as CreditTransaction[];
}

// ── Obtener balance actual (fresh, no cache) ──

export async function getSharkCoinsBalance(): Promise<number> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return 0;

  const { data, error } = await supabase
    .from("profiles")
    .select("shark_coins_balance")
    .eq("id", userData.user.id)
    .single();

  if (error) throw error;
  return data?.shark_coins_balance ?? 0;
}