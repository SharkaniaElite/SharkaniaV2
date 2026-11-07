\set ON_ERROR_STOP on
-- 100% synthetic PostgreSQL 17 fixture; no production data, never Supabase cloud.
-- The current weak policy is reproduced, then the proposed replacement is
-- tested under distinct JWT roles and rolled back in this database.
BEGIN;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid
LANGUAGE sql STABLE SET search_path TO ''
AS $fn$
 SELECT NULLIF(pg_catalog.current_setting('request.jwt.claim.sub',true),'')::uuid;
$fn$;
CREATE FUNCTION auth.role() RETURNS text
LANGUAGE sql STABLE SET search_path TO ''
AS $fn$ SELECT current_user::text; $fn$;
GRANT USAGE ON SCHEMA auth,public TO anon,authenticated;
GRANT EXECUTE ON FUNCTION auth.uid(),auth.role() TO anon,authenticated;

CREATE TABLE public.profiles(id uuid PRIMARY KEY,role text NOT NULL);
CREATE TABLE public.club_admins(club_id uuid NOT NULL,user_id uuid NOT NULL);
CREATE TABLE public.league_clubs(
 league_id uuid NOT NULL,club_id uuid NOT NULL,is_primary boolean NOT NULL);
CREATE TABLE public.league_standings(
 league_id uuid NOT NULL,player_id uuid NOT NULL,
 total_points numeric NOT NULL DEFAULT 0,
 PRIMARY KEY (league_id,player_id));
INSERT INTO public.profiles(id,role) VALUES
 ('00000000-0000-0000-0000-000000000001','super_admin'),
 ('00000000-0000-0000-0000-000000000002','player'),
 ('00000000-0000-0000-0000-000000000005','player'),
 ('00000000-0000-0000-0000-000000000003','player');
INSERT INTO public.club_admins(club_id,user_id) VALUES
 ('00000000-0000-0000-0000-000000000021','00000000-0000-0000-0000-000000000002'),
 ('00000000-0000-0000-0000-000000000022','00000000-0000-0000-0000-000000000005');
INSERT INTO public.league_clubs(league_id,club_id,is_primary) VALUES
 ('00000000-0000-0000-0000-000000000041','00000000-0000-0000-0000-000000000021',true),
 ('00000000-0000-0000-0000-000000000041','00000000-0000-0000-0000-000000000022',false),
 ('00000000-0000-0000-0000-000000000042','00000000-0000-0000-0000-000000000022',true);
INSERT INTO public.league_standings(league_id,player_id,total_points) VALUES
 ('00000000-0000-0000-0000-000000000041','00000000-0000-0000-0000-000000000051',10),
 ('00000000-0000-0000-0000-000000000042','00000000-0000-0000-0000-000000000052',10);
CREATE FUNCTION public.is_super_admin() RETURNS boolean
LANGUAGE sql SECURITY DEFINER SET search_path TO ''
AS $fn$
 SELECT EXISTS(SELECT 1 FROM public.profiles p
 WHERE p.id=(SELECT auth.uid()) AND p.role='super_admin');
$fn$;
CREATE FUNCTION public.is_club_admin(p_id uuid) RETURNS boolean
LANGUAGE sql SECURITY DEFINER SET search_path TO ''
AS $fn$
 SELECT EXISTS(SELECT 1 FROM public.club_admins ca
 WHERE ca.club_id=p_id AND ca.user_id=(SELECT auth.uid()));
$fn$;
GRANT SELECT ON public.league_clubs TO anon,authenticated;
GRANT INSERT,UPDATE,DELETE ON public.league_clubs TO authenticated;
ALTER TABLE public.league_clubs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "League clubs: lectura publica"
  ON public.league_clubs FOR SELECT USING (true);
CREATE POLICY "League clubs: admin update"
  ON public.league_clubs FOR UPDATE
  USING (public.is_super_admin() OR public.is_club_admin(club_id));
CREATE POLICY "League clubs: admin insert"
  ON public.league_clubs FOR INSERT
  WITH CHECK (public.is_super_admin() OR public.is_club_admin(club_id));
