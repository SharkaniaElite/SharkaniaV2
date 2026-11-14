
-- ══════════════════════════════════════════════════════════
-- GLOSARIO DE POKER — Tabla
-- ══════════════════════════════════════════════════════════

CREATE TABLE glossary_terms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  term TEXT NOT NULL,
  short_definition TEXT NOT NULL,      -- Para tooltip (máx 160 chars)
  full_definition TEXT NOT NULL,        -- Para la página individual del glosario
  category TEXT NOT NULL DEFAULT 'general',  -- estrategia, estadísticas, torneos, plataformas, sharkania
  related_terms TEXT[] DEFAULT '{}',    -- slugs de términos relacionados
  related_links JSONB DEFAULT '[]',    -- [{label, href}] links a herramientas/páginas internas
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE glossary_terms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "glossary_public_read" ON glossary_terms
  FOR SELECT USING (is_active = true);

CREATE POLICY "glossary_admin_all" ON glossary_terms
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

-- Índices
CREATE INDEX idx_glossary_slug ON glossary_terms(slug);
CREATE INDEX idx_glossary_category ON glossary_terms(category);
CREATE INDEX idx_glossary_active ON glossary_terms(is_active) WHERE is_active = true;
