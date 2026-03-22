// src/lib/replayer-engine.ts
// ══════════════════════════════════════════════════════════
// Sharkania Hand Replayer — Engine (State Machine)
// Advances a hand action-by-action, computing pots & stacks
// ══════════════════════════════════════════════════════════

import type {
  HandHistory,
  ReplayState,
  PlayerState,
  PotInfo,
  Action,
  Card,
  CardString,
  Rank,
  Suit,
} from "../types/replayer";

// ── Card helpers ─────────────────────────────────────────

export function parseCard(str: string): Card | null {
  if (str.length < 2) return null;
  const rank = str[0].toUpperCase() as Rank;
  const suit = str[1].toLowerCase() as Suit;
  if (!"23456789TJQKA".includes(rank)) return null;
  if (!"shdc".includes(suit)) return null;
  return { rank, suit };
}

export function parseCards(str: string): Card[] {
  const cards: Card[] = [];
  for (let i = 0; i < str.length - 1; i += 2) {
    const card = parseCard(str.slice(i, i + 2));
    if (card) cards.push(card);
  }
  return cards;
}

export function cardToString(card: Card): CardString {
  return `${card.rank}${card.suit}` as CardString;
}

export function cardsToString(cards: Card[]): string {
  return cards.map(cardToString).join("");
}

// ── Initialize replay state ──────────────────────────────

export function initReplayState(hand: HandHistory): ReplayState {
  const players: PlayerState[] = hand.players.map((p) => ({
    ...p,
    currentStack: p.stackAtStart,
    isFolded: false,
    isAllIn: false,
    currentBet: 0,
    totalInvested: 0,
  }));

  return {
    hand,
    currentStreetIndex: 0,
    currentActionIndex: -1,
    players,
    pot: { mainPot: 0, sidePots: [], totalPot: 0 },
    communityCards: [],
    isPlaying: false,
    playbackSpeed: 1,
    isFinished: false,
  };
}

// ── Apply a single action ────────────────────────────────

function applyAction(state: ReplayState, action: Action): ReplayState {
  const players = state.players.map((p) => ({ ...p }));
  const player = players[action.playerIndex];
  const pot = { ...state.pot };

  switch (action.type) {
    case "fold":
      player.isFolded = true;
      break;

    case "check":
      // No change to stacks or pot
      break;

    case "call": {
      const toCall = Math.min(action.amount, player.currentStack);
      player.currentStack -= toCall;
      player.currentBet += toCall;
      player.totalInvested += toCall;
      pot.totalPot += toCall;
      if (player.currentStack === 0) player.isAllIn = true;
      break;
    }

    case "bet":
    case "raise": {
      const betAmount = Math.min(action.amount, player.currentStack);
      player.currentStack -= betAmount;
      player.currentBet += betAmount;
      player.totalInvested += betAmount;
      pot.totalPot += betAmount;
      if (player.currentStack === 0 || action.isAllIn) player.isAllIn = true;
      break;
    }

    case "all-in": {
      const allInAmount = player.currentStack;
      player.currentBet += allInAmount;
      player.totalInvested += allInAmount;
      pot.totalPot += allInAmount;
      player.currentStack = 0;
      player.isAllIn = true;
      break;
    }

    case "post-sb": {
      const sb = Math.min(action.amount, player.currentStack);
      player.currentStack -= sb;
      player.currentBet = sb;
      player.totalInvested += sb;
      pot.totalPot += sb;
      break;
    }

    case "post-bb": {
      const bb = Math.min(action.amount, player.currentStack);
      player.currentStack -= bb;
      player.currentBet = bb;
      player.totalInvested += bb;
      pot.totalPot += bb;
      break;
    }

    case "post-ante": {
      const ante = Math.min(action.amount, player.currentStack);
      player.currentStack -= ante;
      player.totalInvested += ante;
      pot.totalPot += ante;
      break;
    }

    case "show":
    case "muck":
      // Visual-only, no stack changes
      break;
  }

  // Recalculate main pot (simplified — no side pot calculation yet)
  pot.mainPot = pot.totalPot;

  return {
    ...state,
    players,
    pot,
  };
}

