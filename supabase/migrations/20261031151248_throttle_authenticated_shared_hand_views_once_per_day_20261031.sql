-- A shared-hand URL currently requires sign-in. Keep counters useful without
-- letting anonymous callers or repeat requests inflate them.
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS private.hand_view_cooldowns (
    hand_id text NOT NULL REFERENCES public.shared_hands(id) ON DELETE CASCADE,
    viewer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    counted_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (hand_id, viewer_id)
);
REVOKE ALL ON TABLE private.hand_view_cooldowns FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.increment_hand_views(hand_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $body$
DECLARE
  v_viewer uuid := (SELECT auth.uid());
  v_counted boolean := false;
BEGIN
  IF v_viewer IS NULL THEN
    RAISE EXCEPTION 'Inicio de sesión requerido para contar la visita' USING ERRCODE = '42501';
  END IF;

  -- No changes for unknown or invalid hand IDs.
  IF hand_id IS NULL OR length(hand_id) < 1 OR length(hand_id) > 64
     OR NOT EXISTS (SELECT 1 FROM public.shared_hands WHERE id = hand_id) THEN
    RETURN;
  END IF;

  -- A repeated view from the same account is only counted once in 24h.
  -- The unique key serializes concurrent retries for a given hand/user.
  INSERT INTO private.hand_view_cooldowns (hand_id, viewer_id, counted_at)
  VALUES (hand_id, v_viewer, now())
  ON CONFLICT (hand_id, viewer_id)
  DO UPDATE SET counted_at = EXCLUDED.counted_at
    WHERE private.hand_view_cooldowns.counted_at <= now() - interval '24 hours'
  RETURNING true INTO v_counted;

  IF COALESCE(v_counted, false) THEN
    UPDATE public.shared_hands
    SET views = COALESCE(views, 0) + 1
    WHERE id = hand_id;
  END IF;
END;
$body$;
REVOKE EXECUTE ON FUNCTION public.increment_hand_views(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_hand_views(text) TO authenticated, service_role;