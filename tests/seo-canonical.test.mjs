import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { readFileSync } from "node:fs";

const bundled = await build({
  entryPoints: ["src/lib/seo-canonical.ts"],
  bundle: true, platform: "node", format: "esm", write: false,
});
const blob = Buffer.from(bundled.outputFiles[0].text).toString("base64");
const { getCanonicalUrl } = await import("data:text/javascript;base64," + blob);

test("SEO canonical defaults to the actual route, not the homepage", () => {
  assert.equal(getCanonicalUrl(undefined, "/tools/replayer"), "https://sharkania.com/tools/replayer");
  assert.equal(getCanonicalUrl(undefined, "/blog/gto-vs-explotativo"), "https://sharkania.com/blog/gto-vs-explotativo");
  assert.equal(getCanonicalUrl("/ranking", "/tools/replayer"), "https://sharkania.com/ranking");
  assert.equal(getCanonicalUrl("/", "/ranking"), "https://sharkania.com/");
});

test("canonical strips query and fragment, and rejects offsite inputs", () => {
  assert.equal(getCanonicalUrl(undefined, "/tools/replayer?hand=secret#street"), "https://sharkania.com/tools/replayer");
  assert.equal(getCanonicalUrl("/blog/post#comments"), "https://sharkania.com/blog/post");
  assert.equal(getCanonicalUrl("//attacker.example/route"), "https://sharkania.com/");
  assert.equal(getCanonicalUrl("https://attacker.example/route"), "https://sharkania.com/");
});

test("React SEOHead uses canonical helper for its default path", () => {
  const source = readFileSync("src/components/seo/seo-head.tsx", "utf8");
  assert.match(source, /import \{ getCanonicalUrl \} from "\.\.\/\.\.\/lib\/seo-canonical"/);
  assert.match(source, /const fullUrl = getCanonicalUrl\(path\)/);
  assert.doesNotMatch(source, /path = ""/);
});
