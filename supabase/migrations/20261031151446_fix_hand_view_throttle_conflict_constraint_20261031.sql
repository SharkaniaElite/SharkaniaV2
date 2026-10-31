-- Existing production initially used ON CONFLICT (hand_id, viewer_id), which
-- can be ambiguous with the function parameter. Idempotent on fresh environments.
DO $fix$
DECLARE src text;
BEGIN
  src:=pg_get_functiondef('public.increment_hand_views(text)'::regprocedure);
  IF position('ON CONFLICT (hand_id, viewer_id)' IN src)>0 THEN
    EXECUTE replace(src,'ON CONFLICT (hand_id, viewer_id)',
      'ON CONFLICT ON CONSTRAINT hand_view_cooldowns_pkey');
  ELSIF position('ON CONFLICT ON CONSTRAINT hand_view_cooldowns_pkey' IN src)=0 THEN
    RAISE EXCEPTION 'Unexpected hand-view counter implementation';
  END IF;
END $fix$;
