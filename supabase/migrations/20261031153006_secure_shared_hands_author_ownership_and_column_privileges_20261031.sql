-- Each shared hand is owned by the authenticated account creating it.
-- Allow ownerless rows only if their profile is subsequently deleted:
-- shared_hands_created_by_fkey uses ON DELETE SET NULL.
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

-- Sharing is a deliberate public-read feature; preserve existing link access.
DROP POLICY IF EXISTS "Public read" ON public.shared_hands;
DROP POLICY IF EXISTS "Public read shared hands" ON public.shared_hands;
DROP POLICY IF EXISTS "Shared hands: public read" ON public.shared_hands;
CREATE POLICY "Shared hands: public read"
ON public.shared_hands
FOR SELECT TO PUBLIC
USING (true);

-- Do not let browsers insert their own IDs/view counts/owners or update
-- counters, delete records, truncate the table or alter the table's triggers.
REVOKE ALL PRIVILEGES ON TABLE public.shared_hands
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.shared_hands TO anon, authenticated;
GRANT INSERT (hand_data, hand_summary)
  ON TABLE public.shared_hands TO authenticated;
