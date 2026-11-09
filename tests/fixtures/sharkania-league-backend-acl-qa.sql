\set ON_ERROR_STOP on
-- QA-only: checked after the guarded Release A SQL in ephemeral PG17.
-- Never run against the production project.
DO $qa_acl$
DECLARE
  v_name text;
  v_sig text;
  v_expected text[] := ARRAY[
    'create_league_guarded(uuid,text,text)',
    'add_league_club_guarded(uuid,uuid)',
    'set_league_rooms_guarded(uuid,uuid[])',
    'duplicate_league_guarded(uuid,text,text)',
    'delete_empty_league_guarded(uuid)',
    'save_league_guarded(uuid,uuid,text,text,jsonb,uuid[])'
  ];
BEGIN
  FOREACH v_name IN ARRAY ARRAY['leagues','league_clubs','league_rooms']
  LOOP
    IF NOT (SELECT relrowsecurity FROM pg_catalog.pg_class
            WHERE oid=format('public.%I',v_name)::regclass) THEN
      RAISE EXCEPTION 'FAIL: RLS disabled on %',v_name;
    END IF;
    IF NOT pg_catalog.has_table_privilege('anon',format('public.%I',v_name),'SELECT') THEN
      RAISE EXCEPTION 'FAIL: public SELECT revoked on %',v_name;
    END IF;
    IF pg_catalog.has_table_privilege('anon',format('public.%I',v_name),'INSERT')
       OR pg_catalog.has_table_privilege('anon',format('public.%I',v_name),'DELETE')
       OR pg_catalog.has_table_privilege('authenticated',format('public.%I',v_name),'INSERT')
       OR pg_catalog.has_table_privilege('authenticated',format('public.%I',v_name),'DELETE')
    THEN RAISE EXCEPTION 'FAIL: broad INSERT/DELETE remains on %',v_name; END IF;
  END LOOP;

  IF pg_catalog.has_table_privilege('anon','public.league_clubs','UPDATE')
    OR pg_catalog.has_table_privilege('authenticated','public.league_clubs','UPDATE')
    OR pg_catalog.has_table_privilege('anon','public.league_rooms','UPDATE')
    OR pg_catalog.has_table_privilege('authenticated','public.league_rooms','UPDATE')
  THEN RAISE EXCEPTION 'FAIL: broad league relationship UPDATE remains'; END IF;

  FOREACH v_name IN ARRAY v_expected LOOP
    v_sig := 'public.' || v_name;
    IF pg_catalog.has_function_privilege('anon',v_sig,'EXECUTE')
       OR NOT pg_catalog.has_function_privilege('authenticated',v_sig,'EXECUTE')
       OR NOT EXISTS (
         SELECT 1 FROM pg_catalog.pg_proc
         WHERE oid=v_sig::regprocedure
           AND prosecdef=true
           AND EXISTS (
             SELECT 1 FROM pg_catalog.unnest(proconfig) AS cfg(setting)
             WHERE cfg.setting LIKE 'search_path=%'
           )
       )
    THEN RAISE EXCEPTION 'FAIL: unexpected RPC EXECUTE, security mode or search_path for %',v_sig; END IF;
  END LOOP;

  IF (SELECT count(*) FROM pg_catalog.pg_indexes
      WHERE schemaname='public' AND tablename='league_clubs'
        AND indexname='league_clubs_one_primary_per_league_guarded') <> 1
  THEN RAISE EXCEPTION 'FAIL: primary index missing or duplicate'; END IF;

  IF (SELECT count(*) FROM public.league_clubs WHERE is_primary)> (SELECT count(*) FROM public.leagues)
  THEN RAISE EXCEPTION 'FAIL: extra primary memberships'; END IF;

  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_policies
    WHERE schemaname='public'
      AND tablename IN ('leagues','league_clubs','league_rooms')
      AND policyname IN (
        'League clubs: admin insert','League clubs: admin update',
        'League clubs: admin delete','Leagues: admin puede crear',
        'Leagues: admin o super editar','Leagues: admin o super eliminar',
        'Permitir insertar league_rooms','Permitir borrar league_rooms')
  ) THEN RAISE EXCEPTION 'FAIL: legacy permissive write policies survived cutover'; END IF;

  RAISE NOTICE 'PASS: guarded RPC EXECUTE and write-table ACL restricted; public SELECT preserved';
END;
$qa_acl$;
