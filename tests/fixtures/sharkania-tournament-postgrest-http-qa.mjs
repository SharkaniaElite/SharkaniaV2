/**
 * HTTP/PostgREST isolated integration test.
 *
 * All identities, credentials and database rows are FAKE and are created
 * by the temporary CI qa_publish_http database. NEVER set this tool's URL
 * or database environment to a production Supabase endpoint.
 *
 * Run only with QA_HTTP_URL=http://127.0.0.1:3000 and PGDATABASE=qa_publish_http.
 */
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { execFileSync } from "node:child_process";

const url = process.env.QA_HTTP_URL;
const secret = process.env.QA_JWT_SECRET;
if (url !== "http://127.0.0.1:3000" ||
    process.env.PGDATABASE !== "qa_publish_http" ||
    !secret || secret.length < 32 ||
    process.env.PGHOST !== "127.0.0.1") {
  throw new Error("STOP: HTTP QA requires loopback and isolated qa_publish_http.");
}

const id = {
  clubAdmin: "00000000-0000-0000-0000-000000000002",
  foreignAdmin: "00000000-0000-0000-0000-000000000005",
  player: "00000000-0000-0000-0000-000000000003",
  first: "00000000-0000-0000-0000-000000000011",
  second: "00000000-0000-0000-0000-000000000012",
  p1: "00000000-0000-0000-0000-000000000051",
  p2: "00000000-0000-0000-0000-000000000052",
};

function makeJwt(sub) {
  const encode = (v) => Buffer.from(JSON.stringify(v)).toString("base64url");
  const header = encode({ alg: "HS256", typ: "JWT" });
  const payload = encode({
    role: "authenticated",
    sub,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 600,
  });
  const signingInput = `${header}.${payload}`;
  const signature = createHmac("sha256", secret).update(signingInput).digest("base64url");
  return `${signingInput}.${signature}`;
}

const results = [
  { player_id: id.p1, nickname: "QaPlayerOne", country_code: "CL",
    position: 1, prize_won: 100, bounties_won: 0,
    league_points_earned: 100, ccp_club: "ALPHA", buy_ins_count: 2 },
  { player_id: id.p2, nickname: "QaPlayerTwo", country_code: "CL",
    position: 2, prize_won: 0, bounties_won: 0,
    league_points_earned: 50, ccp_club: "BETA", buy_ins_count: 1 },
];

async function callRpc({ sub, name = "publish_tournament_results_guarded", body }) {
  const response = await fetch(`${url}/rpc/${name}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(sub ? { authorization: `Bearer ${makeJwt(sub)}` } : {}),
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  const text = await response.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { message: text.slice(0, 200) }; }
  return { code: response.status, json };
}

function assertDenied(result, label) {
  assert.ok([401, 403].includes(result.code),
    `${label}: expected HTTP 401/403, got ${result.code} ${JSON.stringify(result.json).slice(0, 250)}`);
  console.log(`PASS: ${label} blocked through HTTP (${result.code})`);
}
function queryNumber(sql) {
  return Number(execFileSync("psql", ["-X", "-At", "-v", "ON_ERROR_STOP=1", "-c", sql],
    { encoding: "utf8" }).trim());
}

console.log("SHARKANIA / synthetic PostgREST HTTP + JWT QA (no production).");
assertDenied(await callRpc({
  body: { p_tournament_id: id.first, p_results: results },
}), "anonymous publication");
const unlinkedPlayer = await callRpc({
  sub: id.player, body: { p_tournament_id: id.first, p_results: results },
});
assertDenied(unlinkedPlayer, "normal player publication");
assert.equal(unlinkedPlayer.json.message, "Club admin required",
  "HTTP JWT was recognized but the player must fail the club authorization, not auth.uid");
const wrongClub = await callRpc({
  sub: id.foreignAdmin, body: { p_tournament_id: id.first, p_results: results },
});
assertDenied(wrongClub, "foreign club administrator publication");
assert.equal(wrongClub.json.message, "Club admin required",
  "other club must fail authorization, not authentication");
assertDenied(await callRpc({
  sub: id.clubAdmin, name: "calculate_tournament_elo_guarded",
  body: { p_tournament_id: id.first },
}), "privileged ELO helper direct access");

const tampered = await callRpc({
  sub: id.clubAdmin,
  body: { p_tournament_id: id.first,
    p_results: results.map((r, i) => i === 0 ? { ...r, elo_after: 9999 } : r) },
});
assert.ok([400, 422].includes(tampered.code),
  `tampered Elo should fail as bad input: ${tampered.code} ${JSON.stringify(tampered.json)}`);
console.log("PASS: HTTP client cannot supply calculated Elo.");

const first = await callRpc({
  sub: id.clubAdmin, body: { p_tournament_id: id.first, p_results: results },
});
assert.equal(first.code, 200, `first publication failed: ${JSON.stringify(first.json)}`);
assert.equal(first.json.success, true);
assert.equal(first.json.players_processed, 2);
console.log("PASS: authorized club admin published via real HTTP/PostgREST JWT.");

const retryPayload = { p_tournament_id: id.first, p_results: results };
const [retryA, retryB] = await Promise.all([
  callRpc({ sub: id.clubAdmin, body: retryPayload }),
  callRpc({ sub: id.clubAdmin, body: retryPayload }),
]);
assert.equal(retryA.code, 200, `concurrent retry A: ${JSON.stringify(retryA.json)}`);
assert.equal(retryB.code, 200, `concurrent retry B: ${JSON.stringify(retryB.json)}`);
assert.equal(retryA.json.success, true);
assert.equal(retryB.json.success, true);
console.log("PASS: two HTTP requests simultaneously republished the same tournament.");

assert.equal(queryNumber("SELECT count(*) FROM public.elo_history"), 2);
assert.equal(queryNumber("SELECT count(*) FROM public.tournament_results"), 2);
assert.equal(queryNumber(`SELECT total_tournaments FROM public.players WHERE id='${id.p1}'`), 1);
assert.equal(queryNumber(`SELECT total_buy_ins_spent FROM public.players WHERE id='${id.p1}'`), 20);
assert.equal(queryNumber(`SELECT total_prize_won FROM public.players WHERE id='${id.p1}'`), 100);
assert.equal(queryNumber("SELECT count(*) FROM public.league_standings"), 2);
console.log("PASS: HTTP racing requests did not duplicate ELO, prize, entries or standings.");

const afterLater = await callRpc({
  sub: id.foreignAdmin,
  body: { p_tournament_id: id.second, p_results: results },
});
assert.equal(afterLater.code, 200, `later club publication: ${JSON.stringify(afterLater.json)}`);
assert.equal(queryNumber("SELECT count(*) FROM public.elo_history"), 4);
console.log("PASS: second club published a chronologically later date via HTTP.");

const older = await callRpc({
  sub: id.clubAdmin, body: retryPayload,
});
assert.equal(older.code, 409,
  `chronological conflict must produce HTTP 409, got ${older.code}: ${JSON.stringify(older.json)}`);
assert.equal(older.json.code, "PT409");
assert.equal(queryNumber("SELECT count(*) FROM public.elo_history"), 4);
console.log("PASS: HTTP rejects historical edits after a newer tournament.");
console.log("PASS FINAL: HTTP/JWT, two parallel requests, permissions and chronology on synthetic PostgREST QA.");
