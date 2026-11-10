import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read=path=>readFileSync(path,"utf8");
const ui=read("src/pages/super-admin.tsx");
const client=read("src/lib/api/bcch-dollar-quote.ts");
const edge=read("supabase/functions/bcch-dollar-preview/index.ts");
const config=read("supabase/config.toml");

test("official BCCh token is server-side, preview cannot write to ELO or jackpot",()=>{
 assert.match(edge,/Deno\.env\.get\("BCCH_BDE_API_TOKEN"\)/);
 assert.match(edge,/https:\/\/si3\.bcentral\.cl\/SieteRestWS\/SieteRestWS\.ashx/);
 assert.match(edge,/F073\.TCO\.PRE\.Z\.D/);
 assert.doesNotMatch(edge,/(?:\.upsert|\.insert|\.update|\.delete)\(/);
 assert.doesNotMatch(edge,/service_role|supabaseAdmin/);
 assert.doesNotMatch(client,/BCCH_BDE_API_TOKEN|si3\.bcentral\.cl/);
 assert.doesNotMatch(ui,/BCCH_BDE_API_TOKEN|si3\.bcentral\.cl/);
});

test("edge verifies genuine auth and superadmin before reading server secret",()=>{
 const verification=edge.indexOf("userDb.auth.getUser(jwt)");
 const role=edge.indexOf('userDb.rpc("is_super_admin")');
 const secret=edge.indexOf('Deno.env.get("BCCH_BDE_API_TOKEN")');
 assert.ok(verification>=0&&role>verification&&secret>role);
 assert.match(edge,/trustedOrigins/);
 assert.match(edge,/req\.method === "OPTIONS"/);
 assert.match(edge,/response\(403,\{error:"super_admin_required"\}/);
 assert.match(edge,/Cache-Control": "no-store"/);
});

test("manual quote is retained until administrator explicitly applies and saves",()=>{
 assert.match(ui,/handlePreviewBcchRate/);
 assert.match(ui,/handleApplyBcchRate/);
 assert.match(ui,/Consultar dólar observado/);
 assert.match(ui,/Usar cotización oficial/);
 assert.match(ui,/Actualizar Jackpot en Vivo/);
 const load=ui.slice(ui.indexOf("const handlePreviewBcchRate"),ui.indexOf("const handleApplyBcchRate"));
 assert.doesNotMatch(load,/setLatinClubStats|\.upsert/);
 const apply=ui.slice(ui.indexOf("const handleApplyBcchRate"),ui.indexOf("const handleSaveLatinStats"));
 assert.match(apply,/usdToClp: bcchPreview\.rateClpPerUsd/);
 assert.doesNotMatch(apply,/\.upsert/);
 assert.match(ui,/usdRateSource: "manual", usdRateDate: ""/);
 assert.match(ui,/usdRateSource: "BCCH"/);
 assert.match(ui,/value: latinClubStats/);
});

test("does not silently reuse manually edited jackpot CLP/USD as an ELO v2 official observation",()=>{
 assert.doesNotMatch(client,/reserve_usd_elo_v2|fx_observation_v2|sharkania_fx_ingest_official_v2/);
 assert.doesNotMatch(edge,/reserve_usd_elo_v2|fx_observation_v2|sharkania_fx_ingest_official_v2/);
 assert.match(config,/\[functions\.bcch-dollar-preview\]\s+enabled = true/);
 assert.doesNotMatch(config,/\[functions\.elo-fx-capture\]/);
});

test("preview checks the latest official dated observation, never API rate from client",()=>{
 assert.match(edge,/parseBcchObservedUsd/);
 assert.match(edge,/\.sort\(\(a,b\)=>b\.effectiveDate\.localeCompare\(a\.effectiveDate\)\)/);
 assert.match(edge,/recent\.quote<300 \|\| recent\.quote>3000/);
 assert.match(edge,/req\.method !== "POST"/);
 assert.doesNotMatch(edge,/req\.json\(/);
});
