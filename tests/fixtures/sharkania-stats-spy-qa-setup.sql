\set ON_ERROR_STOP on
-- Synthetic-only PostgreSQL 17 fixtures for Stats Espía guarded RPCs.
-- Executed exclusively in a NEW temporary CI database named qa_stats.
-- Never run against Supabase production, a branch, or customer data.
BEGIN;
DO $roles$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
END;
$roles$;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.sub',true),'')::uuid;
$$;
GRANT USAGE ON SCHEMA auth, public TO anon, authenticated;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon,authenticated;

CREATE TABLE public.profiles(id uuid PRIMARY KEY,role text NOT NULL);
CREATE TABLE public.user_purchases(user_id uuid NOT NULL,feature_key text NOT NULL,is_active boolean NOT NULL,expires_at timestamptz);
CREATE TABLE public.players(
 id uuid PRIMARY KEY,profile_id uuid,slug text NOT NULL,nickname text,
 total_tournaments integer DEFAULT 0,total_cashes integer DEFAULT 0,
 total_wins integer DEFAULT 0,total_prize_won numeric DEFAULT 0,
 total_buy_ins_spent numeric DEFAULT 0
);
CREATE TABLE public.clubs(id uuid PRIMARY KEY,name text,slug text);
CREATE TABLE public.tournaments(
 id uuid PRIMARY KEY,name text,slug text,buy_in numeric,currency text,
 start_datetime timestamptz,club_id uuid
);
CREATE TABLE public.tournament_results(
 id uuid PRIMARY KEY,tournament_id uuid NOT NULL,player_id uuid NOT NULL,
 position integer,prize_won numeric,buy_ins_count integer,elo_change numeric,
 ccp_club text,created_at timestamptz NOT NULL
);
INSERT INTO public.profiles(id,role) VALUES
 ('00000000-0000-0000-0000-000000000001','super_admin'),
 ('00000000-0000-0000-0000-000000000002','player'),
 ('00000000-0000-0000-0000-000000000003','player'),
 ('00000000-0000-0000-0000-000000000004','player'),
 ('00000000-0000-0000-0000-000000000005','player');
INSERT INTO public.user_purchases(user_id,feature_key,is_active,expires_at) VALUES
 ('00000000-0000-0000-0000-000000000003','cosmetic_extended_stats',true,now()+interval '10 days'),
 ('00000000-0000-0000-0000-000000000004','cosmetic_extended_stats',true,now()-interval '1 day'),
 ('00000000-0000-0000-0000-000000000005','cosmetic_extended_stats',false,now()+interval '10 days');
INSERT INTO public.players(id,profile_id,slug,nickname,total_tournaments,total_cashes,total_wins,total_prize_won,total_buy_ins_spent) VALUES
 ('00000000-0000-0000-0000-000000000051','00000000-0000-0000-0000-000000000061','mixed-main','Mixed main',2,2,1,150,40),
 ('00000000-0000-0000-0000-000000000052','00000000-0000-0000-0000-000000000061','mixed-alias','Mixed alias',1,1,0,5000,5000),
 ('00000000-0000-0000-0000-000000000053','00000000-0000-0000-0000-000000000062','single-player','Single currency',1,1,1,30000,20000);
INSERT INTO public.clubs(id,name,slug) VALUES
 ('00000000-0000-0000-0000-000000000081','Synthetic Club','synthetic-club');
INSERT INTO public.tournaments(id,name,slug,buy_in,currency,start_datetime,club_id) VALUES
 ('00000000-0000-0000-0000-000000000071','Synthetic EUR','synthetic-eur',10,'EUR',now(),'00000000-0000-0000-0000-000000000081'),
 ('00000000-0000-0000-0000-000000000072','Synthetic USD','synthetic-usd',20,'USD',now(),'00000000-0000-0000-0000-000000000081'),
 ('00000000-0000-0000-0000-000000000073','Synthetic CLP','synthetic-clp',5000,'CLP',now(),'00000000-0000-0000-0000-000000000081'),
 ('00000000-0000-0000-0000-000000000074','Synthetic Single CLP','synthetic-single-clp',10000,'CLP',now(),'00000000-0000-0000-0000-000000000081');
INSERT INTO public.tournament_results(id,tournament_id,player_id,position,prize_won,buy_ins_count,elo_change,ccp_club,created_at) VALUES
 ('00000000-0000-0000-0000-000000000091','00000000-0000-0000-0000-000000000071','00000000-0000-0000-0000-000000000051',1,50,2,15,'CCP',now()-interval '3 days'),
 ('00000000-0000-0000-0000-000000000092','00000000-0000-0000-0000-000000000072','00000000-0000-0000-0000-000000000051',2,100,1,-5,'CCP',now()-interval '2 days'),
 ('00000000-0000-0000-0000-000000000093','00000000-0000-0000-0000-000000000073','00000000-0000-0000-0000-000000000052',3,5000,1,0,'CCP',now()-interval '1 day'),
 ('00000000-0000-0000-0000-000000000094','00000000-0000-0000-0000-000000000074','00000000-0000-0000-0000-000000000053',1,30000,2,20,'CCP',now());

-- The guarded SECURITY DEFINER endpoints execute as the fixture owner.
-- No direct SELECT on synthetic financial tables is needed by callers.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC, anon, authenticated;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clubs ENABLE ROW LEVEL SECURITY;
COMMIT;
