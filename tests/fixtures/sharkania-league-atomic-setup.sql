\set ON_ERROR_STOP on
-- Single disposable PostgreSQL 17 QA database. NEVER production.
\ir sharkania-league-membership-qa-setup.sql
-- Mirror only columns/constraints used by the new server writer. All fake IDs.
ALTER TABLE public.tournaments
 ADD COLUMN room_id uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000031',
 ADD COLUMN currency text NOT NULL DEFAULT 'USD',
 ADD COLUMN start_datetime timestamptz NOT NULL DEFAULT '2026-11-01T20:00:00Z';
ALTER TABLE public.players
 ADD COLUMN room_id uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000031';
ALTER TABLE public.tournament_results
 ADD COLUMN league_points_earned numeric NOT NULL DEFAULT 0,
 ADD COLUMN ccp_club text;
ALTER TABLE public.elo_history
 ADD COLUMN recorded_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.league_standings
 ADD COLUMN id uuid NOT NULL DEFAULT gen_random_uuid(),
 ADD COLUMN total_points numeric NOT NULL DEFAULT 0,
 ADD COLUMN tournaments_played integer NOT NULL DEFAULT 0,
 ADD COLUMN best_position integer,
 ADD COLUMN final_tables_count integer NOT NULL DEFAULT 0,
 ADD COLUMN rank_position integer,
 ADD COLUMN ccp_club text,
 ADD COLUMN total_buy_ins_spent numeric NOT NULL DEFAULT 0,
 ADD COLUMN last_tournament_id uuid,
 ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
CREATE UNIQUE INDEX qa_result_writer_standings_pk ON public.league_standings(id);
ALTER TABLE public.league_standings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.league_standings FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.league_standings TO anon,authenticated;
CREATE POLICY qa_atomic_standings_read ON public.league_standings FOR SELECT
 TO anon,authenticated USING (true);

UPDATE public.tournaments
SET start_datetime='2026-11-01T20:00:00Z'
WHERE id='00000000-0000-0000-0000-000000000011';
UPDATE public.tournaments
SET start_datetime='2026-11-03T20:00:00Z'
WHERE id='00000000-0000-0000-0000-000000000012';
UPDATE public.tournament_results
SET league_points_earned=CASE WHEN position=1 THEN 11 ELSE 5 END
WHERE tournament_id='00000000-0000-0000-0000-000000000011';
INSERT INTO public.league_standings (
 id,league_id,player_id,total_points,tournaments_played,best_position,
 final_tables_count,rank_position,ccp_club,total_buy_ins_spent,last_tournament_id
) VALUES (
 '00000000-0000-0000-0000-000000000075',
 '00000000-0000-0000-0000-000000000041',
 '00000000-0000-0000-0000-000000000051',
 11,1,1,1,1,'CCP-LOCKED',95,
 '00000000-0000-0000-0000-000000000011'
);
INSERT INTO public.tournaments(
 id,club_id,buy_in,league_id,room_id,currency,start_datetime
) VALUES (
 '00000000-0000-0000-0000-000000000071',
 '00000000-0000-0000-0000-000000000021',
 3.30,'00000000-0000-0000-0000-000000000041',
 '00000000-0000-0000-0000-000000000031',
 'USD','2026-11-05T20:00:00Z'
);
\echo 'PASS: fake league results writer schema prepared'
