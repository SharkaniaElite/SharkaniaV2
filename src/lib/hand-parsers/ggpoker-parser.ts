// src/lib/hand-parsers/ggpoker-parser.ts
// ══════════════════════════════════════════════════════════
// Parser for GGPoker / PokerStars / HomeGames hand history
// Standard format: "Poker Hand #XXX: Hold'em No Limit..."
// Also works with PokerStars and HomeGames PokerStars
// ══════════════════════════════════════════════════════════

import type {
  HandHistory,
  HandParser,
  PlayerState,
  StreetData,
  Action,
  Card,
  GameType,
  TableSize,
  Street,
  ActionType,
  HandResult,
} from "../../types/replayer";
import { assignPositions } from "../replayer-engine";

// ── Helpers ──────────────────────────────────────────────

function parseCard(str: string): Card | null {
  const s = str.trim();
  if (s.length < 2) return null;
  const rankChar = s.slice(0, -1).toUpperCase();
  const suitChar = s.slice(-1).toLowerCase();

  const rankMap: Record<string, Card["rank"]> = {
    "2": "2", "3": "3", "4": "4", "5": "5", "6": "6", "7": "7",
    "8": "8", "9": "9", "10": "T", "T": "T", "J": "J", "Q": "Q", "K": "K", "A": "A",
  };
  const suitMap: Record<string, Card["suit"]> = { s: "s", h: "h", d: "d", c: "c" };

  const rank = rankMap[rankChar];
  const suit = suitMap[suitChar];
  if (!rank || !suit) return null;
  return { rank, suit };
}

function parseCardList(str: string): Card[] {
  // "[7s 9s 2d]" or "7s 9s 2d" or "[2h 5c]"
  const cleaned = str.replace(/[\[\]]/g, "").trim();
  if (!cleaned) return [];
  return cleaned.split(/\s+/).map(parseCard).filter((c): c is Card => c !== null);
}

function parseAmount(str: string): number {
  // "$0.05" or "0.05" or "$1.32" or "1305"
  return parseFloat(str.replace(/[$€£¥,]/g, "")) || 0;
}

function detectSource(text: string): HandHistory["source"] {
  if (text.includes("GGPoker") || text.includes("RushAndCash") || text.includes("RC")) return "ggpoker";
  if (text.includes("HomeGames") || text.includes("Home Game")) return "homegames";
  if (text.includes("PokerStars")) return "pokerstars";
  return "pokerstars"; // default fallback — same format
}

// ── Split multi-hand file into individual hands ──────────

