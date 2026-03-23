// src/lib/api/site-settings.ts
// ══════════════════════════════════════════════════════════
// Sharkania — Configuraciones del sitio desde Supabase
// ══════════════════════════════════════════════════════════

import { supabase } from "../supabase";

// ── Types ─────────────────────────────────────────────────

export interface BannerConfig {
  src: string;
  href: string;
  width: number;
  height: number;
  label: string;
}

export interface BannerSlotConfig {
  desktop: BannerConfig | null;
  mobile: BannerConfig | null;
}

export interface BannersConfig {
  bonusCode: string;
  slots: {
    mid: BannerSlotConfig;
    final: BannerSlotConfig;
    sidebar: BannerSlotConfig;
  };
}

// ── Valores por defecto (fallback si Supabase falla) ──────

export const DEFAULT_BANNERS: BannersConfig = {
  bonusCode: "FPHL",
  slots: {
    mid: {
      desktop: {
        src: "https://wptpartners.ck-cdn.com/tn/serve/?cid=505259",
        href: "https://tracking.wptpartners.com/visit/?bta=35660&nci=13409",
        width: 728, height: 90,
        label: "Leaderboard 728×90",
      },
      mobile: {
        src: "https://wptpartners.ck-cdn.com/tn/serve/?cid=505261",
        href: "https://tracking.wptpartners.com/visit/?bta=35660&nci=13410",
        width: 870, height: 200,
        label: "Wide 870×200",
      },
    },
    final: {
      desktop: {
        src: "https://wptpartners.ck-cdn.com/tn/serve/?cid=505261",
        href: "https://tracking.wptpartners.com/visit/?bta=35660&nci=13410",
        width: 870, height: 200,
        label: "Wide 870×200",
      },
      mobile: {
        src: "https://wptpartners.ck-cdn.com/tn/serve/?cid=505261",
        href: "https://tracking.wptpartners.com/visit/?bta=35660&nci=13410",
        width: 870, height: 200,
        label: "Wide 870×200",
      },
    },
    sidebar: {
      desktop: {
        src: "https://central.ck-cdn.com/w-pt-partners/2026-03-17/300x250_0e7435e0.jpg",
        href: "https://tracking.wptpartners.com/visit/?bta=35660&nci=13647",
        width: 300, height: 250,
        label: "Rectangle 300×250",
      },
      mobile: null,
    },
  },
};

// ── Leer banners ──────────────────────────────────────────

export async function getBannersConfig(): Promise<BannersConfig> {
  try {
    const { data, error } = await supabase
      .from("site_settings")
      .select("value")
      .eq("key", "banners")
      .single();

    if (error || !data) return DEFAULT_BANNERS;
    return data.value as BannersConfig;
  } catch {
    return DEFAULT_BANNERS;
  }
}

// ── Guardar banners ───────────────────────────────────────

export async function saveBannersConfig(config: BannersConfig): Promise<void> {
  const { error } = await supabase
    .from("site_settings")
    .upsert({ key: "banners", value: config, updated_at: new Date().toISOString() })
    .eq("key", "banners");

  if (error) throw error;
}
