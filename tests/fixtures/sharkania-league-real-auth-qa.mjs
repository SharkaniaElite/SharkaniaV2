/**
 * QA Release A: Supabase GoTrue REAL (not a synthetic JWT), PostgREST and RLS.
 * Run only on an ephemeral GitHub runner with local 127.0.0.1 Supabase.
 * Not a browser/UI E2E, nor a replacement for the 64-table local QA.
 */
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

const base = process.env.QA_SUPABASE_URL;
const anonKey = process.env.QA_SUPABASE_ANON_KEY;
const serviceKey = process.env.QA_SUPABASE_SERVICE_ROLE_KEY;
if (process.env.GITHUB_ACTIONS !== "true" ||
    base !== "http://127.0.0.1:25421" ||
    process.env.PGHOST !== "127.0.0.1" || process.env.PGPORT !== "25422" ||
    !anonKey || !serviceKey) {
  throw new Error("STOP: requires ephemeral LOCAL Supabase Auth/REST and PostgreSQL only");
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ident = x => { assert.match(x, UUID); return "'" + x + "'::uuid"; };
const sql = q => execFileSync("psql", ["-X","-At","-v","ON_ERROR_STOP=1","-d","postgres","-c",q], { encoding:"utf8" }).trim();
const service = createClient(base,serviceKey,{ auth:{persistSession:false,autoRefreshToken:false} });
const suffix = randomBytes(6).toString("hex");
const actors = {};
const clubA="00000000-0000-0000-0000-000000000021";
const clubB="00000000-0000-0000-0000-000000000022";
const leagueA="00000000-0000-0000-0000-000000000041";
const roomB="00000000-0000-0000-0000-000000000032";
for (const role of ["organizer","participant","player","superadmin"]) {
  const email="qa-league-"+role+"-"+suffix+"@example.test";
  const password=randomBytes(22).toString("base64url");
  const created=await service.auth.admin.createUser({email,password,email_confirm:true});
  assert.ifError(created.error);
  const id=created.data.user.id;
  assert.match(id,UUID);
  sql("INSERT INTO public.profiles(id,role) VALUES ("+ident(id)+",'"+(role==="superadmin"?"super_admin":"player")+"')");
  if (role==="organizer" || role==="participant") {
    sql("INSERT INTO public.club_admins(club_id,user_id) VALUES ("+ident(role==="organizer"?clubA:clubB)+","+ident(id)+")");
  }
  const client=createClient(base,anonKey,{auth:{persistSession:false,autoRefreshToken:false}});
  const login=await client.auth.signInWithPassword({email,password});
  assert.ifError(login.error);
  assert.equal(login.data.user.id,id);
  const token=login.data.session?.access_token;
  assert.ok(token);
  const current=await client.auth.getUser(token);
  assert.ifError(current.error);
  assert.equal(current.data.user.id,id);
  actors[role]={token,id};
}
console.log("PASS: 4 synthetic users signed in via REAL Supabase GoTrue and genuine JWT");

async function rpc(name,who,payload) {
  const response=await fetch(base+"/rest/v1/rpc/"+name,{
    method:"POST",
    headers:{"Content-Type":"application/json",apikey:anonKey,
      ...(who?{Authorization:"Bearer "+actors[who].token}:{})},
    body:JSON.stringify(payload),
    signal:AbortSignal.timeout(15000)
  });
  const raw=await response.text();
  let data;try{data=JSON.parse(raw);}catch{data=raw;}
  return {status:response.status,data};
}
function check(r,status,description) {
  assert.equal(r.status,status,description+": "+JSON.stringify(r.data).slice(0,300));
  console.log("PASS: "+description+" HTTP "+status);
}
const form=(league,name,slug,fields,rooms)=>({
  p_league_id:league,p_primary_club_id:clubA,p_name:name,p_slug:slug,
  p_fields:fields,p_room_ids:rooms
});
const fields={description:"Real Auth QA",start_date:"2026-11-05",end_date:"2026-12-05",
  rules_url:"https://example.test/qa-rules",total_dates:8,best_dates_to_count:5,status:"upcoming"};
const listing=await fetch(base+"/rest/v1/leagues?select=id,name",{headers:{apikey:anonKey}});
assert.equal(listing.status,200);
console.log("PASS: anonymous public league listing over local gateway");
check(await rpc("save_league_guarded","player",form(null,"Player denied","qa-player-"+suffix,fields,[])),403,"player cannot create league");
check(await rpc("save_league_guarded","participant",form(null,"Foreign club denied","qa-foreign-"+suffix,fields,[])),403,"participant cannot create under club A");
const created=await rpc("save_league_guarded","organizer",form(null,"Auth QA league","qa-auth-"+suffix,fields,[roomB]));
check(created,200,"organizer creates league with genuine session");
const newID=created.data;assert.match(newID,UUID);
assert.equal(+sql("SELECT count(*) FROM public.league_clubs WHERE league_id="+ident(newID)+" AND club_id="+ident(clubA)+" AND is_primary"),1);
assert.equal(+sql("SELECT count(*) FROM public.league_rooms WHERE league_id="+ident(newID)+" AND room_id="+ident(roomB)),1);
check(await rpc("save_league_guarded","participant",form(newID,"Hijacked","qa-auth-"+suffix,fields,[])),403,"participant cannot edit foreign league");
check(await rpc("save_league_guarded","organizer",form(newID,"Auth QA updated","qa-auth-"+suffix,{...fields,description:"Changed",total_dates:9,best_dates_to_count:6,status:"active"},[])),200,"organizer edits league and clears rooms");
assert.equal(+sql("SELECT count(*) FROM public.league_rooms WHERE league_id="+ident(newID)),0);
const before=sql("SELECT name||':'||description||':'||total_dates::text FROM public.leagues WHERE id="+ident(newID));
check(await rpc("save_league_guarded","organizer",form(newID,"Wrong","qa-auth-"+suffix,{...fields,total_dates:2,best_dates_to_count:7},[roomB])),422,"invalid metadata rejected");
assert.equal(sql("SELECT name||':'||description||':'||total_dates::text FROM public.leagues WHERE id="+ident(newID)),before);
assert.equal(+sql("SELECT count(*) FROM public.league_rooms WHERE league_id="+ident(newID)),0);
check(await rpc("add_league_club_guarded","participant",{p_league_id:leagueA,p_club_id:clubB}),403,"secondary admin cannot self-join");
check(await rpc("add_league_club_guarded","organizer",{p_league_id:leagueA,p_club_id:clubB}),403,"organizer cannot force another club");
check(await rpc("add_league_club_guarded","superadmin",{p_league_id:leagueA,p_club_id:clubB}),200,"superadmin can authorize shared membership");
check(await rpc("delete_empty_league_guarded","participant",{p_league_id:newID}),403,"foreign admin cannot delete league");
check(await rpc("delete_empty_league_guarded","organizer",{p_league_id:leagueA}),409,"league referenced by tournament cannot be deleted");
assert.equal(+sql("SELECT count(*) FROM public.tournaments WHERE id='00000000-0000-0000-0000-000000000011' AND league_id="+ident(leagueA)),1);
check(await rpc("delete_empty_league_guarded","organizer",{p_league_id:newID}),200,"organizer deletes truly empty league");
assert.equal(+sql("SELECT count(*) FROM public.leagues WHERE id="+ident(newID)),0);
console.log("PASS FINAL: real Auth + PostgREST League Release A, isolated runner only");
