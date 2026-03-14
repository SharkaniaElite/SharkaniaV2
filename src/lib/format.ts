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
