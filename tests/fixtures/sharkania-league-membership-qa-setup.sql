\set ON_ERROR_STOP on
-- Isolated PostgreSQL qa_league_auth. All IDs/auth fake.
\ir sharkania-elo-qa-setup.sql

CREATE TABLE public.clubs(
  id uuid PRIMARY KEY
);
INSERT INTO public.clubs(id) VALUES
  ('00000000-0000-0000-0000-000000000021'),
  ('00000000-0000-0000-0000-000000000022');

CREATE TYPE public.league_status AS ENUM ('upcoming','active','finished');
CREATE TABLE public.leagues(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL, slug text,
  description text, rules_url text,
  start_date date, end_date date,
  status public.league_status NOT NULL DEFAULT 'upcoming',
  scoring_system_id uuid, total_dates integer, best_dates_to_count integer
);
CREATE TABLE public.league_clubs(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id uuid NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  is_primary boolean NOT NULL DEFAULT false,
  UNIQUE(league_id,club_id)
);
CREATE TABLE public.poker_rooms(id uuid PRIMARY KEY);
INSERT INTO public.poker_rooms(id) VALUES
 ('00000000-0000-0000-0000-000000000031'),
 ('00000000-0000-0000-0000-000000000032');
CREATE TABLE public.league_rooms(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id uuid NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  room_id uuid NOT NULL REFERENCES public.poker_rooms(id),
  UNIQUE(league_id,room_id)
);

INSERT INTO public.leagues(
  id,name,slug,description,rules_url,start_date,end_date,
  status,scoring_system_id,total_dates,best_dates_to_count
) VALUES
('00000000-0000-0000-0000-000000000041','QA League A',
 'qa-league-a','Liga de prueba con reglamento','https://example.test/reglas',
 '2026-11-01','2026-12-01','finished',
 '00000000-0000-0000-0000-000000000061',9,5),
('00000000-0000-0000-0000-000000000042','QA League B',
 'qa-league-b',null,null,null,null,'upcoming',null,null,null);
INSERT INTO public.league_clubs(league_id,club_id,is_primary) VALUES
('00000000-0000-0000-0000-000000000041','00000000-0000-0000-0000-000000000021',true),
('00000000-0000-0000-0000-000000000042','00000000-0000-0000-0000-000000000022',true);
INSERT INTO public.league_rooms(league_id,room_id) VALUES
('00000000-0000-0000-0000-000000000041','00000000-0000-0000-0000-000000000031');

-- Original policy joins club_admins directly; the ELO-only base fixture
-- deliberately had no club_admins SELECT. Supply read in this fake DB so
-- we can reproduce exactly the vulnerable production policy before hardening.
GRANT SELECT ON TABLE public.club_admins TO authenticated;
ALTER TABLE public.leagues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.league_clubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.league_rooms ENABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE public.leagues,public.league_clubs,public.league_rooms
  TO anon,authenticated;

-- Clone precise effective buggy policies from read-only live metadata.
CREATE POLICY "Leagues: lectura publica"
ON public.leagues FOR SELECT USING (true);
CREATE POLICY "Leagues: admin puede crear"
ON public.leagues FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Leagues: admin o super editar"
ON public.leagues FOR UPDATE
USING (
  public.is_super_admin() OR EXISTS (
    SELECT 1 FROM public.league_clubs lc JOIN public.club_admins ca
      ON ca.club_id=lc.club_id
    WHERE lc.league_id=leagues.id AND ca.user_id=auth.uid()
  )
);
CREATE POLICY "Leagues: admin o super eliminar"
ON public.leagues FOR DELETE
USING (
  public.is_super_admin() OR EXISTS (
    SELECT 1 FROM public.league_clubs lc JOIN public.club_admins ca
      ON ca.club_id=lc.club_id
    WHERE lc.league_id=leagues.id AND ca.user_id=auth.uid()
  )
);
CREATE POLICY "League clubs: lectura publica"
ON public.league_clubs FOR SELECT USING (true);
CREATE POLICY "League clubs: admin insert"
ON public.league_clubs FOR INSERT
WITH CHECK (public.is_super_admin() OR public.is_club_admin(club_id));
CREATE POLICY "League clubs: admin update"
ON public.league_clubs FOR UPDATE
USING (public.is_super_admin() OR public.is_club_admin(club_id));
CREATE POLICY "League clubs: admin delete"
ON public.league_clubs FOR DELETE
USING (public.is_super_admin() OR public.is_club_admin(club_id));

CREATE POLICY "Permitir leer league_rooms"
ON public.league_rooms FOR SELECT USING (true);
CREATE POLICY "Permitir insertar league_rooms"
ON public.league_rooms FOR INSERT TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Permitir borrar league_rooms"
ON public.league_rooms FOR DELETE TO authenticated
USING (auth.uid() IS NOT NULL);

-- Reproduce the actual old policies in a transaction that rolls back.
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-0000-0000-000000000005';
INSERT INTO public.league_clubs(league_id,club_id,is_primary) VALUES
('00000000-0000-0000-0000-000000000041','00000000-0000-0000-0000-000000000022',false);
UPDATE public.league_clubs SET is_primary=true
WHERE league_id='00000000-0000-0000-0000-000000000041'
  AND club_id='00000000-0000-0000-0000-000000000022';
UPDATE public.leagues SET name='Hijacked League A'
WHERE id='00000000-0000-0000-0000-000000000041';
DO $qa$
BEGIN
  IF (SELECT name FROM public.leagues
    WHERE id='00000000-0000-0000-0000-000000000041')<>'Hijacked League A'
  THEN RAISE EXCEPTION 'FAIL: vulnerable baseline not reproduced'; END IF;
  RAISE NOTICE 'CONFIRMADO QA: club B autojoined, self-promoted and edited foreign league';
END;
$qa$;
ROLLBACK;
DO $qa$
BEGIN
  IF (SELECT name FROM public.leagues
     WHERE id='00000000-0000-0000-0000-000000000041')<>'QA League A'
   OR (SELECT count(*) FROM public.league_clubs
       WHERE league_id='00000000-0000-0000-0000-000000000041')<>1
  THEN RAISE EXCEPTION 'FAIL: vulnerable reproduction did not roll back'; END IF;
END;
$qa$;

-- Apply patch only in this isolated temporary QA PostgreSQL database.
\ir ../../docs/security/league-membership-guarded-cutover-2026-11-04.proposal.sql
SELECT 'PASS: league security proposal compiled in PostgreSQL QA' AS status;
