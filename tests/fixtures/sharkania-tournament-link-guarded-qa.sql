\set ON_ERROR_STOP on
-- SHARKANIA: test ONLY in disposable qa_league_auth Postgres 17 database.
-- The test opens a transaction, mirrors current tournament owner-only RLS,
-- installs the proposed trigger ONLY within transaction, asserts 42501
-- failures + real allowed operations, then ROLLBACK + verifies fixture intact.
BEGIN;
GRANT SELECT,INSERT,UPDATE ON TABLE public.tournaments TO authenticated;
CREATE POLICY qa_tournament_owner_read ON public.tournaments
  FOR SELECT USING (true);
CREATE POLICY qa_tournament_owner_insert ON public.tournaments
  FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.is_club_admin(club_id));
CREATE POLICY qa_tournament_owner_update ON public.tournaments
  FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.is_club_admin(club_id))
  WITH CHECK (public.is_super_admin() OR public.is_club_admin(club_id));

-- One deliberately inconsistent synthetic legacy row, to verify a secondary
-- club admin cannot sever the old league relationship without organizer A.
INSERT INTO public.tournaments(id,club_id,buy_in,league_id) VALUES
('00000000-0000-0000-0000-000000000016',
 '00000000-0000-0000-0000-000000000022',
 10,
 '00000000-0000-0000-0000-000000000041');
-- Two unused tournaments make safe owner-approved linkage tests possible:
-- linked tournaments with historical results must remain immutable instead.
INSERT INTO public.tournaments(id,club_id,buy_in,league_id) VALUES
('00000000-0000-0000-0000-000000000019',
 '00000000-0000-0000-0000-000000000022',10,NULL),
('00000000-0000-0000-0000-000000000020',
 '00000000-0000-0000-0000-000000000021',10,NULL);

\ir ../../docs/security/tournament-league-link-guard-2026-11-06.qa-only.sql

-- Negative cases with a genuine authenticated role and synthetic JWT claim.
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '00000000-0000-0000-0000-000000000005';
DO $qa$
DECLARE v_rows integer;
BEGIN
  BEGIN
    UPDATE public.tournaments
      SET league_id='00000000-0000-0000-0000-000000000041'
      WHERE id='00000000-0000-0000-0000-000000000012';
    RAISE EXCEPTION 'FAIL: secondary B linked its tournament to organizer A league';
  EXCEPTION WHEN SQLSTATE '42501' THEN
    RAISE NOTICE 'PASS: secondary participant cannot link B tournament into organizer A league';
  END;

  BEGIN
    INSERT INTO public.tournaments(id,club_id,buy_in,league_id) VALUES
    ('00000000-0000-0000-0000-000000000014',
     '00000000-0000-0000-0000-000000000022',10,
     '00000000-0000-0000-0000-000000000041');
    RAISE EXCEPTION 'FAIL: secondary B inserted new tournament directly into A league';
  EXCEPTION WHEN SQLSTATE '42501' THEN
    RAISE NOTICE 'PASS: secondary participant cannot INSERT into A league';
  END;

  BEGIN
    UPDATE public.tournaments SET league_id=NULL
    WHERE id='00000000-0000-0000-0000-000000000016';
    RAISE EXCEPTION 'FAIL: secondary B removed inherited A league link';
  EXCEPTION WHEN SQLSTATE '42501' THEN
    RAISE NOTICE 'PASS: secondary participant cannot detach historic foreign league';
  END;

  IF NOT EXISTS(SELECT 1 FROM public.tournaments
     WHERE id='00000000-0000-0000-0000-000000000012' AND league_id IS NULL)
     OR NOT EXISTS(SELECT 1 FROM public.tournaments
     WHERE id='00000000-0000-0000-0000-000000000016'
       AND league_id='00000000-0000-0000-0000-000000000041') THEN
    RAISE EXCEPTION 'FAIL: rejected mutation changed a tournament';
  END IF;

  BEGIN
    UPDATE public.tournaments
     SET league_id='00000000-0000-0000-0000-000000000042'
     WHERE id='00000000-0000-0000-0000-000000000012';
    RAISE EXCEPTION 'FAIL: linked historical results reassigned from B tournament';
  EXCEPTION WHEN SQLSTATE 'PT409' THEN
    RAISE NOTICE 'PASS: prior results block relinking even by own club admin';
  END;

  UPDATE public.tournaments
   SET league_id='00000000-0000-0000-0000-000000000042'
   WHERE id='00000000-0000-0000-0000-000000000019';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows<>1 THEN RAISE EXCEPTION 'FAIL: primary B cannot link fresh OWN tournament'; END IF;

  UPDATE public.tournaments
   SET buy_in=11 WHERE id='00000000-0000-0000-0000-000000000019';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows<>1 THEN RAISE EXCEPTION 'FAIL: ordinary tournament edit blocked'; END IF;

  INSERT INTO public.tournaments(id,club_id,buy_in,league_id) VALUES
  ('00000000-0000-0000-0000-000000000015',
   '00000000-0000-0000-0000-000000000022',10,
   '00000000-0000-0000-0000-000000000042');
  IF NOT EXISTS(SELECT 1 FROM public.tournaments
     WHERE id='00000000-0000-0000-0000-000000000015'
       AND league_id='00000000-0000-0000-0000-000000000042') THEN
    RAISE EXCEPTION 'FAIL: primary B could not create tournament in own league';
  END IF;

  UPDATE public.tournaments SET league_id=NULL
   WHERE id='00000000-0000-0000-0000-000000000019';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows<>1 THEN RAISE EXCEPTION 'FAIL: primary B cannot unlink fresh own league'; END IF;
  RAISE NOTICE 'PASS: B primary can link/create/edit/unlink fresh B tournaments';
