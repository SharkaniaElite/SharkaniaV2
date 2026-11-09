import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read = p => readFileSync(new URL("../"+p,import.meta.url),"utf8");
const deployedLegacy = read("src/lib/api/elo-engine.ts");
const policySQL = read("docs/security/league-elo-policy-versions-2026-11-09.qa-only.sql");
const policyQA = read("tests/fixtures/sharkania-league-elo-policy-versions-qa.sql");
const concurrencyCall=read("tests/fixtures/sharkania-league-concurrency-race-call-qa.sql");
const concurrencyAssert=read("tests/fixtures/sharkania-league-concurrency-race-assert-qa.sql");
const workflow=read(".github/workflows/qa-league-elo-policy-concurrency.yml");

const round2 = n => Math.round(n*100)/100;
function quote({algorithm,currency,buyIn,elo,played,position,ratings}) {
  if (!["legacy-js-v1","currency-neutral-v2-PROPOSAL"].includes(algorithm)) throw Error("version not approved");
  if (!["USD","EUR","CLP"].includes(currency)) throw Error("invalid currency");
  const n=ratings.length;
  assert.ok(n>=2&&n<=1000&&position>=1&&position<=n&&ratings.includes(elo));
  const sum=ratings.reduce((a,b)=>a+b,0);
  const score=(n-position)/(n-1);
  const averageOpponent=(sum-elo)/(n-1);
  const expected=1/(1+Math.pow(10,(averageOpponent-elo)/400));
  const base=played<30?40:20;
  const k=base*(1+Math.log10(n)*0.15)*
    (algorithm==="legacy-js-v1"?(1+Math.log10(buyIn+1)*0.1):1);
  const change=k*((sum/n)/1200)*(score-expected);
  return {after:round2(Math.max(100,elo+change)),change:round2(change),k};
}

test("candidate policies are explicit, not reachable by REST or included in production",()=>{
  assert.match(policySQL,/EXPLORATORY QA, NOT A PRODUCTION MIGRATION/);
  assert.match(policySQL,/quote_elo_policy_qa/);
  assert.match(policySQL,/IMMUTABLE SECURITY INVOKER SET search_path TO ''/);
  assert.match(policySQL,/QA_PROPOSAL_NOT_ACTIVE/);
  assert.match(policySQL,/Unapproved Elo version/);
  assert.match(policySQL,/FROM PUBLIC,anon,authenticated/);
  assert.match(policySQL,/IF p_algorithm_version='legacy-js-v1' THEN/);
  assert.match(policySQL,/v_k:=v_k\*\(1\+pg_catalog\.log\(p_buy_in\+1\)\*0\.1\)/);
  assert.match(policySQL,/IF p_algorithm_version='legacy-js-v1' THEN[\s\S]*?END IF;/);
  assert.doesNotMatch(policySQL,/UPDATE public\.|DELETE FROM public\.|INSERT INTO public\./);
  assert.match(policyQA,/pg_catalog\.has_function_privilege\('anon'/);
});

test("independent JS calculation preserves the deployed legacy formula for 2 and 3 players",()=>{
  assert.match(deployedLegacy,/const kBase = player\.total_tournaments < 30 \? 40 : 20/);
  assert.match(deployedLegacy,/Math\.log10\(buyIn \+ 1\) \* 0\.1/);
  assert.match(deployedLegacy,/Math\.log10\(N\) \* 0\.15/);
  assert.deepEqual(
    {after:quote({algorithm:"legacy-js-v1",currency:"USD",buyIn:3.30,elo:1200,played:0,position:1,ratings:[1200,1200]}).after},
    {after:1222.23}
  );
  const expected=[[1200,29,1,1222.79],[1400,30,2,1392.05],[1000,31,3,996.56]];
  for(const [elo,played,position,after] of expected)
    assert.equal(quote({algorithm:"legacy-js-v1",currency:"USD",buyIn:3.30,elo,played,position,ratings:[1200,1400,1000]}).after,after);
  assert.match(policyQA,/1222\.79/);
  assert.match(policyQA,/1392\.05/);
  assert.match(policyQA,/996\.56/);
});

test("buy-in-neutral v2 candidate gives identical Elo for different currencies and nominal amounts",()=>{
  const params={algorithm:"currency-neutral-v2-PROPOSAL",elo:1200,played:0,position:1,ratings:[1200,1200]};
  const usd=quote({...params,currency:"USD",buyIn:3.30});
  const eur=quote({...params,currency:"EUR",buyIn:12});
  const clp=quote({...params,currency:"CLP",buyIn:3300});
  assert.equal(usd.after,1220.90);
  assert.deepEqual(usd,eur);
  assert.deepEqual(usd,clp);
  const oldUSD=quote({...params,algorithm:"legacy-js-v1",currency:"USD",buyIn:3.30});
  const oldCLP=quote({...params,algorithm:"legacy-js-v1",currency:"CLP",buyIn:3300});
  assert.equal(oldCLP.after,1228.26);
  assert.notEqual(oldUSD.after,oldCLP.after);
  assert.match(policyQA,/currency-neutral-v2-PROPOSAL/);
});

test("concurrent requests prove exactly one writer, one rejection and one ledger without credentials",()=>{
  assert.match(workflow,/PGHOST: 127\.0\.0\.1/);
  assert.match(workflow,/image: postgres:17/);
  assert.match(workflow,/set \+e/);
  assert.match(workflow,/wait "\$pid1"/);
  assert.match(workflow,/wait "\$pid2"/);
  assert.match(workflow,/Tournament already processed, cancelled or contains prior results/);
  assert.match(concurrencyCall,/SET LOCAL ROLE authenticated/);
  assert.match(concurrencyCall,/SET LOCAL request\.jwt\.claim\.sub/);
  assert.match(concurrencyCall,/^BEGIN;/m);
  assert.match(concurrencyCall,/^COMMIT;/m);
  assert.match(concurrencyAssert,/one result\/ledger set, no duplicate nicknames/);
  assert.match(concurrencyAssert,/n<>1/);
  assert.match(concurrencyAssert,/j\.entry_spend=6\.60/);
  assert.doesNotMatch(workflow,/(supabase db push|supabase functions deploy|nhpjzywfzljtlqaigzed|\.supabase\.co)/);
});
