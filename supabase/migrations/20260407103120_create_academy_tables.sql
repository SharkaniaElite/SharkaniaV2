
-- ══════════════════════════════════════════════════════════
-- SHARKANIA ACADEMY — Sistema de aprendizaje dinámico
-- ══════════════════════════════════════════════════════════

-- ── Enums ──

CREATE TYPE academy_level AS ENUM (
  'fundamentos',      -- Nivel 1: Gratis
  'pensamiento',      -- Nivel 2: 50 coins
  'torneo',           -- Nivel 3: 100 coins
  'mentalidad',       -- Nivel 4: 100 coins
  'avanzado',         -- Nivel 5: 200 coins
  'elite'             -- Nivel 6: 300 coins
);

CREATE TYPE lesson_content_type AS ENUM (
  'text',        -- Párrafo normal
  'h2',          -- Título de sección
  'h3',          -- Subtítulo
  'callout',     -- Frase destacada
  'stat',        -- Dato visual grande
  'list',        -- Lista de puntos
  'hand',        -- Ejemplo de mano (formato especial)
  'tip',         -- Tip del tiburón 🦈
  'warning',     -- Advertencia importante
  'action'       -- Acción concreta para el próximo torneo
);

-- ── 1. Módulos (los 6 niveles) ──

CREATE TABLE academy_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  level academy_level NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  title TEXT NOT NULL,
  subtitle TEXT,
  description TEXT,
  icon TEXT DEFAULT '📚',
  price_coins INT NOT NULL DEFAULT 0,      -- 0 = gratis
  total_lessons INT NOT NULL DEFAULT 0,
  estimated_minutes INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT false,
  unlock_message TEXT,                       -- Mensaje motivacional al desbloquear
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 2. Lecciones ──

CREATE TABLE academy_lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID NOT NULL REFERENCES academy_modules(id) ON DELETE CASCADE,
  sort_order INT NOT NULL DEFAULT 0,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  subtitle TEXT,
  estimated_minutes INT NOT NULL DEFAULT 7,
  xp_reward INT NOT NULL DEFAULT 50,        -- XP por completar
  coins_reward INT NOT NULL DEFAULT 5,       -- Shark Coins por completar
  body JSONB NOT NULL DEFAULT '[]'::jsonb,   -- Contenido (mismo formato que blog)
  quiz JSONB NOT NULL DEFAULT '[]'::jsonb,   -- Las 5 preguntas obligatorias
  action_challenge TEXT,                      -- "En tu próximo torneo, haz X"
  glossary_terms TEXT[] DEFAULT '{}',         -- Slugs de términos del glosario relevantes
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 3. Progreso del usuario por módulo ──

CREATE TABLE academy_user_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  module_id UUID NOT NULL REFERENCES academy_modules(id) ON DELETE CASCADE,
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  UNIQUE (user_id, module_id)
);

-- ── 4. Progreso del usuario por lección ──

CREATE TABLE academy_user_lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  lesson_id UUID NOT NULL REFERENCES academy_lessons(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,              -- NULL = en progreso
  quiz_passed BOOLEAN NOT NULL DEFAULT false,
  quiz_attempts INT NOT NULL DEFAULT 0,  -- Cuántas veces intentó el quiz
  quiz_last_answers JSONB,               -- Última respuesta {questionIndex: selectedAnswer}
  xp_earned INT NOT NULL DEFAULT 0,
  coins_earned INT NOT NULL DEFAULT 0,
  UNIQUE (user_id, lesson_id)
);

-- ── 5. Streaks de estudio ──

CREATE TABLE academy_study_streaks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
  current_streak INT NOT NULL DEFAULT 0,
  longest_streak INT NOT NULL DEFAULT 0,
  last_study_date DATE,
  total_lessons_completed INT NOT NULL DEFAULT 0,
  total_xp_earned INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Índices ──

CREATE INDEX idx_academy_lessons_module ON academy_lessons(module_id, sort_order);
CREATE INDEX idx_academy_lessons_slug ON academy_lessons(slug);
CREATE INDEX idx_academy_user_lessons_user ON academy_user_lessons(user_id);
CREATE INDEX idx_academy_user_lessons_lesson ON academy_user_lessons(lesson_id);
CREATE INDEX idx_academy_user_modules_user ON academy_user_modules(user_id);

