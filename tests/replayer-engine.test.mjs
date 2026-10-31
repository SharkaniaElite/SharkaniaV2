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
