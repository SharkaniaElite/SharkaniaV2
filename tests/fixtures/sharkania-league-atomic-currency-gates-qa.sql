\set ON_ERROR_STOP on
-- QA-ONLY. Ephemeral PostgreSQL, all clubs, tournaments and players synthetic.
-- Enforces that non-USD tournaments and unknown players cannot partially
-- change Elo, tournament results, standings, player stats or publication ledger.
BEGIN;

INSERT INTO public.tournaments
(id, club_id, buy_in, league_id, room_id, currency, start_datetime)
VALUES
('00000000-0000-0000-0000-000000000072',
 '00000000-0000-0000-0000-000000000021', 12,
 '00000000-0000-0000-0000-000000000041',
 '00000000-0000-0000-0000-000000000031', 'EUR', '2026-11-05T21:00:00Z'),
('00000000-0000-0000-0000-000000000073',
 '00000000-0000-0000-0000-000000000021', 3300,
 '00000000-0000-0000-0000-000000000041',
 '00000000-0000-0000-0000-000000000031', 'CLP', '2026-11-05T21:00:00Z'),
('00000000-0000-0000-0000-000000000074',
 '00000000-0000-0000-0000-000000000021', 3.30,
 '00000000-0000-0000-0000-000000000041',
 '00000000-0000-0000-0000-000000000031', 'USD', '2026-11-05T21:00:00Z');

CREATE TEMP TABLE qa_currency_snapshot AS SELECT
 (SELECT COALESCE(jsonb_agg(to_jsonb(p) ORDER BY p.id),'[]'::jsonb) FROM public.players p) AS players_before,
 (SELECT COALESCE(jsonb_agg(to_jsonb(p) ORDER BY p.id),'[]'::jsonb) FROM public.profiles p) AS profiles_before,
 (SELECT COALESCE(jsonb_agg(to_jsonb(s) ORDER BY s.league_id,s.player_id),'[]'::jsonb)
    FROM public.league_standings s) AS standings_before,
 (SELECT COALESCE(jsonb_agg(to_jsonb(h) ORDER BY h.id),'[]'::jsonb) FROM public.elo_history h) AS history_before,
 (SELECT COALESCE(jsonb_agg(to_jsonb(r) ORDER BY r.id),'[]'::jsonb)
    FROM public.tournament_results r) AS results_before;

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';

DO $qa$
DECLARE
  v_currency text;
  v_tournament uuid;
  v_payload jsonb := '[
    {"player_id":"00000000-0000-0000-0000-000000000051","position":1,
     "prize_won":20,"bounties_won":0,"league_points_earned":10,
     "ccp_club":null,"buy_ins_count":1},
    {"player_id":"00000000-0000-0000-0000-000000000052","position":2,
     "prize_won":0,"bounties_won":0,"league_points_earned":5,
     "ccp_club":null,"buy_ins_count":1}]'::jsonb;
  v_denied boolean;
BEGIN
  -- Exact synthetic IDs are supplied by the fixture, not queried through a
  -- role without table SELECT; the SECURITY DEFINER RPC owns authorization.
  FOR v_currency, v_tournament IN
    SELECT x.currency,x.tournament_id
    FROM (VALUES
      ('CLP'::text,'00000000-0000-0000-0000-000000000073'::uuid),
      ('EUR'::text,'00000000-0000-0000-0000-000000000072'::uuid)
    ) AS x(currency,tournament_id)
    ORDER BY x.currency
  LOOP
    v_denied := false;
    BEGIN
      PERFORM public.publish_league_results_guarded_qa(v_tournament,'upload',v_payload);
    EXCEPTION WHEN SQLSTATE 'PT409' THEN
      IF SQLERRM NOT LIKE 'Currency conversion rules must be approved%' THEN
        RAISE EXCEPTION 'FAIL: % unexpectedly rejected for another reason: %',
          v_currency, SQLERRM;
      END IF;
      v_denied:=true;
    END;
    IF v_denied IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'FAIL: % currency bypassed the QA-only safe stop', v_currency;
    END IF;
    RAISE NOTICE 'PASS: % safely rejected before all publication writes',v_currency;
  END LOOP;
END;
$qa$;

DO $qa$
DECLARE v_denied boolean:=false;
BEGIN
  BEGIN
    PERFORM public.publish_league_results_guarded_qa(
      '00000000-0000-0000-0000-000000000074','upload',
      '[
      {"player_id":"00000000-0000-0000-0000-000000000051","position":1,
       "prize_won":20,"bounties_won":0,"league_points_earned":10,
       "ccp_club":null,"buy_ins_count":1},
      {"player_id":"00000000-0000-0000-0000-000000000099","position":2,
       "prize_won":0,"bounties_won":0,"league_points_earned":5,
       "ccp_club":null,"buy_ins_count":1}]'::jsonb
    );
  EXCEPTION WHEN SQLSTATE 'PT422' THEN
    IF SQLERRM NOT LIKE 'Unknown players:%' THEN
      RAISE EXCEPTION 'FAIL: unknown nickname failed for another reason: %',SQLERRM;
    END IF;
    v_denied:=true;
  END;
  IF v_denied IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'FAIL: missing player was published, unlike the secure contract';
  END IF;
  RAISE NOTICE 'PASS: unknown player cannot create partial results or a nickname';
END;
$qa$;
RESET ROLE;

DO $qa$
DECLARE s record;
BEGIN
  SELECT * INTO s FROM qa_currency_snapshot;
  IF s.players_before IS DISTINCT FROM
        (SELECT COALESCE(jsonb_agg(to_jsonb(p) ORDER BY p.id),'[]'::jsonb) FROM public.players p)
    OR s.profiles_before IS DISTINCT FROM
        (SELECT COALESCE(jsonb_agg(to_jsonb(p) ORDER BY p.id),'[]'::jsonb) FROM public.profiles p)
    OR s.standings_before IS DISTINCT FROM
        (SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.league_id,x.player_id),'[]'::jsonb)
         FROM public.league_standings x)
    OR s.history_before IS DISTINCT FROM
        (SELECT COALESCE(jsonb_agg(to_jsonb(h) ORDER BY h.id),'[]'::jsonb) FROM public.elo_history h)
    OR s.results_before IS DISTINCT FROM
        (SELECT COALESCE(jsonb_agg(to_jsonb(r) ORDER BY r.id),'[]'::jsonb)
         FROM public.tournament_results r)
    OR EXISTS (
      SELECT 1 FROM sharkania_release_qa.elo_publication p
      WHERE p.tournament_id IN (
        '00000000-0000-0000-0000-000000000072'::uuid,
        '00000000-0000-0000-0000-000000000073'::uuid,
        '00000000-0000-0000-0000-000000000074'::uuid)
    )
    OR EXISTS (
      SELECT 1 FROM public.tournaments t
      WHERE t.id IN (
        '00000000-0000-0000-0000-000000000072'::uuid,
        '00000000-0000-0000-0000-000000000073'::uuid,
        '00000000-0000-0000-0000-000000000074'::uuid)
      AND (t.results_uploaded=true OR t.status<>'scheduled')
    )
  THEN RAISE EXCEPTION 'FAIL: rejected currency or unknown player changed business data'; END IF;
  RAISE NOTICE 'PASS: complete business snapshot unchanged for EUR, CLP and missing player';
END;
$qa$;

ROLLBACK;
SELECT 'PASS: currency rejection, missing player and no partial persistence' AS status;
