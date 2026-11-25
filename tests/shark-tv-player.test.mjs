import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import ts from "typescript";
import * as sharkTv from "../src/lib/shark-tv.ts";

const require = createRequire(import.meta.url);
const source = readFileSync(new URL("../src/pages/hand-review.tsx", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;

function renderEpisode(episode) {
  let seo;
  const imports = {
    "@tanstack/react-query": { useQuery: () => ({ data: episode }) },
    "../components/layout/page-shell": { PageShell: ({ children }) => children },
    "../components/seo/seo-head": { SEOHead: (props) => { seo = props; return null; } },
    "../components/shark-tv/episode-cover": { EpisodeCover: () => createElement("div", { "data-cover": true }) },
    "../components/ui/button": { Button: ({ children }) => createElement("button", null, children) },
    "../components/ui/badge": { Badge: ({ children }) => createElement("span", null, children) },
    "../lib/api/shark-tv": { sharkTvQueryKey: ["shark-tv"] },
    "../lib/arena-preview": { isArenaPreviewHost: () => true },
    "../lib/shark-tv": sharkTv,
    "./shark-tv.css": {},
  };
  const exports = {};
  runInNewContext(compiled, { exports, require: name => imports[name] ?? require(name) });
  const html = renderToStaticMarkup(createElement(
    MemoryRouter,
    { initialEntries: [sharkTv.episodePath(episode.id)] },
    createElement(Routes, null, createElement(Route, {
      path: "/tv/:id",
      element: createElement(exports.HandReviewPage),
    })),
  ));
  return { html, seo };
}

test("the first render mounts the official Rumble iframe and keeps the external link and SEO", () => {
  const { html, seo } = renderEpisode(sharkTv.CLERIGO_EPISODE);
  assert.match(html, /<iframe src="https:\/\/rumble\.com\/embed\/v7gq0y0\/\?pub=4par2u"/);
  assert.match(html, /allow="autoplay; fullscreen; encrypted-media; picture-in-picture"/);
  assert.match(html, /allowfullscreen=""/i);
  assert.match(html, /Ver en Rumble/);
  assert.doesNotMatch(html, /Cargar reproductor|loading="lazy"|data-cover|[?&]mute=/);
  assert.equal(seo.ogVideo, sharkTv.CLERIGO_EPISODE.video_url);
  assert.equal(seo.path, "/tv/clerigo-analiza-01");
  assert.equal(seo.noIndex, true);
});

test("episodes without an official player keep their cover and safe external playback", () => {
  const { html, seo } = renderEpisode({
    ...sharkTv.CLERIGO_EPISODE,
    id: "archived",
    video_url: "https://rumble.com/vabc-watch.html",
    table_context: null,
  });
  assert.match(html, /data-cover/);
  assert.match(html, /href="https:\/\/rumble\.com\/vabc-watch\.html"/);
  assert.doesNotMatch(html, /<iframe|Cargar reproductor/);
  assert.equal(seo.ogVideo, undefined);
});
