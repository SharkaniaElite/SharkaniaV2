import assert from "node:assert/strict";import {readFileSync} from "node:fs";import {test} from "node:test";
const s=readFileSync(new URL("../src/main.tsx",import.meta.url),"utf8");
test("Preview domains never initialize PostHog and Clarity tracking",()=>{
 assert.match(s,/productionHost/);assert.match(s,/\["sharkania\.com", "www\.sharkania\.com"\]/);
 assert.match(s,/if \(productionHost\)/);
 assert.match(s,/posthog\.init/);
 assert.match(s,/Clarity\.init/);
});
