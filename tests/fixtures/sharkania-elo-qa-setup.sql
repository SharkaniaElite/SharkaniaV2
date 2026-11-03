\set ON_ERROR_STOP on
-- Run in a NEW ephemeral PostgreSQL 17 database, never Supabase production.
BEGIN;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.sub',true),'')::uuid;
$$;
CREATE TABLE public.profiles(id uuid PRIMARY KEY,role text NOT NULL,unified_elo numeric);
CREATE TABLE public.club_admins(club_id uuid NOT NULL,user_id uuid NOT NULL);
CREATE TABLE public.tournaments(id uuid PRIMARY KEY,club_id uuid NOT NULL,buy_in numeric(10,2) NOT NULL,results_uploaded boolean NOT NULL DEFAULT false,status text NOT NULL DEFAULT 'scheduled');
CREATE TABLE public.players(id uuid PRIMARY KEY,profile_id uuid,elo_rating numeric(10,2) NOT NULL DEFAULT 1200,elo_peak numeric(10,2) NOT NULL DEFAULT 1200,total_tournaments integer NOT NULL DEFAULT 0,total_cashes integer NOT NULL DEFAULT 0,total_wins integer NOT NULL DEFAULT 0,total_prize_won numeric(12,2) NOT NULL DEFAULT 0,total_buy_ins_spent numeric(12,2) NOT NULL DEFAULT 0);
CREATE TABLE public.tournament_results(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tournament_id uuid NOT NULL,player_id uuid NOT NULL,position integer NOT NULL,prize_won numeric(10,2) NOT NULL DEFAULT 0,bounties_won numeric(10,2) NOT NULL DEFAULT 0,buy_ins_count numeric NOT NULL DEFAULT 1,elo_before numeric(10,2),elo_after numeric(10,2),elo_change numeric(10,2));
CREATE TABLE public.elo_history(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tournament_id uuid NOT NULL,player_id uuid NOT NULL,elo_before numeric(10,2) NOT NULL,elo_after numeric(10,2) NOT NULL,elo_change numeric(10,2) NOT NULL);
INSERT INTO public.profiles(id,role) VALUES
('00000000-0000-0000-0000-000000000001','super_admin'),
('00000000-0000-0000-0000-000000000002','player'),
('00000000-0000-0000-0000-000000000003','player'),
('00000000-0000-0000-0000-000000000005','player'),
('00000000-0000-0000-0000-000000000061','player'),
('00000000-0000-0000-0000-000000000062','player');
INSERT INTO public.club_admins VALUES
('00000000-0000-0000-0000-000000000021','00000000-0000-0000-0000-000000000002'),
('00000000-0000-0000-0000-000000000022','00000000-0000-0000-0000-000000000005');
INSERT INTO public.tournaments(id,club_id,buy_in) VALUES
('00000000-0000-0000-0000-000000000011','00000000-0000-0000-0000-000000000021',10),
('00000000-0000-0000-0000-000000000012','00000000-0000-0000-0000-000000000022',10);
INSERT INTO public.players(id,profile_id) VALUES
('00000000-0000-0000-0000-000000000051','00000000-0000-0000-0000-000000000061'),
('00000000-0000-0000-0000-000000000052','00000000-0000-0000-0000-000000000062');
INSERT INTO public.tournament_results(tournament_id,player_id,position,prize_won,bounties_won) VALUES
('00000000-0000-0000-0000-000000000011','00000000-0000-0000-0000-000000000051',1,50,5),
('00000000-0000-0000-0000-000000000011','00000000-0000-0000-0000-000000000052',2,0,0),
('00000000-0000-0000-0000-000000000012','00000000-0000-0000-0000-000000000051',1,50,0),
('00000000-0000-0000-0000-000000000012','00000000-0000-0000-0000-000000000052',2,0,0);
CREATE FUNCTION public.is_super_admin() RETURNS boolean
LANGUAGE sql SECURITY DEFINER SET search_path TO '' AS $$
SELECT EXISTS(SELECT 1 FROM public.profiles WHERE id=(SELECT auth.uid()) AND role='super_admin');
$$;
CREATE FUNCTION public.is_club_admin(p_club_id uuid) RETURNS boolean
LANGUAGE sql SECURITY DEFINER SET search_path TO '' AS $$
SELECT EXISTS(SELECT 1 FROM public.club_admins WHERE club_id=p_club_id AND user_id=(SELECT auth.uid()));
$$;
CREATE FUNCTION public.get_unified_elo(p_profile_id uuid) RETURNS numeric
LANGUAGE sql SECURITY DEFINER SET search_path TO '' AS $$
SELECT p.elo_rating FROM public.players p WHERE p.profile_id=p_profile_id LIMIT 1;
$$;
GRANT USAGE ON SCHEMA auth,public TO anon,authenticated;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon,authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin(),public.is_club_admin(uuid),public.get_unified_elo(uuid) TO authenticated;
-- Simulate protected tables: only the owner/guarded RPC can mutate.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.elo_history ENABLE ROW LEVEL SECURITY;
COMMIT;
