-- Applied to Sharkania production at Supabase migration 20261031143409.
-- Preserved with the identical migration version for reproducible environments.
-- Restricts club creation and manager assignments to super admins.
-- Club admins may edit club contact information but not ownership/status.

DROP POLICY IF EXISTS "Clubs: insertar autenticado" ON public.clubs;
DROP POLICY IF EXISTS "Clubs: insertar super administrador" ON public.clubs;
CREATE POLICY "Clubs: insertar super administrador"
ON public.clubs FOR INSERT TO authenticated
WITH CHECK ((SELECT public.is_super_admin()));

DROP POLICY IF EXISTS "Club admins: lectura publica" ON public.club_admins;
DROP POLICY IF EXISTS "Club admins: gestionar select" ON public.club_admins;
DROP POLICY IF EXISTS "Club admins: lectura solo integrantes y super" ON public.club_admins;
CREATE POLICY "Club admins: lectura solo integrantes y super"
ON public.club_admins FOR SELECT TO authenticated
USING (
  user_id = (SELECT auth.uid())
  OR (SELECT public.is_super_admin())
  OR public.is_club_admin(club_id)
);

DROP POLICY IF EXISTS "Club admins: gestionar insert" ON public.club_admins;
DROP POLICY IF EXISTS "Club admins: insercion solo super" ON public.club_admins;
CREATE POLICY "Club admins: insercion solo super"
ON public.club_admins FOR INSERT TO authenticated
WITH CHECK ((SELECT public.is_super_admin()));

DROP POLICY IF EXISTS "Club admins: gestionar update" ON public.club_admins;
DROP POLICY IF EXISTS "Club admins: actualizacion solo super" ON public.club_admins;
CREATE POLICY "Club admins: actualizacion solo super"
ON public.club_admins FOR UPDATE TO authenticated
USING ((SELECT public.is_super_admin()))
WITH CHECK ((SELECT public.is_super_admin()));

DROP POLICY IF EXISTS "Club admins: gestionar delete" ON public.club_admins;
DROP POLICY IF EXISTS "Club admins: eliminacion solo super" ON public.club_admins;
CREATE POLICY "Club admins: eliminacion solo super"
ON public.club_admins FOR DELETE TO authenticated
USING ((SELECT public.is_super_admin()));

CREATE OR REPLACE FUNCTION public.guard_club_sensitive_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $func$
BEGIN
 IF current_user IN ('anon','authenticated')
    AND NOT (SELECT public.is_super_admin())
    AND (
      NEW.id IS DISTINCT FROM OLD.id
      OR NEW.created_by IS DISTINCT FROM OLD.created_by
      OR NEW.is_approved IS DISTINCT FROM OLD.is_approved
      OR NEW.is_demo IS DISTINCT FROM OLD.is_demo
      OR NEW.slug IS DISTINCT FROM OLD.slug
      OR NEW.created_at IS DISTINCT FROM OLD.created_at
    )
 THEN
   RAISE EXCEPTION 'Solo superadministrador puede modificar identificador, propietario, aprobación o slug del club'
   USING ERRCODE='42501';
 END IF;
 RETURN NEW;
END
$func$;

DROP TRIGGER IF EXISTS guard_club_sensitive_fields ON public.clubs;
CREATE TRIGGER guard_club_sensitive_fields
BEFORE UPDATE ON public.clubs
FOR EACH ROW
EXECUTE FUNCTION public.guard_club_sensitive_fields();

REVOKE EXECUTE ON FUNCTION public.guard_club_sensitive_fields()
FROM PUBLIC, anon, authenticated;
