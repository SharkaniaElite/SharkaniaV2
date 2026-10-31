import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";

// Bundle the real parser and replay engine; only stub the unused browser
// Supabase client. Chip accounting and step navigation are never mocked.
const built = await build({
  stdin: {
    contents: [
      'export { ggpokerParser } from "./src/lib/hand-parsers/ggpoker-parser.ts";',
      'export { initReplayState, stepForward, stepBackward, goToStep, getTotalStepIndex, getTotalSteps } from "./src/lib/replayer-engine.ts";',
    ].join("\n"),
    resolveDir: process.cwd(),
    sourcefile: "test-entry.ts",
    loader: "ts",
  },
  bundle: true,
  format: "esm",
  platform: "node",
  write: false,
  plugins: [{
    name: "supabase-client-stub",
    setup(bundle) {
      bundle.onResolve({ filter: /\/supabase$/ }, () => ({ path: "supabase-stub", namespace: "test-only" }));
      bundle.onLoad({ filter: /.*/, namespace: "test-only" }, () => ({
        contents: "export const supabase = {};",
        loader: "js",
      }));
    },
  }],
});

const blob = Buffer.from(built.outputFiles[0].text).toString("base64");
const { ggpokerParser, initReplayState, stepForward, stepBackward, goToStep,
  getTotalStepIndex, getTotalSteps } = await import("data:text/javascript;base64," + blob);

// SB raises to $0.06, BB reraises to $0.20, SB calls $0.14.
// Preflop pot is $0.40; flop bet/call $0.10 each yields $0.60.
const handText = [
  "Poker Hand #RC777: Hold'em No Limit ($0.01/$0.02) - 2026/10/31 20:00:00",
  "Table 'RushAndCash777' 6-max Seat #1 is the button",
  "Seat 1: Hero ($2 in chips)",
  "Seat 2: Villain ($2 in chips)",
  "Hero: posts small blind $0.01",
  "Villain: posts big blind $0.02",
  "*** HOLE CARDS ***",
  "Dealt to Hero [Ah Kh]",
  "Hero: raises $0.04 to $0.06",
  "Villain: raises $0.14 to $0.20",
  "Hero: calls $0.14",
  "*** FLOP *** [2s 7d 9h]",
  "Villain: checks",
  "Hero: bets $0.10",
  "Villain: calls $0.10",
  "*** SUMMARY ***",
  "Hero collected $0.60 from pot",
].join("\n");

function approximately(actual, expected) {
  assert.ok(Math.abs(actual - expected) < 1e-9, "Expected " + expected + ", got " + actual);
}

test("GG raise-to amounts contribute only uninvested chips", () => {
  const hands = ggpokerParser.parse(handText);
  assert.equal(hands.length, 1);
  const hand = hands[0];
  assert.equal(hand.streets.length, 2);
  assert.deepEqual(hand.streets[0].actions.map((a) => a.amount), [0.01, 0.02, 0.06, 0.20, 0.14]);

  let state = initReplayState(hand);
  for (let i = 0; i < hand.streets[0].actions.length; i++) state = stepForward(state);
  assert.equal(state.currentStreetIndex, 0);
  approximately(state.pot.totalPot, 0.40);
  approximately(state.players[0].currentStack, 1.80);
  approximately(state.players[1].currentStack, 1.80);
  approximately(state.players[0].currentBet, 0.20);
  approximately(state.players[1].currentBet, 0.20);

  const startFlop = stepForward(state);
  assert.equal(startFlop.currentStreetIndex, 1);
  assert.equal(startFlop.currentActionIndex, -1);
  approximately(startFlop.players[0].currentBet, 0);
  approximately(startFlop.players[1].currentBet, 0);

  let afterFlop = startFlop;
  for (let i = 0; i < hand.streets[1].actions.length; i++) afterFlop = stepForward(afterFlop);
  approximately(afterFlop.pot.totalPot, 0.60);
  approximately(afterFlop.players[0].currentStack, 1.70);
  approximately(afterFlop.players[1].currentStack, 1.70);
});

