-- PostgreSQL 17. Run in an authorized read-only session; keep the output private.
BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL search_path = pg_catalog;
SET LOCAL statement_timeout = '60s';

WITH
public_ns AS (SELECT oid, nspowner, nspacl FROM pg_namespace WHERE nspname = 'public'),
relations AS (
    SELECT c.* FROM pg_class c JOIN public_ns n ON c.relnamespace = n.oid
),
routines AS (
    SELECT p.* FROM pg_proc p JOIN public_ns n ON p.pronamespace = n.oid
),
constraints AS (
    SELECT c.* FROM pg_constraint c JOIN public_ns n ON c.connamespace = n.oid
),
object_ids(classid, objid) AS (
    SELECT 'pg_namespace'::regclass, oid FROM public_ns
    UNION ALL SELECT 'pg_class'::regclass, oid FROM relations
    UNION ALL SELECT 'pg_proc'::regclass, oid FROM routines
    UNION ALL SELECT 'pg_constraint'::regclass, oid FROM constraints
    UNION ALL SELECT 'pg_type'::regclass, t.oid FROM pg_type t JOIN public_ns n ON t.typnamespace = n.oid
    UNION ALL SELECT 'pg_policy'::regclass, p.oid FROM pg_policy p JOIN relations r ON p.polrelid = r.oid
    UNION ALL SELECT 'pg_rewrite'::regclass, w.oid FROM pg_rewrite w JOIN relations r ON w.ev_class = r.oid
    UNION ALL SELECT 'pg_attrdef'::regclass, a.oid FROM pg_attrdef a JOIN relations r ON a.adrelid = r.oid
    UNION ALL SELECT 'pg_trigger'::regclass, t.oid FROM pg_trigger t JOIN relations r ON t.tgrelid = r.oid
),
auth_foreign_keys AS (
    SELECT c.conname AS name, src.relname AS source_table, dst.relname AS auth_table,
           jsonb_agg(jsonb_build_object('source', a.attname, 'target', b.attname,
                                       'type', format_type(b.atttypid, b.atttypmod))
                     ORDER BY k.position) AS columns
    FROM constraints c
    JOIN relations src ON src.oid = c.conrelid
    JOIN pg_class dst ON dst.oid = c.confrelid
    JOIN pg_namespace n ON n.oid = dst.relnamespace AND n.nspname = 'auth'
    CROSS JOIN LATERAL unnest(c.conkey, c.confkey) WITH ORDINALITY k(from_num, to_num, position)
    JOIN pg_attribute a ON a.attrelid = src.oid AND a.attnum = k.from_num
    JOIN pg_attribute b ON b.attrelid = dst.oid AND b.attnum = k.to_num
    WHERE c.contype = 'f'
    GROUP BY c.conname, src.relname, dst.relname
),
acl_entries AS (
    SELECT 'schema' AS type, 'public' AS identity, a.*
    FROM public_ns CROSS JOIN LATERAL aclexplode(coalesce(nspacl, acldefault('n', nspowner))) a
    UNION ALL
    SELECT 'relation', relname, a.* FROM relations
    CROSS JOIN LATERAL aclexplode(coalesce(relacl,
        acldefault(CASE WHEN relkind = 'S' THEN 's' ELSE 'r' END::"char", relowner))) a
    WHERE relkind IN ('r', 'p', 'v', 'm', 'f', 'S')
    UNION ALL
    SELECT 'routine', p.identity, a.*
    FROM routines r CROSS JOIN LATERAL pg_identify_object('pg_proc'::regclass, r.oid, 0) p
    CROSS JOIN LATERAL aclexplode(coalesce(proacl, acldefault('f', proowner))) a
    UNION ALL
    SELECT 'type', t.typname, a.*
    FROM pg_type t JOIN public_ns n ON t.typnamespace = n.oid
    CROSS JOIN LATERAL aclexplode(coalesce(t.typacl, acldefault('T', t.typowner))) a
    UNION ALL
    SELECT 'column', format('%I.%I', r.relname, a.attname), p.*
    FROM pg_attribute a JOIN relations r ON r.oid = a.attrelid
    CROSS JOIN LATERAL aclexplode(a.attacl) p
    WHERE a.attnum > 0 AND NOT a.attisdropped AND a.attacl IS NOT NULL
),
role_ids AS (
    SELECT DISTINCT d.refobjid AS oid FROM object_ids o
    JOIN pg_shdepend d ON (o.classid, o.objid) = (d.classid, d.objid)
    WHERE d.refclassid = 'pg_authid'::regclass
      AND d.dbid = (SELECT oid FROM pg_database WHERE datname = current_database())
    UNION SELECT nspowner FROM public_ns
    UNION SELECT relowner FROM relations
    UNION SELECT proowner FROM routines
),
dependencies AS (
    SELECT DISTINCT src.type AS source_type, src.identity AS source, dst.type AS target_type,
           dst.schema AS target_schema, dst.identity AS target, e.extname AS extension, d.deptype AS kind
    FROM object_ids o JOIN pg_depend d USING (classid, objid)
    CROSS JOIN LATERAL pg_identify_object(d.classid, d.objid, d.objsubid) src
    CROSS JOIN LATERAL pg_identify_object(d.refclassid, d.refobjid, d.refobjsubid) dst
    LEFT JOIN pg_depend member ON (member.classid, member.objid) = (d.refclassid, d.refobjid)
         AND member.refclassid = 'pg_extension'::regclass AND member.deptype = 'e'
    LEFT JOIN pg_extension e ON e.oid = member.refobjid
    WHERE dst.schema IS DISTINCT FROM 'public' OR e.oid IS NOT NULL
)
SELECT jsonb_pretty(jsonb_build_object(
    'database', (SELECT jsonb_build_object(
        'server_version', current_setting('server_version'), 'encoding', pg_encoding_to_char(encoding),
        'collation', datcollate, 'ctype', datctype, 'locale_provider', datlocprovider,
        'locale', to_jsonb(d)->>'datlocale', 'collation_version', datcollversion)
        FROM pg_database d WHERE datname = current_database()),
    'totals', jsonb_build_object(
        'tables', (SELECT count(*) FROM relations WHERE relkind IN ('r','p')),
        'views', (SELECT count(*) FROM relations WHERE relkind IN ('v','m')),
        'indexes', (SELECT count(*) FROM relations WHERE relkind IN ('i','I')),
        'routines', (SELECT count(*) FROM routines), 'constraints', (SELECT count(*) FROM constraints),
        'foreign_keys_to_auth', (SELECT count(*) FROM auth_foreign_keys),
        'extensions', (SELECT count(*) FROM pg_extension)),
    'extensions', (SELECT jsonb_agg(jsonb_build_object('name', e.extname, 'version', e.extversion,
                'schema', n.nspname, 'owner', pg_get_userbyid(e.extowner)) ORDER BY e.extname)
                FROM pg_extension e JOIN pg_namespace n ON e.extnamespace = n.oid),
    'relations', (SELECT jsonb_agg(jsonb_build_object('name', r.relname, 'kind', r.relkind,
                'owner', pg_get_userbyid(r.relowner), 'rls', r.relrowsecurity, 'force_rls', r.relforcerowsecurity,
                'view_fingerprint', CASE WHEN r.relkind IN ('v','m') THEN md5(pg_get_viewdef(r.oid)) END)
                ORDER BY r.relname) FROM relations r),
    'types', (SELECT jsonb_agg(jsonb_build_object('name', t.typname, 'kind', t.typtype,
                'owner', pg_get_userbyid(t.typowner), 'base_type', format_type(nullif(t.typbasetype, 0), t.typtypmod))
                ORDER BY t.typname) FROM pg_type t JOIN public_ns n ON t.typnamespace = n.oid),
    'columns', (SELECT jsonb_agg(jsonb_build_object('relation', r.relname, 'name', a.attname,
                'position', a.attnum, 'type', format_type(a.atttypid, a.atttypmod),
                'not_null', a.attnotnull, 'identity', a.attidentity, 'generated', a.attgenerated,
                'collation', co.collname, 'expression_fingerprint', md5(pg_get_expr(d.adbin, d.adrelid)))
                ORDER BY r.relname, a.attnum)
                FROM pg_attribute a JOIN relations r ON r.oid = a.attrelid
                LEFT JOIN pg_attrdef d ON (d.adrelid, d.adnum) = (a.attrelid, a.attnum)
                LEFT JOIN pg_collation co ON co.oid = a.attcollation
                WHERE a.attnum > 0 AND NOT a.attisdropped AND r.relkind NOT IN ('i','I')),
    'indexes', (SELECT jsonb_agg(jsonb_build_object('name', r.relname, 'relation', t.relname,
                'unique', i.indisunique, 'valid', i.indisvalid, 'fingerprint', md5(pg_get_indexdef(r.oid)))
                ORDER BY r.relname) FROM relations r JOIN pg_index i ON i.indexrelid = r.oid
                JOIN pg_class t ON t.oid = i.indrelid),
    'routines', (SELECT jsonb_agg(jsonb_build_object('identity', id.identity,
                'kind', p.prokind, 'owner', pg_get_userbyid(p.proowner), 'language', l.lanname,
                'security_definer', p.prosecdef, 'configuration_fingerprint', md5(p.proconfig::text),
                'fingerprint', CASE WHEN p.prokind <> 'a' THEN md5(pg_get_functiondef(p.oid)) END)
                ORDER BY id.identity) FROM routines p JOIN pg_language l ON l.oid = p.prolang
                CROSS JOIN LATERAL pg_identify_object('pg_proc'::regclass, p.oid, 0) id),
    'constraints', (SELECT jsonb_agg(jsonb_build_object('identity', id.identity, 'kind', c.contype,
                'validated', c.convalidated, 'fingerprint', md5(pg_get_constraintdef(c.oid)))
                ORDER BY id.identity) FROM constraints c
                CROSS JOIN LATERAL pg_identify_object('pg_constraint'::regclass, c.oid, 0) id),
    'foreign_keys_to_auth', (SELECT jsonb_agg(to_jsonb(f) ORDER BY f.source_table, f.name) FROM auth_foreign_keys f),
    'policies', (SELECT jsonb_agg(jsonb_build_object('relation', r.relname, 'name', p.polname,
                'command', p.polcmd, 'permissive', p.polpermissive,
                'roles', ARRAY(SELECT CASE WHEN k = 0 THEN 'PUBLIC' ELSE pg_get_userbyid(k)::text END
                               FROM unnest(p.polroles) k ORDER BY 1),
                'using_fingerprint', md5(pg_get_expr(p.polqual, p.polrelid)),
                'check_fingerprint', md5(pg_get_expr(p.polwithcheck, p.polrelid))) ORDER BY r.relname, p.polname)
                FROM pg_policy p JOIN relations r ON r.oid = p.polrelid),
    'triggers', (SELECT jsonb_agg(jsonb_build_object('relation', r.relname, 'name', t.tgname,
                'state', t.tgenabled, 'routine', t.tgfoid::regprocedure::text,
                'fingerprint', md5(pg_get_triggerdef(t.oid))) ORDER BY r.relname, t.tgname)
                FROM pg_trigger t JOIN relations r ON r.oid = t.tgrelid WHERE NOT t.tgisinternal),
    'roles', (SELECT jsonb_agg(jsonb_build_object('name', r.rolname, 'login', r.rolcanlogin,
                'superuser', r.rolsuper, 'inherit', r.rolinherit, 'bypass_rls', r.rolbypassrls)
                ORDER BY r.rolname) FROM role_ids i JOIN pg_roles r ON r.oid = i.oid),
    'memberships', (SELECT jsonb_agg(jsonb_build_object('role', pg_get_userbyid(m.roleid),
                'member', pg_get_userbyid(m.member), 'grantor', pg_get_userbyid(m.grantor),
                'admin', m.admin_option, 'inherit', m.inherit_option, 'set_role', m.set_option)
                ORDER BY pg_get_userbyid(m.roleid), pg_get_userbyid(m.member), pg_get_userbyid(m.grantor))
                FROM pg_auth_members m WHERE m.roleid IN (SELECT oid FROM role_ids)
                    OR m.member IN (SELECT oid FROM role_ids)),
    'acl', (SELECT jsonb_agg(jsonb_build_object('type', a.type, 'identity', a.identity,
                'grantor', pg_get_userbyid(a.grantor),
                'grantee', CASE WHEN a.grantee = 0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee)::text END,
                'privilege', a.privilege_type, 'grantable', a.is_grantable)
                ORDER BY a.type, a.identity, a.grantee, a.grantor, a.privilege_type)
                FROM acl_entries a),
    'default_acl', (SELECT jsonb_agg(jsonb_build_object('role', pg_get_userbyid(d.defaclrole),
                'schema', coalesce(n.nspname, ''), 'type', d.defaclobjtype,
                'grantor', pg_get_userbyid(a.grantor), 'grantable', a.is_grantable,
                'grantee', CASE WHEN a.grantee = 0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee)::text END,
                'privilege', a.privilege_type) ORDER BY d.defaclrole, d.defaclnamespace, d.defaclobjtype,
                a.grantee, a.grantor, a.privilege_type)
                FROM pg_default_acl d CROSS JOIN LATERAL aclexplode(d.defaclacl) a
                LEFT JOIN pg_namespace n ON n.oid = d.defaclnamespace
                WHERE n.nspname = 'public' OR (d.defaclnamespace = 0 AND d.defaclrole IN (SELECT oid FROM role_ids))),
    'dependencies_outside_public', (SELECT jsonb_agg(to_jsonb(d) ORDER BY d.source, d.target, d.kind)
                FROM dependencies d)
));

ROLLBACK;