-- ── RLS ──

ALTER TABLE academy_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE academy_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE academy_user_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE academy_user_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE academy_study_streaks ENABLE ROW LEVEL SECURITY;

-- Módulos y lecciones: lectura pública, escritura solo admin
CREATE POLICY "academy_modules_read" ON academy_modules FOR SELECT USING (true);
CREATE POLICY "academy_modules_admin" ON academy_modules FOR ALL USING (is_super_admin());

CREATE POLICY "academy_lessons_read" ON academy_lessons FOR SELECT USING (true);
CREATE POLICY "academy_lessons_admin" ON academy_lessons FOR ALL USING (is_super_admin());

-- Progreso: solo el propio usuario puede ver/modificar su progreso
CREATE POLICY "academy_user_modules_own" ON academy_user_modules FOR ALL 
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "academy_user_modules_admin_read" ON academy_user_modules FOR SELECT 
  USING (is_super_admin());

CREATE POLICY "academy_user_lessons_own" ON academy_user_lessons FOR ALL 
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "academy_user_lessons_admin_read" ON academy_user_lessons FOR SELECT 
  USING (is_super_admin());

CREATE POLICY "academy_streaks_own" ON academy_study_streaks FOR ALL 
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "academy_streaks_admin_read" ON academy_study_streaks FOR SELECT 
  USING (is_super_admin());

-- ── Función para completar lección y dar rewards ──

CREATE OR REPLACE FUNCTION academy_complete_lesson(
  p_user_id UUID,
  p_lesson_id UUID,
  p_quiz_answers JSONB
)
RETURNS JSON AS $$
DECLARE
  v_lesson RECORD;
  v_module RECORD;
  v_xp INT;
  v_coins INT;
  v_all_lessons_complete BOOLEAN;
  v_streak RECORD;
  v_today DATE := CURRENT_DATE;
