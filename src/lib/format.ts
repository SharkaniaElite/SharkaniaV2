// src/lib/format.ts

export function formatNumber(n: number): string {
  return n.toLocaleString("en-US");
}

export function formatElo(elo: number): string {
  return Math.round(elo).toLocaleString("en-US");
}

export function formatCurrency(amount: number, currency: string = "USD"): string {
  if (amount === 0) return "FREE";
  return `$${amount.toLocaleString("en-US", { minimumFractionDigits: amount % 1 === 0 ? 0 : 2 })}`;
}

export function formatPercent(value: number, decimals: number = 1): string {
  return `${value.toFixed(decimals)}%`;
}

export function formatEloChange(change: number): string {
  const sign = change >= 0 ? "+" : "";
  return `${sign}${Math.round(change)}`;
}

export function calcItm(cashes: number, tournaments: number): number {
  if (tournaments === 0) return 0;
  return (cashes / tournaments) * 100;
}

export function calcRoi(prizeWon: number, buyInsSpent: number): number {
  if (buyInsSpent === 0) return 0;
  return ((prizeWon - buyInsSpent) / buyInsSpent) * 100;
}

// Agrega esto al final de src/lib/format.ts
export function translateAuthError(message: string): string {
  const msg = message.toLowerCase();
  
  if (msg.includes("invalid login credentials")) return "Email o contraseña incorrectos.";
  if (msg.includes("user already registered")) return "Este correo ya está registrado.";
  if (msg.includes("password should be at least 6 characters")) return "La contraseña debe tener al menos 6 caracteres.";
  if (msg.includes("new password should be different")) return "La nueva contraseña debe ser distinta a la anterior.";
  if (msg.includes("captcha")) return "Error en la verificación de seguridad (Captcha).";
  if (msg.includes("email not confirmed")) return "Debes confirmar tu email antes de iniciar sesión.";
  
  return "Ocurrió un error inesperado. Inténtalo de nuevo.";
}

/**
 * Convierte cualquier formato de moneda a un número flotante nativo de JavaScript.
 * Soporta: "1.500,50", "1,500.50", "1500,5", "1.500", "$ 1,500"
 */
export function parseInternationalNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "number") return value;

  // 1. Limpiamos espacios, símbolos de moneda o letras
  let cleanStr = String(value).replace(/[^0-9.,-]/g, "");
  if (!cleanStr) return 0;

  // 2. Detectamos qué símbolos tiene
  const hasDot = cleanStr.includes(".");
  const hasComma = cleanStr.includes(",");

  if (hasDot && hasComma) {
    // Si tiene ambos, el que está al final es el decimal
    const lastDot = cleanStr.lastIndexOf(".");
    const lastComma = cleanStr.lastIndexOf(",");
    
    if (lastDot > lastComma) {
      // Formato US: 1,500.50 -> Quitamos comas
      cleanStr = cleanStr.replace(/,/g, "");
    } else {
      // Formato EU/LATAM: 1.500,50 -> Quitamos puntos, cambiamos coma por punto
      cleanStr = cleanStr.replace(/\./g, "").replace(",", ".");
    }
  } 
  else if (hasComma) {
    // Solo tiene comas. Miramos la última coma.
    const parts = cleanStr.split(",");
    const lastPart = parts[parts.length - 1];
    
    // 👇 FIX: Le decimos a TS que verifique si lastPart existe primero
    if (lastPart && lastPart.length === 3 && parts.length > 1) {
      cleanStr = cleanStr.replace(/,/g, "");
    } else {
      // Si no, es decimal (ej: 1500,50 o 200,2)
      cleanStr = cleanStr.replace(",", ".");
    }
  } 
  else if (hasDot) {
    // Solo tiene puntos. Misma lógica.
    const parts = cleanStr.split(".");
    const lastPart = parts[parts.length - 1];
    
    // 👇 FIX: Le decimos a TS que verifique si lastPart existe primero
    if (lastPart && lastPart.length === 3 && parts.length > 1) {
      // Es miles (ej: 1.500)
      cleanStr = cleanStr.replace(/\./g, "");
    }
    // Si es decimal (ej: 1500.50), no hacemos nada porque el punto ya es nativo de JS.
  }

  const parsed = parseFloat(cleanStr);
  return isNaN(parsed) ? 0 : parsed;
}
