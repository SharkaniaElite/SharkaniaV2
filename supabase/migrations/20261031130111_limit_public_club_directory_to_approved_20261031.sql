DROP POLICY IF EXISTS "Permitir lectura publica de clubes" ON public.clubs;
DROP POLICY IF EXISTS "Clubs: lectura aprobados" ON public.clubs;
CREATE POLICY "Clubs: lectura aprobados"
ON public.clubs
FOR SELECT TO PUBLIC
USING (
  is_approved IS TRUE
  OR public.is_club_admin(id)
  OR public.is_super_admin()
);