import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const edge = readFileSync(new URL("../supabase/functions/posthog-stats/index.ts", import.meta.url), "utf8");
const main = readFileSync(new URL("../src/main.tsx", import.meta.url), "utf8");

test("admin analytics only aggregates exact official Sharkania hosts", () => {
  const start = edge.indexOf("const hogqlQuery = [");
  const end = edge.indexOf('].join(" ");', start);
  assert.ok(start >= 0 && end > start, "the live HogQL query must exist");
  const query = edge.slice(start, end);
  assert.match(query, /WHERE event = '\$pageview'/);
  assert.match(query, /AND properties\.\$host IN \('sharkania\.com', 'www\.sharkania\.com'\)/);
  assert.doesNotMatch(query, /properties\.\$host LIKE|\.pages\.dev.*LIKE/);
  assert.match(query, /count\(DISTINCT person_id\)/);
  assert.match(query, /topK\(5\)\(properties\.\$current_url\)/);
  assert.match(query, /topK\(5\)\(properties\.\$geoip_country_name\)/);
  assert.match(query, /topK\(3\)\(properties\.\$device_type\)/);
});

test("preview frontend cannot initialize PostHog or Microsoft Clarity", () => {
  assert.match(main, /const productionHost = \["sharkania\.com", "www\.sharkania\.com"\]\.includes\(window\.location\.hostname\)/);
  assert.match(main, /if \(productionHost\) \{[\s\S]*?posthog\.init\(/);
  assert.match(main, /if \(productionHost\) \{[\s\S]*?Clarity\.init\(/);
});
