import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ignition = readFileSync("src/pages/ignition-championship.tsx", "utf8");

test("signed-in users can read public league rules without forced redirection", () => {
  assert.doesNotMatch(ignition, /useEffect\(\(\) => \{\s*if \(isAuthenticated\)/);
  assert.match(ignition, /\{isAuthenticated \? \(/);
  assert.match(ignition, /Ya eres parte de Sharkania/);
  assert.match(ignition, /to="\/dashboard\?highlight=ignition"/);
});

test("anonymous users keep existing registration, login and anti-bot protections", () => {
  assert.match(ignition, /<form onSubmit=\{handleSubmit\}/);
  assert.match(ignition, /<Turnstile/);
  assert.match(ignition, /disabled=\{\(!isExistingUser && !captchaToken\) \|\| loading\}/);
  assert.match(ignition, /Nuevo en Sharkania/);
  assert.match(ignition, /Ya tengo cuenta/);
});
