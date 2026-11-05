import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { transform } from "esbuild";

const workerSource = readFileSync("workers/email-worker.mjs","utf8");
const workerModuleUrl = "data:text/javascript;base64," + Buffer.from(workerSource).toString("base64");
const { linkifyPlainUrlsInHtml } = await import(workerModuleUrl);

const helperSource = readFileSync("src/lib/email-rendering.ts","utf8");
const transformed = await transform(helperSource,{loader:"ts",format:"esm",target:"es2022"});
const helperModuleUrl = "data:text/javascript;base64," + Buffer.from(transformed.code).toString("base64");
const { escapeNewsletterHtml, newsletterTextToHtml, safeNewsletterUrl } = await import(helperModuleUrl);

test("Ignition email: URLs in plain text become clickable anchors",()=>{
  const raw = "<p>Bases: https://sharkania.com/noticias/bases-oficiales-liga-sharkania-noviembre-2026<br/>Directo: https://www.twitch.tv/sharkania_oficial</p>";
  const html = linkifyPlainUrlsInHtml(raw);
  assert.match(html,/href="https:\/\/sharkania\.com\/noticias\/bases-oficiales-liga-sharkania-noviembre-2026"/);
  assert.match(html,/href="https:\/\/www\.twitch\.tv\/sharkania_oficial"/);
  assert.equal((html.match(/<a href=/g)||[]).length,2);
  assert.match(html,/<br\/>/);
});
test("Newsletter already has a clickable button; do not create nested links",()=>{
  const html = '<a href="https://sharkania.com/ignition" style="color:#fff">Inscribirme</a><p>Bases: https://sharkania.com/noticias/bases-oficiales-liga-sharkania-noviembre-2026.</p>';
  const out = linkifyPlainUrlsInHtml(html);
  assert.match(out,/<a href="https:\/\/sharkania\.com\/ignition" style="color:#fff">Inscribirme<\/a>/);
  assert.equal((out.match(/<a href=/g)||[]).length,2);
  assert.match(out,/<\/a>\.<\/p>$/);
});
test("Do not linkify HTML attributes or dangerous protocols",()=>{
  const html = '<img src="https://sharkania.com/logo.svg" alt="logo"><p>javascript:alert(1)</p><style>url(https://sharkania.com/ignore)</style>';
  const out = linkifyPlainUrlsInHtml(html);
  assert.equal(out,html);
});
test("Encoded query parameters stay encoded safely, and punctuation is excluded",()=>{
  const out = linkifyPlainUrlsInHtml("<p>https://sharkania.com/ignition?a=1&amp;b=2, luego.</p>");
  assert.match(out,/href="https:\/\/sharkania\.com\/ignition\?a=1&amp;b=2"/);
  assert.match(out,/<\/a>, luego\.<\/p>$/);
});
test("Newsletter editor text is escaped before being assembled into an email",()=>{
  assert.equal(escapeNewsletterHtml('<img src=x onerror="alert(1)">'),'&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
  assert.equal(newsletterTextToHtml("Hola & hola\nhttps://sharkania.com/ignition"),"Hola &amp; hola<br/>https://sharkania.com/ignition");
});
test("Only safe HTTPS destinations are accepted for newsletter buttons",()=>{
  assert.equal(safeNewsletterUrl("https://sharkania.com/ignition"),"https://sharkania.com/ignition");
  assert.equal(safeNewsletterUrl("https://www.twitch.tv/sharkania_oficial"),"https://www.twitch.tv/sharkania_oficial");
  assert.equal(safeNewsletterUrl("javascript:alert(1)"),null);
  assert.equal(safeNewsletterUrl("http://sharkania.com/ignition"),null);
  assert.equal(safeNewsletterUrl("https://user:pass@sharkania.com/"),null);
  assert.equal(safeNewsletterUrl("/ignition"),null);
});
