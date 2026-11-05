import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
const read = file => readFileSync(new URL("../"+file, import.meta.url),"utf8");
const data=read("src/lib/ignition-liga-fecha1.ts");
const asset=read("public/images/guias/ignition-liga-privada-fecha-1.svg");
const landing=read("src/pages/ignition-championship.tsx");
const panel=read("src/components/admin/ignition-claims-tab.tsx");
const newsletter=read("src/pages/super-admin.tsx");

test("Fecha 1 has precise search name, official ID, buy-in and date",()=>{
  assert.match(data,/Liga Privada - Fecha 1/);
  assert.match(data,/82905364/);
  assert.match(data,/2026-11-05/);
  assert.match(data,/3\.30/);
  assert.match(data,/guideUrl:/);
  for(const date of ["2026-11-12","2026-11-19","2026-11-26"]) assert.ok(data.includes(date));
  assert.match(data,/id: null/);
});
test("Published guide is accessible, readable and does not expose tournament password",()=>{
  assert.match(asset,/<svg xmlns=/);
  assert.match(asset,/role="img" aria-labelledby/);
  assert.match(asset,/Torneos Programados/);
  assert.match(asset,/Liga Privada - Fecha 1/);
  assert.match(asset,/#82905364/);
  assert.match(asset,/ID de las fechas 2, 3 y 4/);
  assert.doesNotMatch(asset,/>SHARKANIA<|>TIBURON<|>REKIN</);
});
test("Landing includes the search instruction and the guide without touching registration",()=>{
  assert.match(landing,/Guía ilustrada para localizar/);
  assert.match(landing,/IGNITION_FECHA1\.guidePath/);
  assert.match(landing,/ID #82905364/);
  assert.match(landing,/setSuccess/);
  assert.match(landing,/check_ignition_duplicate/);
});
test("Admin can append official guidance to welcome/date 1, not send on load",()=>{
  assert.match(panel,/fecha1AccessInstructions/);
  assert.match(panel,/Añadir instrucciones y enlace a este correo/);
  assert.match(panel,/prev\.includes\(IGNITION_FECHA1\.id\)/);
  assert.match(panel,/IGNITION_FECHA1\.guidePath/);
  assert.match(panel,/window\.confirm/);
});
test("Newsletter can insert a graphic block without sending or deleting other news",()=>{
  assert.match(newsletter,/\+ Guía Fecha 1/);
  assert.match(newsletter,/IGNITION_FECHA1\.guideUrl/);
  assert.match(newsletter,/return previous\.length===1/);
  assert.match(newsletter,/\[\.\.\.previous, guideBlock\]/);
  assert.match(newsletter,/p_test_email: isTestMode \? testEmail : null/);
});
