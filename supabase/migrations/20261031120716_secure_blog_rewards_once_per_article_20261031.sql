CREATE TABLE IF NOT EXISTS public.blog_study_sessions (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id uuid NOT NULL REFERENCES public.blog_posts(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, post_id)
);
CREATE TABLE IF NOT EXISTS public.blog_reward_claims (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id uuid NOT NULL REFERENCES public.blog_posts(id) ON DELETE CASCADE,
  claimed_at timestamptz NOT NULL DEFAULT now(),
  coins_awarded integer NOT NULL DEFAULT 10,
  xp_awarded integer NOT NULL DEFAULT 50,
  PRIMARY KEY (user_id, post_id)
);
ALTER TABLE public.blog_study_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_reward_claims ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.blog_study_sessions FROM PUBLIC,anon,authenticated;
REVOKE ALL ON public.blog_reward_claims FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.blog_reward_claims TO authenticated;
CREATE POLICY "Users can see own blog rewards"
 ON public.blog_reward_claims FOR SELECT TO authenticated
 USING (user_id = (select auth.uid()));

CREATE OR REPLACE FUNCTION public.start_blog_study(p_post_id uuid)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','extensions'
AS $body$
DECLARE v_uid uuid := (select auth.uid());
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Autenticación requerida' USING ERRCODE='42501'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.blog_posts WHERE id=p_post_id AND published=true) THEN
    RETURN json_build_object('success',false,'error','not_found');
  END IF;
  INSERT INTO public.blog_study_sessions(user_id,post_id)
  VALUES (v_uid,p_post_id) ON CONFLICT DO NOTHING;
  RETURN json_build_object('success',true);
END;
$body$;

CREATE OR REPLACE FUNCTION public.claim_blog_reward_secure(p_post_id uuid)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','extensions'
AS $body$
DECLARE
  v_uid uuid := (select auth.uid());
  v_started timestamptz;
  v_read_minutes integer;
  v_inserted uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Autenticación requerida' USING ERRCODE='42501'; END IF;
  IF EXISTS (SELECT 1 FROM public.blog_reward_claims WHERE user_id=v_uid AND post_id=p_post_id) THEN
    RETURN json_build_object('success',false,'error','already_claimed');
  END IF;
  SELECT COALESCE(read_time,3) INTO v_read_minutes
    FROM public.blog_posts WHERE id=p_post_id AND published=true;
  IF NOT FOUND THEN RETURN json_build_object('success',false,'error','not_found'); END IF;
  SELECT started_at INTO v_started FROM public.blog_study_sessions
    WHERE user_id=v_uid AND post_id=p_post_id;
  IF v_started IS NULL OR v_started > now() - (GREATEST(1,LEAST(v_read_minutes,20))* interval '1 minute') THEN
    RETURN json_build_object('success',false,'error','not_ready');
  END IF;
  INSERT INTO public.blog_reward_claims(user_id,post_id,coins_awarded,xp_awarded)
    VALUES (v_uid,p_post_id,10,50)
    ON CONFLICT DO NOTHING RETURNING user_id INTO v_inserted;
  IF v_inserted IS NULL THEN RETURN json_build_object('success',false,'error','already_claimed'); END IF;
  UPDATE public.profiles SET
    shark_coins_balance = COALESCE(shark_coins_balance,0)+10,
    xp = COALESCE(xp,0)+50
    WHERE id=v_uid;
  IF NOT FOUND THEN RAISE EXCEPTION 'Perfil no encontrado'; END IF;
  RETURN json_build_object('success',true,'coins_earned',10,'xp_earned',50);
END;
$body$;

REVOKE EXECUTE ON FUNCTION public.start_blog_study(uuid) FROM PUBLIC,anon;
REVOKE EXECUTE ON FUNCTION public.claim_blog_reward_secure(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.start_blog_study(uuid) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.claim_blog_reward_secure(uuid) TO authenticated,service_role;
