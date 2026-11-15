
-- ══════════════════════════════════════════════════════════
-- Tournament Templates: configuración reutilizable de torneos
-- Un club define sus plantillas una vez y crea torneos a partir de ellas
-- ══════════════════════════════════════════════════════════

CREATE TABLE tournament_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  
  -- Datos del torneo (se copian al crear un torneo)
  name text NOT NULL,                          -- "Freeroll Nocturno", "$5.50 Freezeout"
  description text,
  room_id uuid NOT NULL REFERENCES poker_rooms(id),
  buy_in numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  guaranteed_prize numeric,                     -- NULL = sin garantizado
  late_registration_minutes integer,
  max_players integer,
  game_type game_type NOT NULL DEFAULT 'NLH',
  tournament_type tournament_type NOT NULL DEFAULT 'MTT',
  league_id uuid REFERENCES leagues(id),        -- Si pertenece a una liga fija
  
  -- Configuración de recurrencia
  default_hour time NOT NULL DEFAULT '22:00',   -- Hora default del torneo
  default_timezone text NOT NULL DEFAULT 'America/Santiago',
  
  -- Días de la semana en que se repite (NULL = no recurrente, manual)
  -- Formato: array de 0-6 (0=domingo, 1=lunes, ..., 6=sábado)
  recurrence_days integer[],
  
  -- Control
  is_active boolean NOT NULL DEFAULT true,      -- Para desactivar sin borrar
  sort_order integer NOT NULL DEFAULT 0,        -- Orden en el panel del admin
  
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX idx_templates_club ON tournament_templates(club_id);
CREATE INDEX idx_templates_active ON tournament_templates(club_id, is_active);

-- RLS
ALTER TABLE tournament_templates ENABLE ROW LEVEL SECURITY;

-- Lectura: cualquiera puede ver las plantillas de clubs aprobados
CREATE POLICY "tournament_templates: public read"
  ON tournament_templates FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM clubs WHERE clubs.id = tournament_templates.club_id AND clubs.is_approved = true
    )
  );

-- CRUD: solo el admin del club puede gestionar sus plantillas
CREATE POLICY "tournament_templates: club admin manage"
  ON tournament_templates FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM club_admins WHERE club_admins.club_id = tournament_templates.club_id 
      AND club_admins.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM club_admins WHERE club_admins.club_id = tournament_templates.club_id 
      AND club_admins.user_id = auth.uid()
    )
  );

-- Super admin tiene acceso total
CREATE POLICY "tournament_templates: super admin"
  ON tournament_templates FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin')
  );

-- ══════════════════════════════════════════════════════════
-- Agregar template_id a tournaments para rastrear origen
-- ══════════════════════════════════════════════════════════

ALTER TABLE tournaments 
  ADD COLUMN template_id uuid REFERENCES tournament_templates(id) ON DELETE SET NULL;

CREATE INDEX idx_tournaments_template ON tournaments(template_id);

-- ══════════════════════════════════════════════════════════
-- Función: crear torneo desde plantilla + fecha
-- El admin solo necesita: template_id + start_datetime
-- Opcionalmente puede override: name, buy_in, guaranteed_prize
-- ══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION create_tournament_from_template(
  p_template_id uuid,
  p_start_datetime timestamptz,
  p_name_override text DEFAULT NULL,
  p_buy_in_override numeric DEFAULT NULL,
  p_guaranteed_override numeric DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_template tournament_templates%ROWTYPE;
  v_tournament_id uuid;
BEGIN
  -- Obtener plantilla
  SELECT * INTO v_template FROM tournament_templates WHERE id = p_template_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Template not found: %', p_template_id;
  END IF;

  -- Crear torneo copiando datos de la plantilla
  INSERT INTO tournaments (
    club_id, league_id, name, description, room_id, buy_in, currency,
    guaranteed_prize, start_datetime, timezone, late_registration_minutes,
    max_players, game_type, tournament_type, status, template_id
  ) VALUES (
    v_template.club_id,
    v_template.league_id,
    COALESCE(p_name_override, v_template.name),
    v_template.description,
    v_template.room_id,
    COALESCE(p_buy_in_override, v_template.buy_in),
    v_template.currency,
    COALESCE(p_guaranteed_override, v_template.guaranteed_prize),
    p_start_datetime,
    v_template.default_timezone,
    v_template.late_registration_minutes,
    v_template.max_players,
    v_template.game_type,
    v_template.tournament_type,
    'scheduled',
    p_template_id
  )
  RETURNING id INTO v_tournament_id;

  RETURN v_tournament_id;
END;
$$;

-- ══════════════════════════════════════════════════════════
-- Función: crear calendario mensual desde plantillas recurrentes
-- Genera torneos para los próximos N días según recurrence_days
-- ══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION generate_calendar_from_templates(
  p_club_id uuid,
  p_days_ahead integer DEFAULT 30
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_template RECORD;
  v_date date;
  v_dow integer;
  v_start timestamptz;
  v_count integer := 0;
  v_exists boolean;
BEGIN
  -- Iterar por cada plantilla activa con recurrencia
  FOR v_template IN
    SELECT * FROM tournament_templates 
    WHERE club_id = p_club_id 
    AND is_active = true 
    AND recurrence_days IS NOT NULL 
    AND array_length(recurrence_days, 1) > 0
  LOOP
    -- Iterar por cada día en el rango
    FOR v_date IN
      SELECT generate_series(
        CURRENT_DATE, 
        CURRENT_DATE + p_days_ahead * interval '1 day', 
        interval '1 day'
      )::date
    LOOP
      v_dow := EXTRACT(DOW FROM v_date)::integer;
      
      -- Si este día de la semana está en recurrence_days
      IF v_dow = ANY(v_template.recurrence_days) THEN
        -- Construir datetime con la hora default y timezone de la plantilla
        v_start := (v_date || ' ' || v_template.default_hour)::timestamp 
                   AT TIME ZONE v_template.default_timezone;
        
        -- Verificar que no exista ya un torneo con esta plantilla en esta fecha
        SELECT EXISTS(
          SELECT 1 FROM tournaments 
          WHERE template_id = v_template.id 
          AND start_datetime::date = v_date
        ) INTO v_exists;
        
        -- Solo crear si no existe y la fecha es futura
        IF NOT v_exists AND v_start > now() THEN
          PERFORM create_tournament_from_template(v_template.id, v_start);
          v_count := v_count + 1;
        END IF;
      END IF;
    END LOOP;
  END LOOP;

  RETURN v_count;
END;
$$;
