\set ON_ERROR_STOP on
-- Minimal production-shaped nickname_claims adapter for isolated QA ONLY.
-- Must not be loaded into production. Existing production enum is claim_status.
CREATE TABLE public.nickname_claims(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES public.profiles(id),
 player_id uuid NOT NULL REFERENCES public.players(id),
 screenshot_url text NOT NULL,
 status text NOT NULL DEFAULT 'pending'
  CHECK(status IN ('pending','approved','rejected')),
 admin_notes text,
 created_at timestamptz NOT NULL DEFAULT now(),
 resolved_at timestamptz,
 resolved_by uuid REFERENCES public.profiles(id)
);
ALTER TABLE public.nickname_claims ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.nickname_claims FROM PUBLIC,anon,authenticated;
-- The guarded admin RPC is owned by the PostgreSQL test owner and enforces
-- is_super_admin() before any mutating statement. API roles cannot write here.
