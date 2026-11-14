
-- Sharkania: harden only storage.objects for blog_images.
-- Preconditions ensure the site can keep its current public assets and
-- that the site's existing trusted role guard is active.
DO $check$
DECLARE
  old_policy_count integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE oid='storage.objects'::regclass AND relrowsecurity) THEN
    RAISE EXCEPTION 'storage.objects RLS must be enabled';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id='blog_images' AND public=true) THEN
    RAISE EXCEPTION 'blog_images must remain a public bucket';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid='public.profiles'::regclass
      AND tgname='guard_profile_privileged_mutations'
      AND tgenabled IN ('O','A')
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname='guard_profile_privileged_mutations'
      AND pg_get_functiondef(p.oid) LIKE '%NEW.role IS DISTINCT FROM OLD.role%'
  ) THEN
    RAISE EXCEPTION 'Profile role guard not active; refusing to grant storage administration';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE role::text='super_admin') THEN
    RAISE EXCEPTION 'No super_admin exists; refusing to lock storage';
  END IF;
  SELECT count(*) INTO old_policy_count
  FROM pg_policies
  WHERE schemaname='storage' AND tablename='objects'
    AND policyname IN (
      'Acceso total a blog_images',
      'Permitir subidas',
      'acciones con imagenes de blog z4i46t_0',
      'acciones con imagenes de blog z4i46t_1',
      'acciones con imagenes de blog z4i46t_2',
      'acciones con imagenes de blog z4i46t_3'
    );
  IF old_policy_count <> 6 THEN
    RAISE EXCEPTION 'Unexpected previous policies: %, expected six',old_policy_count;
  END IF;
END $check$;

-- All mutating operations, including upload/upsert and deletion, require
-- an authenticated superadministrator. Public object URLs remain public.
CREATE POLICY "Sharkania blog_images admin select"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'blog_images' AND (SELECT public.is_super_admin()));

CREATE POLICY "Sharkania blog_images admin insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'blog_images' AND (SELECT public.is_super_admin()));

CREATE POLICY "Sharkania blog_images admin update"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'blog_images' AND (SELECT public.is_super_admin()))
WITH CHECK (bucket_id = 'blog_images' AND (SELECT public.is_super_admin()));

CREATE POLICY "Sharkania blog_images admin delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'blog_images' AND (SELECT public.is_super_admin()));

-- Policies are OR-composed by Postgres, so all overly broad legacy
-- policies must be removed, not merely superseded.
DROP POLICY "Acceso total a blog_images" ON storage.objects;
DROP POLICY "Permitir subidas" ON storage.objects;
DROP POLICY "acciones con imagenes de blog z4i46t_0" ON storage.objects;
DROP POLICY "acciones con imagenes de blog z4i46t_1" ON storage.objects;
DROP POLICY "acciones con imagenes de blog z4i46t_2" ON storage.objects;
DROP POLICY "acciones con imagenes de blog z4i46t_3" ON storage.objects;
