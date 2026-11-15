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
  BEGIN
    DELETE FROM public.leagues WHERE id='00000000-0000-0000-0000-000000000041';
    RAISE EXCEPTION 'FAIL: club B deleted league A';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL; -- Direct DELETE has been REVOKED, not just RLS-filtered.
  END;
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
  BEGIN
    DELETE FROM public.leagues
    WHERE id='00000000-0000-0000-0000-000000000041';
    RAISE EXCEPTION 'FAIL: B secondary member deleted league A';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
  RAISE NOTICE 'PASS: secondary club participant cannot take over shared league';
END;
$qa$;
RESET ROLE;

-- Safe duplication is authorized ONLY for the original organizer.
-- A secondary club already participating in source A cannot inherit ownership
-- or membership in the newly cloned league without separate approval.
SET ROLE authenticated;
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000005';
DO $qa$
BEGIN
  PERFORM public.duplicate_league_guarded(
    '00000000-0000-0000-0000-000000000041',
    'Unauthorized clone','qa-unauthorized-clone');
  RAISE EXCEPTION 'FAIL: secondary admin duplicated foreign league';
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'PASS: secondary club cannot duplicate organizer league';
END;
$qa$;
RESET ROLE;

SET ROLE authenticated;
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
DO $qa$
DECLARE
  v_clone uuid;
  v_repeated boolean := false;
BEGIN
  SELECT public.duplicate_league_guarded(
    '00000000-0000-0000-0000-000000000041',
    'Liga A clonada','qa-league-a-clone') INTO v_clone;
  IF NOT EXISTS (
    SELECT 1 FROM public.leagues l
    WHERE l.id=v_clone AND l.name='Liga A clonada'
      AND l.slug='qa-league-a-clone' AND l.status='upcoming'
      AND l.description='Liga de prueba con reglamento'
      AND l.rules_url='https://example.test/reglas'
      AND l.start_date='2026-11-01' AND l.end_date='2026-12-01'
      AND l.scoring_system_id='00000000-0000-0000-0000-000000000061'
      AND l.total_dates=9 AND l.best_dates_to_count=5
      AND l.is_demo IS TRUE
  ) OR (SELECT count(*) FROM public.league_clubs lc
        WHERE lc.league_id=v_clone)<>1
    OR NOT EXISTS (
      SELECT 1 FROM public.league_clubs lc
      WHERE lc.league_id=v_clone
        AND lc.club_id='00000000-0000-0000-0000-000000000021'
        AND lc.is_primary
    )
    OR (SELECT count(*) FROM public.league_rooms lr
        WHERE lr.league_id=v_clone
          AND lr.room_id='00000000-0000-0000-0000-000000000032')<>1
    OR (SELECT count(*) FROM public.league_rooms lr
        WHERE lr.league_id=v_clone)<>1
  THEN
    RAISE EXCEPTION 'FAIL: league clone copied unauthorized members or lost metadata';
  END IF;
  RAISE NOTICE 'PASS: organizer cloned settings and rooms, no secondary club inherited';
END;
$qa$;
DO $qa$
BEGIN
  PERFORM public.duplicate_league_guarded(
    '00000000-0000-0000-0000-000000000041',
    'Conflicting duplicate','qa-league-a-clone');
  RAISE EXCEPTION 'FAIL: duplicated slug was accepted';
EXCEPTION WHEN SQLSTATE 'PT409' THEN
  RAISE NOTICE 'PASS: clone slug conflict blocked without partial rows';
END;
$qa$;
RESET ROLE;

-- New deletion policy refuses any operational references, preserving
-- the tournament->league link (production FK ON DELETE SET NULL).
SET ROLE authenticated;
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000005';
DO $qa$
BEGIN
  PERFORM public.delete_empty_league_guarded(
    '00000000-0000-0000-0000-000000000041');
  RAISE EXCEPTION 'FAIL: secondary club deleted organizer league via RPC';
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'PASS: secondary club cannot delete league via protected RPC';
END;
$qa$;
RESET ROLE;

