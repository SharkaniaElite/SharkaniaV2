\set ON_ERROR_STOP on
-- PostgreSQL 17 synthetic-only CI database qa_publish; no Supabase data.
-- Reuse the previously proven fake Auth + guarded ELO test identities.
\ir sharkania-elo-qa-setup.sql

-- Extend the small ELO fixture to match required real app columns.
ALTER TABLE public.tournaments
  ADD COLUMN league_id uuid,
  ADD COLUMN room_id uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000031'::uuid,
  ADD COLUMN currency text NOT NULL DEFAULT 'USD',
  ADD COLUMN start_datetime timestamptz NOT NULL DEFAULT '2026-11-01 12:00+00'::timestamptz;
UPDATE public.tournaments
SET start_datetime=CASE
  WHEN id='00000000-0000-0000-0000-000000000011'::uuid
  THEN '2026-11-01 12:00+00'::timestamptz
  ELSE '2026-11-02 12:00+00'::timestamptz END,
  league_id='00000000-0000-0000-0000-000000000041'::uuid;

ALTER TABLE public.players
  ADD COLUMN nickname text NOT NULL DEFAULT 'unassigned',
  ADD COLUMN room_id uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000031'::uuid,
  ADD COLUMN country_code text,
  ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.players ALTER COLUMN id SET DEFAULT gen_random_uuid();
UPDATE public.players SET nickname=CASE
  WHEN id='00000000-0000-0000-0000-000000000051'::uuid THEN 'QaPlayerOne'
  ELSE 'QaPlayerTwo' END;

ALTER TABLE public.tournament_results
  ADD COLUMN league_points_earned numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN ccp_club text;
ALTER TABLE public.elo_history
  ADD COLUMN recorded_at timestamptz NOT NULL DEFAULT now();

-- Base fixture contains pre-inserted unprocessed results for older ELO-only
-- tests, but publication specifically must start with a CLEAN tournament.
TRUNCATE public.tournament_results;
CREATE TABLE public.leagues(id uuid PRIMARY KEY);
INSERT INTO public.leagues VALUES
  ('00000000-0000-0000-0000-000000000041'::uuid);
CREATE TABLE public.league_clubs(
  league_id uuid NOT NULL, club_id uuid NOT NULL, is_primary boolean NOT NULL DEFAULT false
);
INSERT INTO public.league_clubs VALUES
  ('00000000-0000-0000-0000-000000000041','00000000-0000-0000-0000-000000000021',true),
  ('00000000-0000-0000-0000-000000000041','00000000-0000-0000-0000-000000000022',false);
CREATE TABLE public.league_standings(
  league_id uuid NOT NULL,player_id uuid NOT NULL,
  total_points numeric NOT NULL DEFAULT 0,
  tournaments_played integer NOT NULL DEFAULT 0,
  best_position integer,
  total_buy_ins_spent numeric NOT NULL DEFAULT 0,
  ccp_club text,last_tournament_id uuid,
  PRIMARY KEY(league_id,player_id)
);

-- The CI subset implements *only* a minimal league points aggregate;
-- full production "best dates" scoring/CCP was tested separately in local QA.
CREATE FUNCTION public.recalculate_league_standings(p_league_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $qa$
BEGIN
  DELETE FROM public.league_standings WHERE league_id=p_league_id;
  INSERT INTO public.league_standings
    (league_id,player_id,total_points,tournaments_played,best_position)
  SELECT p_league_id,tr.player_id,coalesce(sum(tr.league_points_earned),0),
         count(*)::integer,min(tr.position)
  FROM public.tournament_results tr
  JOIN public.tournaments t ON t.id=tr.tournament_id
  WHERE t.league_id=p_league_id AND t.status='completed'
  GROUP BY tr.player_id;
END;
$qa$;
REVOKE ALL ON FUNCTION public.recalculate_league_standings(uuid)
  FROM PUBLIC,anon,authenticated;

-- The 3 real SQL proposals, applied to synthetic tables only (not production).
\ir ../../docs/security/elo-transactional-guarded-rpc-2026-11-03.proposal.sql
\ir ../../docs/security/player-creation-guarded-rpc-2026-11-04.proposal.sql
\ir ../../docs/security/tournament-publication-transaction-2026-11-04.proposal.sql

SELECT 'PASS: synthetic publication schema and guarded functions installed' AS status;
