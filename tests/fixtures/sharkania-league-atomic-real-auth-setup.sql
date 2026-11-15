\set ON_ERROR_STOP on
-- ONLY ephemeral Supabase Docker QA. Business schema and GoTrue are already
-- fake and configured by qa-league-real-auth.yml. Not a migration.
ALTER TABLE public.tournaments
 ADD COLUMN room_id uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000031',
 ADD COLUMN currency text NOT NULL DEFAULT 'USD';
ALTER TABLE public.players
 ADD COLUMN room_id uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000031';
ALTER TABLE public.elo_history
 ADD COLUMN recorded_at timestamptz NOT NULL DEFAULT now();
-- The old fixture includes t011, t012 and t013. The new HTTP test creates
-- its own t074 via authenticated PostgREST, not through owner SQL.
\echo 'PASS: isolated real-Auth writer schema adapter loaded'
