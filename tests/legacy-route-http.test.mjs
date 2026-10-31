import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import typescript from "typescript";

const source = readFileSync("functions/_middleware.ts", "utf8");
const compiled = typescript.transpileModule(source, {
  compilerOptions: {
    module: typescript.ModuleKind.CommonJS,
    target: typescript.ScriptTarget.ES2022,
  },
}).outputText;

function loadMiddleware(fetchMock) {
  const exports = {};
  class MockHTMLRewriter {
    on(selector, handlers) {
      if (selector === 'meta[property="og:image"]') this.onOgImage = handlers.element;
      return this;
    }
    transform(response) {
      if (this.onOgImage) {
        this.onOgImage({
          setAttribute(name, value) {
            if (name === "content") response.headers.set("x-test-og-image", value);
          },
        });
      }
      return response;
    }
  }
  runInNewContext(compiled, {
    exports, Response, URL, Headers, fetch: fetchMock, HTMLRewriter: MockHTMLRewriter,
  });
  return exports.onRequest;
}

function makeContext(path, options = {}) {
  return {
    request: new Request("https://sharkania.com" + path, { method: options.method || "GET" }),
    env: { SUPABASE_ANON_KEY: options.key === undefined ? "test-public-key" : options.key },
    next: async () => new Response("<!doctype html><html><head></head><body><div id='root'></div></body></html>", {
      headers: { "content-type": "text/html; charset=utf-8" },
    }),
  };
}

function fakeSupabase(url) {
  const request = new URL(url);
  if (request.pathname.endsWith("/players")) {
    if (request.searchParams.get("slug") === "eq.chunlix") {
      return Promise.resolve(Response.json([{ slug: "chunlix", nickname: "chunlix", total_tournaments: 5, elo_rating: 1126 }]));
    }
  }
  if (request.pathname.endsWith("/blog_posts") && request.searchParams.get("slug") === "eq.valid-news") {
    return Promise.resolve(Response.json([{
      slug: "valid-news", title: "Noticia válida", excerpt: "Contenido público",
      category: "Noticias", body: [],
    }]));
  }
  return Promise.resolve(Response.json([]));
}

test("legacy /jugador route redirects a real player to /ranking preserving query", async () => {
  const middleware = loadMiddleware(fakeSupabase);
  const response = await middleware(makeContext("/jugador/chunlix?utm_source=google"));
  assert.equal(response.status, 301);
  assert.equal(response.headers.get("location"), "https://sharkania.com/ranking/chunlix?utm_source=google");
});

test("removed /jugador route returns HTTP 404 rather than rendering /blog", async () => {
  const middleware = loadMiddleware(fakeSupabase);
  const response = await middleware(makeContext("/jugador/lima-legend"));
  assert.equal(response.status, 404);
  assert.equal(response.headers.get("x-robots-tag"), "noindex");
  assert.match(await response.text(), /Jugador no encontrado/);
});

test("legacy player HEAD requests and temporary database failures are handled explicitly", async () => {
  const middleware = loadMiddleware(fakeSupabase);
  const headResponse = await middleware(makeContext("/jugador/lima-legend", { method: "HEAD" }));
  assert.equal(headResponse.status, 404);
  assert.equal(await headResponse.text(), "");
  const outage = loadMiddleware(async () => { throw new Error("temporary upstream outage"); });
  const unavailable = await outage(makeContext("/jugador/chunlix"));
  assert.equal(unavailable.status, 503);
  assert.equal(unavailable.headers.get("retry-after"), "300");
});

test("missing blog, news and promotion articles return HTTP 404, not SPA fallback", async () => {
  const middleware = loadMiddleware(fakeSupabase);
  for (const prefix of ["/blog", "/noticias", "/promociones"]) {
    const response = await middleware(makeContext(prefix + "/nonexistent-article"));
    assert.equal(response.status, 404, prefix);
    assert.equal(response.headers.get("x-robots-tag"), "noindex", prefix);
  }
});

test("three standalone promotion landings and an existing news article stay HTTP 200", async () => {
  const middleware = loadMiddleware(fakeSupabase);
  for (const slug of ["freeroll-diario", "ignition-bonus", "coinpoker"]) {
    const response = await middleware(makeContext("/promociones/" + slug));
    assert.equal(response.status, 200, slug);
    assert.equal(response.headers.get("x-test-og-image"), "https://sharkania.com/og-default.png?v=2", slug + " OG image");
    const withSlash = await middleware(makeContext("/promociones/" + slug + "/"));
    assert.equal(withSlash.status, 200, slug + " with trailing slash");
  }
  const news = await middleware(makeContext("/noticias/valid-news"));
  assert.equal(news.status, 200);
});

test("missing database on a dynamic article is HTTP 503 instead of claiming it is deleted", async () => {
  const outage = loadMiddleware(async () => { throw new Error("temporary upstream outage"); });
  const response = await outage(makeContext("/noticias/a-valid-but-temporarily-unavailable-news"));
  assert.equal(response.status, 503);
  assert.equal(response.headers.get("retry-after"), "300");
});
