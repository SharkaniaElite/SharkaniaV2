-- Remove database-level DDL/destructive privileges from web roles.
-- RLS does NOT govern TRUNCATE. Data API users need row DML, not TRUNCATE,
-- REFERENCES (DDL foreign keys) or TRIGGER (DDL trigger creation).
-- Preserve SELECT, INSERT, UPDATE, DELETE, RLS, functions and service_role.
-- All current public regular/partitioned tables are owned by postgres.

DO $revoke_web_sql$
DECLARE
  v_table record;
BEGIN
  FOR v_table IN
    SELECT n.nspname, c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
  LOOP
    EXECUTE format(
      'REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLE %I.%I FROM PUBLIC, anon, authenticated',
      v_table.nspname,
      v_table.relname
    );
  END LOOP;
END;
$revoke_web_sql$;

-- Keep new tables created by the normal postgres migration role least-privileged.
-- Supabase-managed future tables owned by other roles must be audited separately.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLES FROM anon, authenticated;
