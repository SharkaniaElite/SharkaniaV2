\set ON_ERROR_STOP on
-- Depends on the synthetic independent first-upload fixture, which generated
-- player NewIndependentQA. All IDs and profiles below are fake.
-- Production exposes public player lookup; the old synthetic QA baseline did
-- not include this SELECT grant/policy. Restore it only in the fake test.
GRANT SELECT ON public.players TO authenticated;
CREATE POLICY qa_admin_claims_players_read ON public.players FOR SELECT
 TO authenticated USING(true);
INSERT INTO public.nickname_claims(user_id,player_id,screenshot_url,status)
SELECT '00000000-0000-0000-0000-000000000005',p.id,'qa-verified-proof','pending'
FROM public.players p WHERE p.nickname='NewIndependentQA';

BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
DO $unauthorized$
DECLARE failed bool:=false; v_player uuid;
BEGIN
 SELECT id INTO v_player FROM public.players WHERE nickname='NewIndependentQA';
 BEGIN
  PERFORM public.admin_link_player_profile_guarded(
    v_player,'00000000-0000-0000-0000-000000000005',NULL);
 EXCEPTION WHEN SQLSTATE '42501' THEN failed:=true; END;
 IF NOT failed THEN RAISE EXCEPTION 'FAIL: club admin impersonated superadmin link'; END IF;
 RAISE NOTICE 'PASS: normal club admin cannot invoke protected claim link';
END;
$unauthorized$;
RESET ROLE;
ROLLBACK;

BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
DO $approve$
DECLARE
 v_player uuid;
 v_claim uuid;
 v_receipt jsonb;
BEGIN
 SELECT id INTO v_player FROM public.players WHERE nickname='NewIndependentQA';
 SELECT id INTO v_claim FROM public.nickname_claims WHERE screenshot_url='qa-verified-proof';

 v_receipt:=public.admin_link_player_profile_guarded(
  v_player,'00000000-0000-0000-0000-000000000005',v_claim);
 IF v_receipt->>'status'<>'linked' OR v_receipt->>'atomic'<>'true'
 OR v_receipt->>'claim_resolved'<>'true' THEN
  RAISE EXCEPTION 'FAIL: claim/profile atomic response mismatch %',v_receipt; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.players WHERE id=v_player
    AND profile_id='00000000-0000-0000-0000-000000000005')
 OR NOT EXISTS(SELECT 1 FROM public.nickname_claims WHERE id=v_claim
    AND status='approved' AND resolved_at IS NOT NULL
    AND resolved_by='00000000-0000-0000-0000-000000000001')
 THEN RAISE EXCEPTION 'FAIL: approved claim and player must commit together'; END IF;

 -- Wrong profile cannot silently hijack already-linked player.
 DECLARE
  failed bool:=false;
 BEGIN
  BEGIN
   PERFORM public.admin_link_player_profile_guarded(
    v_player,'00000000-0000-0000-0000-000000000061',NULL);
  EXCEPTION WHEN SQLSTATE 'PT409' THEN failed:=true; END;
  IF NOT failed THEN RAISE EXCEPTION 'FAIL: accepted account hijack'; END IF;
 END;

 -- A resolved claim cannot be approved twice.
 DECLARE
  failed bool:=false;
 BEGIN
  BEGIN
   PERFORM public.admin_link_player_profile_guarded(
    v_player,'00000000-0000-0000-0000-000000000005',v_claim);
  EXCEPTION WHEN SQLSTATE 'PT409' THEN failed:=true; END;
  IF NOT failed THEN RAISE EXCEPTION 'FAIL: duplicate claim approval accepted'; END IF;
 END;

 v_receipt:=public.admin_link_player_profile_guarded(v_player,NULL,NULL);
 IF v_receipt->>'status'<>'unlinked' OR EXISTS(
  SELECT 1 FROM public.players WHERE id=v_player AND profile_id IS NOT NULL
 ) THEN RAISE EXCEPTION 'FAIL: superadmin unlink failed'; END IF;

 v_receipt:=public.admin_link_player_profile_guarded(
  v_player,'00000000-0000-0000-0000-000000000005',NULL);
 IF v_receipt->>'status'<>'linked'
 OR NOT EXISTS(SELECT 1 FROM public.nickname_claims WHERE player_id=v_player
    AND screenshot_url='admin-claim' AND status='approved'
    AND resolved_by='00000000-0000-0000-0000-000000000001')
 THEN RAISE EXCEPTION 'FAIL: manual superadmin link has no atomic approval evidence'; END IF;
 RAISE NOTICE 'PASS: verified superadmin claim, unlink, manual link and anti-hijack';
END;
$approve$;
RESET ROLE;
COMMIT;
SELECT 'PASS FINAL: protected profile claims preserve admin workflow under restrictive player ACL' AS result;
