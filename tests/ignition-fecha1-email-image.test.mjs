import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
const worker=await import("data:text/javascript;base64,"+Buffer.from(readFileSync(new URL("../workers/email-worker.mjs",import.meta.url))).toString("base64"));
const news=readFileSync(new URL("../src/pages/super-admin.tsx",import.meta.url),"utf8");
const meta=readFileSync(new URL("../src/lib/ignition-liga-fecha1.ts",import.meta.url),"utf8");

test("JPG is embedded only for the welcome and first-date reminder",()=>{
  const html="<html><body><p>Hola jugador</p></body></html>";
  const welcome=worker.addIgnitionFecha1Guide(html,"ignition-2026-11-welcome");
  const first=worker.addIgnitionFecha1Guide(html,"ignition-2026-11-05");
  assert.match(welcome,/ignition-liga-privada-fecha-1-email\.jpg/);
  assert.match(welcome,/ignition-liga-privada-fecha-1\.svg/);
  assert.match(first,/Liga Privada - Fecha 1/);
  for(const k of ["ignition-2026-11-12","ignition-2026-11-19","ignition-2026-11-26",null])
    assert.equal(worker.addIgnitionFecha1Guide(html,k),html);
});
test("Image is included once, and plain links keep functioning",()=>{
  const html="<html><body>https://sharkania.com/ignition</body></html>";
  const out=worker.addIgnitionFecha1Guide(worker.linkifyPlainUrlsInHtml(html),"ignition-2026-11-welcome");
  assert.equal((out.match(/-email\.jpg/g)||[]).length,1);
  assert.equal(worker.addIgnitionFecha1Guide(out,"ignition-2026-11-welcome"),out);
  assert.match(out,/href="https:\/\/sharkania\.com\/ignition"/);
});
test("Newsletter block uses email-compatible JPG with link to full guide",()=>{
  assert.match(meta,/emailGuideImageUrl/);
  assert.match(news,/image: IGNITION_FECHA1\.emailGuideImageUrl/);
  assert.match(news,/link: IGNITION_FECHA1\.guideUrl/);
});