SET ROLE authenticated;
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
DO $qa$
BEGIN
  PERFORM public.delete_empty_league_guarded(
    '00000000-0000-0000-0000-000000000041');
  RAISE EXCEPTION 'FAIL: active league with tournament was deleted';
EXCEPTION WHEN SQLSTATE 'PT409' THEN
  RAISE NOTICE 'PASS: organizer cannot delete league with tournament references';
END;
$qa$;
RESET ROLE;
DO $qa$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.leagues
                  WHERE id='00000000-0000-0000-0000-000000000041')
     OR NOT EXISTS (
       SELECT 1 FROM public.tournaments
       WHERE id='00000000-0000-0000-0000-000000000011'
       AND league_id='00000000-0000-0000-0000-000000000041')
  THEN
    RAISE EXCEPTION 'FAIL: rejected delete damaged tournament link';
  END IF;
  RAISE NOTICE 'PASS: rejected deletion preserves tournament/league relation';
END;
$qa$;

-- Even privileged buggy code must not be able to create TWO primary
-- organizers. This is an integrity invariant independent from client RLS.
DO $qa$
BEGIN
  UPDATE public.league_clubs SET is_primary=true
  WHERE league_id='00000000-0000-0000-0000-000000000041'
    AND club_id='00000000-0000-0000-0000-000000000022';
  RAISE EXCEPTION 'FAIL: a second primary organizer was accepted';
EXCEPTION WHEN unique_violation THEN
  RAISE NOTICE 'PASS: partial unique index blocks a second primary organizer';
END;
$qa$;

-- LeagueForm parity: create/edit metadata + primary association + rooms
-- in ONE server-side operation, with strict authorization and rollback.
SET ROLE authenticated;
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000005';
DO $qa$
BEGIN
  PERFORM public.save_league_guarded(NULL,
    '00000000-0000-0000-0000-000000000021','Foreign Admin Form',
    'qa-foreign-form',
    '{"description":"no","start_date":null,"end_date":null,"rules_url":null,"total_dates":null,"best_dates_to_count":null,"status":"upcoming"}'::jsonb,
    ARRAY[]::uuid[]);
  RAISE EXCEPTION 'FAIL: B created a new league owned by A';
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'PASS: guarded form cannot create a league under another club';
END;
$qa$;
DO $qa$
BEGIN
  PERFORM public.save_league_guarded(
    '00000000-0000-0000-0000-000000000041'::uuid,
    '00000000-0000-0000-0000-000000000021','Foreign Club Edit',
    'qa-league-a',
    '{"description":"hijack","start_date":null,"end_date":null,"rules_url":null,"total_dates":null,"best_dates_to_count":null,"status":"active"}'::jsonb,
    ARRAY[]::uuid[]);
  RAISE EXCEPTION 'FAIL: B edited primary A via LeagueForm RPC';
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'PASS: guarded form blocks secondary club editing a league';
END;
$qa$;
RESET ROLE;

SET ROLE authenticated;
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
DO $qa$
DECLARE v_league uuid;
BEGIN
  SELECT public.save_league_guarded(
    NULL,'00000000-0000-0000-0000-000000000021'::uuid,
    'Form Created League','qa-form-created',
    '{"description":"first form","start_date":"2026-11-05","end_date":"2026-12-02","rules_url":"https://example.test/rules","total_dates":8,"best_dates_to_count":5,"status":"upcoming"}'::jsonb,
    ARRAY['00000000-0000-0000-0000-000000000031'::uuid,
          '00000000-0000-0000-0000-000000000032'::uuid]
  ) INTO v_league;
  IF (SELECT count(*) FROM public.league_clubs lc WHERE
      lc.league_id=v_league AND lc.is_primary
      AND lc.club_id='00000000-0000-0000-0000-000000000021')<>1
    OR (SELECT count(*) FROM public.league_rooms lr
        WHERE lr.league_id=v_league)<>2
    OR NOT EXISTS (SELECT 1 FROM public.leagues l
      WHERE l.id=v_league AND l.name='Form Created League'
       AND l.total_dates=8 AND l.best_dates_to_count=5
       AND l.start_date='2026-11-05' AND l.status='upcoming')
  THEN RAISE EXCEPTION 'FAIL: form create was not atomic'; END IF;
  RAISE NOTICE 'PASS: guarded form creates metadata, organizer and rooms atomically';
