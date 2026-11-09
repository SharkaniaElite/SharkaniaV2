\set ON_ERROR_STOP on
-- Disposable PostgreSQL 17 only: two DIFFERENT leagues with distinct
-- primary-organizer clubs but the SAME poker room and shared player identities.
-- The prior same-league concurrency test has already committed in this
-- throwaway DB, preserving a known shared-player Elo starting state.
INSERT INTO public.league_rooms(league_id,room_id)
VALUES (
 '00000000-0000-0000-0000-000000000042',
 '00000000-0000-0000-0000-000000000031'
);
INSERT INTO public.tournaments
 (id,club_id,buy_in,league_id,room_id,currency,start_datetime)
VALUES
 ('00000000-0000-0000-0000-000000000097',
  '00000000-0000-0000-0000-000000000021',3.30,
  '00000000-0000-0000-0000-000000000041',
  '00000000-0000-0000-0000-000000000031','USD',
  '2026-11-15T19:00:00Z'),
 ('00000000-0000-0000-0000-000000000098',
  '00000000-0000-0000-0000-000000000022',3.30,
  '00000000-0000-0000-0000-000000000042',
  '00000000-0000-0000-0000-000000000031','USD',
  '2026-11-16T19:00:00Z'),
 ('00000000-0000-0000-0000-000000000099',
  '00000000-0000-0000-0000-000000000021',3.30,
  '00000000-0000-0000-0000-000000000041',
  '00000000-0000-0000-0000-000000000031','USD',
  '2026-11-14T19:00:00Z');
SELECT 'PASS: 2 primary-club organizers, 2 leagues, 1 shared room, 3 synthetic tournaments' AS qa_status;
