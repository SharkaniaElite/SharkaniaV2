\set ON_ERROR_STOP on
-- POST candidate lockdown, with fake rows and JWT-only SQL role.
-- Verify client cannot bypass server Elo but may still fix own nickname.
DO $acl$
BEGIN
 IF pg_catalog.has_column_privilege('authenticated','public.players','elo_rating','UPDATE')
 OR pg_catalog.has_column_privilege('authenticated','public.players','elo_peak','UPDATE')
 OR pg_catalog.has_column_privilege('authenticated','public.players','total_prize_won','UPDATE')
 OR pg_catalog.has_column_privilege('authenticated','public.players','profile_id','UPDATE')
 OR pg_catalog.has_table_privilege('authenticated','public.players','INSERT')
 OR pg_catalog.has_table_privilege('authenticated','public.elo_history','INSERT')
 OR pg_catalog.has_table_privilege('authenticated','public.tournament_results','INSERT')
 OR NOT pg_catalog.has_column_privilege('authenticated','public.players','nickname','UPDATE')
 THEN RAISE EXCEPTION 'FAIL: column ACL not protected'; END IF;
 RAISE NOTICE 'PASS: API cannot update Elo/finance/player links or insert arbitrary history';
END;
$acl$;

-- Recreate only the read/owner RLS policies observed in production.
-- Changes below are inside a transaction and ALWAYS rolled back.
BEGIN;
GRANT SELECT ON public.players,public.tournaments TO authenticated;
GRANT UPDATE ON public.tournaments TO authenticated;
CREATE POLICY qa_independent_owner_players_read
 ON public.players FOR SELECT TO authenticated USING(true);
CREATE POLICY qa_independent_owner_players_edit
 ON public.players FOR UPDATE TO authenticated
 USING(profile_id=(SELECT auth.uid()))
 WITH CHECK(profile_id=(SELECT auth.uid()));
CREATE POLICY qa_independent_tournaments_read
 ON public.tournaments FOR SELECT TO authenticated USING(true);
CREATE POLICY qa_independent_tournaments_update
 ON public.tournaments FOR UPDATE TO authenticated
 USING(true) WITH CHECK(true);

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-0000-0000-000000000061';
DO $bad$
DECLARE blocked bool; changed int;
BEGIN
 blocked:=false;
 BEGIN
  UPDATE public.players SET elo_rating=99999
  WHERE id='00000000-0000-0000-0000-000000000051';
 EXCEPTION WHEN SQLSTATE '42501' THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'FAIL: user changed shared Elo directly'; END IF;

 blocked:=false;
 BEGIN
  INSERT INTO public.elo_history(tournament_id,player_id,elo_before,elo_after,elo_change)
  VALUES('00000000-0000-0000-0000-000000000012',
         '00000000-0000-0000-0000-000000000051',1200,99999,98799);
 EXCEPTION WHEN SQLSTATE '42501' THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'FAIL: direct Elo history was accepted'; END IF;

 blocked:=false;
 BEGIN
  INSERT INTO public.tournament_results(tournament_id,player_id,position)
  VALUES('00000000-0000-0000-0000-000000000098',
         '00000000-0000-0000-0000-000000000051',4);
 EXCEPTION WHEN SQLSTATE '42501' THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'FAIL: direct results insert was accepted'; END IF;

 blocked:=false;
 BEGIN
  UPDATE public.tournaments SET results_uploaded=true
  WHERE id='00000000-0000-0000-0000-000000000012';
 EXCEPTION WHEN SQLSTATE 'PT409' THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'FAIL: direct standalone completion was accepted'; END IF;

 UPDATE public.players SET nickname='SharkHero-Edited-In-QA'
 WHERE id='00000000-0000-0000-0000-000000000051';
 GET DIAGNOSTICS changed=ROW_COUNT;
 IF changed<>1 THEN RAISE EXCEPTION 'FAIL: legitimate nickname UPDATE broken'; END IF;
 RAISE NOTICE 'PASS: direct Elo blocked, independent completion blocked, nickname update preserved';
END;
$bad$;
RESET ROLE;
ROLLBACK;

-- A SECURITY DEFINER RPC should still be able to publish after revocation.
INSERT INTO public.tournaments(id,club_id,buy_in,league_id,room_id,currency,start_datetime)
VALUES('00000000-0000-0000-0000-000000000101',
       '00000000-0000-0000-0000-000000000021',3.30,NULL,
       '00000000-0000-0000-0000-000000000031','USD','2026-12-02T20:00:00Z');

BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
DO $new$
DECLARE receipt jsonb;
BEGIN
 receipt:=public.publish_independent_nickname_results_guarded(
  '00000000-0000-0000-0000-000000000101',
  '[{"nickname":"SharkHero","position":1,"prize_won":0,"bounties_won":0,"buy_ins_count":1},{"nickname":"PokerQueen","position":2,"prize_won":0,"bounties_won":0,"buy_ins_count":1}]');
 IF receipt->>'status'<>'published' OR receipt->>'players'<>'2'
 THEN RAISE EXCEPTION 'FAIL: RPC stopped after permissions cutover'; END IF;
END;
$new$;
RESET ROLE;
COMMIT;
DO $post$
BEGIN
 IF (SELECT count(*) FROM public.tournament_results
  WHERE tournament_id='00000000-0000-0000-0000-000000000101')<>2
 OR (SELECT count(*) FROM sharkania_release.independent_elo_publication)<>2
 THEN RAISE EXCEPTION 'FAIL: protected independent publication blocked after cutover'; END IF;
 RAISE NOTICE 'PASS FINAL: safe client ACL with real server writer functioning';
END;
$post$;