END;
$qa$;

DO $qa$
DECLARE v_league uuid;
BEGIN
  SELECT id INTO v_league FROM public.leagues WHERE slug='qa-form-created';
  PERFORM public.save_league_guarded(
    v_league,'00000000-0000-0000-0000-000000000021'::uuid,
    'Form Edited League','qa-form-created',
    '{"description":"updated form","start_date":"2026-11-06","end_date":"2026-12-04","rules_url":"https://example.test/updated","total_dates":9,"best_dates_to_count":6,"status":"active"}'::jsonb,
    ARRAY['00000000-0000-0000-0000-000000000032'::uuid]
  );
  IF NOT EXISTS (SELECT 1 FROM public.leagues l
      WHERE l.id=v_league AND l.name='Form Edited League'
      AND l.description='updated form' AND l.total_dates=9
      AND l.best_dates_to_count=6 AND l.status='active')
    OR (SELECT count(*) FROM public.league_rooms lr
        WHERE lr.league_id=v_league AND
        lr.room_id='00000000-0000-0000-0000-000000000032')<>1
    OR (SELECT count(*) FROM public.league_rooms lr
        WHERE lr.league_id=v_league)<>1
  THEN RAISE EXCEPTION 'FAIL: guarded form edit did not replace rooms/metadata'; END IF;
  RAISE NOTICE 'PASS: guarded form edits metadata and replaces rooms atomically';
END;
$qa$;
DO $qa$
DECLARE v_league uuid;
BEGIN
  SELECT id INTO v_league FROM public.leagues WHERE slug='qa-form-created';
  PERFORM public.save_league_guarded(
    v_league,'00000000-0000-0000-0000-000000000021'::uuid,
    'Malicious Partial Update','qa-form-created',
    '{"description":"should rollback","start_date":null,"end_date":null,"rules_url":null,"total_dates":5,"best_dates_to_count":9,"status":"active"}'::jsonb,
    ARRAY[]::uuid[]);
  RAISE EXCEPTION 'FAIL: invalid best_dates_to_count was accepted';
EXCEPTION WHEN SQLSTATE 'PT422' THEN
  RAISE NOTICE 'PASS: invalid league date count rejected';
END;
$qa$;
DO $qa$
DECLARE v_league uuid;
BEGIN
  SELECT id INTO v_league FROM public.leagues WHERE slug='qa-form-created';
  PERFORM public.save_league_guarded(
    v_league,'00000000-0000-0000-0000-000000000021'::uuid,
    'Malicious Unknown Room','qa-form-created',
    '{"description":"bad room","start_date":null,"end_date":null,"rules_url":null,"total_dates":4,"best_dates_to_count":2,"status":"active"}'::jsonb,
    ARRAY['00000000-0000-0000-0000-000000000099'::uuid]);
  RAISE EXCEPTION 'FAIL: unknown room was accepted by atomic LeagueForm';
EXCEPTION WHEN SQLSTATE 'PT422' THEN
  RAISE NOTICE 'PASS: invalid room rejected before metadata update';
