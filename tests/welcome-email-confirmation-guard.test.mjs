import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const welcome = read("src/pages/welcome.tsx");
const login = read("src/pages/login.tsx");
const headers = read("public/_headers");

test("welcome never announces confirmed email just because its route was opened", () => {
  assert.match(welcome, /supabase\.auth\.getUser\(\)/);
  assert.doesNotMatch(welcome, /getSession\(\)/);
  assert.match(welcome, /if \(error \|\| !data\.user\)/);
  assert.match(welcome, /if \(!data\.user\.email_confirmed_at\)/);
  assert.match(welcome, /setStatus\("pending"\)/);
  assert.match(welcome, /setStatus\("unknown"\)/);
  assert.match(welcome, /setStatus\("verified"\)/);
  assert.ok(welcome.indexOf('if (!data.user.email_confirmed_at)') < welcome.indexOf('setStatus("verified")'));
  assert.match(welcome, /\{verified && \(/);
  assert.match(welcome, /verified \? "\/dashboard" : "\/login"/);
  assert.match(welcome, /status === "checking"/);
  assert.match(welcome, /return \(\) => \{ active = false; \}/);
});

test("verification notices cannot mislead a person without a session", () => {
  assert.match(welcome, /No pudimos comprobar tu cuenta/);
  assert.match(welcome, /No encontramos una sesión válida/);
  assert.match(welcome, /Tu correo está pendiente/);
  assert.match(welcome, /Esta cuenta aún no registra/);
});

test("login and welcome are noindexed both by React and HTTP headers", () => {
  assert.match(login, /path="\/login"\s+noIndex/);
  assert.match(welcome, /path="\/welcome"\s+noIndex/);
  assert.match(headers, /\/login\s+X-Robots-Tag: noindex, nofollow/);
  assert.match(headers, /\/welcome\s+X-Robots-Tag: noindex, nofollow/);
});
