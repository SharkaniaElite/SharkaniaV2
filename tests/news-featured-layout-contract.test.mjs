import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const page=readFileSync("src/pages/noticias.tsx","utf8");
const css=readFileSync("src/styles/arena-interior.css","utf8");
test("featured news photo is not constrained to the old desktop height",()=>{
  const section=page.slice(page.indexOf("{/* NOTICIA DESTACADA"),page.indexOf("{/* GRILLA DE NOTICIAS REGULARES"));
  assert.match(section,/arena-news-featured-media/);
  assert.match(section,/absolute inset-0 block w-full h-full object-cover/);
  assert.doesNotMatch(section,/md:h-\[450px\]|md:w-2\/3|md:w-1\/3/);
  assert.match(section,/arena-news-featured-copy/);
  assert.match(section,/arena-news-featured-title/);
  assert.doesNotMatch(section,/line-clamp-\d+[^"]*">\s*\{featuredPost.title\}/);
});
test("featured card stacks on mobile and stretches its image on desktop",()=>{
  assert.match(css,/\.arena-editorial \.arena-news-featured\s*\{[^}]*display:grid;grid-template-columns:minmax\(0,1fr\);[^}]*align-items:stretch/);
  assert.match(css,/\.arena-editorial \.arena-news-featured-media\s*\{[^}]*aspect-ratio:16\/9/);
  assert.match(css,/@media\(min-width:1024px\)\s*\{\s*\.arena-editorial \.arena-news-featured\s*\{[^}]*grid-template-columns:minmax\(0,58fr\) minmax\(0,42fr\);\s*\}\s*\.arena-editorial \.arena-news-featured-media\s*\{[^}]*aspect-ratio:auto;min-height:/);
});
