-- The production frontend now reads shares through public.get_shared_hand(text).
-- Remove the ability to enumerate all shared hands from the Data API.
DROP POLICY IF EXISTS "Public read" ON public.shared_hands;
DROP POLICY IF EXISTS "Public read shared hands" ON public.shared_hands;
DROP POLICY IF EXISTS "Shared hands: public read" ON public.shared_hands;
DROP POLICY IF EXISTS "Shared hands: owner-only SELECT" ON public.shared_hands;

CREATE POLICY "Shared hands: owner-only SELECT"
ON public.shared_hands FOR SELECT TO authenticated
USING (created_by = (SELECT auth.uid()));

REVOKE SELECT ON TABLE public.shared_hands FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.shared_hands TO authenticated;

-- Keep the existing owner-matched INSERT and the column-restricted grants.
-- Non-owners who know the exact URL can still read that specific hand via
-- the authenticated RPC, not via public table enumeration.