BEGIN
  -- Obtener datos de la lección
  SELECT l.*, m.id as mod_id, m.level, m.total_lessons
  INTO v_lesson
  FROM academy_lessons l
  JOIN academy_modules m ON m.id = l.module_id
  WHERE l.id = p_lesson_id;
  
  IF v_lesson IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Lección no encontrada');
  END IF;
  
  v_xp := v_lesson.xp_reward;
  v_coins := v_lesson.coins_reward;
  
  -- Registrar o actualizar progreso
  INSERT INTO academy_user_lessons (user_id, lesson_id, quiz_passed, quiz_attempts, quiz_last_answers, completed_at, xp_earned, coins_earned)
  VALUES (p_user_id, p_lesson_id, true, 1, p_quiz_answers, now(), v_xp, v_coins)
  ON CONFLICT (user_id, lesson_id) DO UPDATE SET
    quiz_passed = true,
    quiz_attempts = academy_user_lessons.quiz_attempts + 1,
    quiz_last_answers = p_quiz_answers,
    completed_at = COALESCE(academy_user_lessons.completed_at, now()),
    xp_earned = v_xp,
    coins_earned = v_coins;
  
  -- Dar XP y coins al perfil del usuario
  UPDATE profiles SET
    xp = xp + v_xp,
    shark_coins_balance = shark_coins_balance + v_coins
  WHERE id = p_user_id;
  
  -- Actualizar streak
  INSERT INTO academy_study_streaks (user_id, current_streak, longest_streak, last_study_date, total_lessons_completed, total_xp_earned)
  VALUES (p_user_id, 1, 1, v_today, 1, v_xp)
  ON CONFLICT (user_id) DO UPDATE SET
    current_streak = CASE
      WHEN academy_study_streaks.last_study_date = v_today - 1 THEN academy_study_streaks.current_streak + 1
      WHEN academy_study_streaks.last_study_date = v_today THEN academy_study_streaks.current_streak
      ELSE 1
    END,
    longest_streak = GREATEST(
      academy_study_streaks.longest_streak,
      CASE
        WHEN academy_study_streaks.last_study_date = v_today - 1 THEN academy_study_streaks.current_streak + 1
        WHEN academy_study_streaks.last_study_date = v_today THEN academy_study_streaks.current_streak
        ELSE 1
      END
    ),
    last_study_date = v_today,
    total_lessons_completed = academy_study_streaks.total_lessons_completed + 1,
    total_xp_earned = academy_study_streaks.total_xp_earned + v_xp,
    updated_at = now();
  
  -- Verificar si completó TODAS las lecciones del módulo
  SELECT NOT EXISTS (
    SELECT 1 FROM academy_lessons al
    WHERE al.module_id = v_lesson.mod_id
    AND al.is_active = true
    AND NOT EXISTS (
      SELECT 1 FROM academy_user_lessons aul
      WHERE aul.lesson_id = al.id
      AND aul.user_id = p_user_id
      AND aul.quiz_passed = true
    )
  ) INTO v_all_lessons_complete;
  
  -- Si completó todo el módulo, marcarlo
  IF v_all_lessons_complete THEN
    UPDATE academy_user_modules
    SET completed_at = now()
    WHERE user_id = p_user_id AND module_id = v_lesson.mod_id;
  END IF;
  
  -- Obtener streak actualizado
  SELECT * INTO v_streak FROM academy_study_streaks WHERE user_id = p_user_id;
  
  RETURN json_build_object(
    'success', true,
    'xp_earned', v_xp,
    'coins_earned', v_coins,
    'module_completed', v_all_lessons_complete,
    'current_streak', v_streak.current_streak,
    'longest_streak', v_streak.longest_streak,
    'total_completed', v_streak.total_lessons_completed
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── Función para desbloquear módulo (compra con coins) ──

CREATE OR REPLACE FUNCTION academy_unlock_module(
  p_user_id UUID,
  p_module_id UUID
)
RETURNS JSON AS $$
DECLARE
  v_module RECORD;
  v_balance INT;
  v_already_unlocked BOOLEAN;
BEGIN
  -- Obtener módulo
  SELECT * INTO v_module FROM academy_modules WHERE id = p_module_id;
  IF v_module IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Módulo no encontrado');
  END IF;
  
  -- Si es gratis, desbloquear directamente
  IF v_module.price_coins = 0 THEN
    INSERT INTO academy_user_modules (user_id, module_id)
    VALUES (p_user_id, p_module_id)
    ON CONFLICT (user_id, module_id) DO NOTHING;
    RETURN json_build_object('success', true, 'coins_spent', 0);
  END IF;
  
  -- Verificar si ya está desbloqueado
  SELECT EXISTS (
    SELECT 1 FROM academy_user_modules WHERE user_id = p_user_id AND module_id = p_module_id
  ) INTO v_already_unlocked;
  
  IF v_already_unlocked THEN
    RETURN json_build_object('success', false, 'error', 'Módulo ya desbloqueado');
  END IF;
  
  -- Verificar balance
  SELECT shark_coins_balance INTO v_balance FROM profiles WHERE id = p_user_id;
  IF v_balance < v_module.price_coins THEN
    RETURN json_build_object('success', false, 'error', 'Shark Coins insuficientes', 'needed', v_module.price_coins, 'balance', v_balance);
  END IF;
  
  -- Cobrar coins
  UPDATE profiles SET shark_coins_balance = shark_coins_balance - v_module.price_coins WHERE id = p_user_id;
  
  -- Registrar transacción
  INSERT INTO credit_transactions (user_id, amount, transaction_type, reference_type, reference_id, description)
  VALUES (p_user_id, -v_module.price_coins, 'spend', 'academy_module', p_module_id, 'Desbloqueo: ' || v_module.title);
  
  -- Desbloquear
  INSERT INTO academy_user_modules (user_id, module_id)
  VALUES (p_user_id, p_module_id);
  
  RETURN json_build_object('success', true, 'coins_spent', v_module.price_coins);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grants
GRANT EXECUTE ON FUNCTION academy_complete_lesson(UUID, UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION academy_unlock_module(UUID, UUID) TO authenticated;
