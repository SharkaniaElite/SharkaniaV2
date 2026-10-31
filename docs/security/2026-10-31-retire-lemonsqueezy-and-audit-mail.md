# Retiro de pagos de dinero real y auditoría de correo — 2026-10-31

## Decisiones confirmadas

- Sharkania **no vende Shark Coins ni acepta pagos de dinero real** en este proyecto.
- Conservar la tienda virtual que consume `spend_credits`, la Academia, los saldos y el registro de `credit_transactions`. Nunca borrar transacciones históricas como parte de esta limpieza.
- El webhook antiguo `lemonsqueezy-webhook` estaba desplegado públicamente en Supabase sin verificar firma del proveedor. Se sustituyó en producción por una función inerte que responde HTTP 410 y exige JWT; no puede emitir monedas. Esta rama retira sus fuentes y configuración local.
- La RPC heredada `public.add_credits_to_user(uuid, integer, text)` (única finalidad conocida: acreditar monedas contra un pedido de Lemon Squeezy) se retira mediante migración. Inspección de base: cero pedidos con `order_id`, cero transacciones `transaction_type='purchase'`, cero referencias de otras funciones y cero dependencias registradas.
- El Worker `sharkania-email-worker` de Cloudflare **usa Resend, no Amazon SES**: secretos `RESEND_API_KEY`, `ADMIN_TRIGGER_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, además de `SUPABASE_URL`. Cron `*/10 * * * *`. Dejarlo operativo.
- La cola de correo `public.email_queue` conserva los correos ya enviados. Se observó 1 fallido y 1.083 enviados al hacer el inventario.
- La inscripción y restablecimiento de contraseña siguen utilizando Supabase Auth; no alterar estas rutas.

## Acciones externas pendientes / límites

1. **Eliminar definitivamente** el recurso Edge Function `lemonsqueezy-webhook` desde Supabase Dashboard → Edge Functions, cuando se haya verificado el retiro. La API de la conexión disponible no permite borrarlo; en producción está neutralizado.
2. El inventario de Cloudflare Pages/Workers no muestra enlaces a Amazon SES ni secretos AWS para el Worker de correos. Esto **no equivale a auditar una cuenta AWS**: para cancelar identidades SES, claves IAM, reglas o cualquier recurso remoto sin uso se requiere entrar a la cuenta de Amazon AWS pertinente; no afirmar que ya se borraron.
3. No borrar `sharkania-email-worker`, `RESEND_API_KEY`, `email_queue`, las plantillas de correo ni las funciones de Auth sin otra auditoría de su tráfico.

## Validación

- CI: comprobaciones existentes de seguridad y SEO; test nuevo impide reintroducir los archivos/config de Lemon Squeezy.
- SQL: verificar que `to_regprocedure('public.add_credits_to_user(uuid,integer,text)') IS NULL` tras migrar.
- Cloudflare: verificar publicación de main; la limpieza es de backend y configuración, no modifica el reproductor ni el ranking.
