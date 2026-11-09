\set ON_ERROR_STOP on
-- Disposable PostgreSQL 17 ONLY. Reproduce key player constraints and slug
-- behavior for nickname resolution; do not apply to Supabase production.
ALTER TABLE public.players
  ALTER COLUMN id SET DEFAULT gen_random_uuid(),
  ADD COLUMN nickname text,
  ADD COLUMN country_code text,
  ADD COLUMN slug text;
ALTER TABLE public.clubs ADD COLUMN country_code text;
UPDATE public.clubs SET country_code='CL'
 WHERE id='00000000-0000-0000-0000-000000000021';
UPDATE public.players SET
  nickname=CASE
    WHEN id='00000000-0000-0000-0000-000000000051' THEN 'SharkHero'
    WHEN id='00000000-0000-0000-0000-000000000052' THEN 'PokerQueen'
    ELSE 'Player-'||right(id::text,8)
  END,
  slug='qa-player-'||right(id::text,8);
ALTER TABLE public.players ALTER COLUMN nickname SET NOT NULL;
ALTER TABLE public.players ALTER COLUMN slug SET NOT NULL;
ALTER TABLE public.players ADD CONSTRAINT qa_players_nickname_room_unique
  UNIQUE(nickname,room_id);
CREATE UNIQUE INDEX qa_players_slug_unique ON public.players(slug);
-- Required for case-insensitive uniqueness, in addition to production's
-- case-sensitive (nickname,room_id) constraint. Preflight in production
-- observed 0 normalized collisions across 1,820 players on 2026-11-09.
CREATE UNIQUE INDEX qa_players_normalized_nickname_room
 ON public.players (room_id,lower(btrim(nickname)));

CREATE OR REPLACE FUNCTION public.qa_auto_slug_players()
RETURNS trigger LANGUAGE plpgsql SET search_path TO ''
AS $qa$
BEGIN
  IF NEW.slug IS NULL OR NEW.slug='' THEN
    -- QA slug emulator, not an exact production auto_slug_players clone.
    -- The core uniqueness/rollback contract is tested independently.
    NEW.slug:='qa-nick-'||lower(replace(btrim(NEW.nickname),' ','-'))||'-'||
      right(replace(NEW.id::text,'-',''),8);
  END IF;
  RETURN NEW;
END;
$qa$;
CREATE TRIGGER qa_auto_player_slug
  BEFORE INSERT ON public.players FOR EACH ROW
  EXECUTE FUNCTION public.qa_auto_slug_players();

CREATE TABLE sharkania_release_qa.currency_posting (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 publication_id uuid NOT NULL
   REFERENCES sharkania_release_qa.elo_publication(id),
 tournament_id uuid NOT NULL REFERENCES public.tournaments(id),
 player_id uuid NOT NULL REFERENCES public.players(id),
 currency text NOT NULL CHECK (currency IN ('USD','EUR','CLP')),
 buy_in_per_entry numeric NOT NULL CHECK (buy_in_per_entry>=0),
 buy_ins_count integer NOT NULL CHECK (buy_ins_count BETWEEN 1 AND 100),
 entry_spend numeric GENERATED ALWAYS AS (buy_in_per_entry * buy_ins_count) STORED,
 prize_won numeric NOT NULL CHECK (prize_won>=0),
 bounties_won numeric NOT NULL CHECK (bounties_won>=0),
 UNIQUE(tournament_id,player_id)
);
ALTER TABLE sharkania_release_qa.currency_posting ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON sharkania_release_qa.currency_posting FROM PUBLIC,anon,authenticated;
CREATE TRIGGER qa_immutable_currency_posting
 BEFORE UPDATE OR DELETE ON sharkania_release_qa.currency_posting
 FOR EACH ROW EXECUTE FUNCTION sharkania_release_qa.reject_publication_mutation();

-- Materialize no mixed-currency total: every aggregate is keyed by currency.
-- This PG17 security-invoker view resides in the private schema; API roles
-- have neither schema USAGE nor SELECT on the underlying posting table.
CREATE VIEW sharkania_release_qa.currency_totals_by_player
WITH (security_invoker = true) AS
SELECT j.player_id,j.currency,
       count(*)::integer AS published_tournaments,
       sum(j.buy_ins_count)::integer AS total_entries,
       sum(j.entry_spend) AS total_entry_spend,
       sum(j.prize_won) AS total_prize_won,
       sum(j.bounties_won) AS total_bounties_won
FROM sharkania_release_qa.currency_posting j
GROUP BY j.player_id,j.currency;
REVOKE ALL ON sharkania_release_qa.currency_totals_by_player
  FROM PUBLIC,anon,authenticated;

\echo 'PASS: private per-currency amount ledger and unique nickname QA schema ready'
