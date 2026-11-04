\set ON_ERROR_STOP on
-- Ephemeral Postgres 17 fixture. No Supabase project or actual customer data.
BEGIN;
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true),'')::uuid;
$$;
CREATE TABLE public.profiles (id uuid PRIMARY KEY, role text NOT NULL);
CREATE TABLE public.clubs (id uuid PRIMARY KEY);
CREATE TABLE public.club_admins (club_id uuid NOT NULL, user_id uuid NOT NULL);
CREATE TABLE public.tournaments (id uuid PRIMARY KEY, club_id uuid NOT NULL);
CREATE TABLE public.tournament_clubs (tournament_id uuid NOT NULL, club_id uuid NOT NULL, is_primary boolean NOT NULL DEFAULT false, PRIMARY KEY (tournament_id,club_id));
CREATE TABLE public.acc_managers (id uuid PRIMARY KEY);
CREATE TABLE public.acc_payouts (id uuid PRIMARY KEY, amount numeric NOT NULL);
CREATE TABLE public.acc_player_promo_config (clubgg_id text PRIMARY KEY, welcome_active boolean NOT NULL DEFAULT false);
CREATE TABLE public.acc_player_promo_payouts (id uuid PRIMARY KEY, total_paid numeric NOT NULL);
CREATE TABLE public.site_configs (key text PRIMARY KEY, value text NOT NULL);
CREATE TABLE public.live_polls (id uuid PRIMARY KEY, question text NOT NULL);
CREATE TABLE public.blog_embeddings (id uuid PRIMARY KEY, content text NOT NULL);
-- Fake identity IDs 1 superadmin, 2 club A admin, 3 player, 4 finance, 5 club B admin.
INSERT INTO public.profiles VALUES ('00000000-0000-0000-0000-000000000001','super_admin'),
('00000000-0000-0000-0000-000000000002','player'),
('00000000-0000-0000-0000-000000000003','player'),
('00000000-0000-0000-0000-000000000004','player'),
('00000000-0000-0000-0000-000000000005','player');
INSERT INTO public.clubs VALUES ('00000000-0000-0000-0000-000000000021'),('00000000-0000-0000-0000-000000000022');
INSERT INTO public.club_admins VALUES
('00000000-0000-0000-0000-000000000021','00000000-0000-0000-0000-000000000002'),
('00000000-0000-0000-0000-000000000022','00000000-0000-0000-0000-000000000005');
INSERT INTO public.tournaments VALUES
('00000000-0000-0000-0000-000000000011','00000000-0000-0000-0000-000000000021'),
('00000000-0000-0000-0000-000000000012','00000000-0000-0000-0000-000000000022');
INSERT INTO public.tournament_clubs VALUES
('00000000-0000-0000-0000-000000000011','00000000-0000-0000-0000-000000000021',true),
('00000000-0000-0000-0000-000000000012','00000000-0000-0000-0000-000000000022',true);
INSERT INTO public.acc_managers VALUES ('00000000-0000-0000-0000-000000000004');
INSERT INTO public.acc_payouts VALUES ('00000000-0000-0000-0000-000000000031',100);
INSERT INTO public.site_configs VALUES ('global','enabled');
INSERT INTO public.live_polls VALUES ('00000000-0000-0000-0000-000000000032','Which room?');
INSERT INTO public.blog_embeddings VALUES ('00000000-0000-0000-0000-000000000033','safe synthetic content');
CREATE FUNCTION public.is_super_admin() RETURNS boolean
  LANGUAGE sql SECURITY DEFINER SET search_path TO public AS $$
  SELECT EXISTS(SELECT 1 FROM public.profiles WHERE id=(SELECT auth.uid()) AND role='super_admin');
$$;
CREATE FUNCTION public.is_club_admin(p_club_id uuid) RETURNS boolean
  LANGUAGE sql SECURITY DEFINER SET search_path TO public AS $$
  SELECT EXISTS(SELECT 1 FROM public.club_admins WHERE club_id=p_club_id AND user_id=(SELECT auth.uid()));
$$;
GRANT USAGE ON SCHEMA auth,public TO anon,authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA auth,public TO anon,authenticated;
GRANT SELECT ON public.tournaments TO anon,authenticated;
GRANT SELECT ON public.acc_managers TO authenticated;
GRANT ALL ON public.tournament_clubs,public.acc_payouts,public.acc_player_promo_config,
  public.acc_player_promo_payouts,public.site_configs,public.live_polls,public.blog_embeddings
TO anon,authenticated;
ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;
CREATE POLICY tournaments_public_read ON public.tournaments FOR SELECT TO PUBLIC USING (true);
ALTER TABLE public.acc_managers ENABLE ROW LEVEL SECURITY;
CREATE POLICY finance_manager_identity ON public.acc_managers FOR SELECT TO authenticated
USING ((SELECT auth.uid()) = id);
ALTER TABLE public.tournament_clubs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin/Public select tournament_clubs" ON public.tournament_clubs
  FOR SELECT TO PUBLIC USING (true);
ALTER TABLE public.acc_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.acc_player_promo_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.acc_player_promo_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY site_configs_public_read ON public.site_configs FOR SELECT TO PUBLIC USING (true);
ALTER TABLE public.live_polls ENABLE ROW LEVEL SECURITY;
CREATE POLICY live_polls_public_read ON public.live_polls FOR SELECT TO PUBLIC USING (true);
ALTER TABLE public.blog_embeddings ENABLE ROW LEVEL SECURITY;
CREATE POLICY embeddings_public_read ON public.blog_embeddings FOR SELECT TO PUBLIC USING (true);
-- SECURITY INVOKER diagnostic: rowcount=0 or RLS privilege error is a denial.
CREATE FUNCTION public.qa_expect_dml(p_label text,p_query text,p_allowed boolean)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE n bigint;
BEGIN
  BEGIN
    EXECUTE p_query;
    GET DIAGNOSTICS n = ROW_COUNT;
    IF p_allowed AND n <> 1 THEN
      RAISE EXCEPTION 'QA FAIL [%]: expected 1 affected row; got %',p_label,n;
    END IF;
    IF NOT p_allowed AND n <> 0 THEN
      RAISE EXCEPTION 'QA FAIL [%]: unauthorized write succeeded (% rows)',p_label,n;
    END IF;
  EXCEPTION WHEN insufficient_privilege THEN
    IF p_allowed THEN RAISE EXCEPTION 'QA FAIL [%]: authorized write blocked', p_label; END IF;
  END;
END
$$;
GRANT EXECUTE ON FUNCTION public.qa_expect_dml(text,text,boolean) TO anon,authenticated;
COMMIT;
