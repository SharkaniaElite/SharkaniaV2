/**
 * SHARKANIA P0 RLS — real GoTrue + PostgREST via local Supabase ONLY.
 * Reproduces old privilege issue and tests new primary-guarded policies.
 * Absolutely no production Supabase / Cloudflare / real user connections.
 */
import assert from "node:assert/strict";
import {randomBytes} from "node:crypto";
import {execFileSync} from "node:child_process";
import {createClient} from "@supabase/supabase-js";

const base=process.env.QA_SUPABASE_URL;
const anonKey=process.env.QA_SUPABASE_ANON_KEY;
const serviceKey=process.env.QA_SUPABASE_SERVICE_ROLE_KEY;
if(process.env.GITHUB_ACTIONS!=="true" ||
   base!=="http://127.0.0.1:25421" ||
   process.env.PGHOST!=="127.0.0.1" ||
   process.env.PGPORT!=="25422" ||
   process.env.PGDATABASE!=="postgres" ||
   !anonKey || !serviceKey)
 throw Error("STOP: P0 RLS real Auth QA requires ephemeral local Supabase only");

const uuidRe=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const safe=x=>{assert.match(x,uuidRe);return "'"+x+"'::uuid";};
const sql=q=>execFileSync("psql",["-X","-At","-v","ON_ERROR_STOP=1","-d","postgres","-c",q],
 {encoding:"utf8",timeout:12000}).trim();
