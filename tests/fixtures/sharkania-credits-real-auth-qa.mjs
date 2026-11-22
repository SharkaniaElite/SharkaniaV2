import assert from "node:assert/strict";
import {randomBytes} from "node:crypto";
import {execFileSync} from "node:child_process";
import {createClient} from "@supabase/supabase-js";
const base=process.env.QA_SUPABASE_URL, anon=process.env.QA_SUPABASE_ANON_KEY, service=process.env.QA_SUPABASE_SERVICE_ROLE_KEY;
assert.equal(process.env.GITHUB_ACTIONS,"true");assert.equal(base,"http://127.0.0.1:54321");assert.equal(process.env.PGHOST,"127.0.0.1");assert.equal(process.env.PGPORT,"54322");assert.ok(anon&&service);
const sql=q=>execFileSync("psql",["-X","-At","-v","ON_ERROR_STOP=1","-c",q],{encoding:"utf8"}).trim();
const admin=createClient(base,service,{auth:{persistSession:false,autoRefreshToken:false}});
const users=[];
for(let i=0;i<2;i++){
 const email="qa-credits-"+randomBytes(8).toString("hex")+"@example.test",password=randomBytes(24).toString("base64url");
 const created=await admin.auth.admin.createUser({email,password,email_confirm:true});assert.ifError(created.error);
 const id=created.data.user.id;assert.match(id,/^[a-f0-9-]{36}$/i);
 sql("INSERT INTO public.profiles VALUES ('"+id+"',100)");
 const client=createClient(base,anon,{auth:{persistSession:false,autoRefreshToken:false}});
 const login=await client.auth.signInWithPassword({email,password});assert.ifError(login.error);assert.equal(login.data.user.id,id);assert.ok(login.data.session);
 users.push({id,client});
}
const [a,b]=users;
const publicClient=createClient(base,anon,{auth:{persistSession:false,autoRefreshToken:false}});
const spend=(client,id,slug="qa-month")=>client.rpc("spend_credits",{p_user_id:id,p_product_slug:slug});
const use=(client,id,tool="qa-tool")=>client.rpc("use_free_tool",{p_user_id:id,p_tool_id:tool});
for(const r of [await spend(publicClient,a.id),await use(publicClient,a.id),await spend(a.client,b.id),await use(a.client,b.id)]){assert.ok(r.error);assert.ok([401,403].includes(r.status));}
const purchase=await Promise.all(Array.from({length:8},()=>spend(a.client,a.id)));
for(const r of purchase)assert.ifError(r.error);
assert.equal(purchase.filter(r=>r.data.success===true).length,1);
assert.equal(purchase.filter(r=>r.data.error==="already_active").length,7);
assert.equal(sql("SELECT shark_coins_balance FROM public.profiles WHERE id='"+a.id+"'"),"90");
assert.equal(sql("SELECT count(*) FROM public.credit_transactions WHERE user_id='"+a.id+"'"),"1");
assert.equal(sql("SELECT count(*) FROM public.user_purchases WHERE user_id='"+a.id+"'"),"1");
const daily=await Promise.all(Array.from({length:8},()=>use(a.client,a.id)));
for(const r of daily)assert.ifError(r.error);assert.equal(daily.filter(r=>r.data===true).length,1);
assert.equal((await use(b.client,b.id)).data,true);
const bypass=await a.client.from("free_tool_usages").insert({user_id:a.id,tool_id:"qa-direct",last_used_date:"2026-11-22"});assert.ok(bypass.error);
const bypassCredit=await a.client.from("credit_transactions").insert({user_id:a.id,amount:999,transaction_type:"spend"});assert.ok(bypassCredit.error);
const own=await a.client.from("credit_transactions").select("user_id");assert.ifError(own.error);assert.equal(own.data.length,1);assert.equal(own.data[0].user_id,a.id);
const perUse=await Promise.all([spend(a.client,a.id,"qa-use"),spend(a.client,a.id,"qa-use")]);for(const r of perUse){assert.ifError(r.error);assert.equal(r.data.success,true);}
assert.equal(sql("SELECT shark_coins_balance FROM public.profiles WHERE id='"+a.id+"'"),"80");
console.log("PASS: genuine local JWT; anon and cross-user denied; one of eight purchases and daily uses; per-use semantics preserved; RLS denies direct writes");