// ── Step forward one action ──────────────────────────────

export function stepForward(state: ReplayState): ReplayState {
  if (state.isFinished) return state;

  const { hand, currentStreetIndex, currentActionIndex } = state;

  // If no streets, we're done
  if (!hand.streets.length) return { ...state, isFinished: true };

  const currentStreet = hand.streets[currentStreetIndex];
  const nextActionIndex = currentActionIndex + 1;

  // Still have actions in this street
  if (nextActionIndex < currentStreet.actions.length) {
    const action = currentStreet.actions[nextActionIndex];
    const newState = applyAction(state, action);
    return {
      ...newState,
      currentActionIndex: nextActionIndex,
    };
  }

  // Move to next street
  const nextStreetIndex = currentStreetIndex + 1;
  if (nextStreetIndex < hand.streets.length) {
    const nextStreet = hand.streets[nextStreetIndex];

    // Reset current bets for new street
    const players = state.players.map((p) => ({
      ...p,
      currentBet: 0,
    }));

    return {
      ...state,
      players,
      currentStreetIndex: nextStreetIndex,
      currentActionIndex: -1,
      communityCards: nextStreet.communityCards,
    };
  }

  // Hand is finished
  return { ...state, isFinished: true };
}

// ── Step backward one action ─────────────────────────────
// Re-initializes and replays up to (totalSteps - 1)

export function stepBackward(state: ReplayState): ReplayState {
  const totalSteps = getTotalStepIndex(state);
  if (totalSteps <= 0) return initReplayState(state.hand);

  return goToStep(state.hand, totalSteps - 1);
}

// ── Go to a specific step (absolute index across all streets) ─

export function goToStep(hand: HandHistory, targetStep: number): ReplayState {
  let current = initReplayState(hand);
  let step = 0;

  for (let si = 0; si < hand.streets.length; si++) {
    const street = hand.streets[si];

    // Entering a new street counts as a step (community cards reveal)
    if (si > 0) {
      if (step === targetStep) {
        return {
          ...current,
          currentStreetIndex: si,
          currentActionIndex: -1,
          communityCards: street.communityCards,
          players: current.players.map((p) => ({ ...p, currentBet: 0 })),
        };
      }
      step++;
      current = {
        ...current,
        currentStreetIndex: si,
        currentActionIndex: -1,
        communityCards: street.communityCards,
        players: current.players.map((p) => ({ ...p, currentBet: 0 })),
      };
    }

    for (let ai = 0; ai < street.actions.length; ai++) {
      if (step === targetStep) return current;
      current = applyAction(current, street.actions[ai]);
      current = {
        ...current,
        currentStreetIndex: si,
        currentActionIndex: ai,
      };
      step++;
    }
  }

  return { ...current, isFinished: true };
}

// ── Get total step count ─────────────────────────────────

export function getTotalSteps(hand: HandHistory): number {
  let count = 0;
  for (let si = 0; si < hand.streets.length; si++) {
    if (si > 0) count++; // street transition
    count += hand.streets[si].actions.length;
  }
  return count;
}

// ── Get current absolute step index ──────────────────────

export function getTotalStepIndex(state: ReplayState): number {
  const { hand, currentStreetIndex, currentActionIndex } = state;
  let step = 0;

  for (let si = 0; si < currentStreetIndex; si++) {
    if (si > 0) step++; // street transition
    step += hand.streets[si].actions.length;
  }

  if (currentStreetIndex > 0) step++; // current street transition
  step += currentActionIndex + 1;

  return step;
}

// ── Get action description (for timeline display) ────────

