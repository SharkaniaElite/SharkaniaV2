import test from "node:test";
import assert from "node:assert/strict";
import {parseBcchObservedUsd,parseEcbEurUsdCsv} from "../supabase/functions/elo-fx-capture/official-parsers.mjs";
const bcch={
 Codigo:0,Descripcion:"Success",Series:{seriesId:"F073.TCO.PRE.Z.D",
  Obs:[
   {indexDateString:"09-11-2026",value:"993.22",statusCode:"OK"},
   {indexDateString:"10-11-2026",value:"988,14",statusCode:"OK"},
   {indexDateString:"08-11-2026",value:"NaN",statusCode:"NO_DATA"}
  ]}
};
const ecb=["FREQ,CURRENCY,CURRENCY_DENOM,EXR_TYPE,EXR_SUFFIX,TIME_PERIOD,OBS_VALUE",
"D,USD,EUR,SP00,A,2026-11-09,1.1193",
"D,USD,EUR,SP00,A,2026-11-10,1.1214"].join("\n");
test("BCCh exact official series parses CLP per USD and skips invalid weekends",()=>{
 const rows=parseBcchObservedUsd(bcch);
 assert.deepEqual(rows.map(x=>({date:x.effectiveDate,quote:x.quote})),[
  {date:"2026-11-09",quote:993.22},{date:"2026-11-10",quote:988.14}
 ]);
 assert.equal(rows[0].referenceId,"BCCH:F073.TCO.PRE.Z.D:2026-11-09");
});
test("BCCh rejects wrong series, response error, impossible dates and negative quote",()=>{
 assert.throws(()=>parseBcchObservedUsd({...bcch,Codigo:1}),/Invalid BCCh/);
 assert.throws(()=>parseBcchObservedUsd({...bcch,Series:{...bcch.Series,seriesId:"OTHER"}}),/Invalid BCCh/);
 assert.throws(()=>parseBcchObservedUsd({...bcch,Series:{...bcch.Series,Obs:[{indexDateString:"31-11-2026",value:"950",statusCode:"OK"}]}}),/Nonexistent/);
 assert.throws(()=>parseBcchObservedUsd({...bcch,Series:{...bcch.Series,Obs:[{indexDateString:"10-11-2026",value:"-1",statusCode:"OK"}]}}),/Invalid official/);
});
test("ECB validates exact EUR/USD pair, daily reference and parses values",()=>{
 const rows=parseEcbEurUsdCsv(ecb);
 assert.deepEqual(rows.map(x=>x.quote),[1.1193,1.1214]);
 assert.equal(rows[1].currency,"EUR");
 assert.equal(rows[1].referenceId,"ECB:EXR.D.USD.EUR.SP00.A:2026-11-10");
});
test("ECB KEY and quoted CSV parse while refusing other currency",()=>{
 const keyed="KEY,TIME_PERIOD,OBS_VALUE\n\"EXR.D.USD.EUR.SP00.A\",2026-11-10,1.1214";
 assert.equal(parseEcbEurUsdCsv(keyed)[0].quote,1.1214);
 assert.throws(()=>parseEcbEurUsdCsv(ecb.replaceAll("USD,EUR","GBP,EUR")),/different currency pair/);
 assert.throws(()=>parseEcbEurUsdCsv(ecb.replaceAll("SP00","SP01")),/different currency pair/);
 assert.throws(()=>parseEcbEurUsdCsv("TIME_PERIOD,OBS_VALUE\n2026-11-10,1.1"),/missing pair/);
 assert.throws(()=>parseEcbEurUsdCsv("KEY,TIME_PERIOD,OBS_VALUE\nEXR.D.USD.EUR.SP00.A,2026-11-10,-8"),/Invalid official/);
});
