-- Only the UUID key is materialized. No login records are restored.
INSERT INTO auth.users (id)
SELECT DISTINCT user_id FROM public.restore_records;
