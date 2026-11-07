\set ON_ERROR_STOP on
-- Runs ONLY as an extension of the P0 PostgreSQL 17 synthetic RLS fixture.
-- P0 test keeps BEGIN open; this script changes fake policies and rolls
-- everything back together with the parent's ROLLBACK.
CREATE TABLE public.leagues(
 id uuid PRIMARY KEY,
 name text NOT NULL,
 status text NOT NULL DEFAULT 'upcoming'
);
INSERT INTO public.leagues(id,name) VALUES
 ('00000000-0000-0000-0000-000000000041','League A'),
 ('00000000-0000-0000-0000-000000000042','League B'),
 ('00000000-0000-0000-0000-000000000043','League C');
INSERT INTO public.league_clubs(league_id,club_id,is_primary) VALUES
 ('00000000-0000-0000-0000-000000000043',
  '00000000-0000-0000-0000-000000000021',true);
CREATE TABLE public.league_rooms (
 league_id uuid NOT NULL,room_id uuid NOT NULL,
 PRIMARY KEY(league_id,room_id));
INSERT INTO public.league_rooms VALUES
 ('00000000-0000-0000-0000-000000000041',
  '00000000-0000-0000-0000-000000000031'),
 ('00000000-0000-0000-0000-000000000042',
  '00000000-0000-0000-0000-000000000031');
GRANT SELECT,INSERT,DELETE ON public.league_rooms TO anon,authenticated;
ALTER TABLE public.league_rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "League rooms: lectura publica"
 ON public.league_rooms FOR SELECT USING(true);
CREATE POLICY "Permitir insertar league_rooms"
 ON public.league_rooms FOR INSERT TO authenticated
 WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Permitir borrar league_rooms"
 ON public.league_rooms FOR DELETE TO authenticated
 USING (auth.uid() IS NOT NULL);
CREATE POLICY "League rooms: super admin insert"
 ON public.league_rooms FOR INSERT WITH CHECK (public.is_super_admin());
CREATE POLICY "League rooms: super admin delete"
 ON public.league_rooms FOR DELETE USING (public.is_super_admin());
CREATE POLICY "League rooms: super admin update"
 ON public.league_rooms FOR UPDATE USING (public.is_super_admin());
GRANT SELECT,INSERT,UPDATE,DELETE ON public.leagues TO anon,authenticated;
GRANT SELECT ON public.club_admins TO authenticated;
ALTER TABLE public.leagues ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Leagues: lectura publica"
 ON public.leagues FOR SELECT USING (true);
CREATE POLICY "Leagues: admin puede crear"
 ON public.leagues FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Leagues: admin o super editar"
 ON public.leagues FOR UPDATE USING (
 public.is_super_admin() OR EXISTS(
  SELECT 1 FROM public.league_clubs lc
  WHERE lc.league_id=leagues.id AND public.is_club_admin(lc.club_id)));
CREATE POLICY "Leagues: admin o super eliminar"
 ON public.leagues FOR DELETE USING (
 public.is_super_admin() OR EXISTS(
  SELECT 1 FROM public.league_clubs lc
  WHERE lc.league_id=leagues.id AND public.is_club_admin(lc.club_id)));
CREATE POLICY "League clubs: admin insert"
 ON public.league_clubs FOR INSERT WITH CHECK (
 public.is_super_admin() OR public.is_club_admin(club_id));
CREATE POLICY "League clubs: admin delete"
 ON public.league_clubs FOR DELETE USING (
 public.is_super_admin() OR public.is_club_admin(club_id));
-- The other old update policy was created by the parent P0 fixture.