const leagueA="00000000-0000-0000-0000-000000000041";
const leagueB="00000000-0000-0000-0000-000000000042";
const clubA="00000000-0000-0000-0000-000000000021";
const clubB="00000000-0000-0000-0000-000000000022";
const playerA="00000000-0000-0000-0000-000000000051";
const playerB="00000000-0000-0000-0000-000000000052";
const extraPlayer="00000000-0000-0000-0000-000000000053";
const accounts={};
const service=createClient(base,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
const suffix=randomBytes(6).toString("hex");
for(const role of ["organizer","secondary","player","superadmin"]){
 const email="qa-p0-"+role+"-"+suffix+"@example.test";
 const password=randomBytes(23).toString("base64url");
 const created=await service.auth.admin.createUser({email,password,email_confirm:true});
 assert.ifError(created.error);
 const id=created.data.user?.id;
 assert.ok(id);assert.match(id,uuidRe);
 sql("INSERT INTO public.profiles(id,role) VALUES ("+safe(id)+",'"+
   (role==="superadmin"?"super_admin":"player")+"')");
 if(role==="organizer" || role==="secondary"){
  const club=role==="organizer"?clubA:clubB;
  sql("INSERT INTO public.club_admins(club_id,user_id) VALUES ("+
    safe(club)+","+safe(id)+")");
 }
 const client=createClient(base,anonKey,{auth:{persistSession:false,autoRefreshToken:false}});
 const login=await client.auth.signInWithPassword({email,password});
 assert.ifError(login.error);
 const token=login.data.session?.access_token;
 assert.ok(token);
 const verified=await client.auth.getUser(token);
 assert.ifError(verified.error);
 assert.equal(verified.data.user.id,id);
 accounts[role]={token};
}
console.log("PASS: genuine local GoTrue JWT created for 4 test actors");

async function rest(who,table,method,filter="",body=undefined){
 const token=who?accounts[who].token:anonKey;
 const res=await fetch(base+"/rest/v1/"+table+filter,{
  method,headers:{
   apikey:anonKey,Authorization:"Bearer "+token,
   "Content-Type":"application/json",
   Prefer:"return=representation"
  },
  ...(body===undefined?{}:{body:JSON.stringify(body)}),
  signal:AbortSignal.timeout(12000)
 });
 const raw=await res.text();
 let data;try{data=JSON.parse(raw)}catch{data=raw}
 return {status:res.status,data};
}
function expectRows(r,rows,label){
 assert.equal(r.status,200,label+" status "+r.status+" "+JSON.stringify(r.data).slice(0,300));
 assert.ok(Array.isArray(r.data),label+" result must be rows");
 assert.equal(r.data.length,rows,label+" row count");
 console.log("PASS: "+label);
}
function points(league,player){
 return sql("SELECT total_points FROM public.league_standings WHERE league_id="+
  safe(league)+" AND player_id="+safe(player));
}
const filterA="?league_id=eq."+leagueA+"&player_id=eq."+playerA;
const filterB="?league_id=eq."+leagueB+"&player_id=eq."+playerB;
const membership="?league_id=eq."+leagueA+"&club_id=eq."+clubB;

// Reproduce observed legacy broad RLS on a disposable API, never real data.
expectRows(await rest("player","league_standings","PATCH",filterA,{total_points:321}),1,
 "old broad RLS lets ordinary player alter foreign league");
assert.equal(points(leagueA,playerA),"321");
sql("UPDATE public.league_standings SET total_points=10 WHERE league_id="+
 safe(leagueA)+" AND player_id="+safe(playerA));
expectRows(await rest("secondary","league_clubs","PATCH",membership,{is_primary:true}),1,
 "old membership RLS permits secondary self-promotion");
assert.equal(sql("SELECT count(*) FROM public.league_clubs WHERE league_id="+safe(leagueA)+
 " AND is_primary"),"2");
sql("UPDATE public.league_clubs SET is_primary=false WHERE league_id="+
 safe(leagueA)+" AND club_id="+safe(clubB));

// Install reviewable SQL only on the already guarded local PostgreSQL.
execFileSync("psql",["-X","-v","ON_ERROR_STOP=1","-d","postgres",
 "-f","docs/security/league-standings-rls-p0-2026-11-07.qa-only.sql"],
 {encoding:"utf8",timeout:12000,stdio:"pipe"});
sql("NOTIFY pgrst, 'reload schema'");
await new Promise(resolve=>setTimeout(resolve,1200));
assert.equal(sql("SELECT count(*) FROM pg_indexes WHERE schemaname='public' AND tablename='league_clubs' AND indexname='league_clubs_one_primary_per_league_guarded'"),"1");
console.log("PASS: P0 RLS and one primary unique index installed in local-only API");

const publicResult=await rest(null,"league_standings","GET","?select=league_id,player_id,total_points");
expectRows(publicResult,2,"anonymous public standings SELECT remains available");

expectRows(await rest("player","league_standings","PATCH",filterA,{total_points:222}),0,
 "ordinary player UPDATE blocked by RLS");
assert.equal(points(leagueA,playerA),"10");
const deniedInsert=await rest("player","league_standings","POST","",{
 league_id:leagueA,player_id:extraPlayer,total_points:100
});
assert.equal(deniedInsert.status,403,"ordinary player INSERT must be HTTP 403");
expectRows(await rest("player","league_standings","DELETE",filterA),0,
 "ordinary player DELETE blocked by RLS");
assert.equal(points(leagueA,playerA),"10");

expectRows(await rest("secondary","league_standings","PATCH",filterA,{total_points:500}),0,
 "secondary club cannot alter primary organizer league");
expectRows(await rest("secondary","league_standings","PATCH",filterB,{total_points:11}),1,
 "club B primary admin may modify league B");

expectRows(await rest("organizer","league_standings","PATCH",filterA,{total_points:12}),1,
 "club A primary admin may modify league A");
expectRows(await rest("organizer","league_standings","PATCH",filterB,{total_points:777}),0,
 "club A admin cannot modify league B");
const cross=await rest("organizer","league_standings","PATCH",filterA,{league_id:leagueB});
assert.equal(cross.status,403,"UPDATE WITH CHECK rejects transfer to foreign league");
assert.equal(points(leagueA,playerA),"12");

const accepted=await rest("organizer","league_standings","POST","",{
 league_id:leagueA,player_id:extraPlayer,total_points:3
});
assert.equal(accepted.status,201,"legitimate primary organizer may INSERT");
expectRows(await rest("organizer","league_standings","DELETE",
 "?league_id=eq."+leagueA+"&player_id=eq."+extraPlayer),1,
 "primary organizer may DELETE its own temporary row");
assert.equal(sql("SELECT count(*) FROM public.league_standings"),"2");

const promotion=await rest("secondary","league_clubs","PATCH",membership,{is_primary:true});
assert.equal(promotion.status,409,"secondary primary escalation must hit unique index (409)");
assert.equal(sql("SELECT count(*) FROM public.league_clubs WHERE league_id="+safe(leagueA)+
 " AND is_primary"),"1");

expectRows(await rest("superadmin","league_standings","PATCH",filterB,{total_points:14}),1,
 "superadmin can modify any league");
expectRows(await rest(null,"league_standings","PATCH",filterA,{total_points:666}),0,
 "anonymous cannot alter league standings");
assert.equal(points(leagueA,playerA),"12");
assert.equal(points(leagueB,playerB),"14");
console.log("PASS FINAL: real local GoTrue and PostgREST RLS verified; no remote credentials or production writes");

// P1: verify current secondary club membership escalation and the proposed
// reduction using the SAME four authentic GoTrue users on local PostgREST.
const leagueC="00000000-0000-0000-0000-000000000043";
const leagueD="00000000-0000-0000-0000-000000000044";
const leagueE="00000000-0000-0000-0000-000000000045";
const memberC="?league_id=eq."+leagueC+"&club_id=eq."+clubB;
expectRows(await rest("secondary","leagues","PATCH","?id=eq."+leagueA,
 {name:"Unauthorized change"}),1,
 "old league RLS lets a secondary club edit another organizer league");
sql("UPDATE public.leagues SET name='League A' WHERE id="+safe(leagueA));
const oldJoin=await rest("secondary","league_clubs","POST","",{
 league_id:leagueC,club_id:clubB,is_primary:false
});
assert.equal(oldJoin.status,201,"old membership RLS allows arbitrary secondary self-join");
sql("DELETE FROM public.league_clubs WHERE league_id="+safe(leagueC)+" AND club_id="+safe(clubB));
const oldPlayerLeague=await rest("player","leagues","POST","",{
 id:leagueE,name:"Unauthorized player league"
});
assert.equal(oldPlayerLeague.status,201,"old policy lets any logged-in player create a league");
sql("DELETE FROM public.leagues WHERE id="+safe(leagueE));
const roomA="?league_id=eq."+leagueA+"&room_id=eq.00000000-0000-0000-0000-000000000031";
const oldRoom=await rest("player","league_rooms","POST","",{
 league_id:leagueA,room_id:"00000000-0000-0000-0000-000000000032"
});
assert.equal(oldRoom.status,201,"old policy lets ordinary player insert room into foreign league");
sql("DELETE FROM public.league_rooms WHERE league_id="+safe(leagueA)+
 " AND room_id='00000000-0000-0000-0000-000000000032'::uuid");
console.log("PASS: P1 reproduced legacy secondary self-join, foreign league edit, player creation and room insertion");

execFileSync("psql",["-X","-v","ON_ERROR_STOP=1","-d","postgres",
 "-f","docs/security/league-membership-ownership-p1-2026-11-07.qa-only.sql"],
 {encoding:"utf8",timeout:12000,stdio:"pipe"});
sql("NOTIFY pgrst, 'reload schema'");
await new Promise(resolve=>setTimeout(resolve,1200));

const blockedRoom=await rest("player","league_rooms","POST","",{
 league_id:leagueA,room_id:"00000000-0000-0000-0000-000000000032"
});
assert.equal(blockedRoom.status,403,"ordinary player cannot insert rooms in foreign league");
expectRows(await rest("player","league_rooms","DELETE",roomA),0,
 "ordinary player cannot delete a league room");
expectRows(await rest("secondary","league_rooms","DELETE",roomA),0,
 "secondary club cannot delete organizer room");
const deniedSecondaryRoom=await rest("secondary","league_rooms","POST","",{
 league_id:leagueA,room_id:"00000000-0000-0000-0000-000000000032"
});
assert.equal(deniedSecondaryRoom.status,403,
 "secondary cannot insert room into foreign primary league");

const blockedJoin=await rest("secondary","league_clubs","POST","",{
 league_id:leagueC,club_id:clubB,is_primary:false
});
assert.equal(blockedJoin.status,403,"secondary self-join into foreign league must fail");
expectRows(await rest("secondary","leagues","PATCH","?id=eq."+leagueA,
 {name:"Still unauthorized"}),0,
 "club B may no longer edit league A just because it participates");
expectRows(await rest("secondary","leagues","DELETE","?id=eq."+leagueA),0,
 "secondary club cannot delete primary A league");

expectRows(await rest("secondary","league_clubs","PATCH",membership,
 {is_primary:false}),0,
 "non-superadmin cannot alter its own primary/secondary membership");
expectRows(await rest("secondary","league_clubs","DELETE",
 "?league_id=eq."+leagueB+"&club_id=eq."+clubB),0,
 "non-superadmin cannot orphan its own principal league");
expectRows(await rest("secondary","leagues","PATCH","?id=eq."+leagueB,
 {name:"Authorized League B"}),1,
 "club B can still edit its own primary league");

expectRows(await rest("organizer","leagues","PATCH","?id=eq."+leagueA,
 {name:"Authorized League A"}),1,
 "club A can still edit its own league");
const playerLeague=await rest("player","leagues","POST","",{
 id:leagueE,name:"Should not exist"
});
assert.equal(playerLeague.status,403,"ordinary player must not create a league");

expectRows(await rest("organizer","league_rooms","DELETE",roomA),1,
 "primary organizer can delete own league room");
const authorizedRoom=await rest("organizer","league_rooms","POST","",{
 league_id:leagueA,room_id:"00000000-0000-0000-0000-000000000032"
});
assert.equal(authorizedRoom.status,201,
 "primary organizer can insert replacement league room");
const newLeague=await rest("organizer","leagues","POST","",{
 id:leagueD,name:"Legitimate new league"
});
assert.equal(newLeague.status,201,"existing admin league creation via REST must survive");
const newMembership=await rest("organizer","league_clubs","POST","",{
 league_id:leagueD,club_id:clubA,is_primary:true
});
assert.equal(newMembership.status,201,"existing UI primary club linkage must survive");
assert.equal(sql("SELECT count(*) FROM public.league_clubs WHERE league_id="+safe(leagueD)+
 " AND is_primary"),"1");
const unauthenticatedRead=await rest(null,"leagues","GET",
 "?select=id,name&order=id.asc");
expectRows(unauthenticatedRead,4,"public league list remains readable");

const superJoin=await rest("superadmin","league_clubs","POST","",{
 league_id:leagueC,club_id:clubB,is_primary:false
});
assert.equal(superJoin.status,201,"superadmin retains cohost repair ability");
expectRows(await rest("organizer","league_clubs","PATCH",
 "?league_id=eq."+leagueA+"&club_id=eq."+clubA,
 {is_primary:false}),0,
 "primary club admin cannot disable own main membership");
assert.equal(sql("SELECT count(*) FROM public.league_clubs WHERE league_id="+safe(leagueA)+
 " AND is_primary"),"1");
console.log("PASS FINAL P1: local GoTrue/PostgREST protects membership, metadata and rooms without breaking legitimate admin creation or room editing");

