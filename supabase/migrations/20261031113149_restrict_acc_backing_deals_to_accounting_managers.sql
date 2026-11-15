BEGIN;

DROP POLICY IF EXISTS "Permitir todo"
ON public.acc_backing_deals;

ALTER TABLE public.acc_backing_deals
ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Acceso gestores contables"
ON public.acc_backing_deals
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.acc_managers
    WHERE id = (SELECT auth.uid())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.acc_managers
    WHERE id = (SELECT auth.uid())
  )
);

REVOKE ALL ON public.acc_backing_deals FROM anon;

COMMIT;