test("backward and absolute-step navigation agree at street boundaries", () => {
  const hand = ggpokerParser.parse(handText)[0];
  assert.ok(hand);
  let lastPreflop = initReplayState(hand);
  for (let i = 0; i < hand.streets[0].actions.length; i++) lastPreflop = stepForward(lastPreflop);
  const startFlop = stepForward(lastPreflop);
  const back = stepBackward(startFlop);
  assert.equal(getTotalStepIndex(lastPreflop), 5);
  assert.equal(getTotalStepIndex(startFlop), 6);
  assert.equal(back.currentStreetIndex, 0);
  assert.equal(back.currentActionIndex, 4);
  approximately(back.pot.totalPot, 0.40);

  const direct = goToStep(hand, 5);
  assert.equal(direct.currentStreetIndex, 0);
  assert.equal(direct.currentActionIndex, 4);
  approximately(direct.pot.totalPot, 0.40);
  const directFlop = goToStep(hand, 6);
  assert.equal(directFlop.currentStreetIndex, 1);
  assert.equal(directFlop.currentActionIndex, -1);
  approximately(directFlop.pot.totalPot, 0.40);
  assert.equal(getTotalSteps(hand), 9);
});


// All-in raise and call metadata must retain how much was actually invested.
// The $1 unmatched portion of the biggest stack is returned and excluded.
const threeWayHand = [
  "Poker Hand #RC778: Hold'em No Limit ($0.01/$0.02) - 2026/10/31 20:01:00",
  "Table 'RushAndCash778' 6-max Seat #3 is the button",
  "Seat 1: A ($0.50 in chips)",
  "Seat 2: B ($1 in chips)",
  "Seat 3: C ($2 in chips)",
  "A: posts small blind $0.01",
  "B: posts big blind $0.02",
  "*** HOLE CARDS ***",
  "C: raises $1.98 to $2 and is all-in",
  "A: calls $0.49 and is all-in",
  "B: calls $0.98 and is all-in",
  "Uncalled bet ($1.00) returned to C",
  "*** SHOWDOWN ***",
  "A: shows [Ah As]",
  "B: shows [Kh Ks]",
  "A collected $1.50 from main pot",
  "B collected $1.00 from side pot",
  "*** SUMMARY ***",
].join("\n");

test("three-way GG all-in separates main and side pots and refunds the uncalled bet", () => {
  const hand = ggpokerParser.parse(threeWayHand)[0];
  assert.ok(hand);
  const actions = hand.streets[0].actions;
  assert.deepEqual(actions.map((a) => a.type), [
    "post-sb", "post-bb", "raise", "call", "call", "return-uncalled",
  ]);
  assert.equal(actions[2].isAllIn, true);
  assert.equal(actions[3].isAllIn, true);
  assert.equal(actions[4].isAllIn, true);
  assert.deepEqual(hand.result.winners.map((w) => w.potType), ["main", "side"]);

  let state = initReplayState(hand);
  for (let i = 0; i < actions.length - 1; i++) state = stepForward(state);
  approximately(state.pot.totalPot, 3.50);

  state = stepForward(state);
  approximately(state.pot.totalPot, 2.50);
  approximately(state.pot.mainPot, 1.50);
  assert.equal(state.pot.sidePots.length, 1);
  approximately(state.pot.sidePots[0].amount, 1.00);
  assert.deepEqual(state.pot.sidePots[0].eligiblePlayers, [1, 2]);
  approximately(state.players[0].currentStack, 0);
  approximately(state.players[1].currentStack, 0);
  approximately(state.players[2].currentStack, 1);
  assert.equal(state.players[2].isAllIn, false);
  approximately(state.players.reduce((sum, p) => sum + p.totalInvested, 0), state.pot.totalPot);

  const rewind = stepBackward(state);
  approximately(rewind.pot.totalPot, 3.50);
  const restore = stepForward(rewind);
  approximately(restore.pot.totalPot, 2.50);
});

const foldedDeadMoneyHand = [
  "Poker Hand #RC779: Hold'em No Limit ($0.01/$0.02) - 2026/10/31 20:02:00",
  "Table 'RushAndCash779' 6-max Seat #3 is the button",
  "Seat 1: A ($0.50 in chips)",
  "Seat 2: B ($1 in chips)",
  "Seat 3: C ($2 in chips)",
  "Seat 4: D ($1.50 in chips)",
  "A: posts small blind $0.01",
  "B: posts big blind $0.02",
  "*** HOLE CARDS ***",
  "C: raises $0.18 to $0.20",
  "D: calls $0.20",
  "A: raises $0.49 to $0.50 and is all-in",
  "B: raises $0.98 to $1 and is all-in",
  "C: calls $0.80",
  "D: folds",
  "*** SHOWDOWN ***",
  "A: shows [Ah As]",
  "B: shows [Kh Ks]",
  "B collected $2.70 from main pot",
  "*** SUMMARY ***",
].join("\n");

