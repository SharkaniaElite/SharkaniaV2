/**
 * QA-only live ECB verification: no key, no Supabase, no database writes.
 * Fetch official daily EUR/USD CSV exactly as the future server would.
 * This is a launch-gate probe, not a recurring unit test or fallback FX.
 */
import assert from "node:assert/strict";
import {parseEcbEurUsdCsv} from "../supabase/functions/elo-fx-capture/official-parsers.mjs";

const url=new URL("https://data-api.ecb.europa.eu/service/data/EXR/D.USD.EUR.SP00.A");
const isoDate=x=>x.toISOString().slice(0,10);
const today=new Date();
const from=new Date(today.getTime()-10*24*60*60*1000);
url.searchParams.set("startPeriod",isoDate(from));
url.searchParams.set("endPeriod",isoDate(today));
url.searchParams.set("format","csvdata");

const response=await fetch(url,{
  method:"GET",
  headers:{Accept:"text/csv"},
  signal:AbortSignal.timeout(20000),
});
assert.equal(response.status,200,"Live ECB EUR/USD API unavailable");
const csv=await response.text();
assert.ok(csv.length<1000000,"ECB response too large");
const quotes=parseEcbEurUsdCsv(csv);
const latest=quotes.filter(x=>x.effectiveDate<=isoDate(today))
  .sort((a,b)=>b.effectiveDate.localeCompare(a.effectiveDate))[0];
assert.ok(latest,"ECB returned no dated USD/EUR quote");
const ageDays=Math.floor((Date.parse(isoDate(today)+"T00:00:00Z")-
  Date.parse(latest.effectiveDate+"T00:00:00Z"))/86400000);
assert.ok(ageDays>=0&&ageDays<=7,"ECB official series stale");
assert.ok(latest.quote>=0.5&&latest.quote<=2.0,"ECB quote out of normal sanity bounds");
console.log(JSON.stringify({
  status:"PASS",
  source:"ECB",
  series:"EXR/D.USD.EUR.SP00.A",
  currency:"EUR",
  lastEffectiveDate:latest.effectiveDate,
  usdPerEuro:latest.quote,
  count:quotes.length,
}));