function splitHands(text: string): string[] {
  const hands: string[] = [];
  const lines = text.split("\n");
  let current: string[] = [];

  for (const line of lines) {
    if (line.match(/^Poker Hand #/) && current.length > 0) {
      hands.push(current.join("\n"));
      current = [];
    }
    current.push(line);
  }
  if (current.length > 0) {
    hands.push(current.join("\n"));
  }

  return hands.filter((h) => h.trim().length > 0);
}

// ── Parse a single hand ──────────────────────────────────

function parseSingleHand(text: string): HandHistory | null {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length < 5) return null;

  // Line 1: Poker Hand #RC4259572857: Hold'em No Limit ($0.01/$0.02) - 2026/01/31 16:14:54
  const headerMatch = lines[0].match(
    /Poker Hand #([^:]+):\s*(.*?)\s*\(([^/]+)\/([^)]+)\)\s*-\s*(.*)/
  );
  if (!headerMatch) return null;

  const handNumber = headerMatch[1];
  const gameStr = headerMatch[2];
  const sbStr = headerMatch[3];
  const bbStr = headerMatch[4];
  const timestamp = headerMatch[5];

  const smallBlind = parseAmount(sbStr);
  const bigBlind = parseAmount(bbStr);

  // Detect game type
  let gameType: GameType = "NLH";
  if (gameStr.includes("Omaha") && gameStr.includes("5")) gameType = "PLO5";
  else if (gameStr.includes("Omaha")) gameType = "PLO";
  else if (gameStr.includes("6+") || gameStr.includes("Short")) gameType = "6+";

  const isTournament = gameStr.includes("Tournament") || lines[0].includes("Tournament");

  // Line 2: Table 'RushAndCash1118015' 6-max Seat #1 is the button
  const tableMatch = lines[1].match(
    /Table '([^']+)'\s+(\d+)-max\s+Seat #(\d+) is the button/
  );
  const tableName = tableMatch?.[1] ?? "Unknown";
  const tableSize = (tableMatch ? parseInt(tableMatch[2]) : 6) as TableSize;
  const buttonSeat = tableMatch ? parseInt(tableMatch[3]) : 1;

  // Parse seats: Seat N: PlayerName ($X.XX in chips)
  const players: PlayerState[] = [];
  const seatToIndex: Record<number, number> = {};
  let lineIdx = 2;

  while (lineIdx < lines.length) {
    const seatMatch = lines[lineIdx].match(
      /Seat (\d+): (.+?) \([$]?([\d.]+)\s+in chips\)/
    );
    if (!seatMatch) break;

    const seatNum = parseInt(seatMatch[1]);
    const name = seatMatch[2].trim();
    const stack = parseFloat(seatMatch[3]);

    seatToIndex[seatNum] = players.length;

    players.push({
      seatIndex: players.length,
      name,
      stackAtStart: stack,
      currentStack: stack,
      holeCards: null,
      position: null,
      isHero: name === "Hero",
      isDealer: seatNum === buttonSeat,
      isFolded: false,
      isAllIn: false,
      isSittingOut: false,
      currentBet: 0,
      totalInvested: 0,
    });

    lineIdx++;
  }

  if (players.length < 2) return null;

  // Helper to find player index by name
  const findPlayer = (name: string): number => {
    const idx = players.findIndex((p) => p.name === name);
    return idx >= 0 ? idx : -1;
  };

  // Parse actions by section
  const streets: StreetData[] = [];
  let currentStreet: Street = "preflop";
  let currentActions: Action[] = [];
  let currentCommunityCards: Card[] = [];
  const result: HandResult = { winners: [], showdownHands: [] };

  const parseActionLine = (line: string): Action | null => {
    // "PlayerName: folds"
    // "PlayerName: calls $0.03"
    // "PlayerName: raises $0.03 to $0.05"
    // "PlayerName: bets $0.08"
    // "PlayerName: checks"
    // "PlayerName: raises $1 to $1.32 and is all-in"
    // "PlayerName: posts small blind $0.01"
    // "PlayerName: posts big blind $0.02"

    const colonIdx = line.indexOf(": ");
    if (colonIdx === -1) return null;
    const playerName = line.slice(0, colonIdx).trim();
    const actionStr = line.slice(colonIdx + 2).trim();
    const playerIndex = findPlayer(playerName);
    if (playerIndex === -1) return null;

    const isAllIn = actionStr.includes("all-in");

    if (actionStr.startsWith("posts small blind")) {
      const amount = parseAmount(actionStr.replace("posts small blind", "").replace("and is all-in", ""));
      return { playerIndex, type: "post-sb", amount, isAllIn, street: currentStreet };
    }
    if (actionStr.startsWith("posts big blind")) {
      const amount = parseAmount(actionStr.replace("posts big blind", "").replace("and is all-in", ""));
      return { playerIndex, type: "post-bb", amount, isAllIn, street: currentStreet };
    }
    if (actionStr.startsWith("posts the ante")) {
      const amount = parseAmount(actionStr.replace("posts the ante", "").replace("and is all-in", ""));
      return { playerIndex, type: "post-ante", amount, isAllIn, street: currentStreet };
    }
    if (actionStr === "folds" || actionStr.startsWith("folds")) {
      return { playerIndex, type: "fold", amount: 0, isAllIn: false, street: currentStreet };
    }
    if (actionStr === "checks" || actionStr.startsWith("checks")) {
      return { playerIndex, type: "check", amount: 0, isAllIn: false, street: currentStreet };
    }
    if (actionStr.startsWith("calls")) {
      const amount = parseAmount(actionStr.replace("calls", "").replace("and is all-in", ""));
      return { playerIndex, type: isAllIn ? "all-in" : "call", amount, isAllIn, street: currentStreet };
    }
    if (actionStr.startsWith("bets")) {
      const amount = parseAmount(actionStr.replace("bets", "").replace("and is all-in", ""));
      return { playerIndex, type: isAllIn ? "all-in" : "bet", amount, isAllIn, street: currentStreet };
    }
    if (actionStr.startsWith("raises")) {
      // "raises $0.03 to $0.05" — we want the "to" amount
      const toMatch = actionStr.match(/to\s+[$]?([\d.]+)/);
      const raiseMatch = actionStr.match(/raises\s+[$]?([\d.]+)/);
      const amount = toMatch ? parseAmount(toMatch[1]) : (raiseMatch ? parseAmount(raiseMatch[1]) : 0);
      return { playerIndex, type: isAllIn ? "all-in" : "raise", amount, isAllIn, street: currentStreet };
    }
    if (actionStr.startsWith("shows")) {
      const cardsMatch = actionStr.match(/\[([^\]]+)\]/);
      if (cardsMatch) {
        const cards = parseCardList(cardsMatch[1]);
        players[playerIndex].holeCards = cards;
        result.showdownHands.push({
          playerIndex,
          cards,
          handDescription: actionStr.replace(/shows\s*\[[^\]]+\]/, "").trim() || undefined,
        });
      }
      return { playerIndex, type: "show", amount: 0, isAllIn: false, street: currentStreet };
    }
    if (actionStr.startsWith("mucks")) {
      return { playerIndex, type: "muck", amount: 0, isAllIn: false, street: currentStreet };
    }

    return null;
  };

  // Continue parsing from where we left off
  for (; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];

    // Dealt to Hero [2h 5c]
    if (line.startsWith("Dealt to ")) {
      const dealtMatch = line.match(/Dealt to (.+?)\s*(\[([^\]]+)\])?$/);
      if (dealtMatch) {
        const name = dealtMatch[1].trim();
        const pidx = findPlayer(name);
        if (pidx >= 0 && dealtMatch[3]) {
          players[pidx].holeCards = parseCardList(dealtMatch[3]);
        }
      }
      continue;
    }

    // *** HOLE CARDS ***
    if (line === "*** HOLE CARDS ***") {
      currentStreet = "preflop";
      continue;
    }

    // *** FLOP *** [7s 9s 2d]
    if (line.startsWith("*** FLOP ***")) {
      // Save preflop
      streets.push({ street: "preflop", communityCards: [], actions: currentActions, potAtStart: 0 });
      currentActions = [];
      currentStreet = "flop";
      const cardsMatch = line.match(/\[([^\]]+)\]/);
      if (cardsMatch) currentCommunityCards = parseCardList(cardsMatch[1]);
      continue;
    }

    // *** TURN *** [7s 9s 2d] [Js]
    if (line.startsWith("*** TURN ***")) {
      streets.push({ street: "flop", communityCards: [...currentCommunityCards], actions: currentActions, potAtStart: 0 });
      currentActions = [];
      currentStreet = "turn";
      const allCards = line.match(/\[([^\]]+)\]\s*\[([^\]]+)\]/);
      if (allCards) {
        currentCommunityCards = [...parseCardList(allCards[1]), ...parseCardList(allCards[2])];
      }
      continue;
    }

    // *** RIVER *** [7s 9s 2d Js] [Kc]
    if (line.startsWith("*** RIVER ***")) {
      streets.push({ street: "turn", communityCards: [...currentCommunityCards], actions: currentActions, potAtStart: 0 });
      currentActions = [];
      currentStreet = "river";
      const allCards = line.match(/\[([^\]]+)\]\s*\[([^\]]+)\]/);
      if (allCards) {
        currentCommunityCards = [...parseCardList(allCards[1]), ...parseCardList(allCards[2])];
      }
      continue;
    }

    // *** SHOWDOWN ***
    if (line === "*** SHOWDOWN ***") {
      // Save last street
      if (currentActions.length > 0 || streets.length === 0) {
        streets.push({ street: currentStreet, communityCards: [...currentCommunityCards], actions: currentActions, potAtStart: 0 });
      }
      currentActions = [];
      currentStreet = "showdown";
      continue;
    }

    // *** SUMMARY ***
    if (line === "*** SUMMARY ***") {
      // If we haven't saved the last street yet
      if (currentStreet !== "showdown" && currentActions.length > 0) {
        streets.push({ street: currentStreet, communityCards: [...currentCommunityCards], actions: currentActions, potAtStart: 0 });
        currentActions = [];
      }
      continue;
    }

    // "PlayerName collected $X.XX from pot"
    if (line.includes("collected") && line.includes("from pot")) {
      const collectMatch = line.match(/^(.+?) collected \$?([\d.]+) from/);
      if (collectMatch) {
        const pidx = findPlayer(collectMatch[1].trim());
        if (pidx >= 0) {
          result.winners.push({
            playerIndex: pidx,
            amount: parseFloat(collectMatch[2]),
            potType: "main",
          });
        }
      }
      continue;
    }

    // "Uncalled bet ($X) returned to PlayerName"
    if (line.startsWith("Uncalled bet")) {
      continue; // Skip — engine handles this
    }

    // Skip summary/board lines
    if (line.startsWith("Total pot") || line.startsWith("Board") || line.startsWith("Seat ")) {
      continue;
    }

    // Try parsing as action
    const action = parseActionLine(line);
    if (action) {
      currentActions.push(action);
    }
  }

  // If there are remaining actions (e.g. hand ended without showdown section)
  if (currentActions.length > 0) {
    streets.push({ street: currentStreet, communityCards: [...currentCommunityCards], actions: currentActions, potAtStart: 0 });
  }

  // Determine currency
  const currency = lines[0].includes("$") ? "USD" : lines[0].includes("€") ? "EUR" : "chips";

  const hand: HandHistory = {
    id: crypto.randomUUID(),
    source: detectSource(text),
    handNumber,
    tableInfo: tableName,
    timestamp,
    config: {
      gameType,
      tableSize: Math.min(Math.max(players.length, 2), 9) as TableSize,
      smallBlind,
      bigBlind,
      ante: 0,
      currency,
      isTournament,
    },
    players,
    streets,
    result: result.winners.length > 0 ? result : undefined,
    rawText: text,
  };

  assignPositions(hand);
  return hand;
}

// ── Export parser ─────────────────────────────────────────

export const ggpokerParser: HandParser = {
  roomName: "GGPoker / PokerStars",

  canParse(text: string): boolean {
    return /Poker Hand #/.test(text) && /Seat #\d+ is the button/.test(text);
  },

  parse(text: string): HandHistory[] {
    const rawHands = splitHands(text);
    const parsed: HandHistory[] = [];

    for (const raw of rawHands) {
      const hand = parseSingleHand(raw);
      if (hand) parsed.push(hand);
    }

    return parsed;
  },
};
