DO $check$
DECLARE
    owner_oid oid := 'recovery_owner'::regrole;
BEGIN
    IF (SELECT count(*) FROM public.restore_records) <> 2
        OR (SELECT sum(score) FROM public.restore_records) <> 60
        OR (SELECT count(*) FROM auth.users) <> 2
        OR (SELECT last_value FROM public.restore_records_id_seq) <> 2
        OR NOT EXISTS (SELECT FROM public.restore_records WHERE id = 1 AND label = 'sintético uno')
    THEN
        RAISE EXCEPTION 'restored rows or identity sequence differ';
    END IF;

    IF (SELECT count(*) FROM pg_constraint
            WHERE conrelid = 'public.restore_records'::regclass
              AND contype IN ('p','f','u','c') AND convalidated) <> 4
        OR NOT EXISTS (SELECT FROM pg_index
            WHERE indexrelid = to_regclass('public.restore_records_user_score')
              AND indrelid = 'public.restore_records'::regclass AND indisvalid AND indisready)
    THEN
        RAISE EXCEPTION 'constraints or secondary index missing';
    END IF;

    IF NOT EXISTS (SELECT FROM pg_class
            WHERE oid = 'public.restore_records'::regclass AND relowner = owner_oid AND relrowsecurity)
        OR NOT EXISTS (SELECT FROM pg_proc
            WHERE oid = 'public.restore_digest(text)'::regprocedure AND proowner = owner_oid AND NOT prosecdef)
        OR EXISTS (SELECT FROM pg_roles WHERE rolname IN ('anon', 'authenticated', 'recovery_owner') AND rolcanlogin)
        OR NOT has_schema_privilege('authenticated', 'public', 'USAGE')
        OR has_table_privilege('anon', 'public.restore_records', 'SELECT')
        OR NOT has_table_privilege('authenticated', 'public.restore_records', 'SELECT')
        OR has_table_privilege('authenticated', 'public.restore_records', 'INSERT')
        OR has_function_privilege('anon', 'public.restore_digest(text)', 'EXECUTE')
        OR NOT has_function_privilege('authenticated', 'public.restore_digest(text)', 'EXECUTE')
        OR NOT EXISTS (
            SELECT FROM pg_default_acl a CROSS JOIN LATERAL aclexplode(a.defaclacl) p
            WHERE a.defaclrole = owner_oid AND a.defaclnamespace = 'public'::regnamespace
              AND a.defaclobjtype = 'r' AND p.grantee = 'authenticated'::regrole AND p.privilege_type = 'SELECT'
        )
    THEN
        RAISE EXCEPTION 'owners, RLS or grants differ';
    END IF;

    BEGIN
        INSERT INTO public.restore_records VALUES (3, '00000000-0000-4000-8000-000000000003', 'invalid FK', 0);
        RAISE EXCEPTION 'foreign key accepted missing auth user';
    EXCEPTION WHEN foreign_key_violation THEN
        NULL;
    END;
    BEGIN
        INSERT INTO public.restore_records VALUES (3, '00000000-0000-4000-8000-000000000001', 'invalid score', -1);
        RAISE EXCEPTION 'check constraint accepted negative score';
    EXCEPTION WHEN check_violation THEN
        NULL;
    END;
    BEGIN
        INSERT INTO public.restore_records VALUES (3, '00000000-0000-4000-8000-000000000001', 'sintético uno', 0);
        RAISE EXCEPTION 'uniqueness constraint accepted duplicate label';
    EXCEPTION WHEN unique_violation THEN
        NULL;
    END;
END
$check$;

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '00000000-0000-4000-8000-000000000001';
DO $check$
BEGIN
    IF (SELECT array_agg(id) FROM public.restore_records) IS DISTINCT FROM ARRAY[1::bigint]
        OR (SELECT array_agg(score) FROM public.restore_visible) IS DISTINCT FROM ARRAY[29]
        OR public.restore_digest('abc') <> 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
    THEN
        RAISE EXCEPTION 'RLS or extension-backed function differs';
    END IF;
END
$check$;
