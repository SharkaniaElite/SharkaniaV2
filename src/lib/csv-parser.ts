// src/lib/csv-parser.ts
import { parseInternationalNumber } from "./format";

export interface CSVValidationError {
  row: number;
  field: string;
  message: string;
}

export interface ParsedCSVRow {
  position: number | null;
  nickname: string;
  prize: number;
  points: number;
}

// ── Header mapping (case-insensitive) ──

const HEADER_ALIASES: Record<string, string> = {
  lugar: "position", posicion: "position", "posición": "position",
  pos: "position", position: "position", puesto: "position",
  rank: "position", "#": "position",

  nickname: "nickname", nick: "nickname", jugador: "nickname",
  player: "nickname", nombre: "nickname", name: "nickname",
  usuario: "nickname",

  premio: "prize", prize: "prize", ganancia: "prize",
  prize_won: "prize", winnings: "prize", payout: "prize", monto: "prize",

  puntos: "points", points: "points", pts: "points",
  league_points: "points", puntaje: "points", score: "points",
};

function normalizeHeader(raw: string): string | null {
  const cleaned = raw.trim().toLowerCase().replace(/['"]/g, "").replace(/\s+/g, "_");
  return HEADER_ALIASES[cleaned] ?? null;
}

// ── CSV Parser Helper ──

export function splitCsvLine(line: string, sep: string): string[] {
  const parts: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes; // Entramos o salimos de comillas
    } else if (char === sep && !inQuotes) {
      parts.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  parts.push(current);
  
  return parts.map((s) => s.trim().replace(/^["']|["']$/g, ""));
}

export function parseCSVSmart(text: string): { rows: ParsedCSVRow[]; errors: CSVValidationError[]; detectedHeaders: string[] } {
  const lines = text.trim().split("\n").filter((l) => l.trim());
  if (lines.length === 0) return { rows: [], errors: [], detectedHeaders: [] };

  const firstLine = lines[0]!;
  const sep = firstLine.includes("\t") ? "\t" : firstLine.includes(";") ? ";" : ",";

  const rawHeaders = splitCsvLine(firstLine, sep);
  const mappedHeaders = rawHeaders.map(normalizeHeader);
  const isHeader = mappedHeaders.some((h) => h !== null);
  const startIndex = isHeader ? 1 : 0;

  const headerMap: Record<string, number> = {};
  if (isHeader) {
    mappedHeaders.forEach((mapped, i) => {
      if (mapped && !(mapped in headerMap)) headerMap[mapped] = i;
    });
  } else {
    const testParts = splitCsvLine(firstLine, sep);
    if (testParts[0] && !isNaN(Number(testParts[0]))) {
      headerMap.position = 0; headerMap.nickname = 1;
      if (testParts.length > 2) headerMap.prize = 2;
      if (testParts.length > 3) headerMap.points = 3;
    } else {
      headerMap.nickname = 0;
      if (testParts.length > 1) headerMap.prize = 1;
      if (testParts.length > 2) headerMap.points = 2;
    }
  }

  const detectedHeaders = Object.keys(headerMap);
  const rows: ParsedCSVRow[] = [];
  const errors: CSVValidationError[] = [];

  if (!("nickname" in headerMap)) {
    errors.push({ row: 0, field: "nickname", message: 'No se encontró la columna "nickname" (o "jugador", "nick", "player"). Es obligatoria.' });
  }

  for (let i = startIndex; i < lines.length; i++) {
    const parts = splitCsvLine(lines[i]!, sep);
    const rowNum = i + 1;

    const getValue = (field: string): string => {
      const idx = headerMap[field];
      return idx !== undefined && parts[idx] !== undefined ? parts[idx]! : "";
    };

    const posRaw    = getValue("position");
    const nickRaw   = getValue("nickname");
    const prizeRaw  = getValue("prize");
    const pointsRaw = getValue("points");

    let position: number | null = null;
    if (posRaw) {
      const parsed = parseInt(posRaw.replace(/[°ºª#]/g, ""), 10);
      if (!isNaN(parsed) && parsed > 0) position = parsed;
      else errors.push({ row: rowNum, field: "lugar", message: `Fila ${rowNum}: "lugar" no es un número válido ("${posRaw}")` });
    }

    const nickname = nickRaw.trim();
    const prize    = parseInternationalNumber(prizeRaw);
    const points   = parseInternationalNumber(pointsRaw);

    if (!nickname) {
      errors.push({ row: rowNum, field: "nickname", message: `Fila ${rowNum}: falta el "nickname" (obligatorio)` });
    }

    rows.push({ position, nickname, prize, points });
  }

  if (!("position" in headerMap)) {
    rows.forEach((r, i) => { r.position = i + 1; });
  } else {
    const missingPos = rows.filter((r) => r.position === null);
    if (missingPos.length > 0 && rows.some((r) => r.position !== null)) {
      missingPos.forEach((r) => {
        const rowNum = rows.indexOf(r) + startIndex + 1;
        errors.push({ row: rowNum, field: "lugar", message: `Fila ${rowNum}: falta el "lugar" (obligatorio)` });
      });
    }
  }

  return { rows, errors, detectedHeaders };
}