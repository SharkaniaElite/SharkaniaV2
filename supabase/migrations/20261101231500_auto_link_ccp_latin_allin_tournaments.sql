-- Link each CCP tournament to Latin Allin Poker using the same tournament_id.
-- Do not duplicate tournament rows, results, league points, or ELO transactions.
-- Existing unrelated co-host relationships are left unchanged.

CREATE OR REPLACE FUNCTION public.ccp_latin_link_on_tournament()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $body$
DECLARE
  v_ccp uuid;
  v_latin uuid;
BEGIN
  SELECT id INTO v_ccp FROM public.clubs WHERE slug = 'ccp';
  SELECT id INTO v_latin FROM public.clubs WHERE slug = 'latin-allin-poker';

  IF NEW.club_id = v_ccp AND v_latin IS NOT NULL THEN
    INSERT INTO public.tournament_clubs (tournament_id, club_id, is_primary)
    VALUES (NEW.id, v_latin, false)
    ON CONFLICT (tournament_id, club_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$body$;

CREATE OR REPLACE FUNCTION public.ccp_latin_link_on_membership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $body$
DECLARE
  v_ccp uuid;
  v_latin uuid;
  v_tournament_id uuid;
BEGIN
  SELECT id INTO v_ccp FROM public.clubs WHERE slug = 'ccp';
  SELECT id INTO v_latin FROM public.clubs WHERE slug = 'latin-allin-poker';

  IF v_ccp IS NULL OR v_latin IS NULL THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- The manual form clears/recreates memberships; adding CCP restores Latin.
    IF NEW.club_id <> v_ccp THEN RETURN NEW; END IF;
    v_tournament_id := NEW.tournament_id;
  ELSIF TG_OP = 'DELETE' THEN
    -- Prevent manual edits from disconnecting the mandatory shared club.
    -- When the actual tournament is being deleted, the parent no longer
    -- exists and the link will not be recreated during FK cascades.
    IF OLD.club_id <> v_latin THEN RETURN OLD; END IF;
    v_tournament_id := OLD.tournament_id;
  ELSE
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.tournaments t
    WHERE t.id = v_tournament_id AND t.club_id = v_ccp
  ) THEN
    INSERT INTO public.tournament_clubs (tournament_id, club_id, is_primary)
    VALUES (v_tournament_id, v_latin, false)
    ON CONFLICT (tournament_id, club_id) DO NOTHING;
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$body$;

-- Trigger functions are invoked only through triggers, not exposed as RPCs.
REVOKE EXECUTE ON FUNCTION public.ccp_latin_link_on_tournament() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.ccp_latin_link_on_membership() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS ccp_latin_tournament_auto_link ON public.tournaments;
CREATE TRIGGER ccp_latin_tournament_auto_link
AFTER INSERT OR UPDATE OF club_id ON public.tournaments
FOR EACH ROW EXECUTE FUNCTION public.ccp_latin_link_on_tournament();

DROP TRIGGER IF EXISTS ccp_latin_membership_auto_link ON public.tournament_clubs;
CREATE TRIGGER ccp_latin_membership_auto_link
AFTER INSERT OR DELETE ON public.tournament_clubs
FOR EACH ROW EXECUTE FUNCTION public.ccp_latin_link_on_membership();

-- Historical one-time reconciliation; link rows only (491 absent at audit).
INSERT INTO public.tournament_clubs (tournament_id, club_id, is_primary)
SELECT t.id, latin.id, false
FROM public.tournaments t
JOIN public.clubs ccp ON ccp.id = t.club_id AND ccp.slug = 'ccp'
CROSS JOIN public.clubs latin
WHERE latin.slug = 'latin-allin-poker'
ON CONFLICT (tournament_id, club_id) DO NOTHING;
