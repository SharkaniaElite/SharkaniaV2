/**
 * SHARKANIA league membership + cloning over REAL PostgREST with synthetic JWT.
 * Test database qa_league_http in GitHub Actions PostgreSQL 17 ONLY.
 * No production Supabase endpoints, keys, or users are accessed.
 */
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { execFileSync } from "node:child_process";

const url = process.env.QA_LEAGUE_HTTP_URL;
const secret = process.env.QA_LEAGUE_JWT_SECRET;
if (url !== "http://127.0.0.1:3001" ||
    process.env.PGDATABASE !== "qa_league_http" ||
    process.env.PGHOST !== "127.0.0.1" ||
    !secret || secret.length < 32) {
  throw new Error("STOP: league HTTP QA requires a synthetic loopback database only.");
}
const ids = {
  super: "00000000-0000-0000-0000-000000000001",
  a: "00000000-0000-0000-0000-000000000002",
  normal: "00000000-0000-0000-0000-000000000003",
  b: "00000000-0000-0000-0000-000000000005",
  clubA: "00000000-0000-0000-0000-000000000021",
  clubB: "00000000-0000-0000-0000-000000000022",
  leagueA: "00000000-0000-0000-0000-000000000041",
  roomB: "00000000-0000-0000-0000-000000000032",
};
function jwt(sub) {
  const part = (x) => Buffer.from(JSON.stringify(x)).toString("base64url");
  const header = part({ alg: "HS256", typ: "JWT" });
  const issued = Math.floor(Date.now() / 1000);
  const payload = part({ role: "authenticated", sub, iat: issued, exp: issued+600 });
  const input = header + "." + payload;
  return input + "." + createHmac("sha256", secret).update(input).digest("base64url");
}
async function http(method, path, sub, body) {
  const response = await fetch(url+path,{
    method,
    headers:{
      "content-type":"application/json",
      ...(sub ? { authorization: "Bearer " + jwt(sub) } : {}),
      ...(method==="PATCH" ? { prefer: "return=representation" } : {}),
    },
    ...(body===undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(15000),
  });
  const raw=await response.text();
  let data;
  try{data=JSON.parse(raw);}catch{data=raw;}
  return { code:response.status,data };
}
function num(query) {
  return Number(execFileSync("psql",["-X","-At","-v","ON_ERROR_STOP=1","-c",query],{encoding:"utf8"}).trim());
}
const call=(name,sub,payload)=>http("POST","/rpc/"+name,sub,payload);
function code(actual,expected,label) {
  assert.equal(actual.code,expected,label+" "+JSON.stringify(actual.data).slice(0,300));
  console.log("PASS: "+label+" HTTP "+expected);
}
console.log("SHARKANIA — league security with synthetic JWT + PostgREST; no production.");

code(await http("GET","/leagues?select=id,name,slug",null),200,
  "public leagues remain readable");
code(await http("GET","/league_clubs?select=league_id,club_id,is_primary",null),200,
  "public membership remains readable");
code(await http("GET","/league_rooms?select=league_id,room_id",null),200,
  "public room assignments remain readable");

code(await call("create_league_guarded",null,{
  p_primary_club_id:ids.clubA,p_name:"Anonymous League",p_slug:"qa-anon"
}),401,"anonymous create denied");
code(await call("create_league_guarded",ids.normal,{
  p_primary_club_id:ids.clubA,p_name:"Player League",p_slug:"qa-player"
}),403,"normal player create denied");
code(await http("POST","/league_clubs",ids.b,{
  league_id:ids.leagueA,club_id:ids.clubB,is_primary:true
}),403,"B cannot INSERT club membership directly");
code(await http("DELETE",`/league_rooms?league_id=eq.${ids.leagueA}`,ids.b),403,
  "authenticated B cannot DELETE rooms directly");
code(await call("add_league_club_guarded",ids.b,{
  p_league_id:ids.leagueA,p_club_id:ids.clubB
}),403,"B cannot self-join A with RPC");
code(await call("add_league_club_guarded",ids.a,{
  p_league_id:ids.leagueA,p_club_id:ids.clubB
}),403,"A cannot force club B participation");
const bEdit=await http("PATCH",`/leagues?id=eq.${ids.leagueA}`,ids.b,
  {name:"Unlawful HTTP Rename"});
code(bEdit,200,"B PATCH executes but RLS filters foreign league");
assert.equal(bEdit.data.length,0);
assert.equal(num(`SELECT count(*) FROM public.leagues WHERE id='${ids.leagueA}' AND name='QA League A'`),1);
console.log("PASS: B did not change the organizer's league.");

const bCreated=await call("create_league_guarded",ids.b,{
  p_primary_club_id:ids.clubB,p_name:"League from club B",p_slug:"qa-b-http"
});
code(bCreated,200,"B creates own league atomically");
assert.match(bCreated.data,/^[0-9a-f-]{36}$/i);
assert.equal(num(`SELECT count(*) FROM public.league_clubs WHERE league_id='${bCreated.data}' AND club_id='${ids.clubB}' AND is_primary`),1);

const rooms=await call("set_league_rooms_guarded",ids.a,{
  p_league_id:ids.leagueA,p_room_ids:[ids.roomB]
});
code(rooms,200,"A updates rooms via authorized RPC");
assert.equal(rooms.data,1);

const cloneBody={
  p_source_league_id:ids.leagueA,
  p_new_name:"A copied league HTTP",
  p_new_slug:"qa-a-http-copy",
};
code(await call("duplicate_league_guarded",ids.b,{
  ...cloneBody,p_new_slug:"qa-b-steal-clone"
}),403,"secondary B cannot duplicate A league");

const join=await call("add_league_club_guarded",ids.super,{
  p_league_id:ids.leagueA,p_club_id:ids.clubB
});
code(join,200,"superadmin joins secondary B to A");
assert.equal(join.data,true);
const joinAgain=await call("add_league_club_guarded",ids.super,{
  p_league_id:ids.leagueA,p_club_id:ids.clubB
});
code(joinAgain,200,"membership request is idempotent");
assert.equal(joinAgain.data,false);

const bEdit2=await http("PATCH",`/leagues?id=eq.${ids.leagueA}`,ids.b,
  {name:"Secondary club takeover"});
code(bEdit2,200,"secondary club PATCH cannot edit principal's league");
assert.equal(bEdit2.data.length,0);

const clone=await call("duplicate_league_guarded",ids.a,cloneBody);
code(clone,200,"A duplicates its own league");
assert.match(clone.data,/^[0-9a-f-]{36}$/i);
assert.equal(num(`SELECT count(*) FROM public.league_clubs WHERE league_id='${clone.data}'`),1);
assert.equal(num(`SELECT count(*) FROM public.league_clubs WHERE league_id='${clone.data}' AND club_id='${ids.clubA}' AND is_primary`),1);
assert.equal(num(`SELECT count(*) FROM public.league_rooms WHERE league_id='${clone.data}' AND room_id='${ids.roomB}'`),1);
assert.equal(num(`SELECT count(*) FROM public.leagues WHERE id='${clone.data}' AND status='upcoming' AND total_dates=9 AND best_dates_to_count=5`),1);
console.log("PASS: clone retains settings and rooms without enrolling B.");
const conflict=await call("duplicate_league_guarded",ids.a,cloneBody);
code(conflict,409,"duplicate league slug rejected without partial rows");
assert.equal(conflict.data.code,"PT409");

const raceBody={...cloneBody,p_new_name:"Concurrent HTTP Clone",p_new_slug:"qa-concurrent-http"};
const [raceA,raceB]=await Promise.all([
  call("duplicate_league_guarded",ids.a,raceBody),
  call("duplicate_league_guarded",ids.a,raceBody),
]);
assert.deepEqual([raceA.code,raceB.code].sort((x,y)=>x-y),[200,409],
  `slug race must result in exactly one clone: ${JSON.stringify([raceA,raceB])}`);
assert.equal(num("SELECT count(*) FROM public.leagues WHERE slug='qa-concurrent-http'"),1);
assert.equal(num("SELECT count(*) FROM public.league_clubs lc JOIN public.leagues l ON l.id=lc.league_id WHERE l.slug='qa-concurrent-http'"),1);
console.log("PASS: real concurrent HTTP duplication serialized; only one league created.");

const formFields = {
  description: "HTTP form test",
  start_date: "2026-11-05",
  end_date: "2026-12-05",
  rules_url: "https://example.test/league-rules",
  total_dates: 8,
  best_dates_to_count: 5,
  status: "upcoming",
};
const formCreate = {
  p_league_id: null,
  p_primary_club_id: ids.clubA,
  p_name: "HTTP form created",
  p_slug: "qa-form-http-created",
  p_fields: formFields,
  p_room_ids: [ids.roomB],
};
code(await call("save_league_guarded",ids.normal,formCreate),403,
  "normal player cannot submit LeagueForm");
code(await call("save_league_guarded",ids.b,formCreate),403,
  "club B cannot create LeagueForm under club A");

const createdForm = await call("save_league_guarded",ids.a,formCreate);
code(createdForm,200,"authorized A can create league, primary and rooms in single RPC");
assert.match(createdForm.data,/^[0-9a-f-]{36}$/i);
assert.equal(num(`SELECT count(*) FROM public.league_clubs
  WHERE league_id='${createdForm.data}' AND club_id='${ids.clubA}' AND is_primary`),1);
assert.equal(num(`SELECT count(*) FROM public.league_rooms
  WHERE league_id='${createdForm.data}' AND room_id='${ids.roomB}'`),1);
assert.equal(num(`SELECT count(*) FROM public.leagues
  WHERE id='${createdForm.data}' AND total_dates=8 AND best_dates_to_count=5 AND status='upcoming'`),1);

const formEdit = {
  ...formCreate,
  p_league_id: createdForm.data,
  p_name: "HTTP form edited",
  p_fields: {...formFields, description:"edited",total_dates:9,best_dates_to_count:6,status:"active"},
  p_room_ids:[],
};
code(await call("save_league_guarded",ids.b,formEdit),403,
  "club B cannot edit A LeagueForm");
code(await call("save_league_guarded",ids.a,formEdit),200,
  "A can edit league and clear rooms atomically");
assert.equal(num(`SELECT count(*) FROM public.league_rooms
  WHERE league_id='${createdForm.data}'`),0);
assert.equal(num(`SELECT count(*) FROM public.leagues
  WHERE id='${createdForm.data}' AND name='HTTP form edited'
  AND description='edited' AND status='active' AND best_dates_to_count=6`),1);

const invalidForm={...formEdit,p_name:"FAIL silently",p_fields:{...formEdit.p_fields,best_dates_to_count:10}};
const badCount=await call("save_league_guarded",ids.a,invalidForm);
code(badCount,422,"invalid league scoring dates rejected");
const badRoom=await call("save_league_guarded",ids.a,{
  ...formEdit,p_name:"FAIL unknown room",
  p_room_ids:["00000000-0000-0000-0000-000000000099"]
});
code(badRoom,422,"unknown room rejected");
assert.equal(num(`SELECT count(*) FROM public.leagues
  WHERE id='${createdForm.data}' AND name='HTTP form edited'
  AND description='edited' AND best_dates_to_count=6`),1);
assert.equal(num(`SELECT count(*) FROM public.league_rooms
  WHERE league_id='${createdForm.data}'`),0);
console.log("PASS: rejected HTTP LeagueForm edits left metadata and rooms unchanged.");
const directDelete = await http("DELETE",
  `/leagues?id=eq.${ids.leagueA}`,ids.a);
code(directDelete,403,"direct DELETE of league is revoked even for primary organizer");

const unauthorizedDelete = await call("delete_empty_league_guarded",ids.b,{
  p_league_id:ids.leagueA,
});
code(unauthorizedDelete,403,"secondary club cannot delete organizer league");

const linkedDelete = await call("delete_empty_league_guarded",ids.a,{
  p_league_id:ids.leagueA,
});
code(linkedDelete,409,"cannot delete league linked to historical tournaments");
assert.equal(num(`SELECT count(*) FROM public.tournaments
  WHERE id='00000000-0000-0000-0000-000000000011' AND league_id='${ids.leagueA}'`),1);
console.log("PASS: tournament retains original league_id after denied deletion.");

const emptyDelete = await call("delete_empty_league_guarded",ids.a,{
  p_league_id:createdForm.data,
});
code(emptyDelete,200,"organizer removes truly empty league via one protected RPC");
assert.equal(emptyDelete.data,true);
assert.equal(num(`SELECT count(*) FROM public.leagues WHERE id='${createdForm.data}'`),0);
assert.equal(num(`SELECT count(*) FROM public.league_clubs WHERE league_id='${createdForm.data}'`),0);
assert.equal(num(`SELECT count(*) FROM public.league_rooms WHERE league_id='${createdForm.data}'`),0);
console.log("PASS: safe league deletion did not leave membership or room orphans.");
console.log("PASS FINAL: protected league CRUD, safe empty-only DELETE, atomic form and concurrent clone over HTTP.");


