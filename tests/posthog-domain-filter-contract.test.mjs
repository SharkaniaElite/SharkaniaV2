import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const edge = readFileSync(new URL("../supabase/functions/posthog-stats/index.ts", import.meta.url), "utf8");
const main = readFileSync(new URL("../src/main.tsx", import.meta.url), "utf8");

test("PostHog stats always restrict to exact official Sharkania hosts", () => {
  const start = edge.indexOf("const hogqlQuery = [");
  const end = edge.indexOf('].join(" ");', start);
  assert.ok(start >= 0 && end > start, "live HogQL query must exist");
  const query = edge.slice(start, end);
  assert.match(query, /WITH base AS \(/);
  assert.match(query, /WHERE event = '\$pageview'/);
  assert.match(query, /AND properties\.\$host IN \('sharkania\.com', 'www\.sharkania\.com'\)/);
  assert.doesNotMatch(query, /properties\.\$host LIKE|\.pages\.dev.*LIKE/);
  assert.ok(query.indexOf("AND properties.$host IN") < query.indexOf('")",'),
    "the exact host filter must be inside the base event query");
});

test("all headline, page, country and device metrics count distinct people", () => {
  const start = edge.indexOf("const hogqlQuery = [");
  const end = edge.indexOf('].join(" ");', start);
  const query = edge.slice(start, end);
  assert.match(query, /uniqExact\(person_id\) FROM base/);
  assert.equal((query.match(/uniqExact\(person_id\) AS unique_people/g) ?? []).length, 3);
  assert.match(query, /GROUP BY page ORDER BY unique_people DESC, page ASC LIMIT 5/);
  assert.match(query, /GROUP BY country ORDER BY unique_people DESC, country ASC LIMIT 5/);
  assert.match(query, /GROUP BY device ORDER BY unique_people DESC, device ASC LIMIT 3/);
  assert.doesNotMatch(query, /topK\(|count\(\*\) AS v_unique/);
  assert.match(edge, /uniqueVisitors: Number\(row\[0\]\)/);
  assert.match(edge, /pages: Array\.isArray\(row\[1\]\)/);
});

test("preview frontend does not initialize PostHog or Clarity", () => {
  assert.match(main, /const productionHost = \["sharkania\.com", "www\.sharkania\.com"\]\.includes\(window\.location\.hostname\)/);
  assert.match(main, /if \(productionHost\) \{[\s\S]*?posthog\.init\(/);
  assert.match(main, /if \(productionHost\) \{[\s\S]*?Clarity\.init\(/);
});