-- Pre-patch proof: secondary B can change A's league, self-join C
-- and arbitrary authenticated player can create a league.
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-0000-0000-000000000005';
DO $old$
DECLARE n integer;
BEGIN
 UPDATE public.leagues SET name='Unauthorized mutation'
 WHERE id='00000000-0000-0000-0000-000000000041';
 GET DIAGNOSTICS n=ROW_COUNT;
 IF n<>1 THEN RAISE EXCEPTION 'FAIL: legacy secondary update not reproduced'; END IF;
 INSERT INTO public.league_clubs(league_id,club_id,is_primary)
 VALUES ('00000000-0000-0000-0000-000000000043',
         '00000000-0000-0000-0000-000000000022',false);
 RAISE NOTICE 'CONFIRMED QA: secondary admin can edit foreign league and silently join another league';
END $old$;
RESET ROLE;
UPDATE public.leagues SET name='League A'
 WHERE id='00000000-0000-0000-0000-000000000041';
DELETE FROM public.league_clubs
 WHERE league_id='00000000-0000-0000-0000-000000000043'
 AND club_id='00000000-0000-0000-0000-000000000022';
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-0000-0000-000000000003';
INSERT INTO public.leagues(id,name) VALUES
 ('00000000-0000-0000-0000-000000000045','Unauthorized player league');
RESET ROLE;
DELETE FROM public.leagues
 WHERE id='00000000-0000-0000-0000-000000000045';
-- Reproduce the separate legacy room-policy vulnerability.
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-0000-0000-000000000003';
INSERT INTO public.league_rooms(league_id,room_id) VALUES
 ('00000000-0000-0000-0000-000000000041',
  '00000000-0000-0000-0000-000000000032');
RESET ROLE;
DELETE FROM public.league_rooms
 WHERE league_id='00000000-0000-0000-0000-000000000041'
   AND room_id='00000000-0000-0000-0000-000000000032';
DO $qa$ BEGIN RAISE NOTICE 'CONFIRMED QA: any signed-in player could create a new league'; END $qa$;

\ir ../../docs/security/league-membership-ownership-p1-2026-11-07.qa-only.sql

DO $verify$
BEGIN
 IF (SELECT count(*) FROM pg_policies WHERE schemaname='public'
    AND tablename='league_rooms' AND policyname LIKE 'league_rooms_%_p1')<>2
 OR (SELECT count(*) FROM pg_policies WHERE schemaname='public'
    AND tablename='league_clubs' AND policyname LIKE 'league_clubs_%_p1')<>3
 OR (SELECT count(*) FROM pg_policies WHERE schemaname='public'
    AND tablename='leagues' AND policyname LIKE 'leagues_%_p1')<>3
 THEN RAISE EXCEPTION 'FAIL: required restricted P1 policies absent'; END IF;
 IF (SELECT count(*) FROM pg_indexes WHERE schemaname='public'
 AND tablename='league_clubs'
 AND indexname='league_clubs_one_primary_per_league_guarded')<>1
 THEN RAISE EXCEPTION 'FAIL: P0 uniqueness index lost or duplicated'; END IF;
 RAISE NOTICE 'PASS: 8 narrow league/room DML policies and one existing primary index';
