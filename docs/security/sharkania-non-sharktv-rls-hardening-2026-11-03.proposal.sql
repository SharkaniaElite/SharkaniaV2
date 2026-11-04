-- SHARKANIA: draft least-privilege RLS hardening for isolated QA ONLY.
-- NOT A MIGRATION. Not applied to Supabase production, and must not be added
-- to supabase/migrations until historical baseline, QA, and owner approval.
-- Scope explicitly EXCLUDES SharkTV (planned removal).
-- Source: read-only review of actual pg_policies and grants, 2026-11-03.
--
-- Risks addressed:
-- - public tournament_clubs ALL true (anonymous writes)
-- - ACC payment tables ALL true to any authenticated session
-- - site_configs, live_polls, blog_embeddings authenticated ALL true
--
-- Access models: club_admin owns the tournament's primary club;
-- acc_managers are authorized finance managers; super_admin is site owner.
-- Keep existing public SELECT policies for public listings/other features.
-- Check all user flows in isolated Supabase before any release.
BEGIN;

-- 1) Club / tournament association.
DROP POLICY IF EXISTS "Admin full access tournament_clubs" ON public.tournament_clubs;

CREATE POLICY "tournament_clubs_insert_owner_only"
ON public.tournament_clubs FOR INSERT TO authenticated
WITH CHECK (
  (SELECT auth.uid()) IS NOT NULL
  AND (
    (SELECT public.is_super_admin())
    OR EXISTS (
      SELECT 1 FROM public.tournaments t
      WHERE t.id = tournament_id
        AND (SELECT public.is_club_admin(t.club_id))
    )
  )
);

CREATE POLICY "tournament_clubs_update_owner_only"
ON public.tournament_clubs FOR UPDATE TO authenticated
USING (
  (SELECT auth.uid()) IS NOT NULL
  AND (
    (SELECT public.is_super_admin())
    OR EXISTS (
      SELECT 1 FROM public.tournaments t
      WHERE t.id = tournament_id
        AND (SELECT public.is_club_admin(t.club_id))
    )
  )
)
WITH CHECK (
  (SELECT auth.uid()) IS NOT NULL
  AND (
    (SELECT public.is_super_admin())
    OR EXISTS (
      SELECT 1 FROM public.tournaments t
      WHERE t.id = tournament_id
        AND (SELECT public.is_club_admin(t.club_id))
    )
  )
);

CREATE POLICY "tournament_clubs_delete_owner_only"
ON public.tournament_clubs FOR DELETE TO authenticated
USING (
  (SELECT auth.uid()) IS NOT NULL
  AND (
    (SELECT public.is_super_admin())
    OR EXISTS (
      SELECT 1 FROM public.tournaments t
      WHERE t.id = tournament_id
        AND (SELECT public.is_club_admin(t.club_id))
    )
  )
);

-- 2) Accounting / finance. A manager must already exist in acc_managers.
-- Compare managers using id, not client-editable JWT user_metadata.
DROP POLICY IF EXISTS "Permitir operaciones a usuarios autenticados" ON public.acc_payouts;
DROP POLICY IF EXISTS "Permitir config a usuarios" ON public.acc_player_promo_config;
DROP POLICY IF EXISTS "Permitir pagos a usuarios" ON public.acc_player_promo_payouts;

CREATE POLICY "acc_payouts_finance_managers_only"
ON public.acc_payouts FOR ALL TO authenticated
USING (
  (SELECT auth.uid()) IS NOT NULL
  AND (
    (SELECT public.is_super_admin())
    OR EXISTS (
      SELECT 1 FROM public.acc_managers m WHERE m.id = (SELECT auth.uid())
    )
  )
)
WITH CHECK (
  (SELECT auth.uid()) IS NOT NULL
  AND (
    (SELECT public.is_super_admin())
    OR EXISTS (
      SELECT 1 FROM public.acc_managers m WHERE m.id = (SELECT auth.uid())
    )
  )
);

CREATE POLICY "acc_player_promo_config_finance_managers_only"
ON public.acc_player_promo_config FOR ALL TO authenticated
USING (
  (SELECT auth.uid()) IS NOT NULL
  AND (
    (SELECT public.is_super_admin())
    OR EXISTS (
      SELECT 1 FROM public.acc_managers m WHERE m.id = (SELECT auth.uid())
    )
  )
)
WITH CHECK (
  (SELECT auth.uid()) IS NOT NULL
  AND (
    (SELECT public.is_super_admin())
    OR EXISTS (
      SELECT 1 FROM public.acc_managers m WHERE m.id = (SELECT auth.uid())
    )
  )
);

CREATE POLICY "acc_player_promo_payouts_finance_managers_only"
ON public.acc_player_promo_payouts FOR ALL TO authenticated
USING (
  (SELECT auth.uid()) IS NOT NULL
  AND (
    (SELECT public.is_super_admin())
    OR EXISTS (
      SELECT 1 FROM public.acc_managers m WHERE m.id = (SELECT auth.uid())
    )
  )
)
WITH CHECK (
  (SELECT auth.uid()) IS NOT NULL
  AND (
    (SELECT public.is_super_admin())
    OR EXISTS (
      SELECT 1 FROM public.acc_managers m WHERE m.id = (SELECT auth.uid())
    )
  )
);

-- 3) Administration content. Keep existing public SELECT where present.
DROP POLICY IF EXISTS "Permitir edicion a admins" ON public.site_configs;
CREATE POLICY "site_configs_super_admin_write"
ON public.site_configs FOR ALL TO authenticated
USING ((SELECT auth.uid()) IS NOT NULL AND (SELECT public.is_super_admin()))
WITH CHECK ((SELECT auth.uid()) IS NOT NULL AND (SELECT public.is_super_admin()));

DROP POLICY IF EXISTS "Admins crean encuestas" ON public.live_polls;
CREATE POLICY "live_polls_super_admin_write"
ON public.live_polls FOR ALL TO authenticated
USING ((SELECT auth.uid()) IS NOT NULL AND (SELECT public.is_super_admin()))
WITH CHECK ((SELECT auth.uid()) IS NOT NULL AND (SELECT public.is_super_admin()));

DROP POLICY IF EXISTS "Admins pueden guardar vectores" ON public.blog_embeddings;
CREATE POLICY "blog_embeddings_super_admin_write"
ON public.blog_embeddings FOR ALL TO authenticated
USING ((SELECT auth.uid()) IS NOT NULL AND (SELECT public.is_super_admin()))
WITH CHECK ((SELECT auth.uid()) IS NOT NULL AND (SELECT public.is_super_admin()));

-- Deliberate exclusions to avoid silent regressions:
-- * current_league_champion: its trigger currently runs as invoker. Rework
--   publisher trigger and add role tests before restricting inserts/updates.
-- * players/leagues: authenticated signup and club-admin creation paths
--   need business-rule tests before replacing their permissive INSERT.
-- * Stats Espía: separate guarded RPC cutover and column exposure audit.
-- * SharkTV: slated for removal and explicitly out of this hardening work.
-- * Any production history / schema change remains prohibited.
COMMIT;
