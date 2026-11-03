\set ON_ERROR_STOP on
-- Run AFTER standard/adversarial ELO QA in isolated PostgreSQL 17 qa_elo.
-- All identities, amounts and results here are synthetic.
INSERT INTO public.tournaments(id,club_id,buy_in) VALUES
 ('00000000-0000-0000-0000-000000000018','00000000-0000-0000-0000-000000000021',10),
 ('00000000-0000-0000-0000-000000000019','00000000-0000-0000-0000-000000000021',10),
 ('00000000-0000-0000-0000-000000000020','00000000-0000-0000-0000-000000000021',10),
 ('00000000-0000-0000-0000-000000000023','00000000-0000-0000-0000-000000000021',10);

-- The winner bought in three times; second place only once.
INSERT INTO public.tournament_results(tournament_id,player_id,position,prize_won,bounties_won,buy_ins_count) VALUES
 ('00000000-0000-0000-0000-000000000018','00000000-0000-0000-0000-000000000051',1,9,2,3),
 ('00000000-0000-0000-0000-000000000018','00000000-0000-0000-0000-000000000052',2,0,0,1),
 ('00000000-0000-0000-0000-000000000019','00000000-0000-0000-0000-000000000051',1,0,0,1.5),
 ('00000000-0000-0000-0000-000000000019','00000000-0000-0000-0000-000000000052',2,0,0,1),
 ('00000000-0000-0000-0000-000000000020','00000000-0000-0000-0000-000000000051',1,0,0,0),
 ('00000000-0000-0000-0000-000000000020','00000000-0000-0000-0000-000000000052',2,0,0,1),
 ('00000000-0000-0000-0000-000000000023','00000000-0000-0000-0000-000000000051',1,0,0,NULL),
 ('00000000-0000-0000-0000-000000000023','00000000-0000-0000-0000-000000000052',2,0,0,1);

SET ROLE authenticated;
SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
DO $qa$
DECLARE response jsonb;
BEGIN
  SELECT public.calculate_tournament_elo_guarded('00000000-0000-0000-0000-000000000018') INTO response;
  IF response->>'success' <> 'true'
     OR response->>'already_processed' <> 'false'
     OR (response->>'players_processed')::integer <> 2
  THEN RAISE EXCEPTION 'QA FAIL: valid reentry result was refused: %',response; END IF;
END;
$qa$;
RESET ROLE;

DO $qa$
BEGIN
  -- Tournament 11 already charged 10 once; tournament 18 charges 30/10.
  IF (SELECT total_buy_ins_spent FROM public.players WHERE id='00000000-0000-0000-0000-000000000051') <> 40
   OR (SELECT total_buy_ins_spent FROM public.players WHERE id='00000000-0000-0000-0000-000000000052') <> 20
   OR (SELECT total_prize_won FROM public.players WHERE id='00000000-0000-0000-0000-000000000051') <> 66
   OR (SELECT total_tournaments FROM public.players WHERE id='00000000-0000-0000-0000-000000000051') <> 2
   OR (SELECT total_cashes FROM public.players WHERE id='00000000-0000-0000-0000-000000000051') <> 2
   OR (SELECT total_wins FROM public.players WHERE id='00000000-0000-0000-0000-000000000051') <> 2
  THEN RAISE EXCEPTION 'QA FAIL: valid reentries miscounted, or ELO/prizes modified incorrectly'; END IF;
END;
$qa$;

-- Malformed entry counts must abort atomically (no ELO, prizes or status changes).
SET ROLE authenticated;
SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
DO $qa$
DECLARE tid uuid; rejected boolean;
BEGIN
  FOREACH tid IN ARRAY ARRAY[
    '00000000-0000-0000-0000-000000000019'::uuid,
    '00000000-0000-0000-0000-000000000020'::uuid,
    '00000000-0000-0000-0000-000000000023'::uuid
  ] LOOP
    rejected := false;
    BEGIN
      PERFORM public.calculate_tournament_elo_guarded(tid);
    EXCEPTION WHEN SQLSTATE '22023' THEN
      rejected := true;
    END;
    IF NOT rejected THEN RAISE EXCEPTION 'QA FAIL: invalid reentry count was accepted for %',tid; END IF;
  END LOOP;
END;
$qa$;
RESET ROLE;

DO $qa$
BEGIN
  IF (SELECT count(*) FROM public.elo_history WHERE tournament_id IN
     ('00000000-0000-0000-0000-000000000019'::uuid,
      '00000000-0000-0000-0000-000000000020'::uuid,
      '00000000-0000-0000-0000-000000000023'::uuid)) <> 0
   OR EXISTS (SELECT 1 FROM public.tournaments WHERE id IN
     ('00000000-0000-0000-0000-000000000019'::uuid,
      '00000000-0000-0000-0000-000000000020'::uuid,
      '00000000-0000-0000-0000-000000000023'::uuid) AND results_uploaded)
   OR (SELECT total_buy_ins_spent FROM public.players WHERE id='00000000-0000-0000-0000-000000000051') <> 40
  THEN RAISE EXCEPTION 'QA FAIL: malformed reentries partially wrote totals or history'; END IF;
END;
$qa$;
SELECT 'PASS: reentry accounting respects entry count and invalid counts cannot mutate results' AS result;