test("folded dead money stays in the main pot; side pot excludes short all-in player", () => {
  const hand = ggpokerParser.parse(foldedDeadMoneyHand)[0];
  assert.ok(hand);
  let state = initReplayState(hand);
  for (let i = 0; i < hand.streets[0].actions.length; i++) state = stepForward(state);
  approximately(state.pot.totalPot, 2.70);
  approximately(state.pot.mainPot, 1.70);
  assert.equal(state.pot.sidePots.length, 1);
  approximately(state.pot.sidePots[0].amount, 1.00);
  assert.deepEqual(state.pot.sidePots[0].eligiblePlayers, [1, 2]);
  assert.equal(state.players[3].isFolded, true);
  approximately(state.players[3].totalInvested, 0.20);
  approximately(state.players.reduce((sum, p) => sum + p.totalInvested, 0), state.pot.totalPot);
});

test("reported GG winners receive their recorded net payouts only at showdown completion", () => {
  const hand = ggpokerParser.parse(threeWayHand)[0];
  assert.ok(hand?.result);
  const steps = getTotalSteps(hand);
  let state = initReplayState(hand);
  for (let i = 0; i < steps; i++) state = stepForward(state);
  assert.equal(state.isFinished, false);
  approximately(state.players[0].currentStack, 0);
  approximately(state.players[1].currentStack, 0);
  approximately(state.players[2].currentStack, 1);

  const done = stepForward(state);
  assert.equal(done.isFinished, true);
  approximately(done.players[0].currentStack, 1.50);
  approximately(done.players[1].currentStack, 1.00);
  approximately(done.players[2].currentStack, 1.00);
  // Keep the historical pot visible on the table instead of counting it twice.
  approximately(done.pot.totalPot, 2.50);
  assert.equal(stepForward(done), done); // payout can never be applied twice

  const direct = goToStep(hand, steps);
  assert.equal(direct.isFinished, true);
  assert.deepEqual(direct.players.map(p => p.currentStack), done.players.map(p => p.currentStack));
  const rewound = stepBackward(done);
  assert.equal(rewound.isFinished, false);
  approximately(rewound.players[0].currentStack, 0);
  const afterLastAction = stepForward(rewound);
  assert.equal(afterLastAction.isFinished, false);
  approximately(stepForward(afterLastAction).players[0].currentStack, 1.50);
});

test("cash-game rake is not invented as winnings: only actual collected net amount is credited", () => {
  const hand = ggpokerParser.parse(
    handText.replace("Hero collected $0.60 from pot", "Hero collected $0.58 from pot")
  )[0];
  assert.ok(hand);
  const completed = goToStep(hand, getTotalSteps(hand));
  assert.equal(completed.isFinished, true);
  approximately(completed.pot.totalPot, 0.60);
  approximately(completed.players[0].currentStack, 2.28);
  approximately(completed.players[1].currentStack, 1.70);
  // Exactly $0.02 remains unawarded; the engine does not guess its reason.
  approximately(completed.players.reduce((sum, p) => sum + p.currentStack, 0), 3.98);
});

test("untrusted or invalid winner amounts cannot mint chips at completion", () => {
  const original = ggpokerParser.parse(handText)[0];
  assert.ok(original);
  for (const invalid of [
    { playerIndex: 7, amount: 0.60, potType: "main" },
    { playerIndex: 0, amount: 50, potType: "main" },
    { playerIndex: 0, amount: -3, potType: "main" },
  ]) {
    const hand = { ...original, result: { winners: [invalid], showdownHands: [] } };
    const prior = stepForward(goToStep(hand, getTotalSteps(hand) - 1));
    assert.equal(prior.isFinished, false);
    const done = goToStep(hand, getTotalSteps(hand));
    assert.equal(done.isFinished, true);
    assert.deepEqual(done.players.map(p => p.currentStack), prior.players.map(p => p.currentStack));
  }
});
