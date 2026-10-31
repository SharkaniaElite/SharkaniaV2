import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";

type Action = { action: "list" } | { action: "resend"; userId: string };
const allowedOrigins = new Set([
  "https://sharkania.com",
  "https://www.sharkania.com",
  "http://localhost:5173",
  "http://localhost:5174",
]);
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function headers(origin: string | null): HeadersInit {
  return {
    ...(origin && allowedOrigins.has(origin) ? { "Access-Control-Allow-Origin": origin } : {}),
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Max-Age": "600",
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Vary": "Origin",
    "X-Content-Type-Options": "nosniff",
  };
}

function json(status: number, payload: Record<string, unknown>, origin: string | null): Response {
  return new Response(JSON.stringify(payload), { status, headers: headers(origin) });
}

function escapeHtml(raw: string): string {
  return raw.replace(/[&<>"']/g, (char) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char] ?? char
  ));
}

function emailContent(displayName: string, actionLink: string): {
  subject: string; body_html: string; body_text: string;
} {
  const name = escapeHtml(displayName.trim().slice(0, 80) || "jugador");
  const link = escapeHtml(actionLink);
  const subject = "Te falta un paso: confirma tu cuenta de Sharkania";
  const body_html = \`<!doctype html>
<html lang="es"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:32px 12px;background:#090d12;color:#e7edf5;font-family:Arial,Helvetica,sans-serif">
  <div style="max-width:560px;margin:0 auto;border:1px solid #26303b;border-radius:14px;background:#121820;padding:32px">
    <div style="font-size:20px;font-weight:800;color:#22d3ee;margin-bottom:24px">🦈 SHARKANIA</div>
    <div style="font-size:12px;letter-spacing:2px;color:#fbbf24;font-weight:bold">TU REGISTRO ESTÁ CASI LISTO</div>
    <h1 style="font-size:28px;line-height:1.2;color:#fff;margin:12px 0 22px">Solo falta confirmar tu correo</h1>
    <p style="font-size:16px;line-height:1.7">Hola, <strong>\${name}</strong>:</p>
    <p style="font-size:16px;line-height:1.7">Tu cuenta de Sharkania ya está creada, pero <strong>todavía no has confirmado tu dirección de correo electrónico</strong>.</p>
    <p style="font-size:16px;line-height:1.7">Completa este último paso para iniciar sesión y explorar tu perfil, el ranking ELO, las ligas y los torneos disponibles.</p>
    <p style="margin:30px 0"><a href="\${link}" style="display:inline-block;background:#22d3ee;color:#071219;font-size:15px;font-weight:800;text-decoration:none;padding:16px 24px;border-radius:8px">CONFIRMAR MI CUENTA</a></p>
    <p style="color:#9aa8b7;font-size:13px;line-height:1.6">El enlace es personal, de un solo uso y expira por seguridad. Si caduca, puedes solicitar uno nuevo.</p>
    <hr style="border:0;border-top:1px solid #26303b;margin:28px 0">
    <p style="color:#9aa8b7;font-size:12px;line-height:1.6">Si no creaste una cuenta en Sharkania, puedes ignorar este mensaje. Nunca te pediremos tu contraseña por correo.</p>
  </div>
</body></html>\`;
  const body_text = [
    "SHARKANIA — Tu registro está casi listo",
    "",
    \`Hola, \${displayName.trim().slice(0, 80) || "jugador"}:\`,
    "",
    "Tu cuenta de Sharkania ya está creada, pero todavía no has confirmado tu dirección de correo electrónico.",
    "Completa este último paso para iniciar sesión y explorar tu perfil, el ranking ELO, las ligas y los torneos disponibles.",
    "",
    "CONFIRMAR MI CUENTA:",
    actionLink,
    "",
    "Este enlace es personal, de un solo uso y expira por seguridad.",
    "Si no creaste la cuenta, ignora este mensaje. Nunca te pediremos tu contraseña por correo.",
  ].join("\n");
  return { subject, body_html, body_text };
}

serve(async (request) => {
  const origin = request.headers.get("Origin");
  if (origin && !allowedOrigins.has(origin)) {
    return json(403, { error: "origin_not_allowed" }, origin);
  }
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: headers(origin) });
  if (request.method !== "POST") return json(405, { error: "method_not_allowed" }, origin);

  const jwt = request.headers.get("Authorization")?.match(/^Bearer\s+([^\s]+)$/i)?.[1];
  if (!jwt) return json(401, { error: "authentication_required" }, origin);
  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anon || !serviceRole) return json(503, { error: "service_unavailable" }, origin);

  try {
    const userClient = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: auth, error: authError } = await userClient.auth.getUser(jwt);
    if (authError || !auth.user?.id) return json(401, { error: "invalid_session" }, origin);

    // Authentication is not authorization: evaluate trusted SQL super-admin role with caller JWT.
    const roleResponse = await fetch(url + "/rest/v1/rpc/is_super_admin", {
      method: "POST",
      headers: { Authorization: "Bearer " + jwt, apikey: anon, "Content-Type": "application/json" },
      body: "{}",
    });
    if (!roleResponse.ok || await roleResponse.json().catch(() => false) !== true) {
      return json(403, { error: "super_admin_required" }, origin);
    }

    const input: unknown = await request.json().catch(() => null);
    if (!input || typeof input !== "object" || !("action" in input)) {
      return json(400, { error: "invalid_request" }, origin);
    }
    const body = input as Action;
    const privileged = createClient(url, serviceRole, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    if (body.action === "list") {
      const statuses: Record<string, boolean> = {};
      // Supabase Admin API pagination; never expose the entire auth.users record.
      for (let page = 1; page <= 30; page++) {
        const { data, error } = await privileged.auth.admin.listUsers({ page, perPage: 500 });
        if (error) return json(503, { error: "status_unavailable" }, origin);
        for (const user of data.users) statuses[user.id] = Boolean(user.email_confirmed_at);
        if (data.users.length < 500) return json(200, { statuses }, origin);
      }
      return json(503, { error: "status_pagination_limit" }, origin);
    }

    if (body.action !== "resend" || typeof body.userId !== "string" ||
        !uuidPattern.test(body.userId)) {
      return json(400, { error: "invalid_request" }, origin);
    }

    const { data: targetResult, error: targetError } =
      await privileged.auth.admin.getUserById(body.userId);
    const target = targetResult?.user;
    if (targetError || !target?.email) return json(404, { error: "account_not_found" }, origin);
    if (target.email_confirmed_at) return json(409, { error: "already_confirmed" }, origin);

    // Atomic reservation: one per hour, two per 24 hours across all administrators.
    const { data: reservation, error: reserveError } = await privileged.rpc(
      "reserve_email_confirmation_reminder",
      { p_target_user_id: target.id, p_requested_by: auth.user.id },
    );
    if (reserveError) return json(503, { error: "reminder_unavailable" }, origin);
    if (!reservation) return json(429, { error: "reminder_cooldown" }, origin);

    try {
      // Generate an authentic single-use Supabase link without changing the user's password.
      const { data: generated, error: generateError } = await privileged.auth.admin.generateLink({
        type: "magiclink",
        email: target.email,
      });
      const actionLink = generated?.properties?.action_link;
      const expectedOrigin = new URL(url).origin;
      if (generateError || !actionLink || new URL(actionLink).origin !== expectedOrigin ||
          new URL(actionLink).pathname !== "/auth/v1/verify") {
        throw new Error("unable_to_generate_confirmation_link");
      }

      const displayName = String(target.user_metadata?.display_name || "jugador");
      const content = emailContent(displayName, actionLink);
      const { error: queueError } = await privileged.from("email_queue").insert({
        recipient_email: target.email,
        subject: content.subject,
        body_html: content.body_html,
        body_text: content.body_text,
        status: "pending",
      });
      if (queueError) throw new Error("unable_to_queue_email");
      // The existing Cloudflare email Worker processes queued transactional emails.
      return json(202, { success: true, message: "Correo de confirmación en cola." }, origin);
    } catch (_error) {
      // No email queued: release reservation so admin can retry after operational failure.
      await privileged.from("email_verification_reminders").delete().eq("id", reservation);
      return json(503, { error: "email_queue_unavailable" }, origin);
    }
  } catch (_error) {
    return json(503, { error: "temporary_unavailable" }, origin);
  }
});
