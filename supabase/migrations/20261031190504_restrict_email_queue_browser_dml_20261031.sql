-- Defense in depth: only trusted service-role cron/trigger code handles email_queue.
-- The existing RLS policy already limits access to service_role, but
-- PostgREST browser roles retained table-wide SELECT/UPDATE/DELETE grants.
-- Deny those SQL operations independently of policy correctness.
-- Preserve all service_role grants; no rows are changed.
REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLE public.email_queue
  FROM PUBLIC, anon, authenticated;
