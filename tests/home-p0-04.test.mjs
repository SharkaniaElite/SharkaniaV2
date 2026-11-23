import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import ts from "typescript";
import * as homeContent from "../src/lib/home-content.ts";
import * as editorial from "../src/lib/editorial-routing.ts";

const require = createRequire(import.meta.url);
const compiled = ts.transpileModule(readFileSync("src/pages/arena-home.tsx", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;

function renderHome(responses = {}, now = "2026-11-22T12:00:00Z", postsByCategory = {}) {
  const exports = {};
  const queries = new Map();
  const newsOptions = [];
  function stubImport(name) {
    switch (name) {
      case "@tanstack/react-query":
        return { useQuery: (query) => {
          const key = query.queryKey.at(-1);
          queries.set(key, query);
          return responses[key] ?? { isPending: true };
        }};
      case "../components/layout/page-shell":
        return { PageShell: ({ children }) => createElement("main", null, children) };
      case "../components/marketing/verified-banner-strip":
        return { VerifiedSecondaryBannerStrip: () => createElement("aside", { "aria-label": "Publicidad secundaria" }) };
      case "../components/seo/seo-head":
        return { SEOHead: ({ title, description }) => createElement("meta", { name: title, content: description }) };
      case "../lib/api/players":
        return { getPlayers: async () => ({ data: [], count: 0 }) };
      case "../lib/api/tournaments":
        return { getUpcomingTournaments: async () => [] };
      case "../lib/api/blog":
        return { getBlogPosts: async (options) => { newsOptions.push(options); return postsByCategory[options.category] ?? []; } };
      case "../lib/home-content": return homeContent;
      case "../lib/editorial-routing": return editorial;
      case "../lib/arena-preview": return { isArenaPreviewHost: () => false };
      case "./arena-home.css": return {};
      default: return require(name);
    }
  }
  class FixtureDate extends Date { static now() { return Date.parse(now); } }
  runInNewContext(compiled, { exports, require: stubImport, IntersectionObserver: class {}, Date: FixtureDate });
  const html = renderToStaticMarkup(createElement(MemoryRouter, null, createElement(exports.ArenaHomePage)));
  return { html, queries, newsOptions: () => JSON.parse(JSON.stringify(newsOptions)) };
}

test("home renders the approved order, destinations and editorial status", () => {
  const { html } = renderHome();
  assert.deepEqual([...html.matchAll(/<h1[^>]*>(.*?)<\/h1>/g)].map(( [, h1]) => h1.replace(/<[^>]+>/g, "")),
    ["Entiende el póker. Analiza tus decisiones."]);
  const sections = [
    'id="arena-hero-title"', 'id="home-pillars-title"', 'id="home-originals-title"',
    'id="home-study-title"', 'id="home-arena-title"', 'aria-label="Publicidad secundaria"',
    'id="home-news-title"', 'id="home-close-title"',
  ];
  const positions = sections.map((marker) => html.indexOf(marker));
  assert.ok(positions.every((position, index) => position > (positions[index - 1] ?? -1)));
  const destinations = (section) => [...section.matchAll(/href="([^"]+)"/g)].map(([, href]) => href);
  assert.deepEqual(destinations(html.slice(positions[1], positions[2])), ["/academia", "/tv", "/tools", "/ranking"]);
  assert.deepEqual(destinations(html.slice(positions[3], positions[4])), ["/academia", "/blog", "/tools", "/glosario"]);
  assert.deepEqual(destinations(html.slice(positions[2], positions[3])), ["/tv"]);
  assert.match(html, /Serie en preparación/);
  assert.doesNotMatch(html, /<iframe|<video|rumble\.com/);
  assert.deepEqual(destinations(html.slice(positions[7])), ["/register"]);
  assert.ok(html.includes(homeContent.HOME_DESCRIPTION));
});

test("home defers queries and requests recent news plus promotions separately", async () => {
  const { queries, newsOptions } = renderHome();
  assert.equal(queries.size, 3);
  for (const query of queries.values()) {
    assert.equal(query.enabled, false);
    assert.ok(query.staleTime >= 180_000);
  }
  await queries.get("news").queryFn();
  assert.deepEqual(newsOptions(), [{ category: "Noticias", limit: 3 }, { category: "Promociones", limit: 20 }]);
});

test("home includes verified WPT promo first but excludes unverified and expired promos", async () => {
  const posts = {
    Noticias: [
      { id: "news-1", slug: "recent-news", category: "Noticias", title: "Noticia reciente", published_at: "2026-11-22T12:00:00Z" },
      { id: "news-2", slug: "older-news", category: "Noticias", title: "Noticia anterior", published_at: "2026-11-21T12:00:00Z" },
    ],
    Promociones: [
      { id: "promo-unverified", slug: "unverified", category: "Promociones", title: "Sin revisión", published_at: "2026-11-23T13:00:00Z", tags: [] },
      { id: "promo-wpt", slug: "wpt-global-winter-wonderland-2026", category: "Promociones", title: "WPT Winter Wonderland", published_at: "2026-11-23T08:44:00Z",
        tags: ["verified-on:2026-11-23", "review-by:2026-11-29", "starts-on:2026-11-24", "official-end:2027-01-09"] },
      { id: "promo-expired", slug: "expired", category: "Promociones", title: "Caducada", published_at: "2026-11-23T07:00:00Z",
        tags: ["verified-on:2026-11-01", "review-by:2026-11-22", "official-end:2026-11-22"] },
    ],
  };
  const current = renderHome({}, "2026-11-23T12:00:00Z", posts);
  const featured = await current.queries.get("news").queryFn();
  assert.deepEqual(JSON.parse(JSON.stringify(featured.map((p) => p.slug))), ["wpt-global-winter-wonderland-2026", "recent-news", "older-news"]);
  const afterReview = renderHome({}, "2026-11-30T12:00:00Z", posts);
  const expired = await afterReview.queries.get("news").queryFn();
  assert.deepEqual(JSON.parse(JSON.stringify(expired.map((p) => p.slug))), ["recent-news", "older-news"]);
});

test("home preserves DEMO and detail links with data and useful fallback links on error", () => {
  const data = renderHome({
    "elo-top-3": { data: { count: 1, data: [{ id: "fixture", slug: "qa-player", nickname: "[DEMO] QA", elo_rating: 1450 }] } },
    "upcoming-events": { data: [{ id: "fixture", slug: "qa-event", name: "Torneo QA", start_datetime: "2026-11-30T23:00:00Z", status: "scheduled" }] },
    news: { data: [{ id: "fixture", slug: "qa-news", category: "Noticias", title: "Noticia QA" }] },
  }).html;
  assert.match(data, /href="\/ranking\/qa-player"/);
  assert.match(data, /Registro demo/);
  assert.match(data, /1\.450/);
  assert.match(data, /href="\/tournament\/qa-event"/);
  assert.match(data, /08:00 p\. m\./);
  assert.match(data, /href="\/noticias\/qa-news"/);
  const fallback = renderHome({
    "elo-top-3": { isError: true },
    "upcoming-events": { isError: true },
    news: { isError: true },
  }).html;
  assert.match(fallback, /No fue posible cargar la clasificación/);
  assert.match(fallback, /No pudimos consultar la agenda/);
  assert.match(fallback, /No fue posible cargar las publicaciones/);
  for (const route of ["/ranking", "/calendar", "/noticias"]) assert.ok(fallback.includes(`href="${route}"`));
});

test("home shows explicit empty states", () => {
  const empty = renderHome({
    "elo-top-3": { data: { count: 0, data: [] } },
    "upcoming-events": { data: [] },
    news: { data: [] },
  }).html;
  assert.match(empty, /Todavía no hay posiciones disponibles/);
  assert.match(empty, /No hay próximos eventos publicados/);
  assert.match(empty, /Pronto habrá nuevas publicaciones/);
});


test("the existing Arena league notice expires at the original cutoff", () => {
  const before = renderHome({}, "2026-11-27T02:59:59Z").html;
  assert.match(before, /id="home-featured-league-title"/);
  assert.ok(before.indexOf('id="home-featured-league-title"') < before.indexOf('aria-label="Publicidad secundaria"'));
  assert.doesNotMatch(renderHome({}, "2026-11-27T03:00:00Z").html, /id="home-featured-league-title"/);
});