END $verify$;

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-0000-0000-000000000003';
DO $player$
DECLARE n integer;
BEGIN
 UPDATE public.leagues SET name='hacked';
 GET DIAGNOSTICS n=ROW_COUNT;
 IF n<>0 THEN RAISE EXCEPTION 'FAIL: player UPDATE league'; END IF;
 DELETE FROM public.leagues;
 GET DIAGNOSTICS n=ROW_COUNT;
 IF n<>0 THEN RAISE EXCEPTION 'FAIL: player DELETE league'; END IF;
 BEGIN
  INSERT INTO public.leagues(id,name) VALUES
   ('00000000-0000-0000-0000-000000000045','blocked player league');
  RAISE EXCEPTION 'FAIL: normal player created a league';
 EXCEPTION WHEN SQLSTATE '42501' THEN
  RAISE NOTICE 'PASS: ordinary player cannot create league';
 END;
 BEGIN
  INSERT INTO public.league_clubs(league_id,club_id,is_primary) VALUES
   ('00000000-0000-0000-0000-000000000043',
    '00000000-0000-0000-0000-000000000022',false);
  RAISE EXCEPTION 'FAIL: normal player inserted club membership';
 EXCEPTION WHEN SQLSTATE '42501' THEN
  RAISE NOTICE 'PASS: ordinary player cannot add club';
 END;
 IF (SELECT count(*) FROM public.leagues)<>3
 THEN RAISE EXCEPTION 'FAIL: anonymous public leagues read broken'; END IF;
 BEGIN
  INSERT INTO public.league_rooms(league_id,room_id) VALUES
   ('00000000-0000-0000-0000-000000000041',
    '00000000-0000-0000-0000-000000000032');
  RAISE EXCEPTION 'FAIL: normal player inserted room in foreign league';
 EXCEPTION WHEN SQLSTATE '42501' THEN
  RAISE NOTICE 'PASS: ordinary player room INSERT blocked';
 END;
 DELETE FROM public.league_rooms WHERE
 league_id='00000000-0000-0000-0000-000000000041';
 GET DIAGNOSTICS n=ROW_COUNT;
 IF n<>0 THEN RAISE EXCEPTION 'FAIL: player DELETE league rooms';END IF;
 RAISE NOTICE 'PASS: player denied league and room DML; public SELECT preserved';
END $player$;
RESET ROLE;

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-0000-0000-000000000005';
DO $secondary$
DECLARE n integer;
BEGIN
 UPDATE public.leagues SET name='secondary changed league A'
 WHERE id='00000000-0000-0000-0000-000000000041';
 GET DIAGNOSTICS n=ROW_COUNT;
 IF n<>0 THEN RAISE EXCEPTION 'FAIL: secondary modifies primary A league'; END IF;
 DELETE FROM public.leagues
 WHERE id='00000000-0000-0000-0000-000000000041';
 GET DIAGNOSTICS n=ROW_COUNT;
 IF n<>0 THEN RAISE EXCEPTION 'FAIL: secondary deletes primary A league'; END IF;
 BEGIN
  INSERT INTO public.league_clubs(league_id,club_id,is_primary)
  VALUES ('00000000-0000-0000-0000-000000000043',
          '00000000-0000-0000-0000-000000000022',false);
  RAISE EXCEPTION 'FAIL: secondary inserted itself into league C';
 EXCEPTION WHEN SQLSTATE '42501' THEN
  RAISE NOTICE 'PASS: secondary self-join rejected';
 END;
 UPDATE public.league_clubs SET is_primary=false
 WHERE league_id='00000000-0000-0000-0000-000000000042';
 GET DIAGNOSTICS n=ROW_COUNT;
 IF n<>0 THEN RAISE EXCEPTION 'FAIL: club admin removed own primary flag'; END IF;
 DELETE FROM public.league_clubs
 WHERE league_id='00000000-0000-0000-0000-000000000042';
 GET DIAGNOSTICS n=ROW_COUNT;
 IF n<>0 THEN RAISE EXCEPTION 'FAIL: club admin removed sole primary'; END IF;
 UPDATE public.leagues SET name='League B updated'
 WHERE id='00000000-0000-0000-0000-000000000042';
 GET DIAGNOSTICS n=ROW_COUNT;
 IF n<>1 THEN RAISE EXCEPTION 'FAIL: primary club B cannot edit own league'; END IF;
 DELETE FROM public.league_rooms WHERE
 league_id='00000000-0000-0000-0000-000000000041';
 GET DIAGNOSTICS n=ROW_COUNT;
 IF n<>0 THEN RAISE EXCEPTION 'FAIL: secondary deleted rooms from league A';END IF;
 BEGIN
  INSERT INTO public.league_rooms(league_id,room_id) VALUES
   ('00000000-0000-0000-0000-000000000041',
    '00000000-0000-0000-0000-000000000032');
  RAISE EXCEPTION 'FAIL: secondary inserted room into league A';
 EXCEPTION WHEN SQLSTATE '42501' THEN
  RAISE NOTICE 'PASS: secondary cannot insert rooms in another league';
 END;
 DELETE FROM public.league_rooms WHERE
 league_id='00000000-0000-0000-0000-000000000042';
 GET DIAGNOSTICS n=ROW_COUNT;
 IF n<>1 THEN RAISE EXCEPTION 'FAIL: primary B cannot delete its own rooms';END IF;
 INSERT INTO public.league_rooms(league_id,room_id) VALUES
  ('00000000-0000-0000-0000-000000000042',
   '00000000-0000-0000-0000-000000000031');
 RAISE NOTICE 'PASS: secondary cannot self-join, edit foreign league, or remove primary; own room edit allowed';
