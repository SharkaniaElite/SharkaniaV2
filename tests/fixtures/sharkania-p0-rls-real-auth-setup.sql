\set ON_ERROR_STOP on
-- Local Supabase GoTrue/PostgREST in GitHub Actions ONLY.
-- Run on 127.0.0.1 port 25422; NEVER point psql at a remote project.
-- Do not replace the real auth schema. All business data here is synthetic.
CREATE TABLE public.profiles(id uuid PRIMARY KEY,role text NOT NULL);
CREATE TABLE public.club_admins(club_id uuid NOT NULL,user_id uuid NOT NULL);
CREATE TABLE public.league_clubs(
 league_id uuid NOT NULL,club_id uuid NOT NULL,is_primary boolean NOT NULL,
 UNIQUE(league_id,club_id));
CREATE TABLE public.league_standings(
 league_id uuid NOT NULL,player_id uuid NOT NULL,
 total_points numeric NOT NULL DEFAULT 0,
 PRIMARY KEY(league_id,player_id));

INSERT INTO public.league_clubs(league_id,club_id,is_primary) VALUES
 ('00000000-0000-0000-0000-000000000041','00000000-0000-0000-0000-000000000021',true),
 ('00000000-0000-0000-0000-000000000041','00000000-0000-0000-0000-000000000022',false),
 ('00000000-0000-0000-0000-000000000042','00000000-0000-0000-0000-000000000022',true);
INSERT INTO public.league_standings VALUES
 ('00000000-0000-0000-0000-000000000041','00000000-0000-0000-0000-000000000051',10),
 ('00000000-0000-0000-0000-000000000042','00000000-0000-0000-0000-000000000052',10);

CREATE FUNCTION public.is_super_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $fn$
SELECT EXISTS(SELECT 1 FROM public.profiles p
 WHERE p.id=(SELECT auth.uid()) AND p.role='super_admin');
$fn$;
CREATE FUNCTION public.is_club_admin(p_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $fn$
SELECT EXISTS(SELECT 1 FROM public.club_admins ca
 WHERE ca.club_id=p_id AND ca.user_id=(SELECT auth.uid()));
$fn$;
REVOKE ALL ON FUNCTION public.is_super_admin(),public.is_club_admin(uuid)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin(),public.is_club_admin(uuid)
 TO anon,authenticated;
GRANT USAGE ON SCHEMA public TO anon,authenticated;
GRANT SELECT ON public.league_clubs TO anon,authenticated;
GRANT INSERT,UPDATE,DELETE ON public.league_clubs TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.league_standings TO anon,authenticated;

ALTER TABLE public.league_clubs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "League clubs: lectura publica"
 ON public.league_clubs FOR SELECT USING (true);
CREATE POLICY "League clubs: admin update"
 ON public.league_clubs FOR UPDATE
 USING (public.is_super_admin() OR public.is_club_admin(club_id));

ALTER TABLE public.league_standings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir lectura publica de posiciones"
 ON public.league_standings FOR SELECT USING (true);
CREATE POLICY "Permitir actualizar a usuarios autenticados"
 ON public.league_standings FOR UPDATE
 USING (auth.role()='authenticated'::text);
CREATE POLICY "Permitir eliminar a usuarios autenticados"
 ON public.league_standings FOR DELETE
 USING (auth.role()='authenticated'::text);
CREATE POLICY "Permitir insertar a usuarios autenticados"
 ON public.league_standings FOR INSERT
 WITH CHECK (auth.role()='authenticated'::text);
CREATE POLICY "Standings: super admin update"
 ON public.league_standings FOR UPDATE USING (public.is_super_admin());
CREATE POLICY "Standings: super admin delete"
 ON public.league_standings FOR DELETE USING (public.is_super_admin());
CREATE POLICY "Standings: super admin insert"
 ON public.league_standings FOR INSERT WITH CHECK (public.is_super_admin());

DO $qa$
BEGIN
 IF (SELECT count(*) FROM public.league_clubs)<>3 OR
 (SELECT count(*) FROM public.league_standings)<>2 THEN
 RAISE EXCEPTION 'STOP: local synthetic fixture incomplete';
 END IF;
 RAISE NOTICE 'PASS: local-only pre-patch RLS roles/fixtures prepared';
END $qa$;
