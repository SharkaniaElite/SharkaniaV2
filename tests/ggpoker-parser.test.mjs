import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";

// Bundle the actual TypeScript parser and stub only the position helper.
// This tests its real runtime behavior without Supabase or browser globals.
const bundled = await build({
  entryPoints: ["src/lib/hand-parsers/ggpoker-parser.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  write: false,
  plugins: [{
    name: "position-helper-stub",
    setup(build) {
      build.onResolve({ filter: /replayer-engine$/ }, () => ({ path: "position-helper", namespace: "test-only" }));
      build.onLoad({ filter: /.*/, namespace: "test-only" }, () => ({
        contents: "export function assignPositions() {}",
        loader: "js",
      }));
    },
  }],
});
const blob = Buffer.from(bundled.outputFiles[0].text).toString("base64");
const { ggpokerParser } = await import("data:text/javascript;base64," + blob);

const validHand = [
  "Poker Hand #RC4259572857: Hold'em No Limit ($0.01/$0.02) - 2026/01/31 16:14:54",
  "Table 'RushAndCash1118015' 6-max Seat #1 is the button",
  "Seat 1: Hero ($2 in chips)",
  "Seat 2: Villain ($2 in chips)",
  "Hero: posts small blind $0.01",
  "Villain: posts big blind $0.02",
  "*** HOLE CARDS ***",
  "Dealt to Hero [Ah Kh]",
  "Hero: raises $0.04 to $0.06",
  "Villain: folds",
  "Hero collected $0.03 from pot",
  "*** SUMMARY ***",
].join("\n");

test("GGPoker parser retains valid seats, blinds, cards and winners", () => {
  const hands = ggpokerParser.parse(validHand);
  assert.equal(hands.length, 1);
  const hand = hands[0];
  assert.equal(hand.handNumber, "RC4259572857");
  assert.equal(hand.config.smallBlind, 0.01);
  assert.equal(hand.config.bigBlind, 0.02);
  assert.equal(hand.players.length, 2);
  assert.equal(hand.players[0].name, "Hero");
  assert.equal(hand.players[0].holeCards.length, 2);
  assert.equal(hand.players[0].holeCards[0].rank, "A");
  assert.equal(hand.result.winners[0].playerIndex, 0);
});

test("GGPoker parser rejects truncated headers and incomplete seats rather than throwing", () => {
  const variants = [
    validHand.replace("Hold'em No Limit ($0.01/$0.02)", "Hold'em No Limit"),
    validHand.replace("Seat 2: Villain ($2 in chips)", "Seat 2: Villain (chips missing)"),
    "Poker Hand #BAD: Hold'em No Limit ($0.01/$0.02) - date\nTable 'X' 6-max Seat #1 is the button\nSeat 1: Hero ($2 in chips)",
  ];
  for (const text of variants) {
    assert.doesNotThrow(() => ggpokerParser.parse(text));
    assert.equal(ggpokerParser.parse(text).length, 0);
  }
});
