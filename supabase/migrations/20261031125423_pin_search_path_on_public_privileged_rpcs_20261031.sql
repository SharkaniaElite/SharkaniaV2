DO $fix_search_paths$
DECLARE fn record;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure AS signature
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public'
      AND p.proconfig IS NULL
      AND p.proname IN (
        'recalculate_league_standings',
        'set_ignition_linked_at',
        'check_ignition_duplicate',
        'queue_ignition_emails',
        'queue_newsletter_emails',
        'increment_post_views',
        'update_usd_to_clp'
      )
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path TO pg_catalog, public, extensions',fn.signature);
  END LOOP;
END
$fix_search_paths$;