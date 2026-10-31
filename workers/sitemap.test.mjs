import test from "node:test";
import assert from "node:assert/strict";
import sitemapWorker, { buildSitemap } from "./sitemap.mjs";

const sample = {
  blog_posts: [{ slug: "poker-y-estrategia", category: "Estrategia", updated_at: "2026-10-20T10:00:00Z" },
               { slug: "fecha-1", category: "Noticias", updated_at: "2026-10-21T12:00:00Z" }],
  glossary_terms: [{ slug: "turn", updated_at: "2026-10-15T00:00:00Z" }],
  clubs: [{ slug: "osorno-poker", updated_at: "2026-10-17T00:00:00Z" }],
  leagues: [{ slug: "liga-octubre", updated_at: "2026-10-19T00:00:00Z" }],
  players: [{ slug: "jugador-1", updated_at: "2026-10-20T00:00:00Z" }],
  tournaments: [{ id: "00000000-0000-4000-8000-000000000001", updated_at: "2026-10-18T00:00:00Z" }],
};

function mockFetch(input) {
  const u = new URL(input);
  const table = u.pathname.split("/").at(-1);
  return Promise.resolve(new Response(JSON.stringify(sample[table] ?? []), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  }));
}

test("publishes all eligible public sections with valid canonical routes", async () => {
  const xml = await buildSitemap("test-key", mockFetch);
  assert.match(xml, /<loc>https:\/\/sharkania\.com\/academia<\/loc>/);
  assert.match(xml, /<loc>https:\/\/sharkania\.com\/tv<\/loc>/);
  assert.match(xml, /\/blog\/poker-y-estrategia<\/loc>/);
  assert.match(xml, /\/noticias\/fecha-1<\/loc>/);
  assert.match(xml, /\/clubs\/osorno-poker<\/loc>/);
  assert.match(xml, /\/glosario\/turn<\/loc>/);
  assert.match(xml, /\/leagues\/liga-octubre<\/loc>/);
  assert.match(xml, /\/ranking\/jugador-1<\/loc>/);
  assert.match(xml, /\/tournament\/00000000-0000-4000-8000-000000000001<\/loc>/);
  assert.doesNotMatch(xml, /sharkania\.com\/academy<\/loc>/);
  assert.doesNotMatch(xml, /sharkania\.com\/shark-tv<\/loc>/);
  assert.doesNotMatch(xml, /sharkania\.com\/tools\/quiz<\/loc>/);
});

test("fails completely rather than returning a truncated sitemap on API errors", async () => {
  await assert.rejects(
    buildSitemap("test-key", async () => new Response("not available", { status: 503 })),
    /Supabase query failed/,
  );
});

test("fetches all pages instead of silently truncating at Supabase max_rows", async () => {
  const calls = [];
  const fetcher = async input => {
    const url = new URL(input);
    const table = url.pathname.split("/").at(-1);
    if (table !== "players") return new Response("[]", { status: 200 });
    const offset = Number(url.searchParams.get("offset"));
    calls.push(offset);
    const count = offset === 0 ? 500 : offset === 500 ? 1 : 0;
    const body = Array.from({ length: count }, (_, n) => ({ slug: `p-${offset + n}` }));
    return new Response(JSON.stringify(body), { status: 200 });
  };
  const xml = await buildSitemap("test-key", fetcher);
  assert.deepEqual(calls, [0, 500]);
  assert.match(xml, /\/ranking\/p-500<\/loc>/);
});

test("returns retryable 503 rather than a cacheable 200 when Supabase fails", async () => {
  const originalFetch = globalThis.fetch;
  const originalCaches = globalThis.caches;
  globalThis.fetch = async () => new Response("unavailable", { status: 503 });
  globalThis.caches = { default: { match: async () => null, put: async () => {} } };
  try {
    const resp = await sitemapWorker.fetch(new Request("https://sharkania.com/sitemap.xml"), { SUPABASE_ANON_KEY: "test" }, { waitUntil() {} });
    assert.equal(resp.status, 503);
    assert.equal(resp.headers.get("Cache-Control"), "no-store");
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.caches = originalCaches;
  }
});

test("includes public evergreen poker tutorials and matches React Router", async () => {
  const xml = await buildSitemap("test-key", mockFetch);
  const app = (await import("node:fs")).readFileSync("src/App.tsx", "utf8");
  for (const path of [
    "/como-jugar-en-clubgg",
    "/tutorial-ignition",
    "/tutorial-ignition-deposit",
    "/tutorial-coinpoker",
  ]) {
    assert.match(app, new RegExp('path="' + path + '"'));
    assert.ok(xml.includes("<loc>https://sharkania.com" + path + "</loc>"), path);
  }
  // Private flows and premium authenticated tools remain excluded.
  for (const privatePath of ["/dashboard", "/login", "/register", "/tools/replayer"]) {
    assert.ok(!xml.includes("<loc>https://sharkania.com" + privatePath + "</loc>"), privatePath);
  }
});