END $secondary$;
RESET ROLE;

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
DO $primary$
DECLARE n integer;
BEGIN
 UPDATE public.leagues SET name='League A updated'
 WHERE id='00000000-0000-0000-0000-000000000041';
 GET DIAGNOSTICS n=ROW_COUNT;
 IF n<>1 THEN RAISE EXCEPTION 'FAIL: primary A cannot edit own league'; END IF;
 INSERT INTO public.leagues(id,name) VALUES
 ('00000000-0000-0000-0000-000000000046','Legitimate fresh club A league');
 INSERT INTO public.league_clubs(league_id,club_id,is_primary)
 VALUES ('00000000-0000-0000-0000-000000000046',
  '00000000-0000-0000-0000-000000000021',true);
 IF (SELECT count(*) FROM public.league_clubs WHERE
 league_id='00000000-0000-0000-0000-000000000046' AND is_primary)<>1
 THEN RAISE EXCEPTION 'FAIL: current web form two-step primary creation broken'; END IF;
 DELETE FROM public.league_rooms WHERE league_id=
  '00000000-0000-0000-0000-000000000041';
 GET DIAGNOSTICS n=ROW_COUNT;
 IF n<>1 THEN RAISE EXCEPTION 'FAIL: primary A cannot delete own rooms'; END IF;
 INSERT INTO public.league_rooms(league_id,room_id) VALUES
  ('00000000-0000-0000-0000-000000000041',
   '00000000-0000-0000-0000-000000000032');
 RAISE NOTICE 'PASS: current club admin two-step league creation and room edit still work';
END $primary$;
RESET ROLE;

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
DO $super$
DECLARE n integer;
BEGIN
 INSERT INTO public.league_clubs(league_id,club_id,is_primary)
 VALUES ('00000000-0000-0000-0000-000000000043',
  '00000000-0000-0000-0000-000000000022',false);
 UPDATE public.league_clubs SET is_primary=false
 WHERE league_id='00000000-0000-0000-0000-000000000043'
 AND club_id='00000000-0000-0000-0000-000000000021';
 GET DIAGNOSTICS n=ROW_COUNT;
 IF n<>1 THEN RAISE EXCEPTION 'FAIL: superadmin cannot repair primary'; END IF;
 DELETE FROM public.league_clubs WHERE
 league_id='00000000-0000-0000-0000-000000000043'
 AND club_id='00000000-0000-0000-0000-000000000022';
 GET DIAGNOSTICS n=ROW_COUNT;
 IF n<>1 THEN RAISE EXCEPTION 'FAIL: superadmin cannot remove secondary'; END IF;
 RAISE NOTICE 'PASS: superadmin still can repair league membership';
END $super$;
RESET ROLE;
DO $final$
BEGIN
 IF (SELECT count(*) FROM public.league_clubs WHERE
   league_id='00000000-0000-0000-0000-000000000041'
    AND is_primary)<>1
 OR (SELECT count(*) FROM public.league_clubs WHERE
   league_id='00000000-0000-0000-0000-000000000042'
    AND is_primary)<>1
 THEN RAISE EXCEPTION 'FAIL: principal league invariants broken'; END IF;
 RAISE NOTICE 'PASS FINAL: league and membership RLS QA scenarios complete; parent P0 test will ROLLBACK';
END $final$;
