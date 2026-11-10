import test from "node:test";
import assert from "node:assert/strict";
import {normalizeBuyInUsdV2,kFactorV2} from "../src/lib/elo/elo-v2-usd-policy.ts";
const start="2026-11-10T21:00:00-03:00";
const date="2026-11-10";
const bcch={
 currency:"CLP",quote:950,source:"BCCH_OBSERVED_USD",
 effectiveDate:"2026-11-10",publishedAt:"2026-11-09T21:00:00Z",
 referenceId:"BCCH:ILLUSTRATIVE:2026-11-10"
};
const ecb={
 currency:"EUR",quote:1.1,source:"ECB_EURUSD_REFERENCE",
 effectiveDate:"2026-11-10",publishedAt:"2026-11-10T15:00:00Z",
 referenceId:"ECB:ILLUSTRATIVE:2026-11-10"
};
const mock=(currency,buyIn,fx)=>normalizeBuyInUsdV2({
 originalBuyIn:buyIn,originalCurrency:currency,
 tournamentStartedAt:start,tournamentLocalDate:date,fx
});
const almost=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,
  String(a)+" should be "+String(b));

test("equal economic USD, CLP, EUR buy-ins yield identical ELO K factor",()=>{
 const tenUsd=mock("USD",10,null);
 const tenClp=mock("CLP",9500,bcch);
 const tenEur=mock("EUR",10/1.1,ecb);
 for(const item of [tenUsd,tenClp,tenEur]){
  assert.equal(item.algorithmVersion,"elo-v2-usd-normalized");
  almost(item.buyInUsd,10);
  almost(kFactorV2(item.buyInUsd,4,50),kFactorV2(tenUsd.buyInUsd,4,50));
  almost(kFactorV2(item.buyInUsd,45,50),kFactorV2(tenUsd.buyInUsd,45,50));
 }
 assert.equal(tenClp.originalCurrency,"CLP");
 assert.equal(tenClp.originalBuyIn,9500);
 assert.equal(tenClp.fx.quote,950);
 assert.equal(tenEur.fx.quote,1.1);
 console.log("PASS: 10 USD, 9,500 CLP and 9.09 EUR are equal weighted ELO inputs with illustrative quotes.");
});

test("same nominal amount in different denominations does not accidentally score equally",()=>{
 const clp=mock("CLP",10000,bcch);
 const usd=mock("USD",10000,null);
 assert.notEqual(clp.buyInUsd,usd.buyInUsd);
 assert.notEqual(kFactorV2(clp.buyInUsd,10,20),kFactorV2(usd.buyInUsd,10,20));
});
test("v1 formula preserved for USD tournaments in v2 K",()=>{
 const buy=3.3,N=8,t=11;
 const old=(t<30?40:20)*(1+Math.log10(buy+1)*0.1)*(1+Math.log10(N)*0.15);
 almost(kFactorV2(mock("USD",buy,null).buyInUsd,t,N),old);
});
test("weekend uses last already published official quote without late resampling",()=>{
 const friday={...bcch,effectiveDate:"2026-11-13",publishedAt:"2026-11-13T10:00:00Z"};
 const actual=normalizeBuyInUsdV2({
  originalBuyIn:9500,originalCurrency:"CLP",
  tournamentStartedAt:"2026-11-15T21:00:00-03:00",
  tournamentLocalDate:"2026-11-15",fx:friday
 });
 almost(actual.buyInUsd,10);
 assert.equal(actual.fx.effectiveDate,"2026-11-13");
});
test("fails closed if exchange rate was published after event started",()=>{
 assert.throws(()=>mock("EUR",10/1.1,{...ecb,publishedAt:"2026-11-11T08:00:00Z"}),
  /did not exist/);
});
test("fails closed with future effective dates and stale references",()=>{
 assert.throws(()=>mock("CLP",9500,{...bcch,effectiveDate:"2026-11-11"}),
  /future or too old/);
 assert.throws(()=>mock("CLP",9500,{...bcch,effectiveDate:"2026-10-23"}),
  /future or too old/);
});
test("fails closed if wrong provider/currency, missing ref or wrong quote direction",()=>{
 assert.throws(()=>mock("CLP",9500,{...bcch,source:"ECB_EURUSD_REFERENCE"}),/Invalid currency quote/);
 assert.throws(()=>mock("CLP",9500,{...bcch,referenceId:" "}),/Invalid currency quote/);
 assert.throws(()=>mock("EUR",10/1.1,bcch),/Invalid currency quote/);
 assert.throws(()=>mock("CLP",9500,{...bcch,quote:0}),/Invalid currency quote/);
 assert.throws(()=>mock("CLP",9500,null),/mandatory/);
 assert.throws(()=>mock("USD",10,ecb),/must not accept external FX/);
});
test("rejects non-dates, no offsets, impossible dates and invalid monetary input",()=>{
 assert.throws(()=>normalizeBuyInUsdV2({
  originalBuyIn:10,originalCurrency:"USD",fx:null,
  tournamentStartedAt:"2026-11-10T21:00:00",
  tournamentLocalDate:"2026-11-10"
 }),/explicit timezone/);
 assert.throws(()=>normalizeBuyInUsdV2({
  originalBuyIn:10,originalCurrency:"USD",fx:null,
  tournamentStartedAt:start,tournamentLocalDate:"2026-11-31"
 }),/Nonexistent/);
 assert.throws(()=>mock("USD",-5,null),/Invalid tournament buy-in/);
 assert.throws(()=>mock("USD",Number.POSITIVE_INFINITY,null),/Invalid tournament buy-in/);
});
test("v2 is side-effect-free: historical V1 events are never rewritten",()=>{
 const historic=Object.freeze({algorithmVersion:"legacy-js-v1",eloAfter:1244.82});
 const event=Object.freeze({
  originalBuyIn:9500,originalCurrency:"CLP",
  tournamentStartedAt:start,tournamentLocalDate:date,fx:Object.freeze(bcch)
 });
 const usd=normalizeBuyInUsdV2(event);
 assert.equal(usd.buyInUsd,10);
 assert.equal(historic.algorithmVersion,"legacy-js-v1");
 assert.equal(historic.eloAfter,1244.82);
});
