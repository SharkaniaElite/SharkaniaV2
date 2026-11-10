/**
 * ELO official FX capture (QA ONLY, not deployed or scheduled).
 * Only service-to-service Supabase secret key may invoke this function.
 * BCCh API token is a server secret. Do not expose rates/credentials to client.
 * With Supabase server SDK, ctx.supabaseAdmin enforces backend key scope.
 */
import {withSupabase} from "npm:@supabase/server@1";
import {parseBcchObservedUsd,parseEcbEurUsdCsv} from "./official-parsers.mjs";

function iso(d: Date): string {return d.toISOString().slice(0,10);}
function subtractDays(d: Date, n: number): Date {
 return new Date(d.getTime()-n*24*60*60*1000);
}
function bcchUrl(token: string,start: string,end: string): string {
 const url=new URL("https://si3.bcentral.cl/SieteRestWS/SieteRestWS.ashx");
 url.searchParams.set("token",token); // NEVER log this URL
 url.searchParams.set("function","GetSeries");
 url.searchParams.set("timeseries","F073.TCO.PRE.Z.D");
 url.searchParams.set("firstdate",start);
 url.searchParams.set("lastdate",end);
 return url.toString();
}
function ecbUrl(start: string,end: string): string {
 const url=new URL("https://data-api.ecb.europa.eu/service/data/EXR/D.USD.EUR.SP00.A");
 url.searchParams.set("startPeriod",start);
 url.searchParams.set("endPeriod",end);
 url.searchParams.set("format","csvdata");
 return url.toString();
}
async function sha256Hex(input:string):Promise<string> {
 const bytes=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(input));
 return Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,"0")).join("");
}
async function readProvider(url:string,format:"json"|"csv"):Promise<unknown> {
 const response=await fetch(url,{
  method:"GET",
  headers:{"Accept":format==="json"?"application/json":"text/csv"},
  signal:AbortSignal.timeout(12000)
 });
 if(!response.ok)throw Error("Upstream official FX provider unavailable");
 const raw=await response.text();
 if(raw.length>1024*1024)throw Error("Upstream response exceeds bound");
 return format==="json"?JSON.parse(raw):raw;
}

export default {
 fetch:withSupabase({auth:"secret"},async(req,ctx)=>{
  if(req.method!=="POST")
   return Response.json({error:"Method not allowed"},{status:405});
  const token=Deno.env.get("BCCH_BDE_API_TOKEN");
  if(!token) return Response.json({
    error:"BCCh API token is not configured; no changes made"
  },{status:503});
  const now=new Date();
  // Avoid ever fetching a user-provided target or arbitrary URL.
  const from=iso(subtractDays(now,10));
  const until=iso(now);
  let clp,eur;
  try {
    [clp,eur]=await Promise.all([
      readProvider(bcchUrl(token,from,until),"json"),
      readProvider(ecbUrl(from,until),"csv")
    ]);
  } catch {
    // Never reveal BCCh access tokens, raw URLs or response bodies in logs.
    return Response.json({error:"Official FX retrieval failed; no records imported"},{status:503});
  }
  let quotes;
  try{
   quotes=[...parseBcchObservedUsd(clp),...parseEcbEurUsdCsv(eur as string)];
  }catch{
   return Response.json({error:"Official FX response failed validation"},{status:503});
  }
  // Validate BOTH feeds before any insertion: no partial acceptance when one
  // is malformed. DB itself remains append-only and validates each ingest.
  const count={CLP:0,EUR:0};
  for(const q of quotes){
    const {error}=await ctx.supabaseAdmin.rpc("sharkania_fx_ingest_official_v2",{
      p_currency:q.currency,
      p_effective_date:q.effectiveDate,
      p_quote:q.quote,
      p_raw_sha256:await sha256Hex(q.canonical),
      p_reference_id:q.referenceId
    });
    if(error){
      // Fail closed on revised quote/DB errors. Earlier immutable rows survive;
      // no partial tournament ELO can ever be written from this function.
      return Response.json({
       error:"Official FX snapshot ingestion stopped; review provider conflicts"
      },{status:409});
    }
    count[q.currency as "CLP"|"EUR"]++;
  }
  // The source-health receipt is created ONLY after an entire feed response
  // has been retrieved, parsed and every returned observation ingested.
  // Old rates without a fresh successful poll cannot be used for new Elo.
  for(const currency of ["CLP","EUR"] as const){
    const {data,error}=await ctx.supabaseAdmin.rpc(
      "sharkania_fx_record_feed_check_v2",{p_currency:currency}
    );
    if(error||data?.status!=="checked"){
      return Response.json({
        error:"Official FX health receipt not confirmed; publication will remain blocked"
      },{status:409});
    }
  }
  return Response.json({
    status:"captured",date:iso(now),observations:count,
    // Intentionally no provider API token or financial user information.
    usage:"For future v2 tournaments only; historical backfill is NOT proof of pre-event availability"
  });
 })
};
