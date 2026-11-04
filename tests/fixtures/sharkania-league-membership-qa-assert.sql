\set ON_ERROR_STOP on
-- PostgreSQL 17 temporary database qa_league_auth only.
-- Exercise real grants+RLS with fake JWTs. No production data.

DO $qa$
BEGIN
  IF pg_catalog.has_table_privilege('authenticated','public.league_clubs','INSERT')
    OR pg_catalog.has_table_privilege('authenticated','public.league_clubs','UPDATE')
    OR pg_catalog.has_table_privilege('authenticated','public.league_clubs','DELETE')
    OR pg_catalog.has_table_privilege('authenticated','public.league_rooms','INSERT')
    OR pg_catalog.has_table_privilege('authenticated','public.league_rooms','DELETE')
    OR pg_catalog.has_table_privilege('authenticated','public.leagues','INSERT')
  THEN RAISE EXCEPTION 'FAIL: broad DML still granted'; END IF;
  IF NOT pg_catalog.has_table_privilege('anon','public.leagues','SELECT')
    OR NOT pg_catalog.has_table_privilege('anon','public.league_clubs','SELECT')
    OR NOT pg_catalog.has_table_privilege('anon','public.league_rooms','SELECT')
  THEN RAISE EXCEPTION 'FAIL: public league read was removed'; END IF;
  RAISE NOTICE 'PASS: direct client DML blocked; public league reads preserved';
END;
$qa$;

SET ROLE authenticated;
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000005';
DO $qa$
BEGIN
  INSERT INTO public.league_clubs(league_id,club_id,is_primary) VALUES
    ('00000000-0000-0000-0000-000000000041',
     '00000000-0000-0000-0000-000000000022',true);
  RAISE EXCEPTION 'FAIL: admin B joined league A directly';
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'PASS: club B cannot self-join league A';
END;
$qa$;

DO $qa$
BEGIN
  UPDATE public.league_clubs SET is_primary=true
  WHERE league_id='00000000-0000-0000-0000-000000000042';
  RAISE EXCEPTION 'FAIL: admin B can change primary directly';
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'PASS: even club admin cannot promote primary directly';
END;
$qa$;

DO $qa$
DECLARE n integer;
BEGIN
  UPDATE public.leagues SET name='Hijacked League A'
  WHERE id='00000000-0000-0000-0000-000000000041';
  GET DIAGNOSTICS n=ROW_COUNT;
  IF n<>0 THEN RAISE EXCEPTION 'FAIL: club B edited league A'; END IF;
  DELETE FROM public.leagues WHERE id='00000000-0000-0000-0000-000000000041';
  GET DIAGNOSTICS n=ROW_COUNT;
  IF n<>0 THEN RAISE EXCEPTION 'FAIL: club B deleted league A'; END IF;
  RAISE NOTICE 'PASS: B cannot edit or delete an unrelated league';
END;
$qa$;

DO $qa$
BEGIN
  PERFORM public.add_league_club_guarded(
    '00000000-0000-0000-0000-000000000041',
    '00000000-0000-0000-0000-000000000022');
  RAISE EXCEPTION 'FAIL: B could self-join through guarded RPC';
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'PASS: guarded RPC blocks B self-join';
END;
$qa$;

DO $qa$
BEGIN
  PERFORM public.create_league_guarded(
    '00000000-0000-0000-0000-000000000021',
    'B hijacks ownership','qa-misowned');
  RAISE EXCEPTION 'FAIL: B can create a league owned by A';
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'PASS: B cannot create a league as organizer of A';
END;
$qa$;

DO $qa$
BEGIN
  PERFORM public.set_league_rooms_guarded(
    '00000000-0000-0000-0000-000000000041',
    ARRAY['00000000-0000-0000-0000-000000000032'::uuid]);
  RAISE EXCEPTION 'FAIL: B could edit room list of A';
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'PASS: B cannot change league A rooms';
END;
$qa$;

DO $qa$
BEGIN
  DELETE FROM public.league_rooms
  WHERE league_id='00000000-0000-0000-0000-000000000041';
  RAISE EXCEPTION 'FAIL: B deleted rooms with direct DML';
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'PASS: B cannot delete rooms via direct table API';
END;
$qa$;

DO $qa$
DECLARE v_league uuid;
BEGIN
  SELECT public.create_league_guarded(
    '00000000-0000-0000-0000-000000000022',
    'B Own League','qa-b-new') INTO v_league;
  IF NOT EXISTS (SELECT 1 FROM public.league_clubs lc
    WHERE lc.league_id=v_league AND lc.club_id='00000000-0000-0000-0000-000000000022'
      AND lc.is_primary)
  THEN RAISE EXCEPTION 'FAIL: create league did not create primary atomically'; END IF;
  UPDATE public.leagues SET name='B Edited Own League'
  WHERE id=v_league;
  IF NOT EXISTS (SELECT 1 FROM public.leagues
       WHERE id=v_league AND name='B Edited Own League')
  THEN RAISE EXCEPTION 'FAIL: B could not update own league'; END IF;
  RAISE NOTICE 'PASS: B creates and edits own league without direct membership grants';
