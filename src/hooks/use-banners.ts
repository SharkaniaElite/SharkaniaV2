// src/hooks/use-banners.ts
// ══════════════════════════════════════════════════════════
// Hook para cargar la configuración de banners desde Supabase
// Con fallback automático a los valores por defecto
// ══════════════════════════════════════════════════════════

import { useQuery } from "@tanstack/react-query";
import { getBannersConfig, DEFAULT_BANNERS, type BannersConfig } from "../lib/api/site-settings";

export function useBanners(): BannersConfig {
  const { data } = useQuery({
    queryKey: ["site-settings-banners"],
    queryFn: getBannersConfig,
    staleTime: 1000 * 60 * 10, // 10 minutos de caché
    retry: 1,
  });

  return data ?? DEFAULT_BANNERS;
}
