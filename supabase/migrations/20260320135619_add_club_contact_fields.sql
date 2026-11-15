
-- Agregar campos de contacto y redes sociales a clubs
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS whatsapp TEXT;
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS website_url TEXT;
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS discord_url TEXT;
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS telegram_url TEXT;
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS instagram_url TEXT;
