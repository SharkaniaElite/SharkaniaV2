import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

const entry = readFileSync(new URL("../src/main.tsx", import.meta.url), "utf8");

test("Production analytics run only on canonical Sharkania domains", () => {
  assert.match(entry, /const productionHost = \["sharkania\.com", "www\.sharkania\.com"\]\.includes\(window\.location\.hostname\)/);
  assert.match(entry, /if \(productionHost\) \{\s+posthog\.init\(/);
});

test("Microsoft Clarity is split into a dynamic bundle after page load", () => {
  assert.doesNotMatch(entry, /import Clarity from/);
  assert.match(entry, /import\("@microsoft\/clarity"\)/);
  assert.match(entry, /window\.addEventListener\("load", startClarity, \{ once: true \}\)/);
});
