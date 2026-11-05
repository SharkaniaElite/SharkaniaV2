import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {test} from "node:test";
import {transform} from "esbuild";

const read = (path) => readFileSync(new URL("../"+path,import.meta.url),"utf8");
const landing = read("src/pages/ignition-championship.tsx");
const dashboard = read("src/pages/player-dashboard.tsx");
const dialog = read("src/components/players/ignition-link-notice.tsx");
const statuses = read("src/lib/ignition-link-status.ts");
const migration = read("supabase/migrations/20261105195500_request_my_ignition_link_secure.sql");

const transformed = await transform(statuses,{loader:"ts",format:"esm",target:"es2022"});
const {ignitionFlowStatus,ignitionNotices} = await import("data:text/javascript;base64,"+
  Buffer.from(transformed.code).toString("base64"));

test("Linked, pending and unlinked statuses use only verified profile data",()=>{
  assert.equal(ignitionFlowStatus({ignition_league_player:true,ignition_status:"verified"}),"linked");
  assert.equal(ignitionFlowStatus({ignition_league_player:true,ignition_status:"pending"}),"pending");
  assert.equal(ignitionFlowStatus({ignition_league_player:false,ignition_status:"verified"}),"needs-link");
  assert.equal(ignitionFlowStatus({ignition_league_player:true,ignition_status:"rejected"}),"needs-link");
  assert.equal(ignitionFlowStatus(null),"needs-link");
  assert.match(ignitionNotices.linked.title,/ya está vinculada/);
  assert.match(ignitionNotices["needs-link"].description,/premios bounty/);
  assert.match(ignitionNotices["needs-link"].description,/premios finales/);
});
test("Existing /ignition login only authenticates and routes to real account status",()=>{
  const existing = landing.slice(landing.indexOf("// FLUJO 1: LOGIN"), landing.indexOf("// FLUJO 2: SIGN UP"));
  assert.match(existing,/signInWithPassword/);
  assert.match(existing,/getProfile\(data.session.user.id\)/);
  assert.match(existing,/navigate\("\/dashboard\?highlight=ignition"/);
  assert.doesNotMatch(existing,/check_ignition_duplicate|ignition_status:|'pending'|signOut\(|profiles'\)\.update/);
  assert.match(landing,/ignitionFlowStatus\(signedInProfile\)/);
  assert.match(landing,/crearemos tu cuenta en Sharkania y registraremos una solicitud/);
});
test("Player dashboard redirects to the right notice and links through server RPC",()=>{
  assert.match(dashboard,/new URLSearchParams\(location.search\)/);
  assert.match(dashboard,/setIgnitionNoticeOpen\(true\)/);
  assert.match(dashboard,/ignitionFlowStatus\(profile\)/);
  assert.match(dashboard,/<IgnitionLinkNotice/);
  assert.match(dashboard,/ignitionPanelRef\.current\?\.scrollIntoView/);
  assert.match(dashboard,/ignitionEmailInputRef\.current\?\.focus/);
  assert.match(dashboard,/rpc\("request_my_ignition_link"/);
  assert.doesNotMatch(dashboard,/\.rpc\("check_ignition_duplicate"/);
  assert.doesNotMatch(dashboard,/ignition_status: 'pending'/);
  assert.doesNotMatch(dashboard,/user\?\.user_metadata\?\.ignition_email/);
  assert.doesNotMatch(dashboard,/user\?\.user_metadata\?\.ignition_nickname/);
});
test("An accessible dialog distinguishes verified vs pending and unlinked states",()=>{
  assert.match(dialog,/role="dialog"/);
  assert.match(dialog,/aria-modal="true"/);
  assert.match(dialog,/data-ignition-notice=\{status\}/);
  assert.match(dialog,/onProceed/);
  assert.match(dialog,/event.key === "Escape"/);
  assert.match(dialog,/ignitionNotices\[status\]/);
});
test("Self-service SQL requires auth.uid, confirmed account and preserves verified records",()=>{
  assert.match(migration,/v_user uuid := auth\.uid\(\)/);
  assert.match(migration,/WHERE p.id=v_user FOR UPDATE/);
  assert.match(migration,/IF v_status='verified' AND v_linked IS TRUE THEN/);
  assert.match(migration,/RETURN jsonb_build_object\('status','already_linked'\)/);
  assert.match(migration,/email_confirmed_at IS NOT NULL/);
  assert.match(migration,/other\.id<>v_user/);
  assert.match(migration,/pg_advisory_xact_lock/);
  assert.match(migration,/ignition_status='pending'/);
  assert.match(migration,/REVOKE EXECUTE ON FUNCTION/);
  assert.match(migration,/TO authenticated, service_role/);
});
