\set ON_ERROR_STOP on
-- A synthetic earlier tournament is submitted AFTER both later tournaments
-- have confirmed Elo for SharkHero. Reject PT409 without new nicknames.
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
DO $qa$
DECLARE
  v_denied boolean:=false;
  v_message text;
BEGIN
  BEGIN
    PERFORM public.publish_league_nickname_results_guarded_qa(
      '00000000-0000-0000-0000-000000000099'::uuid,
      '[
       {"nickname":"SharkHero","position":1,"prize_won":20,
        "bounties_won":0,"league_points_earned":20,"buy_ins_count":1},
       {"nickname":"EarlierUnbornPlayer","position":2,"prize_won":0,
        "bounties_won":0,"league_points_earned":10,"buy_ins_count":1}
      ]'::jsonb
    );
  EXCEPTION WHEN SQLSTATE 'PT409' THEN
    GET STACKED DIAGNOSTICS v_message=MESSAGE_TEXT;
    IF v_message LIKE 'Later tournament results exist for an affected player%' THEN
      v_denied:=true;
    ELSE
      RAISE EXCEPTION 'FAIL: incorrect PT409 cause: %',v_message;
    END IF;
  END;
  IF NOT v_denied THEN
    RAISE EXCEPTION 'FAIL: earlier publication illegally rewrote future Elo timeline';
  END IF;
END;
$qa$;
RESET ROLE;

DO $qa$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.players p
    WHERE lower(btrim(p.nickname))='earlierunbornplayer'
  ) OR EXISTS (
    SELECT 1 FROM public.tournament_results tr
    WHERE tr.tournament_id='00000000-0000-0000-0000-000000000099'
  ) OR EXISTS (
    SELECT 1 FROM public.elo_history h
    WHERE h.tournament_id='00000000-0000-0000-0000-000000000099'
  ) OR EXISTS (
    SELECT 1 FROM sharkania_release_qa.elo_publication ep
    WHERE ep.tournament_id='00000000-0000-0000-0000-000000000099'
  ) OR EXISTS (
    SELECT 1 FROM sharkania_release_qa.currency_posting j
    WHERE j.tournament_id='00000000-0000-0000-0000-000000000099'
  ) OR EXISTS (
    SELECT 1 FROM public.tournaments t
    WHERE t.id='00000000-0000-0000-0000-000000000099'
      AND t.results_uploaded
  ) THEN
    RAISE EXCEPTION 'FAIL: rejected retroactive cross-league upload left partial data';
  END IF;
  RAISE NOTICE 'PASS: cross-league out-of-order results refused and new nickname rolled back';
END;
$qa$;
COMMIT;
