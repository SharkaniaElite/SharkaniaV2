DO $patch$
DECLARE body text;
BEGIN
  body := pg_get_functiondef('public.sync_blog_unique_views(jsonb)'::regprocedure);
  IF position('v_supplied := jsonb_object_length(p_views);' IN body) = 0 THEN
    RAISE EXCEPTION 'Unexpected sync function definition';
  END IF;
  EXECUTE replace(body,
    'v_supplied := jsonb_object_length(p_views);',
    'SELECT count(*) INTO v_supplied FROM jsonb_object_keys(p_views);'
  );
END
$patch$;