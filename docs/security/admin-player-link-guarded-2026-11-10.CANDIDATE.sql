-- SHARKANIA / PR #96 / ADMIN NICKNAME LINKING (QA CANDIDATE, NOT LIVE).
-- Keep administrative linking working after revoking players.profile_id UPDATE.
-- Server validates real superadmin and writes player + claim in ONE transaction.
-- The RLS policy of nickname_claims remains unchanged for player submissions.
BEGIN;
SET LOCAL lock_timeout='10s';
SET LOCAL statement_timeout='120s';
DO $link_pre$
BEGIN
 IF to_regclass('public.nickname_claims') IS NULL
 OR to_regclass('public.players') IS NULL
 OR to_regprocedure('public.publish_independent_nickname_results_guarded(uuid,jsonb)') IS NULL
 THEN RAISE EXCEPTION 'Review current tables and guarded writer before admin link RPC'
 USING ERRCODE='PT409'; END IF;
 IF to_regprocedure('public.admin_link_player_profile_guarded(uuid,uuid,uuid)') IS NOT NULL
 THEN RAISE EXCEPTION 'Admin profile link RPC already exists; compare definition'
 USING ERRCODE='PT409'; END IF;
END;
$link_pre$;

CREATE FUNCTION public.admin_link_player_profile_guarded(
 p_player_id uuid,p_profile_id uuid,p_claim_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $admin_link$
DECLARE
 v_actor uuid := (SELECT auth.uid());
 v_before uuid;
 v_claim record;
BEGIN
 IF v_actor IS NULL OR NOT (SELECT public.is_super_admin()) THEN
  RAISE EXCEPTION 'Super administrator required' USING ERRCODE='42501';
 END IF;
 IF p_player_id IS NULL THEN
  RAISE EXCEPTION 'Invalid player' USING ERRCODE='PT422'; END IF;
 IF p_claim_id IS NOT NULL AND p_profile_id IS NULL THEN
  RAISE EXCEPTION 'Cannot approve a claim when unlinking' USING ERRCODE='PT422';
 END IF;

 SELECT p.profile_id INTO v_before
 FROM public.players p WHERE p.id=p_player_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Player not found' USING ERRCODE='PT404'; END IF;

 IF p_profile_id IS NULL THEN
  UPDATE public.players SET profile_id=NULL WHERE id=p_player_id;
  RETURN pg_catalog.jsonb_build_object('status','unlinked','player_id',p_player_id);
 END IF;

 PERFORM 1 FROM public.profiles WHERE id=p_profile_id FOR KEY SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Profile not found' USING ERRCODE='PT404'; END IF;

 -- Never silently steal a nickname that belongs to another account.
 IF v_before IS NOT NULL AND v_before IS DISTINCT FROM p_profile_id THEN
  RAISE EXCEPTION 'Already linked to a different profile' USING ERRCODE='PT409'; END IF;

 IF p_claim_id IS NOT NULL THEN
  SELECT c.id,c.user_id,c.player_id,c.status::text AS status
   INTO v_claim
  FROM public.nickname_claims c
  WHERE c.id=p_claim_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Claim not found' USING ERRCODE='PT404'; END IF;
  IF v_claim.status<>'pending'
  OR v_claim.user_id IS DISTINCT FROM p_profile_id
  OR v_claim.player_id IS DISTINCT FROM p_player_id THEN
   RAISE EXCEPTION 'Claim does not match player/profile or is already resolved'
   USING ERRCODE='PT409';
  END IF;
 END IF;

 UPDATE public.players SET profile_id=p_profile_id WHERE id=p_player_id;
 IF p_claim_id IS NOT NULL THEN
  UPDATE public.nickname_claims
   SET status='approved',resolved_at=pg_catalog.now(),resolved_by=v_actor
   WHERE id=p_claim_id;
 ELSIF v_before IS DISTINCT FROM p_profile_id THEN
  -- Manual superadmin linking: preserve the legacy administrative evidence,
  -- but write it in the SAME transaction as the player link.
  INSERT INTO public.nickname_claims(
   user_id,player_id,screenshot_url,status,resolved_at,resolved_by
  ) VALUES(p_profile_id,p_player_id,'admin-claim','approved',
           pg_catalog.now(),v_actor);
 END IF;

 RETURN pg_catalog.jsonb_build_object(
   'status','linked','player_id',p_player_id,'profile_id',p_profile_id,
   'claim_resolved',p_claim_id IS NOT NULL,'atomic',true);
END;
$admin_link$;

REVOKE ALL ON FUNCTION public.admin_link_player_profile_guarded(uuid,uuid,uuid)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_link_player_profile_guarded(uuid,uuid,uuid)
 TO authenticated;

DO $post$
BEGIN
 IF pg_catalog.has_function_privilege('anon',
  'public.admin_link_player_profile_guarded(uuid,uuid,uuid)','EXECUTE')
 OR NOT pg_catalog.has_function_privilege('authenticated',
  'public.admin_link_player_profile_guarded(uuid,uuid,uuid)','EXECUTE')
 OR pg_catalog.has_column_privilege('authenticated','public.players','profile_id','UPDATE')
 THEN RAISE EXCEPTION 'Unsafe linking privileges' USING ERRCODE='PT409'; END IF;
END;
$post$;
COMMIT;
