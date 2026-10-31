-- Already applied in production on 2026-10-31, Supabase migration version 20261031153006.
-- A removed profile may leave an ownerless row because the existing FK uses
-- ON DELETE SET NULL. Do not make created_by NOT NULL without changing deletion semantics.
ALTER TABLE public.shared_hands
  ALTER COLUMN created_by SET DEFAULT auth.uid();

DROP POLICY IF EXISTS "Auth insert" ON public.shared_hands;
DROP POLICY IF EXISTS "Auth insert shared hands" ON public.shared_hands;
DROP POLICY IF EXISTS "Shared hands: insert only signed-in owner" ON public.shared_hands;
CREATE POLICY "Shared hands: insert only signed-in owner"
ON public.shared_hands
FOR INSERT TO authenticated
WITH CHECK (
  (SELECT auth.uid()) IS NOT NULL
  AND created_by = (SELECT auth.uid())
);

-- Public SELECT is intentional for link-based sharing, although the React
-- route currently requires sign-in. Review data exposure separately.
DROP POLICY IF EXISTS "Public read" ON public.shared_hands;
DROP POLICY IF EXISTS "Public read shared hands" ON public.shared_hands;
DROP POLICY IF EXISTS "Shared hands: public read" ON public.shared_hands;
CREATE POLICY "Shared hands: public read"
ON public.shared_hands
FOR SELECT TO PUBLIC
USING (true);

-- Column grants only: the client must not insert its own identifier, author,
-- initial view count or timestamp, nor directly mutate/delete stored hands.
REVOKE ALL PRIVILEGES ON TABLE public.shared_hands
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.shared_hands TO anon, authenticated;
GRANT INSERT (hand_data, hand_summary)
  ON TABLE public.shared_hands TO authenticated;
