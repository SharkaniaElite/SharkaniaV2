import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

const load = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");

test("Home communicates poker immediately in the main heading and title", () => {
  const home = load("src/pages/arena-home.tsx");
  assert.match(home, /<h1 id="arena-hero-title">EL PÓKER TIENE/);
  assert.match(home, /<em>ARENA\.<\/em>/);
  assert.match(home, /title="Ranking ELO y torneos de póker online"/);
  assert.match(home, /Ver torneos de póker/);
  assert.match(home, /ranking ELO/i);
  assert.doesNotMatch(home, /EL RANKING<br\/>NO <em>MIENTE/);
});

test("Poker directories use descriptive page headings without changing their routes", () => {
  const pages = [
    ["ranking", "/ranking"],
    ["calendar", "/calendar"],
    ["clubs", "/clubs"],
    ["leagues", "/leagues"],
    ["blog", "/blog"],
    ["tools", "/tools"],
    ["glossary", "/glosario"],
    ["academy", "/academia"],
    ["elo-system", "/sistema-elo"],
    ["noticias", "/noticias"],
  ];
  for (const [file, path] of pages) {
    const source = load("src/pages/" + file + ".tsx");
    assert.match(source, /<ArenaPageHero/, file);
    assert.match(source, /highlight="(?:DE PÓKER\.|DEL PÓKER\.|PÓKER\.)"/, file);
    assert.ok(source.includes('path="' + path + '"'), file + ": stable URL");
    assert.match(source, /<PageShell variant="arena">/, file);
  }
});

test("HTML and structured data keep a clear poker platform description", () => {
  const html = load("index.html");
  const seo = load("src/components/seo/seo-head.tsx");
  const jsonld = load("src/components/seo/structured-data.tsx");
  assert.match(html, /<title>Sharkania \| Ranking ELO y torneos de póker online<\/title>/);
  assert.match(html, /<meta name="description" content="Sharkania reúne ranking ELO de póker/);
  assert.match(seo, /Ranking ELO y torneos de póker online/);
  assert.match(jsonld, /resultados de póker competitivo/);
  assert.match(seo, /isPreviewHost/);
  assert.match(seo, /noindex, nofollow/);
});

test("Comparison preserves its guest gate and premium controls", () => {
  const compare = load("src/pages/compare.tsx");
  assert.match(compare, /if \(!isAuthenticated\)/);
  assert.match(compare, /useFeatureAccess\("cosmetic_extended_stats"\)/);
  assert.match(compare, /const canSearch = hasPremiumAccess/);
  assert.match(compare, /section="compare"/);
  assert.match(compare, /Comparador de jugadores de póker/);
  assert.match(compare, /arena-compare-row/);
});

test("Academy and articles retain their behavior, SEO paths and rewards", () => {
  const module = load("src/pages/academy-module.tsx");
  const lesson = load("src/pages/academy-lesson.tsx");
  const article = load("src/pages/blog-post.tsx");
  assert.match(module, /useUnlockModule/);
  assert.match(module, /getUserLessonProgress/);
  assert.match(module, /onKeyDown=/);
  assert.match(module, /arena-module-header/);
  assert.match(lesson, /useCompleteLesson/);
  assert.match(lesson, /QuizComponent/);
  assert.match(lesson, /WptBanner/);
  assert.match(lesson, /arena-lesson-content/);
  assert.match(article, /getEditorialPath\(post\.category, post\.slug\)/);
  assert.match(article, /useArticleSchema/);
  assert.match(article, /RelatedPosts/);
  assert.match(article, /WptBanner/);
  assert.match(article, /claimBlogReward/);
  assert.match(article, /arena-article-title/);
});
