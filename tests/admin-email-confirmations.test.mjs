import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { transform } from "esbuild";

const handler = readFileSync("supabase/functions/admin-email-confirmations/index.ts", "utf8");
const migration = readFileSync("supabase/migrations/20261031195701_admin_email_verification_reminder_limits.sql", "utf8");
const adminPage = readFileSync("src/pages/super-admin.tsx", "utf8");
const config = readFileSync("supabase/config.toml", "utf8");

test("confirmation reminder edge function parses as TypeScript", async () => {
  const compiled = await transform(handler, { loader: "ts", target: "es2022" });
  assert.ok(compiled.code.includes("emailContent"));
});

test("auth confirmation statuses come from Auth Admin and require a verified super-admin JWT", () => {
  assert.match(handler, /userClient\.auth\.getUser\(jwt\)/);
  assert.match(handler, /\/rest\/v1\/rpc\/is_super_admin/);
  assert.match(handler, /roleResponse\.json\(\)/);
  assert.match(handler, /privileged\.auth\.admin\.listUsers/);
  assert.match(handler, /Boolean\(user\.email_confirmed_at\)/);
  assert.match(handler, /privileged\.auth\.admin\.getUserById\(body\.userId\)/);
  assert.match(handler, /if \(target\.email_confirmed_at\)/);
  assert.ok(handler.indexOf("is_super_admin") < handler.indexOf("privileged.auth.admin.listUsers"));
});

test("recovery message uses a real one-time Supabase auth link, without browser secrets", () => {
  assert.match(handler, /generateLink\(\{/);
  assert.match(handler, /type: "magiclink"/);
  assert.match(handler, /generated\?\.properties\?\.action_link/);
  assert.match(handler, /new URL\(actionLink\)\.origin !== expectedOrigin/);
  assert.match(handler, /privileged\.from\("email_queue"\)\.insert/);
  assert.match(handler, /Todav[ií]a no has confirmado tu direcci[oó]n de correo|todav[ií]a no has confirmado tu direcci[oó]n de correo/i);
  assert.match(handler, /CONFIRMAR MI CUENTA/);
  assert.match(handler, /Si no creaste una cuenta en Sharkania, puedes ignorar/);
  assert.match(handler, /escapeHtml\(displayName/);
  assert.match(handler, /escapeHtml\(actionLink\)/);
  assert.doesNotMatch(adminPage, /SERVICE_ROLE_KEY|RESEND_API_KEY|generateLink\(/);
});

test("reminders have atomic global rate limits and no direct browser access to log", () => {
  assert.match(migration, /ENABLE ROW LEVEL SECURITY/);
  assert.match(migration, /REVOKE ALL ON TABLE public\.email_verification_reminders FROM PUBLIC, anon, authenticated/);
  assert.match(migration, /GRANT SELECT, INSERT, DELETE ON TABLE public\.email_verification_reminders TO service_role/);
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.match(migration, /INTERVAL '1 hour'/);
  assert.match(migration, /INTERVAL '24 hours'/);
  assert.match(migration, /v_daily_count >= 2/);
  assert.match(migration, /SECURITY INVOKER/);
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.reserve_email_confirmation_reminder\(uuid,uuid\)/);
  assert.match(handler, /reserve_email_confirmation_reminder/);
  assert.match(handler, /!reservation\) return json\(429/);
  assert.match(handler, /email_verification_reminders"\)\.delete/);
});

test("admin UI shows true confirmation badges and an action only for pending users", () => {
  assert.match(adminPage, /admin-email-confirmations/);
  assert.match(adminPage, /action: "list"/);
  assert.match(adminPage, /action: "resend"/);
  assert.match(adminPage, /emailConfirmations\?\.\[p\.id\] === true/);
  assert.match(adminPage, /emailConfirmations\?\.\[p\.id\] === false/);
  assert.match(adminPage, /emailConfirmations\?\.\[selectedUser\.id\] === false/);
  assert.match(adminPage, /Reenviar confirmación/);
  assert.match(config, /\[functions\.admin-email-confirmations\]/);
  assert.match(config, /verify_jwt = false/);
});
