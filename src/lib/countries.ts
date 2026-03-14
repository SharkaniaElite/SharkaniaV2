// src/lib/countries.ts

const COUNTRY_FLAGS: Record<string, string> = {
  BR: "🇧🇷", AR: "🇦🇷", MX: "🇲🇽", CL: "🇨🇱", CO: "🇨🇴",
  ES: "🇪🇸", PE: "🇵🇪", UY: "🇺🇾", VE: "🇻🇪", EC: "🇪🇨",
  PY: "🇵🇾", BO: "🇧🇴", CR: "🇨🇷", PA: "🇵🇦", DO: "🇩🇴",
  GT: "🇬🇹", HN: "🇭🇳", NI: "🇳🇮", SV: "🇸🇻", CU: "🇨🇺",
  US: "🇺🇸", CA: "🇨🇦", PT: "🇵🇹", GB: "🇬🇧", FR: "🇫🇷",
  DE: "🇩🇪", IT: "🇮🇹",
};

const COUNTRY_NAMES: Record<string, string> = {
  BR: "Brasil", AR: "Argentina", MX: "México", CL: "Chile", CO: "Colombia",
  ES: "España", PE: "Perú", UY: "Uruguay", VE: "Venezuela", EC: "Ecuador",
  PY: "Paraguay", BO: "Bolivia", CR: "Costa Rica", PA: "Panamá", DO: "Rep. Dominicana",
  GT: "Guatemala", HN: "Honduras", NI: "Nicaragua", SV: "El Salvador", CU: "Cuba",
  US: "Estados Unidos", CA: "Canadá", PT: "Portugal", GB: "Reino Unido", FR: "Francia",
  DE: "Alemania", IT: "Italia",
};

export function getFlag(countryCode: string | null): string {
  if (!countryCode) return "🌍";
  return COUNTRY_FLAGS[countryCode.toUpperCase()] ?? "🏳️";
}

export function getCountryName(countryCode: string | null): string {
  if (!countryCode) return "Global";
  return COUNTRY_NAMES[countryCode.toUpperCase()] ?? countryCode;
}

export function getUniqueCountries(codes: (string | null)[]): string[] {
  return [...new Set(codes.filter((c): c is string => c !== null))].sort();
}
