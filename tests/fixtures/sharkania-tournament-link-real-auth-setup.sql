\set ON_ERROR_STOP on
-- Isolated local Supabase E2E adapter; fake business schema already created.
-- Never run against an external or production database. CI enforces loopback.
GRANT SELECT,INSERT,UPDATE ON public.tournaments TO authenticated;
GRANT SELECT ON public.tournaments TO anon;
CREATE POLICY qa_real_auth_tournament_read ON public.tournaments
 FOR SELECT USING (true);
CREATE POLICY qa_real_auth_tournament_insert ON public.tournaments
 FOR INSERT TO authenticated
 WITH CHECK (public.is_super_admin() OR public.is_club_admin(club_id));
CREATE POLICY qa_real_auth_tournament_update ON public.tournaments
 FOR UPDATE TO authenticated
 USING (public.is_super_admin() OR public.is_club_admin(club_id))
 WITH CHECK (public.is_super_admin() OR public.is_club_admin(club_id));
\ir ../../docs/security/tournament-league-link-guard-2026-11-06.qa-only.sql
\echo 'PASS: GoTrue local QA tournament policies and link trigger installed'
