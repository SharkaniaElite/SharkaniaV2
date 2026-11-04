-- SHARKANIA / league ownership + membership security cutover PROPOSAL.
-- 2026-11-04. NOT A MIGRATION. DO NOT APPLY TO PRODUCTION.
-- Must be deployed only together with new league admin UI and authenticated
-- PostgREST tests, following full Supabase QA, backups and owner approval.
-- Reproduced bug: club B self-joins club A's league, marks is_primary and
-- can UPDATE league A due to an overbroad membership-based leagues policy.
--
-- Design fail-closed:
-- * Public SELECT remains unchanged.
-- * Only the actual PRIMARY club admin may edit/delete a league.
-- * Direct DML on league_clubs and league_rooms is blocked for clients.
-- * Creator of a league must be admin of its primary club; creation+primary
--   membership are in ONE transaction, not two browser writes.
-- * Adding an outside club requires approval from administrators of BOTH
--   primary and candidate clubs in the same session, or superadmin. This
--   is an interim rule until a two-party invite/accept flow is built.
-- * Existing primary cannot be changed through an untrusted request.
-- * Room membership changes are atomic and authorized against the primary.
-- * SQL privileged wrappers reside in public for PostgREST visibility;
--   production migration must review invoker wrappers + private logic.
--
-- BEFORE APPLYING: enumerate all existing league creation, duplication and
-- editing frontend paths, as they currently use direct INSERT on leagues,
-- league_clubs and league_rooms. Do not deploy privileges without parity.
BEGIN;

-- The existing leagues were inspected read-only: no league has zero or
-- multiple primary clubs. Enforce AT MOST one organizer at the DB layer.
-- Combined with the guarded creation RPC, this also guarantees a primary
-- for every league created by the new flow.
CREATE UNIQUE INDEX league_clubs_one_primary_per_league_guarded
ON public.league_clubs (league_id) WHERE is_primary;

-- Remove exactly the policy names independently verified from production.
DROP POLICY IF EXISTS "League clubs: admin insert" ON public.league_clubs;
DROP POLICY IF EXISTS "League clubs: admin update" ON public.league_clubs;
DROP POLICY IF EXISTS "League clubs: admin delete" ON public.league_clubs;

DROP POLICY IF EXISTS "Permitir insertar league_rooms" ON public.league_rooms;
DROP POLICY IF EXISTS "Permitir borrar league_rooms" ON public.league_rooms;

DROP POLICY IF EXISTS "Leagues: admin o super editar" ON public.leagues;
DROP POLICY IF EXISTS "Leagues: admin o super eliminar" ON public.leagues;
DROP POLICY IF EXISTS "Leagues: admin puede crear" ON public.leagues;

-- Fail-closed even when any leftover permissive policy exists: no INSERT /
-- UPDATE / DELETE privilege for anon or authenticated on these tables.
REVOKE INSERT,UPDATE,DELETE ON TABLE public.league_clubs
  FROM PUBLIC,anon,authenticated;
REVOKE INSERT,UPDATE,DELETE ON TABLE public.league_rooms
  FROM PUBLIC,anon,authenticated;
REVOKE INSERT ON TABLE public.leagues
  FROM PUBLIC,anon,authenticated;

CREATE POLICY "leagues_primary_owner_update"
ON public.leagues FOR UPDATE TO authenticated
USING (
  (SELECT auth.uid()) IS NOT NULL
  AND (
    (SELECT public.is_super_admin())
    OR EXISTS (
      SELECT 1 FROM public.league_clubs lc
      WHERE lc.league_id=leagues.id AND lc.is_primary
        AND (SELECT public.is_club_admin(lc.club_id))
    )
  )
)
WITH CHECK (
  (SELECT auth.uid()) IS NOT NULL
  AND (
    (SELECT public.is_super_admin())
    OR EXISTS (
      SELECT 1 FROM public.league_clubs lc
      WHERE lc.league_id=leagues.id AND lc.is_primary
        AND (SELECT public.is_club_admin(lc.club_id))
    )
  )
);

CREATE POLICY "leagues_primary_owner_delete"
ON public.leagues FOR DELETE TO authenticated
USING (
  (SELECT auth.uid()) IS NOT NULL
  AND (
    (SELECT public.is_super_admin())
    OR EXISTS (
      SELECT 1 FROM public.league_clubs lc
      WHERE lc.league_id=leagues.id AND lc.is_primary
        AND (SELECT public.is_club_admin(lc.club_id))
    )
  )
);

