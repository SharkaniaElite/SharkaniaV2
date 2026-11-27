-- Dependencies deliberately absent from pg_dump --schema=public.
CREATE ROLE recovery_owner NOLOGIN;
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;

CREATE SCHEMA auth;
REVOKE ALL ON SCHEMA auth FROM PUBLIC;
CREATE TABLE auth.users (id uuid PRIMARY KEY);
CREATE FUNCTION auth.uid() RETURNS uuid
LANGUAGE sql STABLE
RETURN nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
GRANT USAGE ON SCHEMA auth TO authenticated;
REVOKE EXECUTE ON FUNCTION auth.uid() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;

CREATE SCHEMA extensions;
CREATE EXTENSION pgcrypto WITH SCHEMA extensions;
GRANT USAGE ON SCHEMA extensions TO authenticated;