END;
$qa$;
RESET ROLE;

SET ROLE authenticated;
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000003';
DO $qa$
BEGIN
  PERFORM public.create_league_guarded(
    '00000000-0000-0000-0000-000000000021',
    'Unprivileged League','qa-normal');
  RAISE EXCEPTION 'FAIL: ordinary player created a league';
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'PASS: normal player cannot create club-owned league';
END;
$qa$;
RESET ROLE;

SET ROLE authenticated;
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
DO $qa$
DECLARE n integer;
BEGIN
  UPDATE public.leagues SET name='A Legitimate Edit'
  WHERE id='00000000-0000-0000-0000-000000000041';
  GET DIAGNOSTICS n=ROW_COUNT;
  IF n<>1 THEN RAISE EXCEPTION 'FAIL: organizer cannot edit league A'; END IF;
  PERFORM public.set_league_rooms_guarded(
    '00000000-0000-0000-0000-000000000041',
    ARRAY['00000000-0000-0000-0000-000000000032'::uuid]);
  IF (SELECT count(*) FROM public.league_rooms WHERE
    league_id='00000000-0000-0000-0000-000000000041'
    AND room_id='00000000-0000-0000-0000-000000000032')<>1
    OR (SELECT count(*) FROM public.league_rooms WHERE
     league_id='00000000-0000-0000-0000-000000000041')<>1
  THEN RAISE EXCEPTION 'FAIL: room set was not atomic'; END IF;
  RAISE NOTICE 'PASS: organizer A can edit its league and replace room list';
END;
$qa$;

DO $qa$
BEGIN
  PERFORM public.set_league_rooms_guarded(
    '00000000-0000-0000-0000-000000000041',
    ARRAY['00000000-0000-0000-0000-000000000099'::uuid]);
  RAISE EXCEPTION 'FAIL: unknown room accepted';
EXCEPTION WHEN SQLSTATE 'PT422' THEN
  RAISE NOTICE 'PASS: unknown room blocked; previous room list preserved';
END;
$qa$;

DO $qa$
BEGIN
  PERFORM public.add_league_club_guarded(
    '00000000-0000-0000-0000-000000000041',
    '00000000-0000-0000-0000-000000000022');
  RAISE EXCEPTION 'FAIL: organizer A unilaterally recruited unrelated club B';
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'PASS: organizer A cannot force membership of club B';
END;
$qa$;
RESET ROLE;

SET ROLE authenticated;
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
DO $qa$
DECLARE ok boolean;
BEGIN
  SELECT public.add_league_club_guarded(
    '00000000-0000-0000-0000-000000000041',
    '00000000-0000-0000-0000-000000000022') INTO ok;
  IF ok IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'FAIL: superadmin failed to add B secondary';
  END IF;
  SELECT public.add_league_club_guarded(
    '00000000-0000-0000-0000-000000000041',
    '00000000-0000-0000-0000-000000000022') INTO ok;
  IF ok IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'FAIL: repeat membership add was not idempotent';
  END IF;
  IF (SELECT count(*) FROM public.league_clubs lc
    WHERE lc.league_id='00000000-0000-0000-0000-000000000041'
      AND lc.is_primary)<>1 THEN
    RAISE EXCEPTION 'FAIL: duplicate primary ownership';
  END IF;
  RAISE NOTICE 'PASS: superadmin adds secondary club, cannot create another primary';
END;
$qa$;
RESET ROLE;

SET ROLE authenticated;
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000005';
DO $qa$
DECLARE n integer;
BEGIN
  UPDATE public.leagues SET name='Secondary Club Takeover'
  WHERE id='00000000-0000-0000-0000-000000000041';
  GET DIAGNOSTICS n=ROW_COUNT;
  IF n<>0 THEN RAISE EXCEPTION 'FAIL: B secondary member edited league A'; END IF;
  DELETE FROM public.leagues
  WHERE id='00000000-0000-0000-0000-000000000041';
  GET DIAGNOSTICS n=ROW_COUNT;
  IF n<>0 THEN RAISE EXCEPTION 'FAIL: B secondary member deleted league A'; END IF;
  RAISE NOTICE 'PASS: secondary club participant cannot take over shared league';
END;
$qa$;
RESET ROLE;

DO $qa$
BEGIN
  IF (SELECT count(*) FROM public.league_rooms
    WHERE league_id='00000000-0000-0000-0000-000000000041'
      AND room_id='00000000-0000-0000-0000-000000000032')<>1
  THEN RAISE EXCEPTION 'FAIL: bad room attempt changed room list'; END IF;
  IF (SELECT count(*) FROM public.league_clubs
    WHERE league_id='00000000-0000-0000-0000-000000000041'
      AND is_primary)<>1
  THEN RAISE EXCEPTION 'FAIL: primary count changed'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.leagues WHERE
    id='00000000-0000-0000-0000-000000000041' AND name='A Legitimate Edit')
  THEN RAISE EXCEPTION 'FAIL: shared league primary owner edit overwritten'; END IF;
  RAISE NOTICE 'PASS FINAL: guarded league creation, association, rooms, RLS ownership';
END;
$qa$;