export function getActionDescription(action: Action, players: PlayerState[]): string {
  const player = players[action.playerIndex];
  const name = player?.name ?? `Seat ${action.playerIndex + 1}`;

  switch (action.type) {
    case "fold": return `${name} folds`;
    case "check": return `${name} checks`;
    case "call": return `${name} calls ${formatAmount(action.amount)}`;
    case "bet": return `${name} bets ${formatAmount(action.amount)}`;
    case "raise": return `${name} raises to ${formatAmount(action.amount)}`;
    case "all-in": return `${name} all-in ${formatAmount(action.amount)}`;
    case "post-sb": return `${name} posts SB ${formatAmount(action.amount)}`;
    case "post-bb": return `${name} posts BB ${formatAmount(action.amount)}`;
    case "post-ante": return `${name} posts ante ${formatAmount(action.amount)}`;
    case "show": return `${name} shows`;
    case "muck": return `${name} mucks`;
    default: return `${name} acts`;
  }
}

function formatAmount(amount: number): string {
  if (amount === 0) return "";
  if (amount >= 1000) return `${(amount / 1000).toFixed(1)}K`;
  if (Number.isInteger(amount)) return String(amount);
  return amount.toFixed(2);
}

// ── URL sharing: guardar en Supabase y devolver ID corto ─────

import { supabase } from "./supabase";

export async function saveHandForShare(hand: HandHistory): Promise<string> {
  // Extraer resumen para el OG
  const winner = hand.result?.winners[0];
  const winnerPlayer = winner ? hand.players[winner.playerIndex] : null;
  const totalPot = hand.result?.winners.reduce((s, w) => s + w.amount, 0) ?? 0;
  const board = hand.streets
    .flatMap((s) => s.communityCards)
    .map(cardToString)
    .join(" ");

  const summary = {
    winner: winnerPlayer?.name ?? null,
    hand_description: winner?.handDescription ?? null,
    pot: totalPot,
    board: board || null,
    players_count: hand.players.length,
    game_type: hand.config.gameType,
    blinds: `${hand.config.smallBlind}/${hand.config.bigBlind}`,
  };

  const { data, error } = await supabase
    .from("shared_hands")
    .insert({ hand_data: hand, hand_summary: summary })
    .select("id")
    .single();

  if (error) throw error;
  return data.id;
}

export async function loadHandFromShare(id: string): Promise<HandHistory | null> {
  const { data, error } = await supabase
    .from("shared_hands")
    .select("hand_data")
    .eq("id", id)
    .single();

  if (error || !data) return null;

  // Incrementar contador de vistas — sin bloquear ni crashear
  try {
    await supabase.rpc("increment_hand_views", { hand_id: id });
  } catch {
    // silencioso — las vistas no son críticas
  }

  const hand = data.hand_data as HandHistory;
  assignPositions(hand);
  return hand;
}

// ── Mantener compatibilidad con URLs viejas (Base64) ─────────

export function encodeHandForURL(hand: HandHistory): string {
  const compact = {
    v: 1,
    g: {
      t: hand.config.gameType,
      s: hand.config.tableSize,
      sb: hand.config.smallBlind,
      bb: hand.config.bigBlind,
      a: hand.config.ante,
      c: hand.config.currency,
      tour: hand.config.isTournament,
    },
    p: hand.players.map((p) => ({
      n: p.name,
      s: p.stackAtStart,
      h: p.holeCards ? cardsToString(p.holeCards) : null,
      d: p.isDealer,
      hero: p.isHero,
    })),
    st: hand.streets.map((s) => ({
      s: s.street,
      cc: cardsToString(s.communityCards),
      a: s.actions.map((a) => ({
        p: a.playerIndex,
        t: a.type,
        am: a.amount,
        ai: a.isAllIn,
      })),
    })),
    ...(hand.result ? {
      r: {
        w: hand.result.winners.map((w) => ({
          p: w.playerIndex,
          am: w.amount,
          pt: w.potType,
          hd: w.handDescription,
        })),
        sh: hand.result.showdownHands.map((sh) => ({
          p: sh.playerIndex,
          c: cardsToString(sh.cards),
          hd: sh.handDescription,
        })),
      },
    } : {}),
  };

  const json = JSON.stringify(compact);
  const encoded = btoa(json)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return encoded;
}

