// src/types/replayer.ts
// ══════════════════════════════════════════════════════════
// Sharkania Hand Replayer — Core Types
// ══════════════════════════════════════════════════════════

// ── Cards ────────────────────────────────────────────────

export type Suit = "s" | "h" | "d" | "c"; // spades, hearts, diamonds, clubs
export type Rank = "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "T" | "J" | "Q" | "K" | "A";

export interface Card {
  rank: Rank;
  suit: Suit;
}

/** e.g. "Ah" = Ace of hearts, "Td" = Ten of diamonds */
export type CardString = `${Rank}${Suit}`;

export const SUITS: Suit[] = ["s", "h", "d", "c"];
export const RANKS: Rank[] = ["2", "3", "4", "5", "6", "7", "8", "9", "T", "J", "Q", "K", "A"];

export const SUIT_SYMBOLS: Record<Suit, string> = {
  s: "♠",
  h: "♥",
  d: "♦",
  c: "♣",
};

export const SUIT_COLORS: Record<Suit, string> = {
  s: "#a1a1aa",  // zinc
  h: "#f87171",  // red
  d: "#60a5fa",  // blue
  c: "#34d399",  // green
};

export const RANK_DISPLAY: Record<Rank, string> = {
  "2": "2", "3": "3", "4": "4", "5": "5", "6": "6",
  "7": "7", "8": "8", "9": "9", "T": "10",
  J: "J", Q: "Q", K: "K", A: "A",
};

// ── Game configuration ───────────────────────────────────

export type GameType = "NLH" | "PLO" | "PLO5" | "NLO" | "6+" | "Mixed";
export type TableSize = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export interface GameConfig {
  gameType: GameType;
  tableSize: TableSize;
  smallBlind: number;
  bigBlind: number;
  ante: number;
  currency: string;        // "USD", "CLP", "chips", etc.
  isTournament: boolean;
  tournamentName?: string;
  level?: string;          // "Level 5" etc.
}

// ── Player ───────────────────────────────────────────────

export type Position = "BTN" | "SB" | "BB" | "UTG" | "UTG+1" | "UTG+2" | "MP" | "MP+1" | "HJ" | "CO";

export interface PlayerState {
  seatIndex: number;       // 0-based seat at the table
  name: string;
  stackAtStart: number;    // chips at start of hand
  currentStack: number;    // chips at current point in replay
  holeCards: Card[] | null; // null if unknown/mucked
  position: Position | null;
  isHero: boolean;
  isDealer: boolean;
  isFolded: boolean;
  isAllIn: boolean;
  isSittingOut: boolean;
  currentBet: number;      // amount bet in current street
  totalInvested: number;   // total chips put into pot this hand
}

// ── Actions ──────────────────────────────────────────────

export type ActionType =
  | "fold"
  | "check"
  | "call"
  | "bet"
  | "raise"
  | "all-in"
  | "post-sb"
  | "post-bb"
  | "post-ante"
  | "show"
  | "muck";

export interface Action {
  playerIndex: number;     // index into HandHistory.players
  type: ActionType;
  amount: number;          // 0 for fold/check/muck, bet/raise amount for others
  isAllIn: boolean;
  street: Street;
}

// ── Streets ──────────────────────────────────────────────

export type Street = "preflop" | "flop" | "turn" | "river" | "showdown";

export interface StreetData {
  street: Street;
  communityCards: Card[];  // cumulative community cards at this street
  actions: Action[];
  potAtStart: number;
}

// ── Pot ──────────────────────────────────────────────────

export interface PotInfo {
  mainPot: number;
  sidePots: {
    amount: number;
    eligiblePlayers: number[]; // indices
  }[];
  totalPot: number;
}

// ── Results ──────────────────────────────────────────────

export interface HandResult {
  winners: {
    playerIndex: number;
    amount: number;
    potType: "main" | "side";
    handDescription?: string; // e.g. "Full House, Aces over Kings"
  }[];
  showdownHands: {
    playerIndex: number;
    cards: Card[];
    handDescription?: string;
  }[];
}

// ── Complete Hand History ─────────────────────────────────

export interface HandHistory {
  id: string;                // unique ID for sharing
  source: "manual" | "pppoker" | "pokerbros" | "clubgg" | "pokerstars" | "homegames" | "ggpoker";
  handNumber?: string;       // original hand number from the room
  tableInfo?: string;        // table name from the room
  timestamp?: string;        // ISO date when hand was played

  config: GameConfig;
  players: PlayerState[];    // initial state of all players
  streets: StreetData[];     // all streets with actions
  result?: HandResult;       // winners, showdown info

  rawText?: string;          // original hand history text (for re-parsing/debugging)
}

// ── Replay State (runtime) ───────────────────────────────

export interface ReplayState {
  hand: HandHistory;
  currentStreetIndex: number;
  currentActionIndex: number; // -1 = start of street (before any action)
  players: PlayerState[];     // mutable copy of player states
  pot: PotInfo;
  communityCards: Card[];
  isPlaying: boolean;
  playbackSpeed: number;      // 0.5, 1, 2, 4
  isFinished: boolean;
}

// ── Parser interface ─────────────────────────────────────

export interface HandParser {
  /** Name of the room this parser handles */
  roomName: string;
  /** Test if a raw text string matches this parser's format */
  canParse: (text: string) => boolean;
  /** Parse raw text into one or more hand histories */
  parse: (text: string) => HandHistory[];
}

// ── Share encoding ───────────────────────────────────────

/** Compact representation for URL sharing (base64-encoded JSON) */
export interface ShareableHand {
  v: 1;                     // schema version
  g: {                      // game config (compact keys)
    t: string;              // gameType
    s: number;              // tableSize
    sb: number;
    bb: number;
    a: number;              // ante
    c: string;              // currency
    tour: boolean;
  };
  p: {                      // players (compact)
    n: string;              // name
    s: number;              // stack
    h: string | null;       // hole cards as string "AhKs" or null
    d: boolean;             // isDealer
    hero: boolean;
  }[];
  st: {                     // streets
    s: string;              // street name
    cc: string;             // community cards as string "AhKsTd"
    a: {                    // actions
      p: number;            // playerIndex
      t: string;            // actionType
      am: number;           // amount
      ai: boolean;          // isAllIn
    }[];
  }[];
  r?: {                     // result (optional)
    w: { p: number; am: number; pt: string; hd?: string }[];
    sh: { p: number; c: string; hd?: string }[];
  };
}
