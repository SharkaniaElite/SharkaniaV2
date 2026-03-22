// src/lib/hand-parsers/index.ts
// ══════════════════════════════════════════════════════════
// Hand History Parser Registry
// Auto-detects format and routes to correct parser
// ══════════════════════════════════════════════════════════

import type { HandHistory, HandParser } from "../../types/replayer";
import { ggpokerParser } from "./ggpoker-parser";

// Register all parsers here
const PARSERS: HandParser[] = [
  ggpokerParser,
  // Future: pppokerParser, pokerbrosParser, clubggParser
];

export interface ParseResult {
  success: boolean;
  hands: HandHistory[];
  detectedRoom: string | null;
  errors: string[];
}

/**
 * Parse a hand history text file.
 * Auto-detects the format and returns parsed hands.
 * If the user is uploading a single hand, returns array with 1 element.
 * If uploading a session file, returns all hands found.
 */
export function parseHandHistory(text: string): ParseResult {
  const errors: string[] = [];

  if (!text.trim()) {
    return { success: false, hands: [], detectedRoom: null, errors: ["El archivo está vacío."] };
  }

  // Try each parser
  for (const parser of PARSERS) {
    if (parser.canParse(text)) {
      try {
        const hands = parser.parse(text);
        if (hands.length > 0) {
          return {
            success: true,
            hands,
            detectedRoom: parser.roomName,
            errors: [],
          };
        }
        errors.push(`Parser de ${parser.roomName} reconoció el formato pero no pudo extraer manos.`);
      } catch (err) {
        errors.push(`Error en parser de ${parser.roomName}: ${err instanceof Error ? err.message : "desconocido"}`);
      }
    }
  }

  return {
    success: false,
    hands: [],
    detectedRoom: null,
    errors: errors.length > 0
      ? errors
      : ["No se reconoció el formato del archivo. Formatos soportados: GGPoker, PokerStars, HomeGames PokerStars."],
  };
}

/**
 * Parse a single hand from text.
 * If the text contains multiple hands, returns only the first one.
 */
export function parseSingleHand(text: string): HandHistory | null {
  const result = parseHandHistory(text);
  return result.hands[0] ?? null;
}

/**
 * Get list of supported room names for UI display
 */
export function getSupportedRooms(): string[] {
  return PARSERS.map((p) => p.roomName);
}
