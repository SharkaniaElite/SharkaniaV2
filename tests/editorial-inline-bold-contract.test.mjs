import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");

test("Editorial paragraphs convert **bold** into React strong without injecting HTML", () => {
  const source = read("src/lib/render-inline-links.tsx");
  const article = read("src/pages/blog-post.tsx");
  assert.match(source, /function applyInlineStrong\(/);
  assert.ok(source.includes(String.raw`const strongPattern = /\*\*([^*]+)\*\*/g;`));
  assert.match(source, /<strong key=\{/);
  assert.match(source, /applyInlineStrong\(part, \(chunk\) =>\s*applyGlossaryLinks\(chunk/);
  assert.match(source, /processMarkdownLinksToArray\(text\)/);
  assert.match(source, /renderText\(match\[1\]\)/);
  assert.doesNotMatch(source, /dangerouslySetInnerHTML/);
  assert.match(article, /renderWithLinksAndGlossary\(text, glossaryTerms, alreadyLinked\)/);
  assert.match(article, /renderWithLinks\(text\)/);
});
