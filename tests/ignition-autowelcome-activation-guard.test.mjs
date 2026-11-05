import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {test} from "node:test";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const migration=read("supabase/migrations/20261105190000_ignition_autowelcome_opt_in_verified.sql");
const admin=read("src/components/admin/ignition-claims-tab.tsx");
const registration=read("src/pages/ignition-championship.tsx");

test("Automatic welcome is disabled by default; only superadmin can enable template",()=>{
  assert.match(migration,/enabled boolean NOT NULL DEFAULT false/);
  assert.match(migration,/VALUES\(1,false,'',''\)/);
  assert.match(migration,/IF NOT public\.is_super_admin\(\)/);
  assert.match(migration,/REVOKE ALL ON TABLE private\.ignition_auto_welcome_settings/);
  assert.match(migration,/save_ignition_auto_welcome_settings/);
  assert.match(migration,/p_body_text ~\*/);
  assert.match(admin,/Guardar configuración automática/);
  assert.match(admin,/window\.confirm\("¿Activar el envío automático/);
});
test("Auto mail requires VERIFIED identity, confirmed address, and new linking after activation",()=>{
  assert.match(migration,/private\.enqueue_ignition_auto_welcome/);
  assert.match(migration,/p\.ignition_status='verified'/);
  assert.match(migration,/u\.email_confirmed_at IS NOT NULL/);
  assert.match(migration,/p\.ignition_linked_at>=v_enabled_at/);
  assert.match(migration,/ON CONFLICT\(campaign_key,recipient_user_id\)/);
  assert.match(migration,/DO NOTHING/);
  assert.match(migration,/SELECT 'ignition-2026-11-welcome'/);
  assert.match(migration,/cron\.schedule\(/);
  assert.match(migration,/REVOKE ALL ON FUNCTION private\.enqueue_ignition_auto_welcome/);
});
test("Manual verification is restricted to superadmin and checks email and nickname",()=>{
  assert.match(migration,/verify_ignition_pending_player/);
  assert.match(migration,/v_confirmed IS NULL/);
  assert.match(migration,/v_status <> 'pending'/);
  assert.match(migration,/nick.*verificado en otra cuenta/i);
  assert.match(admin,/rpc\("verify_ignition_pending_player"/);
  assert.match(admin,/Validar vinculación/);
});
test("New registration does not prematurely promise immediate passwords",()=>{
  assert.match(registration,/Tu vinculación de Ignition quedará pendiente de validación/);
  assert.match(registration,/bienvenida automática esté habilitada/);
  assert.doesNotMatch(registration,/confirmar tu cuenta y recibir las contraseñas\./);
});
test("Auto welcome and manual welcome share same per-player campaign key",()=>{
  const current=read("src/components/admin/ignition-claims-tab.tsx");
  assert.match(current,/ignition-2026-11-welcome/);
  assert.match(migration,/SELECT 'ignition-2026-11-welcome'/);
  assert.match(admin,/rpc\("get_ignition_auto_welcome_settings"/);
  assert.match(admin,/rpc\("save_ignition_auto_welcome_settings"/);
  assert.match(admin,/Solo afecta a quienes se vinculen DESPUÉS de activar la función/);
});
