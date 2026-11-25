import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CLERIGO_EPISODE, episodePath, getEpisodePlayback, getEpisodeThumbnail, getRumbleEmbed,
  selectSharkTvEpisodes, validateEpisode, videoStructuredData,
} from "../src/lib/shark-tv.ts";

const archiveEpisode = {
  ...CLERIGO_EPISODE,
  id: "archive",
  title: "Fixture de un capítulo anterior",
  table_context: { board: ["9s", "2c", "Ac"], analysis_verdict: "Revisar la mano." },
  video_url: "https://rumble.com/embed/vabc123/?pub=archive",
};

test("launch uses the official player URL and a separate public fallback", () => {
  assert.equal(episodePath(CLERIGO_EPISODE.id), "/tv/clerigo-analiza-01");
  assert.equal(CLERIGO_EPISODE.duration, "6:18");
  const playback = getEpisodePlayback(CLERIGO_EPISODE);
  assert.equal(playback.embed, "https://rumble.com/embed/v7gq0y0/?pub=4par2u");
  assert.match(playback.externalUrl, /^https:\/\/rumble\.com\/v7iwdvi-/);
  assert.equal(getRumbleEmbed(playback.externalUrl), null);
});

test("embed normalization accepts only HTTPS Rumble player paths and removes autoplay", () => {
  assert.equal(getRumbleEmbed("https://www.rumble.com/embed/vabc123?autoplay=1&pub=demo#foo"),
    "https://rumble.com/embed/vabc123/?pub=demo");
  for (const invalid of ["javascript:alert(1)", "http://rumble.com/embed/vabc/",
    "https://rumble.com.example.org/embed/vabc/", "https://other@rumble.com/embed/vabc/",
    "https://rumble.com:8443/embed/vabc/", "https://rumble.com/embed/vabc/extra/"]) {
    assert.equal(getRumbleEmbed(invalid), null, invalid);
  }
  assert.equal(getEpisodeThumbnail("data:text/html,unsafe"), null);
  assert.deepEqual(getEpisodePlayback({ ...archiveEpisode, video_url: "https://rumble.com/vabc-watch.html" }),
    { embed: null, externalUrl: "https://rumble.com/vabc-watch.html", rumble: true });
});

test("catalog keeps archives, merges the stored launch without duplicates and lets admins feature another episode", () => {
  const stored = { ...CLERIGO_EPISODE, id: "stored-launch", thumbnail_url: "https://example.org/thumbnail.jpg" };
  const duplicate = { ...stored, id: "duplicate" };
  const catalog = selectSharkTvEpisodes([stored, duplicate, archiveEpisode]);
  assert.equal(catalog.featured.id, "stored-launch");
  assert.equal(catalog.featured.thumbnail_url, stored.thumbnail_url);
  assert.deepEqual(catalog.archive.map(episode => episode.id), ["archive"]);
  const featured = { ...archiveEpisode, table_context: { featured: true } };
  assert.equal(selectSharkTvEpisodes([featured]).featured.id, "archive");
  assert.equal(selectSharkTvEpisodes([featured]).archive[0].id, CLERIGO_EPISODE.id);
  assert.equal(selectSharkTvEpisodes([]).featured.id, CLERIGO_EPISODE.id);
});

test("editor uses legacy table fields and retains context while validating new media", () => {
  const clean = validateEpisode({ ...archiveEpisode, table_context: {
    ...archiveEpisode.table_context, series: "Serie", description: "Un análisis", featured: true,
  } });
  assert.equal(clean.video_url, archiveEpisode.video_url);
  assert.deepEqual(clean.table_context.board, ["9s", "2c", "Ac"]);
  assert.equal(clean.table_context.series, "Serie");
  assert.equal(clean.table_context.featured, true);
  assert.equal(Object.hasOwn(clean, "id"), false);
  assert.throws(() => validateEpisode({ ...archiveEpisode, duration: "6:99" }));
  assert.throws(() => validateEpisode({ ...archiveEpisode, video_url: "https://fake-rumble.example/embed/vabc/" }));
  assert.throws(() => validateEpisode({ ...archiveEpisode, table_context: { hero_cards: ["9s", 42] } }));
  assert.throws(() => validateEpisode({ ...archiveEpisode, table_context: { public_url: "https://example.org/video" } }));
});

test("schema is generated only when publication date, thumbnail and embed are known", () => {
  assert.equal(videoStructuredData(CLERIGO_EPISODE), null);
  const data = videoStructuredData({
    ...archiveEpisode, thumbnail_url: "https://example.org/archive.jpg", created_at: "2026-11-25T15:00:00Z",
  });
  assert.equal(data["@type"], "VideoObject");
  assert.equal(data.duration, "PT6M18S");
  assert.equal(data.uploadDate, "2026-11-25T15:00:00.000Z");
  assert.equal(data.embedUrl, archiveEpisode.video_url);
});
