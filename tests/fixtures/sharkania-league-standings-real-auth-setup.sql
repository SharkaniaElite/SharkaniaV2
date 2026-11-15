\set ON_ERROR_STOP on
-- SHARKANIA — isolated QA only, extends pre-existing fake real-Auth schema.
-- Executed strictly in GitHub runner Supabase local loopback after legacy QA.
-- This intentionally does not modify the production schema or access grants.
ALTER TABLE public.tournaments
  ADD COLUMN start_datetime timestamptz NOT NULL DEFAULT '2026-11-01T20:00:00Z';
ALTER TABLE public.tournament_results
  ADD COLUMN league_points_earned numeric NOT NULL DEFAULT 0,
  ADD COLUMN ccp_club text;
ALTER TABLE public.league_standings
  ADD COLUMN id uuid NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN total_points numeric NOT NULL DEFAULT 0,
  ADD COLUMN tournaments_played integer NOT NULL DEFAULT 0,
  ADD COLUMN best_position integer,
  ADD COLUMN final_tables_count integer NOT NULL DEFAULT 0,
  ADD COLUMN rank_position integer,
  ADD COLUMN ccp_club text,
  ADD COLUMN total_buy_ins_spent numeric DEFAULT 0,
  ADD COLUMN last_tournament_id uuid,
  ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
CREATE UNIQUE INDEX qa_real_auth_standings_id ON public.league_standings(id);
ALTER TABLE public.league_standings ENABLE ROW LEVEL SECURITY;
REVOKE INSERT,UPDATE,DELETE ON public.league_standings FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.league_standings TO anon,authenticated;
CREATE POLICY qa_real_auth_standings_read ON public.league_standings
 FOR SELECT TO anon,authenticated USING (true);

UPDATE public.leagues SET best_dates_to_count=1
WHERE id='00000000-0000-0000-0000-000000000041';
UPDATE public.tournaments
SET start_datetime='2026-11-01T20:00:00Z'
WHERE id='00000000-0000-0000-0000-000000000011';
-- Two pre-existing fake players; one has an older result without CCP.
UPDATE public.tournament_results
SET league_points_earned=CASE
  WHEN player_id='00000000-0000-0000-0000-000000000051' THEN 10 ELSE 20 END,
 ccp_club=CASE
  WHEN player_id='00000000-0000-0000-0000-000000000051' THEN 'CCP-INITIAL' ELSE NULL END,
 buy_ins_count=CASE
  WHEN player_id='00000000-0000-0000-0000-000000000051' THEN 1 ELSE 2 END
WHERE tournament_id='00000000-0000-0000-0000-000000000011';

INSERT INTO public.tournaments(id,club_id,buy_in,league_id,start_datetime)
VALUES ('00000000-0000-0000-0000-000000000013',
 '00000000-0000-0000-0000-000000000021',3.30,
 '00000000-0000-0000-0000-000000000041','2026-11-03T20:00:00Z');
INSERT INTO public.tournament_results (
  tournament_id,player_id,position,league_points_earned,ccp_club,buy_ins_count
) VALUES
('00000000-0000-0000-0000-000000000013','00000000-0000-0000-0000-000000000051',5,30,'CCP-LATER',2),
('00000000-0000-0000-0000-000000000013','00000000-0000-0000-0000-000000000052',1,5,'CCP-FIRST-52',3);

-- Existing row must keep UUID and locked club + registration count.
INSERT INTO public.league_standings (
 id,league_id,player_id,total_points,tournaments_played,best_position,
 final_tables_count,rank_position,ccp_club,total_buy_ins_spent,last_tournament_id
) VALUES (
 '00000000-0000-0000-0000-000000000061',
 '00000000-0000-0000-0000-000000000041',
 '00000000-0000-0000-0000-000000000051',
 0,0,NULL,0,90,'CCP-LOCKED',99,'00000000-0000-0000-0000-000000000011'
);
-- An orphan in the second league must reject calculation and preserve history.
INSERT INTO public.league_standings (
 id,league_id,player_id,total_points,tournaments_played,
 best_position,final_tables_count,rank_position,ccp_club,total_buy_ins_spent
) VALUES (
 '00000000-0000-0000-0000-000000000062',
 '00000000-0000-0000-0000-000000000042',
 '00000000-0000-0000-0000-000000000052',
 1200,0,2,1,7,'CCP-HISTORIC',8
);
\echo 'PASS: real Supabase Auth standings QA extension prepared locally'