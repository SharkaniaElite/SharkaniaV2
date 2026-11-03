import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("Arena educational and discovery routes use the same preview shell and hero", () => {
  const routes = [
    "blog", "noticias", "tools", "glossary", "glossary-term", "academy", "elo-system",
  ];
  for (const route of routes) {
    const code = source(`src/pages/${route}.tsx`);
    assert.match(code, /<PageShell variant="arena">/, route);
    assert.match(code, /<SEOHead/, route);
    assert.match(code, /<ArenaPageHero/, route);
    assert.match(code, /arena-interior/, route);
  }
});

test("Editorial index pages retain search, filters and accessible selected categories", () => {
  const blog = source("src/pages/blog.tsx");
  const news = source("src/pages/noticias.tsx");
  const glossary = source("src/pages/glossary.tsx");
  assert.match(blog, /aria-pressed=\{selectedCategory === cat\}/);
  assert.match(news, /aria-pressed=\{activeCategory === category\}/);
  assert.match(glossary, /aria-pressed=\{activeCategory === key\}/);
  assert.match(glossary, /aria-pressed=\{activeCategory === "all"\}/);
  assert.match(news, /getEditorialPath\(featuredPost\.category, featuredPost\.slug\)/);
  assert.match(news, /getEditorialPath\(post\.category, post\.slug\)/);
});

test("Tool catalog login remains a single navigable link, not a nested button", () => {
  const tools = source("src/pages/tools.tsx");
  assert.match(tools, /\/login\?redirect=\$\{redirectParam\}/);
  assert.doesNotMatch(tools, /<Button\b/);
  assert.match(tools, /arena-tool-login/);
  assert.match(tools, /TOOL[S]?\.map/);
});

test("Glossary term pages keep semantic metadata and article content", () => {
  const glossaryTerm = source("src/pages/glossary-term.tsx");
  assert.match(glossaryTerm, /useDefinedTermSchema/);
  assert.match(glossaryTerm, /useBreadcrumbSchema/);
  assert.match(glossaryTerm, /term\.full_definition/);
  assert.match(glossaryTerm, /description=\{term\.short_definition\}/);
});

test("Preview design remains separate from paid API security controls", () => {
  const stats = source("src/lib/api/stats-spy.ts");
  assert.match(stats, /VITE_STATS_SPY_SECURE_RPC === "true"/);
  const pageShell = source("src/components/layout/page-shell.tsx");
  assert.match(pageShell, /variant/);
});
