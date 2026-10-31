import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { build } from "esbuild";

const compiled = await build({
  entryPoints: ["src/lib/format.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  write: false,
});
const encoded = Buffer.from(compiled.outputFiles[0].text).toString("base64");
const { translateAuthError } = await import("data:text/javascript;base64," + encoded);

test("Supabase's actual weak-password signup rejection is explained in Spanish", () => {
  const message = translateAuthError(
    "Password is known to be weak and easy to guess, please choose a different one."
  );
  assert.match(message, /contraseña/i);
  assert.match(message, /común|adivinar/i);
  assert.match(message, /nueva y única/i);
  assert.doesNotMatch(message, /error inesperado/i);
});

test("other password-security errors and known Auth errors remain understandable", () => {
  for (const error of [
    "Password is known to be leaked",
    "Password has been found in a data breach",
    "weak_password",
    "Password has been compromised",
  ]) {
    assert.match(translateAuthError(error), /contraseña/i);
    assert.doesNotMatch(translateAuthError(error), /error inesperado/i);
  }
  assert.match(translateAuthError("User already registered"), /correo ya está registrado/i);
  assert.match(translateAuthError("invalid login credentials"), /contraseña incorrectos/i);
  assert.match(translateAuthError("captcha verification failed"), /Captcha/i);
  assert.match(translateAuthError("unrecognized internal error"), /error inesperado/i);
});

test("registration shows password guidance without weakening Supabase Auth", () => {
  const src = readFileSync("src/pages/register.tsx", "utf8");
  assert.match(src, /autoComplete="new-password"/);
  assert.match(src, /register-password-hint/);
  assert.match(src, /no se permiten contraseñas comunes o filtradas/);
  assert.match(src, /minLength=\{6\}/);
  assert.match(src, /captchaToken/);
  assert.match(src, /translateAuthError\(rawMessage\)/);
});
