-- ============================================================
-- PilatesMatch — Evaluaciones de estudios por instructores
-- ============================================================

-- Tabla de evaluaciones de estudios
CREATE TABLE studio_evaluations (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  instructor_id         UUID NOT NULL REFERENCES instructors(id),
  studio_id             UUID NOT NULL REFERENCES studios(id),
  match_id              UUID REFERENCES matches(id),
  class_type            class_type NOT NULL,
  class_date            DATE NOT NULL,
  score_payment         SMALLINT NOT NULL CHECK (score_payment BETWEEN 1 AND 10),
  score_organization    SMALLINT NOT NULL CHECK (score_organization BETWEEN 1 AND 10),
  score_treatment       SMALLINT NOT NULL CHECK (score_treatment BETWEEN 1 AND 10),
  score_facilities      SMALLINT NOT NULL CHECK (score_facilities BETWEEN 1 AND 10),
  average_score         DECIMAL(4,2) GENERATED ALWAYS AS (
    (score_payment + score_organization + score_treatment + score_facilities)::decimal / 4
  ) STORED,
  comment               TEXT,
  -- Reportes de problemas (múltiples pueden ser true)
  issue_late_payment    BOOLEAN DEFAULT FALSE,
  issue_last_minute     BOOLEAN DEFAULT FALSE,
  issue_bad_treatment   BOOLEAN DEFAULT FALSE,
  issue_bad_facilities  BOOLEAN DEFAULT FALSE,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  -- Un instructor solo puede evaluar una vez por match
  UNIQUE (instructor_id, match_id)
);

-- Control de evaluaciones pendientes del estudio (para el bloqueo)
-- Una vez que el match tiene fecha pasada, el estudio tiene 48hs para evaluar
-- Esta view simplifica la consulta de "¿puede el estudio enviar propuestas?"
CREATE OR REPLACE VIEW pending_studio_evaluations AS
SELECT
  m.studio_id,
  m.id AS match_id,
  m.instructor_id,
  m.class_date,
  m.class_type,
  m.end_time,
  -- Deadline: fecha de clase + 48 horas
  (m.class_date + INTERVAL '1 day' * 2) AS deadline,
  i.full_name AS instructor_name,
  i.avatar_url AS instructor_avatar
FROM matches m
JOIN instructors i ON i.id = m.instructor_id
-- Solo matches aceptados con fecha pasada
WHERE m.status = 'aceptado'
AND m.class_date < CURRENT_DATE
-- Que no tengan evaluación todavía
AND NOT EXISTS (
  SELECT 1 FROM evaluations e
  WHERE e.studio_id = m.studio_id
  AND e.instructor_id = m.instructor_id
  AND e.class_date = m.class_date
);

-- Función: ¿puede el estudio enviar propuestas? (sin evaluaciones pendientes)
CREATE OR REPLACE FUNCTION can_studio_send_proposal(p_studio_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN NOT EXISTS (
    SELECT 1 FROM pending_studio_evaluations
    WHERE studio_id = p_studio_id
  );
END;
$$ LANGUAGE plpgsql;

-- RLS para studio_evaluations
ALTER TABLE studio_evaluations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "instructor_own_studio_evals" ON studio_evaluations
  FOR ALL USING (
    instructor_id IN (SELECT id FROM instructors WHERE user_id = auth.uid())
  );

CREATE POLICY "camara_read_studio_evals" ON studio_evaluations
  FOR SELECT USING (auth_role() = 'camara_admin');

-- Índices
CREATE INDEX idx_studio_evals_studio ON studio_evaluations(studio_id);
CREATE INDEX idx_studio_evals_instructor ON studio_evaluations(instructor_id);
CREATE INDEX idx_studio_evals_date ON studio_evaluations(class_date DESC);

-- Función stats de estudio (para la Cámara y perfil público)
CREATE OR REPLACE FUNCTION get_studio_stats(p_studio_id UUID)
RETURNS TABLE (
  total_evaluations  INTEGER,
  avg_score          DECIMAL,
  avg_payment        DECIMAL,
  avg_organization   DECIMAL,
  avg_treatment      DECIMAL,
  avg_facilities     DECIMAL,
  total_issues       INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::INTEGER,
    AVG(average_score),
    AVG(score_payment),
    AVG(score_organization),
    AVG(score_treatment),
    AVG(score_facilities),
    SUM(CASE WHEN issue_late_payment OR issue_last_minute OR issue_bad_treatment OR issue_bad_facilities THEN 1 ELSE 0 END)::INTEGER
  FROM studio_evaluations
  WHERE studio_id = p_studio_id;
END;
$$ LANGUAGE plpgsql;