END;
$qa$;
RESET ROLE;
DO $qa$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.leagues l
       WHERE l.slug='qa-form-created' AND l.name='Form Edited League'
       AND l.description='updated form')
    OR (SELECT count(*) FROM public.league_rooms lr
        JOIN public.leagues l ON l.id=lr.league_id
        WHERE l.slug='qa-form-created')<>1 THEN
    RAISE EXCEPTION 'FAIL: rejected guarded form changed existing metadata';
  END IF;
  RAISE NOTICE 'PASS: rejected form submission leaves earlier league and rooms intact';
END;
$qa$;

-- It is still safe to remove a newly created EMPTY league, including its
-- primary membership and room selection, in a single transaction.
SET ROLE authenticated;
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
DO $qa$
DECLARE v_id uuid;
BEGIN
  SELECT id INTO v_id FROM public.leagues WHERE slug='qa-form-created';
  IF v_id IS NULL THEN
    RAISE EXCEPTION 'FAIL: expected synthetic empty league missing';
  END IF;
  IF public.delete_empty_league_guarded(v_id) IS DISTINCT FROM true
  THEN RAISE EXCEPTION 'FAIL: protected empty deletion returned false'; END IF;
  IF EXISTS (SELECT 1 FROM public.leagues WHERE id=v_id)
     OR EXISTS (SELECT 1 FROM public.league_clubs WHERE league_id=v_id)
     OR EXISTS (SELECT 1 FROM public.league_rooms WHERE league_id=v_id)
  THEN RAISE EXCEPTION 'FAIL: empty delete left stale membership or room'; END IF;
  RAISE NOTICE 'PASS: organizer deletes truly empty league without orphans';
END;
$qa$;
RESET ROLE;


-- Extra QA: saving unchanged metadata and rooms must NOT rewrite existing
-- league tuples or delete/reinsert room relationship UUIDs.
SET ROLE authenticated;
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
DO $qa$
DECLARE
 v_id uuid := '00000000-0000-0000-0000-000000000041';
 v_before_tid tid;
 v_after_tid tid;
 v_before_room_ids uuid[];
 v_after_room_ids uuid[];
 v_meta jsonb;
 v_name text;
 v_slug text;
 v_rooms uuid[];
 v_primary uuid;
BEGIN
 SELECT l.ctid,l.name,l.slug,
        pg_catalog.jsonb_build_object(
         'description',l.description,
         'start_date',l.start_date,'end_date',l.end_date,
         'rules_url',l.rules_url,'status',l.status,
         'total_dates',l.total_dates,'best_dates_to_count',l.best_dates_to_count),
        (SELECT lc.club_id FROM public.league_clubs lc
         WHERE lc.league_id=l.id AND lc.is_primary)
 INTO v_before_tid,v_name,v_slug,v_meta,v_primary
 FROM public.leagues l WHERE l.id=v_id;
 SELECT pg_catalog.array_agg(lr.id ORDER BY lr.room_id),
        pg_catalog.array_agg(lr.room_id ORDER BY lr.room_id)
 INTO v_before_room_ids,v_rooms
 FROM public.league_rooms lr WHERE lr.league_id=v_id;
 IF v_primary IS NULL OR v_before_room_ids IS NULL THEN
   RAISE EXCEPTION 'FAIL: missing synthetic primary or rooms for idempotence';
 END IF;
 PERFORM public.save_league_guarded(
   v_id,v_primary,v_name,v_slug,v_meta,v_rooms);
 PERFORM public.save_league_guarded(
   v_id,v_primary,v_name,v_slug,v_meta,v_rooms);
 SELECT l.ctid INTO v_after_tid FROM public.leagues l WHERE l.id=v_id;
 SELECT pg_catalog.array_agg(lr.id ORDER BY lr.room_id)
 INTO v_after_room_ids FROM public.league_rooms lr WHERE lr.league_id=v_id;
 IF v_before_tid IS DISTINCT FROM v_after_tid OR
    v_before_room_ids IS DISTINCT FROM v_after_room_ids THEN
  RAISE EXCEPTION 'FAIL: unchanged league save rewrote metadata or room relationships';
 END IF;
 RAISE NOTICE 'PASS: identical guarded save creates zero league tuple changes and keeps room IDs';
