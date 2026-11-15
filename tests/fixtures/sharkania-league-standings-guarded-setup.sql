-- Ephemeral PostgreSQL 17 only: synthetic users, roles, clubs, tournaments.
-- Never run on production; the workflow creates a disposable QA database.
CREATE SCHEMA auth;
CREATE TABLE public.qa_club_admins(club_id uuid NOT NULL,user_id uuid NOT NULL);
CREATE TABLE public.qa_superadmins(user_id uuid PRIMARY KEY);
CREATE TABLE public.leagues(id uuid PRIMARY KEY,best_dates_to_count integer);
CREATE TABLE public.league_clubs(league_id uuid NOT NULL,club_id uuid NOT NULL,is_primary boolean NOT NULL);
CREATE TABLE public.tournaments(id uuid PRIMARY KEY,league_id uuid,start_datetime timestamptz NOT NULL);
CREATE TABLE public.tournament_results(
  id uuid PRIMARY KEY,tournament_id uuid NOT NULL,player_id uuid NOT NULL,
  league_points_earned numeric NOT NULL,position integer NOT NULL,
  ccp_club text,buy_ins_count integer NOT NULL
);
CREATE TABLE public.league_standings(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id uuid NOT NULL,player_id uuid NOT NULL,
  total_points numeric NOT NULL DEFAULT 0,
  tournaments_played integer NOT NULL DEFAULT 0,
  best_position integer,final_tables_count integer,
  rank_position integer,ccp_club text,
  total_buy_ins_spent numeric DEFAULT 0,
  last_tournament_id uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT qa_standings_unique UNIQUE(league_id,player_id)
);
CREATE FUNCTION auth.uid() RETURNS uuid
LANGUAGE sql STABLE SET search_path TO '' AS $f$
 SELECT nullif(pg_catalog.current_setting('request.jwt.claim.sub',true),'')::uuid
$f$;
CREATE FUNCTION public.is_club_admin(p_club_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $f$
 SELECT EXISTS(SELECT 1 FROM public.qa_club_admins
  WHERE club_id=p_club_id AND user_id=(SELECT auth.uid()))
$f$;
CREATE FUNCTION public.is_super_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $f$
 SELECT EXISTS(SELECT 1 FROM public.qa_superadmins
  WHERE user_id=(SELECT auth.uid()))
$f$;
ALTER TABLE public.league_standings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.league_standings FROM PUBLIC,anon,authenticated;
GRANT SELECT ON TABLE public.league_standings TO anon,authenticated;
CREATE POLICY qa_standings_read ON public.league_standings
 FOR SELECT TO anon,authenticated USING (true);
GRANT USAGE ON SCHEMA auth TO anon,authenticated;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon,authenticated;
-- Synthetic IDs: A=001; B=002; player=003; superadmin=004;
-- clubs A=021/B=022, leagues A=011/B=012.
INSERT INTO public.qa_club_admins VALUES
 ('00000000-0000-0000-0000-000000000021','00000000-0000-0000-0000-000000000001'),
 ('00000000-0000-0000-0000-000000000022','00000000-0000-0000-0000-000000000002');
INSERT INTO public.qa_superadmins VALUES ('00000000-0000-0000-0000-000000000004');
INSERT INTO public.leagues VALUES
 ('00000000-0000-0000-0000-000000000011',1),
 ('00000000-0000-0000-0000-000000000012',2);
INSERT INTO public.league_clubs VALUES
 ('00000000-0000-0000-0000-000000000011','00000000-0000-0000-0000-000000000021',true),
 ('00000000-0000-0000-0000-000000000011','00000000-0000-0000-0000-000000000022',false),
 ('00000000-0000-0000-0000-000000000012','00000000-0000-0000-0000-000000000022',true);
INSERT INTO public.tournaments VALUES
 ('00000000-0000-0000-0000-000000000041','00000000-0000-0000-0000-000000000011','2026-11-01T20:00:00Z'),
 ('00000000-0000-0000-0000-000000000042','00000000-0000-0000-0000-000000000011','2026-11-03T20:00:00Z'),
 ('00000000-0000-0000-0000-000000000043','00000000-0000-0000-0000-000000000012','2026-11-01T20:00:00Z');
INSERT INTO public.tournament_results VALUES
 ('00000000-0000-0000-0000-000000000051','00000000-0000-0000-0000-000000000041','00000000-0000-0000-0000-000000000031',10,1,'CCP-OLD',1),
 ('00000000-0000-0000-0000-000000000052','00000000-0000-0000-0000-000000000042','00000000-0000-0000-0000-000000000031',30,5,'CCP-NEW',2),
 ('00000000-0000-0000-0000-000000000053','00000000-0000-0000-0000-000000000041','00000000-0000-0000-0000-000000000032',20,2,'CCP-B',3),
 ('00000000-0000-0000-0000-000000000054','00000000-0000-0000-0000-000000000043','00000000-0000-0000-0000-000000000033',7,4,'CCP-B',1);
INSERT INTO public.league_standings (
 id,league_id,player_id,total_points,tournaments_played,best_position,
 final_tables_count,rank_position,ccp_club,total_buy_ins_spent,last_tournament_id
) VALUES
 ('00000000-0000-0000-0000-000000000061','00000000-0000-0000-0000-000000000011','00000000-0000-0000-0000-000000000031',0,0,NULL,0,99,'CCP-LOCKED',99,'00000000-0000-0000-0000-000000000041'),
 ('00000000-0000-0000-0000-000000000062','00000000-0000-0000-0000-000000000012','00000000-0000-0000-0000-000000000033',0,0,NULL,0,99,'CCP-HISTORIC',88,NULL),
 -- Historical orphan: has standings without a corresponding result in league B.
 ('00000000-0000-0000-0000-000000000063','00000000-0000-0000-0000-000000000012','00000000-0000-0000-0000-000000000034',5,1,6,1,88,'CCP-HISTORIC',2,NULL);