GRANT SELECT,INSERT,UPDATE,DELETE ON public.league_standings TO anon,authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin(),public.is_club_admin(uuid) TO anon,authenticated;
ALTER TABLE public.league_standings ENABLE ROW LEVEL SECURITY;
-- Exact effective form of the three broad policies observed in production.
CREATE POLICY "Permitir lectura publica de posiciones"
ON public.league_standings FOR SELECT USING (true);
CREATE POLICY "Permitir actualizar a usuarios autenticados"
ON public.league_standings FOR UPDATE
USING (auth.role()='authenticated'::text);
CREATE POLICY "Permitir eliminar a usuarios autenticados"
ON public.league_standings FOR DELETE
USING (auth.role()='authenticated'::text);
CREATE POLICY "Permitir insertar a usuarios autenticados"
ON public.league_standings FOR INSERT
WITH CHECK (auth.role()='authenticated'::text);
CREATE POLICY "Standings: super admin update"
ON public.league_standings FOR UPDATE USING (public.is_super_admin());
CREATE POLICY "Standings: super admin delete"
ON public.league_standings FOR DELETE USING (public.is_super_admin());
CREATE POLICY "Standings: super admin insert"
ON public.league_standings FOR INSERT WITH CHECK (public.is_super_admin());

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-0000-0000-000000000003';
DO $qa$
DECLARE v_count integer;
BEGIN
 UPDATE public.league_standings SET total_points=999 WHERE
 league_id='00000000-0000-0000-0000-000000000041';
 GET DIAGNOSTICS v_count = ROW_COUNT;
 IF v_count<>1 THEN
   RAISE EXCEPTION 'FAIL: legacy permissive RLS vulnerability not reproduced';
 END IF;
 RAISE NOTICE 'CONFIRMED QA: regular authenticated player can overwrite foreign league points under old policy';
END $qa$;
RESET ROLE;
UPDATE public.league_standings SET total_points=10;

-- Reproduce a separate old-policy escape hatch before proposing the
-- narrow unique-primary invariant. Club B can promote itself in league A.
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-0000-0000-000000000005';
DO $qa$
DECLARE n integer;
BEGIN
 UPDATE public.league_clubs SET is_primary=true
 WHERE league_id='00000000-0000-0000-0000-000000000041'
 AND club_id='00000000-0000-0000-0000-000000000022';
 GET DIAGNOSTICS n=ROW_COUNT;
 IF n<>1 OR (SELECT count(*) FROM public.league_clubs
   WHERE league_id='00000000-0000-0000-0000-000000000041'
     AND is_primary)=1 THEN
   RAISE EXCEPTION 'FAIL: old secondary promotion vulnerability not reproduced';
 END IF;
 RAISE NOTICE 'CONFIRMED QA: secondary club can self-promote and create TWO primaries without constraint';
 UPDATE public.league_clubs SET is_primary=false
 WHERE league_id='00000000-0000-0000-0000-000000000041'
 AND club_id='00000000-0000-0000-0000-000000000022';
END $qa$;
RESET ROLE;

-- Apply the reviewable emergency policy only to this disposable database.
\ir ../../docs/security/league-standings-rls-p0-2026-11-07.qa-only.sql
DO $qa$
BEGIN
 IF EXISTS(SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='league_standings'
    AND policyname IN (
     'Permitir actualizar a usuarios autenticados',
     'Permitir eliminar a usuarios autenticados',
     'Permitir insertar a usuarios autenticados'))
 THEN RAISE EXCEPTION 'FAIL: broad old policies still permit writes through OR'; END IF;
 IF (SELECT count(*) FROM pg_policies WHERE schemaname='public'
   AND tablename='league_standings' AND policyname LIKE 'standings_primary_guarded_%_p0')<>3
 THEN RAISE EXCEPTION 'FAIL: expected three primary-organizer policies'; END IF;
 RAISE NOTICE 'PASS: unsafe permissive policies replaced rather than supplemented';
END $qa$;

-- The old membership UPDATE policy is still permissive, but the new
-- partial unique index rejects secondary-club self-promotion. This gate
-- prevents a B admin from making itself a second primary.
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-0000-0000-000000000005';
DO $qa$
BEGIN
 BEGIN
  UPDATE public.league_clubs SET is_primary=true
  WHERE league_id='00000000-0000-0000-0000-000000000041'
    AND club_id='00000000-0000-0000-0000-000000000022';
  RAISE EXCEPTION 'FAIL: B can still self-promote to second primary';
 EXCEPTION WHEN unique_violation THEN
  RAISE NOTICE 'PASS: unique partial index blocks secondary self-promotion';
 END;
 IF (SELECT count(*) FROM public.league_clubs
   WHERE league_id='00000000-0000-0000-0000-000000000041'
     AND is_primary)<>1
 THEN RAISE EXCEPTION 'FAIL: primary cardinality was corrupted'; END IF;
END $qa$;
RESET ROLE;

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-0000-0000-000000000003';
DO $qa$
DECLARE n integer;
BEGIN
 UPDATE public.league_standings SET total_points=888;
 GET DIAGNOSTICS n=ROW_COUNT;
 IF n<>0 THEN RAISE EXCEPTION 'FAIL: player can UPDATE % league standings',n; END IF;
 DELETE FROM public.league_standings;
 GET DIAGNOSTICS n=ROW_COUNT;
 IF n<>0 THEN RAISE EXCEPTION 'FAIL: player can DELETE % standings',n; END IF;
 BEGIN
   INSERT INTO public.league_standings(league_id,player_id,total_points)
   VALUES ('00000000-0000-0000-0000-000000000041',
     '00000000-0000-0000-0000-000000000053',400);
   RAISE EXCEPTION 'FAIL: player inserted foreign standing';
 EXCEPTION WHEN SQLSTATE '42501' THEN
   RAISE NOTICE 'PASS: player INSERT blocked by RLS';
 END;
 IF (SELECT count(*) FROM public.league_standings)<>2
 THEN RAISE EXCEPTION 'FAIL: public read broken'; END IF;
 RAISE NOTICE 'PASS: player cannot INSERT, UPDATE or DELETE standings; public SELECT works';
