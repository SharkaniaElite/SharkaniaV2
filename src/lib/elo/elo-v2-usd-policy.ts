/**
 * SHARKANIA — ELO v2 USD-normalized policy candidate, QA ONLY.
 * No network, database, historical rewrite or FX provider in this module.
 * This pure calculation is NOT connected to production/guarded writers.
 *
 * Source quote must have been verified by trusted SERVER code: never accept
 * browser-supplied FX for an authenticated publication.
 */
export type EloCurrency = "USD" | "CLP" | "EUR";

export interface VerifiedFxSnapshot {
  currency: "CLP" | "EUR";
  /** BCCH: CLP per 1 USD; ECB: USD per 1 EUR */
  quote: number;
  source: "BCCH_OBSERVED_USD" | "ECB_EURUSD_REFERENCE";
  effectiveDate: string; // YYYY-MM-DD in the source's official calendar
  publishedAt: string; // ISO timestamp with offset
  referenceId: string; // immutable provider observation/series identifier
}

export interface EloV2Input {
  originalBuyIn: number;
  originalCurrency: EloCurrency;
  /** Actual event timestamp with UTC offset, NOT results publication time. */
  tournamentStartedAt: string;
  /** Event's civil date in tournament's IANA timezone; derived on SERVER. */
  tournamentLocalDate: string;
  /** Server-verified daily rate, null for USD. */
  fx: VerifiedFxSnapshot | null;
}

export interface EloV2Normalization {
  algorithmVersion: "elo-v2-usd-normalized";
  originalBuyIn: number;
  originalCurrency: EloCurrency;
  buyInUsd: number;
  fx: VerifiedFxSnapshot | null;
}

const DAY = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const MAX_QUOTE_AGE_DAYS = 7; // Closed-market weekends; fail closed if stale.

function civilDayNumber(day: string): number {
  if (!DAY.test(day)) throw new Error("Invalid YYYY-MM-DD date.");
  const year = Number(day.slice(0, 4));
  const month = Number(day.slice(5, 7));
  const dayOfMonth = Number(day.slice(8, 10));
  const utc = Date.UTC(year, month - 1, dayOfMonth);
  if (new Date(utc).toISOString().slice(0, 10) !== day) {
    throw new Error("Nonexistent calendar date.");
  }
  return Math.floor(utc / 86400000);
}

export function normalizeBuyInUsdV2(input: EloV2Input): EloV2Normalization {
  const { originalBuyIn, originalCurrency, tournamentStartedAt,
    tournamentLocalDate, fx } = input;
  if (!Number.isFinite(originalBuyIn) || originalBuyIn < 0 ||
    originalBuyIn > 100000000) {
    throw new Error("Invalid tournament buy-in.");
  }
  if (!["USD", "CLP", "EUR"].includes(originalCurrency)) {
    throw new Error("Unsupported currency.");
  }
  const eventMs = new Date(tournamentStartedAt).getTime();
  if (!Number.isFinite(eventMs) ||
    !/(Z|[+-]\d\d:\d\d)$/i.test(tournamentStartedAt)) {
    throw new Error("Tournament start must have explicit timezone.");
  }
  const eventDay = civilDayNumber(tournamentLocalDate);

  if (originalCurrency === "USD") {
    if (fx !== null) throw new Error("USD must not accept external FX.");
    return {
      algorithmVersion: "elo-v2-usd-normalized",
      originalBuyIn, originalCurrency,
      buyInUsd: originalBuyIn,
      fx: null,
    };
  }
  if (!fx) throw new Error("Verified currency quote is mandatory.");
  const expectedSource = originalCurrency === "CLP"
    ? "BCCH_OBSERVED_USD" : "ECB_EURUSD_REFERENCE";
  if (fx.currency !== originalCurrency || fx.source !== expectedSource ||
    !Number.isFinite(fx.quote) || fx.quote <= 0 ||
    fx.quote > 100000000 || !fx.referenceId.trim()) {
    throw new Error("Invalid currency quote, provider or observation ID.");
  }
  const publishedMs = new Date(fx.publishedAt).getTime();
  if (!Number.isFinite(publishedMs) ||
    !/(Z|[+-]\d\d:\d\d)$/i.test(fx.publishedAt) ||
    publishedMs > eventMs) {
    throw new Error("FX quote did not exist when tournament began.");
  }
  const ageDays = eventDay - civilDayNumber(fx.effectiveDate);
  if (ageDays < 0 || ageDays > MAX_QUOTE_AGE_DAYS) {
    throw new Error("FX quote date is future or too old.");
  }
  // BCCH quote direction: CLP per 1 USD. ECB: USD per 1 EUR.
  // Only the Elo buy-in is normalized. Prize/financial ledgers stay native.
  const buyInUsd = originalCurrency === "CLP"
    ? originalBuyIn / fx.quote : originalBuyIn * fx.quote;
  if (!Number.isFinite(buyInUsd) || buyInUsd > 100000000) {
    throw new Error("Normalized buy-in outside Elo guardrail.");
  }
  return {
    algorithmVersion: "elo-v2-usd-normalized",
    originalBuyIn, originalCurrency,
    buyInUsd,
    fx: {...fx},
  };
}

/** v1 mathematical structure; v2 changes ONLY nominal buy-in -> USD buy-in. */
export function kFactorV2(usdBuyIn: number, totalTournaments: number, entrants: number): number {
  if (!Number.isFinite(usdBuyIn) || usdBuyIn < 0 ||
    !Number.isSafeInteger(totalTournaments) || totalTournaments < 0 ||
    !Number.isSafeInteger(entrants) || entrants < 2 || entrants > 1000) {
    throw new Error("Invalid Elo K inputs.");
  }
  const kBase = totalTournaments < 30 ? 40 : 20;
  return kBase * (1 + Math.log10(usdBuyIn + 1) * 0.1) *
    (1 + Math.log10(entrants) * 0.15);
}
