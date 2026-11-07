\set ON_ERROR_STOP on
-- P1 extra tables/policies: local Supabase GoTrue/PostgREST ONLY (127.0.0.1).
-- Reproduces current league RLS behavior atop the P0 local environment.
CREATE TABLE public.leagues(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 name text NOT NULL,
 status text NOT NULL DEFAULT 'upcoming');
INSERT INTO public.leagues(id,name) VALUES
 ('00000000-0000-0000-0000-000000000041','League A'),
 ('00000000-0000-0000-0000-000000000042','League B'),
 ('00000000-0000-0000-0000-000000000043','League C');
INSERT INTO public.league_clubs(league_id,club_id,is_primary) VALUES
 ('00000000-0000-0000-0000-000000000043',
  '00000000-0000-0000-0000-000000000021',true);
GRANT SELECT,INSERT,UPDATE,DELETE ON public.leagues TO authenticated;
GRANT SELECT ON public.leagues TO anon;
GRANT SELECT ON public.club_admins TO authenticated;
ALTER TABLE public.club_admins ENABLE ROW LEVEL SECURITY;
CREATE POLICY qa_club_admin_read_self ON public.club_admins
 FOR SELECT TO authenticated
 USING (user_id=(SELECT auth.uid()) OR (SELECT public.is_super_admin()));
ALTER TABLE public.leagues ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Leagues: lectura publica"
 ON public.leagues FOR SELECT USING (true);
CREATE POLICY "Leagues: admin puede crear"
 ON public.leagues FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Leagues: admin o super editar"
 ON public.leagues FOR UPDATE USING (
   public.is_super_admin() OR EXISTS(
     SELECT 1 FROM public.league_clubs lc
     WHERE lc.league_id=leagues.id AND public.is_club_admin(lc.club_id)));
CREATE POLICY "Leagues: admin o super eliminar"
 ON public.leagues FOR DELETE USING (
   public.is_super_admin() OR EXISTS(
     SELECT 1 FROM public.league_clubs lc
     WHERE lc.league_id=leagues.id AND public.is_club_admin(lc.club_id)));
CREATE POLICY "League clubs: admin insert"
 ON public.league_clubs FOR INSERT WITH CHECK (
   public.is_super_admin() OR public.is_club_admin(club_id));
CREATE POLICY "League clubs: admin delete"
 ON public.league_clubs FOR DELETE USING (
   public.is_super_admin() OR public.is_club_admin(club_id));
DO $qa$
BEGIN
 IF (SELECT count(*) FROM public.leagues)<>3 OR
 (SELECT count(*) FROM public.league_clubs)<>4
 THEN RAISE EXCEPTION 'STOP: P1 local API fixtures incomplete';END IF;
 RAISE NOTICE 'PASS: P1 local API old league RLS and fake memberships ready';
END $qa$;