END $qa$;
RESET ROLE;

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-0000-0000-000000000005';
DO $qa$
DECLARE n integer;
BEGIN
 UPDATE public.league_standings SET total_points=777 WHERE
 league_id='00000000-0000-0000-0000-000000000041';
 GET DIAGNOSTICS n=ROW_COUNT;
 IF n<>0 THEN RAISE EXCEPTION 'FAIL: secondary club admin modified principal league'; END IF;
 UPDATE public.league_standings SET total_points=12 WHERE
 league_id='00000000-0000-0000-0000-000000000042';
 GET DIAGNOSTICS n=ROW_COUNT;
 IF n<>1 THEN RAISE EXCEPTION 'FAIL: own league admin cannot update standings'; END IF;
 RAISE NOTICE 'PASS: secondary admin barred from other club; primary B can edit league B';
END $qa$;
RESET ROLE;

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
DO $qa$
DECLARE n integer;
BEGIN
 UPDATE public.league_standings SET total_points=13 WHERE
 league_id='00000000-0000-0000-0000-000000000041';
 GET DIAGNOSTICS n=ROW_COUNT;
 IF n<>1 THEN RAISE EXCEPTION 'FAIL: primary A cannot update own league'; END IF;
 UPDATE public.league_standings SET total_points=88 WHERE
 league_id='00000000-0000-0000-0000-000000000042';
 GET DIAGNOSTICS n=ROW_COUNT;
 IF n<>0 THEN RAISE EXCEPTION 'FAIL: primary A modified league B'; END IF;
 BEGIN
  UPDATE public.league_standings
  SET league_id='00000000-0000-0000-0000-000000000042'
  WHERE league_id='00000000-0000-0000-0000-000000000041';
  RAISE EXCEPTION 'FAIL: UPDATE moved standings into unauthorized league B';
 EXCEPTION WHEN SQLSTATE '42501' THEN
  RAISE NOTICE 'PASS: WITH CHECK rejects cross-league standing reassignment';
 END;
 INSERT INTO public.league_standings(league_id,player_id,total_points) VALUES
 ('00000000-0000-0000-0000-000000000041',
  '00000000-0000-0000-0000-000000000053',5);
 GET DIAGNOSTICS n=ROW_COUNT;
 IF n<>1 THEN RAISE EXCEPTION 'FAIL: primary A cannot INSERT'; END IF;
 DELETE FROM public.league_standings
 WHERE player_id='00000000-0000-0000-0000-000000000053';
 GET DIAGNOSTICS n=ROW_COUNT;
 IF n<>1 THEN RAISE EXCEPTION 'FAIL: primary A cannot DELETE'; END IF;
 RAISE NOTICE 'PASS: primary organizer can preserve existing CRUD workflow without cross-league escalation';
END $qa$;
RESET ROLE;

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
DO $qa$
DECLARE n integer;
BEGIN
 UPDATE public.league_standings SET total_points=15;
 GET DIAGNOSTICS n=ROW_COUNT;
 IF n<>2 THEN RAISE EXCEPTION 'FAIL: superadmin could not edit both leagues'; END IF;
 RAISE NOTICE 'PASS: superadmin permissions retained under emergency policies';
END $qa$;
RESET ROLE;

SET LOCAL ROLE anon;
SET LOCAL request.jwt.claim.sub='';
DO $qa$
DECLARE n integer;
BEGIN
 UPDATE public.league_standings SET total_points=999;
 GET DIAGNOSTICS n=ROW_COUNT;
 IF n<>0 THEN RAISE EXCEPTION 'FAIL: anon updated standings'; END IF;
 IF (SELECT count(*) FROM public.league_standings)<>2 THEN
   RAISE EXCEPTION 'FAIL: anon SELECT lost public standings';
 END IF;
 RAISE NOTICE 'PASS: anon cannot write but can read public standings';
END $qa$;
RESET ROLE;
\ir sharkania-p0-standings-legacy-compat-qa.sql
ROLLBACK;
DO $qa$
BEGIN
 IF to_regclass('public.league_standings') IS NOT NULL OR
    to_regprocedure('public.is_club_admin(uuid)') IS NOT NULL THEN
  RAISE EXCEPTION 'FAIL: P0 isolated test left persistent schema';
 END IF;
 RAISE NOTICE 'PASS FINAL: P0 policy QA rolled back completely';
END $qa$;
