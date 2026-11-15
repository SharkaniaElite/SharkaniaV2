-- Batch analytics synchronization to stay below Cloudflare Pages Functions
-- per-invocation subrequest limits. Only an authenticated super-admin may invoke it.
CREATE OR REPLACE FUNCTION public.sync_blog_unique_views(p_views jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $body$
DECLARE
  v_updated integer := 0;
  v_supplied integer;
BEGIN
  IF (SELECT auth.uid()) IS NULL OR NOT (SELECT public.is_super_admin()) THEN
    RAISE EXCEPTION 'No autorizado a sincronizar estadísticas'
      USING ERRCODE = '42501';
  END IF;

  IF p_views IS NULL OR jsonb_typeof(p_views) <> 'object' THEN
    RAISE EXCEPTION 'Se esperaba un objeto de visitas'
      USING ERRCODE = '22023';
  END IF;

  v_supplied := jsonb_object_length(p_views);
  IF v_supplied < 1 OR v_supplied > 1000 THEN
    RAISE EXCEPTION 'La cantidad de artículos está fuera de rango'
      USING ERRCODE = '22023';
  END IF;

  WITH valid_views AS (
    SELECT key AS slug, value::integer AS visits
    FROM jsonb_each_text(p_views)
    WHERE length(key) BETWEEN 1 AND 240
      AND value ~ '^[0-9]{1,9}$'
  ),
  changed AS (
    UPDATE public.blog_posts AS b
      SET unique_views = GREATEST(COALESCE(b.unique_views, 0), v.visits)
    FROM valid_views AS v
    WHERE b.slug = v.slug AND b.published IS TRUE
      AND v.visits > COALESCE(b.unique_views, 0)
    RETURNING b.id
  )
  SELECT count(*) INTO v_updated FROM changed;

  RETURN jsonb_build_object('success', true, 'updated', v_updated, 'supplied', v_supplied);
END;
$body$;

REVOKE EXECUTE ON FUNCTION public.sync_blog_unique_views(jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_blog_unique_views(jsonb)
  TO authenticated, service_role;