export function decodeHandFromURL(encoded: string): HandHistory | null {
  try {
    // Restore base64 padding
    let base64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
    while (base64.length % 4) base64 += "=";

    const json = atob(base64);
    const compact = JSON.parse(json);

    if (compact.v !== 1) return null;

    const hand: HandHistory = {
      id: crypto.randomUUID(),
      source: "manual",
      config: {
        gameType: compact.g.t,
        tableSize: compact.g.s,
        smallBlind: compact.g.sb,
        bigBlind: compact.g.bb,
        ante: compact.g.a,
        currency: compact.g.c,
        isTournament: compact.g.tour,
      },
      players: compact.p.map((p: { n: string; s: number; h: string | null; d: boolean; hero: boolean }, i: number) => ({
        seatIndex: i,
        name: p.n,
        stackAtStart: p.s,
        currentStack: p.s,
        holeCards: p.h ? parseCards(p.h) : null,
        position: null,
        isHero: p.hero,
        isDealer: p.d,
        isFolded: false,
        isAllIn: false,
        isSittingOut: false,
        currentBet: 0,
        totalInvested: 0,
      })),
      streets: compact.st.map((s: { s: string; cc: string; a: { p: number; t: string; am: number; ai: boolean }[] }) => ({
        street: s.s,
        communityCards: parseCards(s.cc),
        actions: s.a.map((a) => ({
          playerIndex: a.p,
          type: a.t,
          amount: a.am,
          isAllIn: a.ai,
          street: s.s,
        })),
        potAtStart: 0,
      })),
    };

    // Reconstruct result if present
    if (compact.r) {
      hand.result = {
        winners: compact.r.w.map((w: { p: number; am: number; pt: string; hd?: string }) => ({
          playerIndex: w.p,
          amount: w.am,
          potType: w.pt,
          handDescription: w.hd,
        })),
        showdownHands: compact.r.sh.map((sh: { p: number; c: string; hd?: string }) => ({
          playerIndex: sh.p,
          cards: parseCards(sh.c),
          handDescription: sh.hd,
        })),
      };
    }

    // Assign positions based on dealer and table size
    assignPositions(hand);

    return hand;
  } catch {
    return null;
  }
}

// ── Position assignment ──────────────────────────────────

export function assignPositions(hand: HandHistory): void {
  const { players, config } = hand;
  const n = players.length;
  const dealerIdx = players.findIndex((p) => p.isDealer);
  if (dealerIdx === -1) return;

  const positionNames = getPositionNames(n);

  for (let i = 0; i < n; i++) {
    const offset = (i - dealerIdx + n) % n;
    players[i].position = positionNames[offset] ?? null;
  }
}

function getPositionNames(n: number): (PlayerState["position"])[] {
  switch (n) {
    case 2: return ["BTN", "BB"];
    case 3: return ["BTN", "SB", "BB"];
    case 4: return ["BTN", "SB", "BB", "UTG"];
    case 5: return ["BTN", "SB", "BB", "UTG", "CO"];
    case 6: return ["BTN", "SB", "BB", "UTG", "MP", "CO"];
    case 7: return ["BTN", "SB", "BB", "UTG", "MP", "HJ", "CO"];
    case 8: return ["BTN", "SB", "BB", "UTG", "UTG+1", "MP", "HJ", "CO"];
    case 9: return ["BTN", "SB", "BB", "UTG", "UTG+1", "UTG+2", "MP", "HJ", "CO"];
    default: return [];
  }
}

// ── Demo hand for testing ────────────────────────────────

