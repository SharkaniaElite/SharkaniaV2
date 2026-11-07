import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const sql=readFileSync(new URL("../docs/security/league-membership-ownership-p1-2026-11-07.qa-only.sql",import.meta.url),"utf8");
const qa=readFileSync(new URL("./fixtures/sharkania-p1-league-membership-rls-qa.sql",import.meta.url),"utf8");
test("P1 fail-closed on unknown old policy or absent P0 unique primary index",()=>{
 assert.match(sql,/STOP: P0 unique primary index missing/);
 assert.match(sql,/old league membership\/ownership policies have changed/);
 assert.match(sql,/unreviewed league write policy exists/);
 assert.match(sql,/v_expected|n<>6/);
});
test("P1 removes all six broad policies and creates only 6 role-scoped replacements",()=>{
 assert.equal((sql.match(/^DROP POLICY "/gm)||[]).length,6);
 assert.equal((sql.match(/^CREATE POLICY /gm)||[]).length,6);
 assert.equal((sql.match(/ FOR (?:INSERT|UPDATE|DELETE) TO authenticated/g)||[]).length,6);
 assert.doesNotMatch(sql,/CREATE UNIQUE INDEX|ALTER TABLE|CREATE TRIGGER|UPDATE public\.league_standings/);
});
test("no N+1 standings authorization; primary only for league edit and delete",()=>{
 assert.match(sql,/FROM public\.league_clubs lc[\s\S]{0,100}lc\.is_primary IS TRUE GROUP BY lc\.league_id/);
 assert.match(sql,/HAVING count\(\*\)=1 AND bool_or\(public\.is_club_admin\(lc\.club_id\)\)/);
 assert.match(sql,/WITH CHECK \([\s\S]*?league_clubs lc/);
 assert.match(sql,/CREATE POLICY leagues_primary_delete_p1/);
 assert.doesNotMatch(sql,/auth\.role\(\)/);
});
test("old legitimate admin web form can create a league and its primary membership",()=>{
 assert.match(sql,/is_primary IS TRUE AND public\.is_club_admin\(club_id\)/);
 assert.match(sql,/SELECT 1 FROM public\.club_admins ca/);
 assert.match(qa,/current club admin two-step league creation and edit still work/);
 assert.match(qa,/secondary self-join rejected/);
 assert.match(qa,/secondary cannot self-join, edit foreign league, or remove primary/);
 assert.match(qa,/superadmin still can repair league membership/);
});
