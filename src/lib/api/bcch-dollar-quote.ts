import { supabase } from "../supabase";

/**
 * Superadmin-only BCCh official exchange quote, via protected Edge Function.
 * The browser NEVER receives the personal BCCh API token and cannot write ELO.
 * Preview only: no site_settings write until the admin clicks Save.
 */
export interface BcchDollarQuote {
  rateClpPerUsd: number;
  effectiveDate: string;
  source: "Banco Central de Chile";
  series: "F073.TCO.PRE.Z.D";
  unit: "CLP por USD";
  fetchedAt: string;
}

export async function fetchBcchDollarQuote(): Promise<BcchDollarQuote> {
  const {data, error}=await supabase.functions.invoke("bcch-dollar-preview",{
    body: {},
  });
  if (error) {
    throw new Error("No fue posible consultar el Banco Central. La cotización actual no se modificó.");
  }
  if (!data || data.source!=="Banco Central de Chile" ||
      data.series!=="F073.TCO.PRE.Z.D" || data.unit!=="CLP por USD" ||
      !Number.isFinite(data.rateClpPerUsd) ||
      data.rateClpPerUsd < 300 || data.rateClpPerUsd > 3000 ||
      typeof data.effectiveDate!=="string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(data.effectiveDate) ||
      typeof data.fetchedAt!=="string" ||
      !Number.isFinite(Date.parse(data.fetchedAt))) {
    throw new Error("La respuesta oficial no tiene un formato válido. No se modificó el jackpot.");
  }
  return data as BcchDollarQuote;
}
