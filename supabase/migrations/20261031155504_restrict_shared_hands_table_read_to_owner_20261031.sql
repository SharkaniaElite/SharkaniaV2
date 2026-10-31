-- Already applied to Sharkania production: Supabase version 20261031155504.
-- Publish after PR #20: the live frontend now uses get_shared_hand(text).
-- No arbitrary browsing of hand histories via PostgREST.
DROP POLICY IF EXISTS "Public read" ON public.shared_hands;
DROP POLICY IF EXISTS "Public read shared hands" ON public.shared_hands;
DROP POLICY IF EXISTS "Shared hands: public read" ON public.shared_hands;
DROP POLICY IF EXISTS "Shared hands: owner-only SELECT" ON public.shared_hands;

CREATE POLICY "Shared hands: owner-only SELECT"
ON public.shared_hands FOR SELECT TO authenticated
USING (created_by = (SELECT auth.uid()));

REVOKE SELECT ON TABLE public.shared_hands FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.shared_hands TO authenticated;