CREATE OR REPLACE FUNCTION public.create_league_guarded(
  p_primary_club_id uuid,
  p_name text,
  p_slug text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO ''
AS $func$
DECLARE
  v_name text := nullif(pg_catalog.btrim(p_name),'');
  v_slug text := nullif(pg_catalog.btrim(p_slug),'');
  v_league_id uuid;
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501';
  END IF;
  IF NOT ((SELECT public.is_super_admin()) OR
          (SELECT public.is_club_admin(p_primary_club_id))) THEN
    RAISE EXCEPTION 'Primary club administration required' USING ERRCODE='42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.clubs c WHERE c.id=p_primary_club_id) THEN
    RAISE EXCEPTION 'Primary club missing' USING ERRCODE='PT422';
  END IF;
  IF v_name IS NULL OR pg_catalog.length(v_name) NOT BETWEEN 3 AND 150
     OR v_slug IS NULL OR pg_catalog.length(v_slug)>160
     OR v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' THEN
    RAISE EXCEPTION 'Invalid league name or slug' USING ERRCODE='PT422';
  END IF;
  -- Production already has a UNIQUE idx_leagues_slug index. The advisory
  -- lock makes concurrent guarded clients fail with a controlled PT409;
  -- the existing database index protects other writers as a final guard.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('league_slug:'||v_slug,0)
  );
  IF EXISTS (SELECT 1 FROM public.leagues WHERE slug=v_slug) THEN
    RAISE EXCEPTION 'League slug already used' USING ERRCODE='PT409';
  END IF;

  INSERT INTO public.leagues(name,slug)
  VALUES (v_name,v_slug)
  RETURNING id INTO v_league_id;

  INSERT INTO public.league_clubs(league_id,club_id,is_primary)
  VALUES (v_league_id,p_primary_club_id,true);

  RETURN v_league_id;
END;
$func$;

CREATE OR REPLACE FUNCTION public.add_league_club_guarded(
  p_league_id uuid,
  p_club_id uuid
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO ''
AS $func$
DECLARE
  v_primary uuid;
  v_is_super boolean;
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501';
  END IF;
  -- Serialize all membership operations on a single league.
  PERFORM l.id FROM public.leagues l WHERE l.id=p_league_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'League missing' USING ERRCODE='PT404';
  END IF;
  SELECT lc.club_id INTO v_primary
  FROM public.league_clubs lc
  WHERE lc.league_id=p_league_id AND lc.is_primary
  ORDER BY lc.id LIMIT 1;
  IF v_primary IS NULL OR
     (SELECT count(*) FROM public.league_clubs lc
      WHERE lc.league_id=p_league_id AND lc.is_primary)<>1 THEN
    RAISE EXCEPTION 'Primary ownership ambiguous or missing'
      USING ERRCODE='PT409';
  END IF;
  v_is_super := (SELECT public.is_super_admin());
  IF NOT v_is_super AND NOT (
    (SELECT public.is_club_admin(v_primary))
    AND (SELECT public.is_club_admin(p_club_id))
  ) THEN
    RAISE EXCEPTION 'Both clubs must authorize league membership'
      USING ERRCODE='42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.clubs c WHERE c.id=p_club_id) THEN
    RAISE EXCEPTION 'Participating club missing' USING ERRCODE='PT422';
  END IF;
  -- A second call is a no-op; NEVER promote a secondary to primary.
  IF EXISTS (SELECT 1 FROM public.league_clubs lc
             WHERE lc.league_id=p_league_id AND lc.club_id=p_club_id) THEN
    RETURN false;
  END IF;
  INSERT INTO public.league_clubs(league_id,club_id,is_primary)
  VALUES (p_league_id,p_club_id,false);
  RETURN true;
END;
$func$;

CREATE OR REPLACE FUNCTION public.set_league_rooms_guarded(
  p_league_id uuid,
  p_room_ids uuid[]
) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO ''
AS $func$
DECLARE
  v_primary uuid;
  v_rooms uuid[] := coalesce(p_room_ids, ARRAY[]::uuid[]);
  v_n integer;
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501';
  END IF;
  PERFORM l.id FROM public.leagues l WHERE l.id=p_league_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'League missing' USING ERRCODE='PT404';
  END IF;
  SELECT lc.club_id INTO v_primary
  FROM public.league_clubs lc
  WHERE lc.league_id=p_league_id AND lc.is_primary
  ORDER BY lc.id LIMIT 1;
  IF v_primary IS NULL OR
     (SELECT count(*) FROM public.league_clubs lc
      WHERE lc.league_id=p_league_id AND lc.is_primary)<>1 THEN
    RAISE EXCEPTION 'Primary ownership ambiguous or missing'
      USING ERRCODE='PT409';
  END IF;
  IF NOT ((SELECT public.is_super_admin()) OR
          (SELECT public.is_club_admin(v_primary))) THEN
    RAISE EXCEPTION 'Primary club administration required' USING ERRCODE='42501';
  END IF;
  v_n := pg_catalog.cardinality(v_rooms);
  IF v_n>32 OR pg_catalog.array_position(v_rooms,NULL) IS NOT NULL OR
    (SELECT count(DISTINCT x.id) FROM pg_catalog.unnest(v_rooms) AS x(id))<>v_n
  THEN
    RAISE EXCEPTION 'Invalid or duplicate room list' USING ERRCODE='PT422';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_catalog.unnest(v_rooms) AS x(id)
             WHERE NOT EXISTS (SELECT 1 FROM public.poker_rooms r WHERE r.id=x.id)) THEN
    RAISE EXCEPTION 'Unknown poker room' USING ERRCODE='PT422';
  END IF;
  DELETE FROM public.league_rooms WHERE league_id=p_league_id;
  INSERT INTO public.league_rooms(league_id,room_id)
  SELECT p_league_id,x.id FROM pg_catalog.unnest(v_rooms) AS x(id);
  RETURN v_n;
