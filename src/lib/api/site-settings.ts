import { supabase } from "../supabase";

// ── Types ─────────────────────────────────────────────────

export interface BannerConfig {
  src: string;
  href: string;
  width: number;
  height: number;
  label: string;
  us_src?: string;  
  us_href?: string; 
  custom_text?: string; 
  custom_code?: string; 
}

export interface BannerSlotConfig {
  desktop: BannerConfig | null;
  mobile: BannerConfig | null;
}

export interface FloatingConfig {
  active?: boolean;
  title?: string;
  description?: string;
  image?: string;
  link?: string;
  delay?: number;
  scrollTrigger?: number;
  us_title?: string;       
  us_description?: string; 
  us_image?: string;       
  us_link?: string;        
}

export interface BannersConfig {
  bonusCode: string;
  floatingCta?: FloatingConfig;
  slots: {
    top_global: BannerSlotConfig;
    super_left: BannerSlotConfig;
    super_right: BannerSlotConfig;
    grid_1: BannerSlotConfig;
    grid_2: BannerSlotConfig;
    grid_3: BannerSlotConfig;
    grid_4: BannerSlotConfig;
    mid: BannerSlotConfig;
    final: BannerSlotConfig;
    sidebar: BannerSlotConfig;
  };
}

// ── Valores por defecto (fallback) ──────

export const DEFAULT_BANNERS: BannersConfig = {
  bonusCode: "FPHL",
  slots: {
    top_global: {
      desktop: { src: "", href: "", width: 1200, height: 150, label: "Top Destacado" },
      mobile: { src: "", href: "", width: 600, height: 200, label: "Top Destacado Mobile" },
    },
    super_left: {
      desktop: { src: "", href: "", width: 728, height: 90, label: "Banner Izquierdo" },
      mobile: { src: "", href: "", width: 320, height: 100, label: "Mobile Izquierdo" },
    },
    super_right: {
      desktop: { src: "", href: "", width: 728, height: 90, label: "Banner Derecho" },
      mobile: { src: "", href: "", width: 320, height: 100, label: "Mobile Derecho" },
    },
    grid_1: { desktop: null, mobile: null },
    grid_2: { desktop: null, mobile: null },
    grid_3: { desktop: null, mobile: null },
    grid_4: { desktop: null, mobile: null },
    mid: {
      desktop: { src: "", href: "", width: 728, height: 90, label: "Leaderboard Blog" },
      mobile: { src: "", href: "", width: 870, height: 200, label: "Wide Mobile" },
    },
    final: {
      desktop: { src: "", href: "", width: 870, height: 200, label: "Wide Footer" },
      mobile: { src: "", href: "", width: 870, height: 200, label: "Wide Mobile" },
    },
    sidebar: {
      desktop: { src: "", href: "", width: 300, height: 250, label: "Rectangle Desktop" },
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
      .maybeSingle();

    if (error || !data) return DEFAULT_BANNERS;

    const mergedSlots = { ...DEFAULT_BANNERS.slots };
    for (const k of Object.keys(DEFAULT_BANNERS.slots)) {
      const key = k as keyof BannersConfig["slots"];
      if (data.value?.slots?.[key]) {
        mergedSlots[key] = {
          desktop: data.value.slots[key].desktop ?? DEFAULT_BANNERS.slots[key].desktop,
          mobile: data.value.slots[key].mobile ?? DEFAULT_BANNERS.slots[key].mobile,
        };
      }
    }

    return {
      bonusCode: data.value?.bonusCode ?? DEFAULT_BANNERS.bonusCode,
      floatingCta: data.value?.floatingCta,
      slots: mergedSlots,
    };
  } catch (err) {
    return DEFAULT_BANNERS;
  }
}

// ── Guardar banners ───────────────────────────────────────

export async function saveBannersConfig(config: BannersConfig) {
  const { error } = await supabase
    .from("site_settings")
    .upsert({ key: "banners", value: config as unknown as Record<string, unknown> }, { onConflict: "key" });

  if (error) throw error;
}