END $qa$;
RESET ROLE;

-- Organizer A may use A league but must not attach to B's league.
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
DO $qa$
DECLARE v_rows integer;
BEGIN
  BEGIN
    UPDATE public.tournaments SET league_id=NULL
      WHERE id='00000000-0000-0000-0000-000000000011';
    RAISE EXCEPTION 'FAIL: organizer A unlinked historical A league results';
  EXCEPTION WHEN SQLSTATE 'PT409' THEN
    RAISE NOTICE 'PASS: organizer A cannot unlink tournament with played results';
  END;

  UPDATE public.tournaments SET league_id='00000000-0000-0000-0000-000000000041'
   WHERE id='00000000-0000-0000-0000-000000000020';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows<>1 THEN RAISE EXCEPTION 'FAIL: organizer A cannot link fresh A tournament'; END IF;
  UPDATE public.tournaments SET league_id=NULL
   WHERE id='00000000-0000-0000-0000-000000000020';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows<>1 THEN RAISE EXCEPTION 'FAIL: organizer A cannot unlink fresh A tournament'; END IF;

  BEGIN
    UPDATE public.tournaments
     SET league_id='00000000-0000-0000-0000-000000000042'
     WHERE id='00000000-0000-0000-0000-000000000011';
    RAISE EXCEPTION 'FAIL: organizer A assigned A-owned tournament to B league';
  EXCEPTION WHEN SQLSTATE '42501' THEN
    RAISE NOTICE 'PASS: organizer A cannot link its tournament to foreign B league';
  END;
END $qa$;
RESET ROLE;

-- Super-admin cannot violate the core primary-club == tournament-club
-- invariant, even though they may manage both leagues.
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
DO $qa$
BEGIN
  BEGIN
    UPDATE public.tournaments
     SET league_id='00000000-0000-0000-0000-000000000041'
     WHERE id='00000000-0000-0000-0000-000000000012';
    RAISE EXCEPTION 'FAIL: superadmin bypassed league primary ownership invariant';
  EXCEPTION WHEN SQLSTATE '42501' THEN
    RAISE NOTICE 'PASS: even superadmin cannot create foreign-club tournament association';
  END;
END $qa$;
RESET ROLE;

DO $qa$
BEGIN
  IF has_function_privilege('authenticated'::name,
        'public.guard_tournament_league_link_qa()'::regprocedure, 'EXECUTE')
     OR has_function_privilege('anon'::name,
        'public.guard_tournament_league_link_qa()'::regprocedure, 'EXECUTE')
  THEN
    RAISE EXCEPTION 'FAIL: QA trigger function callable directly';
  END IF;
  RAISE NOTICE 'PASS: direct EXECUTE revoked to browser database roles';
END $qa$;
ROLLBACK;

DO $qa$
BEGIN
  IF EXISTS(SELECT 1 FROM public.tournaments
    WHERE id IN ('00000000-0000-0000-0000-000000000015',
                 '00000000-0000-0000-0000-000000000016',
                 '00000000-0000-0000-0000-000000000019',
                 '00000000-0000-0000-0000-000000000020'))
     OR NOT EXISTS(SELECT 1 FROM public.tournaments
    WHERE id='00000000-0000-0000-0000-000000000012' AND league_id IS NULL)
     OR EXISTS(SELECT 1 FROM pg_trigger
    WHERE tgname='qa_guard_tournament_league_link') THEN
      RAISE EXCEPTION 'FAIL: QA foreign-link test changed base fixture';
  END IF;
  RAISE NOTICE 'PASS FINAL: guarded league link tested and completely ROLLED BACK';
END $qa$;