export function createDemoHand(): HandHistory {
  return {
    id: crypto.randomUUID(),
    source: "manual",
    config: {
      gameType: "NLH",
      tableSize: 6,
      smallBlind: 50,
      bigBlind: 100,
      ante: 0,
      currency: "chips",
      isTournament: true,
    },
    players: [
      { seatIndex: 0, name: "Hero", stackAtStart: 5000, currentStack: 5000, holeCards: [{ rank: "A", suit: "h" }, { rank: "K", suit: "s" }], position: "BTN", isHero: true, isDealer: true, isFolded: false, isAllIn: false, isSittingOut: false, currentBet: 0, totalInvested: 0 },
      { seatIndex: 1, name: "Villain1", stackAtStart: 3200, currentStack: 3200, holeCards: null, position: "SB", isHero: false, isDealer: false, isFolded: false, isAllIn: false, isSittingOut: false, currentBet: 0, totalInvested: 0 },
      { seatIndex: 2, name: "Villain2", stackAtStart: 7500, currentStack: 7500, holeCards: [{ rank: "Q", suit: "d" }, { rank: "Q", suit: "c" }], position: "BB", isHero: false, isDealer: false, isFolded: false, isAllIn: false, isSittingOut: false, currentBet: 0, totalInvested: 0 },
      { seatIndex: 3, name: "Villain3", stackAtStart: 2100, currentStack: 2100, holeCards: null, position: "UTG", isHero: false, isDealer: false, isFolded: false, isAllIn: false, isSittingOut: false, currentBet: 0, totalInvested: 0 },
      { seatIndex: 4, name: "Villain4", stackAtStart: 4800, currentStack: 4800, holeCards: null, position: "MP", isHero: false, isDealer: false, isFolded: false, isAllIn: false, isSittingOut: false, currentBet: 0, totalInvested: 0 },
      { seatIndex: 5, name: "Villain5", stackAtStart: 6000, currentStack: 6000, holeCards: null, position: "CO", isHero: false, isDealer: false, isFolded: false, isAllIn: false, isSittingOut: false, currentBet: 0, totalInvested: 0 },
    ],
    streets: [
      {
        street: "preflop",
        communityCards: [],
        potAtStart: 0,
        actions: [
          { playerIndex: 1, type: "post-sb", amount: 50, isAllIn: false, street: "preflop" },
          { playerIndex: 2, type: "post-bb", amount: 100, isAllIn: false, street: "preflop" },
          { playerIndex: 3, type: "fold", amount: 0, isAllIn: false, street: "preflop" },
          { playerIndex: 4, type: "fold", amount: 0, isAllIn: false, street: "preflop" },
          { playerIndex: 5, type: "raise", amount: 250, isAllIn: false, street: "preflop" },
          { playerIndex: 0, type: "raise", amount: 700, isAllIn: false, street: "preflop" },
          { playerIndex: 1, type: "fold", amount: 0, isAllIn: false, street: "preflop" },
          { playerIndex: 2, type: "call", amount: 600, isAllIn: false, street: "preflop" },
          { playerIndex: 5, type: "fold", amount: 0, isAllIn: false, street: "preflop" },
        ],
      },
      {
        street: "flop",
        communityCards: [{ rank: "A", suit: "d" }, { rank: "7", suit: "h" }, { rank: "3", suit: "c" }],
        potAtStart: 1700,
        actions: [
          { playerIndex: 2, type: "check", amount: 0, isAllIn: false, street: "flop" },
          { playerIndex: 0, type: "bet", amount: 850, isAllIn: false, street: "flop" },
          { playerIndex: 2, type: "call", amount: 850, isAllIn: false, street: "flop" },
        ],
      },
      {
        street: "turn",
        communityCards: [{ rank: "A", suit: "d" }, { rank: "7", suit: "h" }, { rank: "3", suit: "c" }, { rank: "K", suit: "d" }],
        potAtStart: 3400,
        actions: [
          { playerIndex: 2, type: "check", amount: 0, isAllIn: false, street: "turn" },
          { playerIndex: 0, type: "bet", amount: 1700, isAllIn: false, street: "turn" },
          { playerIndex: 2, type: "fold", amount: 0, isAllIn: false, street: "turn" },
        ],
      },
    ],
    result: {
      winners: [
        { playerIndex: 0, amount: 3400, potType: "main", handDescription: "Two Pair, Aces and Kings" },
      ],
      showdownHands: [],
    },
  };
}
