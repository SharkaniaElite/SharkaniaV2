\set ON_ERROR_STOP on
-- Disposable PG17 base schema only; no ledger or guarded SQL loaded here.
-- The real production DB already has player nickname, slug and country fields.
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
-- Consolidated Release A itself must create the normalized identity index.

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


