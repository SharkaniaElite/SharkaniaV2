-- Applied to Sharkania production on 2026-10-31 (Supabase migration 20261031154647).
-- Prepare an authenticated exact-ID sharing endpoint before restricting table SELECT.
-- New hand IDs contain 128 bits of randomness; old 8-character links continue to work.
ALTER TABLE public.shared_hands
  ALTER COLUMN id SET DEFAULT (pg_catalog.gen_random_uuid())::text;

CREATE OR REPLACE FUNCTION public.get_shared_hand(p_hand_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $body$
DECLARE v_result jsonb;
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'Login required to open a shared hand' USING ERRCODE='42501';
  END IF;

  IF p_hand_id IS NULL
     OR length(p_hand_id) NOT IN (8,36)
     OR p_hand_id !~ '^[0-9a-fA-F-]+$' THEN
    RETURN NULL;
  END IF;

  SELECT h.hand_data INTO v_result
  FROM public.shared_hands AS h
  WHERE h.id=p_hand_id LIMIT 1;

  RETURN v_result;
END;
$body$;

REVOKE EXECUTE ON FUNCTION public.get_shared_hand(text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_shared_hand(text)
  TO authenticated, service_role;
