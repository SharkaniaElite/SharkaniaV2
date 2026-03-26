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