END;
$func$;

-- A league duplicate cannot inherit arbitrary member clubs. Only the
-- SOURCE primary club is attached to the NEW league. Existing room selection
-- and scoring/schedule configuration are retained. Historic tournaments,
-- standing entries, participants, payments and results are NOT cloned.
CREATE OR REPLACE FUNCTION public.duplicate_league_guarded(
  p_source_league_id uuid,
  p_new_name text,
  p_new_slug text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO ''
AS $func$
DECLARE
  v_name text := nullif(pg_catalog.btrim(p_new_name),'');
  v_slug text := nullif(pg_catalog.btrim(p_new_slug),'');
  v_primary uuid;
  v_new uuid;
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501';
  END IF;
  -- Serialize operations against the source before copying relationships.
  PERFORM l.id FROM public.leagues l
  WHERE l.id=p_source_league_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'League not found' USING ERRCODE='PT404';
  END IF;
  SELECT lc.club_id INTO v_primary FROM public.league_clubs lc
  WHERE lc.league_id=p_source_league_id AND lc.is_primary
  ORDER BY lc.id LIMIT 1;
  IF v_primary IS NULL OR
     (SELECT count(*) FROM public.league_clubs lc
      WHERE lc.league_id=p_source_league_id AND lc.is_primary)<>1 THEN
    RAISE EXCEPTION 'Source league primary ownership is ambiguous'
      USING ERRCODE='PT409';
  END IF;
  IF NOT ((SELECT public.is_super_admin()) OR
          (SELECT public.is_club_admin(v_primary))) THEN
    RAISE EXCEPTION 'Only primary club admin may duplicate this league'
      USING ERRCODE='42501';
  END IF;
  IF v_name IS NULL OR pg_catalog.length(v_name) NOT BETWEEN 3 AND 150
     OR v_slug IS NULL OR pg_catalog.length(v_slug)>160
     OR v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' THEN
    RAISE EXCEPTION 'Invalid cloned league name or slug'
      USING ERRCODE='PT422';
  END IF;
  IF (SELECT count(*) FROM public.league_rooms lr
      WHERE lr.league_id=p_source_league_id)>32 THEN
    RAISE EXCEPTION 'Source league has too many rooms for this flow'
      USING ERRCODE='PT422';
  END IF;

  -- Production already enforces UNIQUE slug with idx_leagues_slug.
  -- Guarded create/duplicate share this advisory lock for stable PT409
  -- responses. Legacy direct writers must still be revoked at cutover.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('league_slug:'||v_slug,0)
  );
  IF EXISTS (SELECT 1 FROM public.leagues WHERE slug=v_slug) THEN
    RAISE EXCEPTION 'League slug already used' USING ERRCODE='PT409';
  END IF;

  INSERT INTO public.leagues(
    name,description,rules_url,start_date,end_date,status,
    scoring_system_id,total_dates,best_dates_to_count,slug
  )
  SELECT v_name,l.description,l.rules_url,l.start_date,l.end_date,
         'upcoming',l.scoring_system_id,l.total_dates,
         l.best_dates_to_count,v_slug
  FROM public.leagues l WHERE l.id=p_source_league_id
  RETURNING id INTO v_new;

  INSERT INTO public.league_clubs(league_id,club_id,is_primary)
  VALUES(v_new,v_primary,true);

  INSERT INTO public.league_rooms(league_id,room_id)
  SELECT v_new,lr.room_id FROM public.league_rooms lr
  WHERE lr.league_id=p_source_league_id;
  RETURN v_new;
END;
$func$;

-- New SECURITY DEFINER functions grant EXECUTE to PUBLIC by default:
-- close the opening in the SAME TRANSACTION and grant authenticated only.
REVOKE ALL ON FUNCTION public.create_league_guarded(uuid,text,text)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.create_league_guarded(uuid,text,text)
  TO authenticated;
REVOKE ALL ON FUNCTION public.add_league_club_guarded(uuid,uuid)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.add_league_club_guarded(uuid,uuid)
  TO authenticated;
REVOKE ALL ON FUNCTION public.set_league_rooms_guarded(uuid,uuid[])
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.set_league_rooms_guarded(uuid,uuid[])
  TO authenticated;

REVOKE ALL ON FUNCTION public.duplicate_league_guarded(uuid,text,text)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.duplicate_league_guarded(uuid,text,text)
  TO authenticated;

COMMIT;

-- This is a cutover PLAN; do NOT execute until admin UI / duplication flow
-- are migrated and legitimate league editing is verified against real QA.
-- Never turn on the tournament publisher flag merely because this passes CI.
