\set ON_ERROR_STOP on
INSERT INTO public.tournaments(id,club_id,buy_in,league_id,room_id,currency,start_datetime)
VALUES('00000000-0000-0000-0000-000000000116',
 '00000000-0000-0000-0000-000000000021',3.30,NULL,
 '00000000-0000-0000-0000-000000000031','USD','2026-11-28T20:00:00Z');
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
DO $negative$
DECLARE denied bool:=false;
BEGIN
 BEGIN
  PERFORM public.publish_independent_nickname_results_guarded(
   '00000000-0000-0000-0000-000000000116',
   '[
    {"nickname":"SharkHero","position":1,"prize_won":1,"bounties_won":0,"buy_ins_count":1},
    {"nickname":"ReverseBackfillQA","position":2,"prize_won":0,"bounties_won":0,"buy_ins_count":1}
   ]'::jsonb);
 EXCEPTION WHEN SQLSTATE 'PT409' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'FAIL: out-of-order independent upload accepted after league publication'; END IF;
END;
$negative$;
RESET ROLE;
ROLLBACK;
DO $post$
BEGIN
 IF EXISTS(SELECT 1 FROM public.players WHERE nickname='ReverseBackfillQA')
 OR EXISTS(SELECT 1 FROM sharkania_release.independent_elo_publication
 WHERE tournament_id='00000000-0000-0000-0000-000000000116')
 OR EXISTS(SELECT 1 FROM public.elo_history
 WHERE tournament_id='00000000-0000-0000-0000-000000000116')
 THEN RAISE EXCEPTION 'FAIL: rejected older independent result left an orphan'; END IF;
 RAISE NOTICE 'PASS: independent writer rejects backdated shared players after newer league result';
END;
$post$;