END;
$qa$;

-- Set-difference test: retain the unchanged room's UUID even as one extra
-- room gets added then removed. Do not delete/reinsert the shared room.
DO $qa$
DECLARE
 v_id uuid := '00000000-0000-0000-0000-000000000041';
 v_room_id uuid;
BEGIN
 SELECT id INTO v_room_id FROM public.league_rooms WHERE
 league_id=v_id AND room_id='00000000-0000-0000-0000-000000000032';
 PERFORM public.set_league_rooms_guarded(v_id,ARRAY[
  '00000000-0000-0000-0000-000000000031'::uuid,
  '00000000-0000-0000-0000-000000000032'::uuid]);
 IF (SELECT id FROM public.league_rooms WHERE league_id=v_id
  AND room_id='00000000-0000-0000-0000-000000000032') IS DISTINCT FROM v_room_id
 THEN RAISE EXCEPTION 'FAIL: delta-add rewrote unchanged room'; END IF;
 PERFORM public.set_league_rooms_guarded(v_id,ARRAY[
  '00000000-0000-0000-0000-000000000032'::uuid]);
 PERFORM public.set_league_rooms_guarded(v_id,ARRAY[
  '00000000-0000-0000-0000-000000000032'::uuid]);
 IF (SELECT count(*) FROM public.league_rooms WHERE league_id=v_id)<>1
 OR (SELECT id FROM public.league_rooms WHERE league_id=v_id
    AND room_id='00000000-0000-0000-0000-000000000032') IS DISTINCT FROM v_room_id
 THEN RAISE EXCEPTION 'FAIL: delta-remove or no-op set changed stable room ID'; END IF;
 RAISE NOTICE 'PASS: delta room writes preserve existing relation IDs, including repeated no-op';
END;
$qa$;
RESET ROLE;

-- Force an error AFTER the new league and principal have already been
-- inserted by the atomic clone RPC. PostgreSQL must roll the entire call
-- back, including metadata, membership, and room rows.
CREATE FUNCTION public.qa_force_room_insert_error()
RETURNS trigger LANGUAGE plpgsql SET search_path TO ''
AS $qa$
BEGIN
 IF NEW.room_id='00000000-0000-0000-0000-000000000032'::uuid
  AND EXISTS(SELECT 1 FROM public.leagues l WHERE l.id=NEW.league_id
             AND l.slug='qa-forced-rollback') THEN
   RAISE EXCEPTION 'QA forced late room failure' USING ERRCODE='PT422';
 END IF;
 RETURN NEW;
END;
$qa$;
CREATE TRIGGER qa_force_room_insert_error
 BEFORE INSERT ON public.league_rooms
 FOR EACH ROW EXECUTE FUNCTION public.qa_force_room_insert_error();

SET ROLE authenticated;
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
DO $qa$
BEGIN
 BEGIN
  PERFORM public.duplicate_league_guarded(
  '00000000-0000-0000-0000-000000000041'::uuid,
  'Must rollback','qa-forced-rollback');
  RAISE EXCEPTION 'FAIL: clone accepted a forced late failure';
 EXCEPTION WHEN SQLSTATE 'PT422' THEN
  RAISE NOTICE 'PASS: forced late clone room error rolled back entire RPC';
 END;
END;
$qa$;
RESET ROLE;
DO $qa$
BEGIN
 IF EXISTS (SELECT 1 FROM public.leagues WHERE slug='qa-forced-rollback') THEN
  RAISE EXCEPTION 'FAIL: failed atomic clone left a partial league'; END IF;
 RAISE NOTICE 'PASS: forced clone rollback left no orphan league';
END;
$qa$;
DROP TRIGGER qa_force_room_insert_error ON public.league_rooms;
DROP FUNCTION public.qa_force_room_insert_error();



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
