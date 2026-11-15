
-- ══════════════════════════════════════════════════════════
-- MIGRACIÓN: Agregar columnas slug a players, clubs, leagues
-- ══════════════════════════════════════════════════════════

-- ── Función helper: generar slug desde texto ──
CREATE OR REPLACE FUNCTION generate_slug(input TEXT) RETURNS TEXT AS $$
BEGIN
  RETURN lower(
    trim(
      regexp_replace(
        regexp_replace(
          translate(
            input,
            'áàäâãéèëêíìïîóòöôõúùüûñçÁÀÄÂÃÉÈËÊÍÌÏÎÓÒÖÔÕÚÙÜÛÑÇ',
            'aaaaaeeeeiiiioooooouuuuncAAAAAEEEEIIIIOOOOOUUUUNC'
          ),
          '[^a-zA-Z0-9\s-]', '', 'g'  -- remover caracteres especiales excepto espacio y guión
        ),
        '[\s]+', '-', 'g'  -- espacios a guiones
      )
    )
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ── Players: slug basado en nickname (lowercase) ──
ALTER TABLE players ADD COLUMN IF NOT EXISTS slug TEXT;

-- Poblar slugs existentes
UPDATE players SET slug = generate_slug(nickname) WHERE slug IS NULL;

-- Manejar posibles colisiones agregando sufijo numérico
DO $$
DECLARE
  rec RECORD;
  counter INT;
  new_slug TEXT;
BEGIN
  FOR rec IN 
    SELECT id, slug FROM players 
    WHERE slug IN (SELECT slug FROM players GROUP BY slug HAVING count(*) > 1)
    ORDER BY elo_rating DESC
  LOOP
    SELECT count(*) INTO counter FROM players WHERE slug = rec.slug AND id < rec.id;
    IF counter > 0 THEN
      new_slug := rec.slug || '-' || counter;
      UPDATE players SET slug = new_slug WHERE id = rec.id;
    END IF;
  END LOOP;
END $$;

-- Hacer slug NOT NULL y UNIQUE
ALTER TABLE players ALTER COLUMN slug SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_players_slug ON players(slug);

-- ── Clubs: slug basado en nombre ──
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS slug TEXT;

UPDATE clubs SET slug = generate_slug(name) WHERE slug IS NULL;

-- Manejar colisiones
DO $$
DECLARE
  rec RECORD;
  counter INT;
  new_slug TEXT;
BEGIN
  FOR rec IN 
    SELECT id, slug FROM clubs 
    WHERE slug IN (SELECT slug FROM clubs GROUP BY slug HAVING count(*) > 1)
    ORDER BY created_at ASC
  LOOP
    SELECT count(*) INTO counter FROM clubs WHERE slug = rec.slug AND id < rec.id;
    IF counter > 0 THEN
      new_slug := rec.slug || '-' || counter;
      UPDATE clubs SET slug = new_slug WHERE id = rec.id;
    END IF;
  END LOOP;
END $$;

ALTER TABLE clubs ALTER COLUMN slug SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_clubs_slug ON clubs(slug);

-- ── Leagues: slug basado en nombre ──
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS slug TEXT;

UPDATE leagues SET slug = generate_slug(name) WHERE slug IS NULL;

-- Manejar colisiones
DO $$
DECLARE
  rec RECORD;
  counter INT;
  new_slug TEXT;
BEGIN
  FOR rec IN 
    SELECT id, slug FROM leagues 
    WHERE slug IN (SELECT slug FROM leagues GROUP BY slug HAVING count(*) > 1)
    ORDER BY created_at ASC
  LOOP
    SELECT count(*) INTO counter FROM leagues WHERE slug = rec.slug AND id < rec.id;
    IF counter > 0 THEN
      new_slug := rec.slug || '-' || counter;
      UPDATE leagues SET slug = new_slug WHERE id = rec.id;
    END IF;
  END LOOP;
END $$;

ALTER TABLE leagues ALTER COLUMN slug SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_leagues_slug ON leagues(slug);

-- ── Trigger: auto-generar slug al insertar ──
CREATE OR REPLACE FUNCTION auto_slug_players() RETURNS TRIGGER AS $$
DECLARE
  base_slug TEXT;
  final_slug TEXT;
  counter INT := 0;
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    base_slug := generate_slug(NEW.nickname);
    final_slug := base_slug;
    WHILE EXISTS (SELECT 1 FROM players WHERE slug = final_slug AND id != NEW.id) LOOP
      counter := counter + 1;
      final_slug := base_slug || '-' || counter;
    END LOOP;
    NEW.slug := final_slug;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_players_auto_slug ON players;
CREATE TRIGGER trg_players_auto_slug
  BEFORE INSERT OR UPDATE ON players
  FOR EACH ROW EXECUTE FUNCTION auto_slug_players();

CREATE OR REPLACE FUNCTION auto_slug_clubs() RETURNS TRIGGER AS $$
DECLARE
  base_slug TEXT;
  final_slug TEXT;
  counter INT := 0;
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    base_slug := generate_slug(NEW.name);
    final_slug := base_slug;
    WHILE EXISTS (SELECT 1 FROM clubs WHERE slug = final_slug AND id != NEW.id) LOOP
      counter := counter + 1;
      final_slug := base_slug || '-' || counter;
    END LOOP;
    NEW.slug := final_slug;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_clubs_auto_slug ON clubs;
CREATE TRIGGER trg_clubs_auto_slug
  BEFORE INSERT OR UPDATE ON clubs
  FOR EACH ROW EXECUTE FUNCTION auto_slug_clubs();

CREATE OR REPLACE FUNCTION auto_slug_leagues() RETURNS TRIGGER AS $$
DECLARE
  base_slug TEXT;
  final_slug TEXT;
  counter INT := 0;
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    base_slug := generate_slug(NEW.name);
    final_slug := base_slug;
    WHILE EXISTS (SELECT 1 FROM leagues WHERE slug = final_slug AND id != NEW.id) LOOP
      counter := counter + 1;
      final_slug := base_slug || '-' || counter;
    END LOOP;
    NEW.slug := final_slug;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_leagues_auto_slug ON leagues;
CREATE TRIGGER trg_leagues_auto_slug
  BEFORE INSERT OR UPDATE ON leagues
  FOR EACH ROW EXECUTE FUNCTION auto_slug_leagues();
