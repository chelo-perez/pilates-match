-- ============================================================
-- PilatesMatch - Schema completo de base de datos
-- Supabase / PostgreSQL
-- ============================================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";    -- Full-text search

-- ============================================================
-- ENUMS
-- ============================================================
CREATE TYPE user_role AS ENUM ('estudio', 'instructor', 'camara_admin');
CREATE TYPE verification_status AS ENUM ('pendiente', 'verificado', 'rechazado', 'inactivo');
CREATE TYPE membership_status AS ENUM ('activa', 'vencida', 'cancelada');
CREATE TYPE class_type AS ENUM ('regular', 'reemplazo');
CREATE TYPE match_status AS ENUM ('pendiente', 'aceptado', 'rechazado', 'expirado', 'cancelado');
CREATE TYPE day_of_week AS ENUM ('lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo');
CREATE TYPE specialty AS ENUM ('mat', 'reformer', 'cadillac', 'chair', 'barrel', 'prenatal', 'terapeutico', 'adultos_mayores');

-- ============================================================
-- USUARIOS (tabla base de autenticacion)
-- ============================================================
CREATE TABLE users (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT NOT NULL UNIQUE,
  role        user_role NOT NULL,
  full_name   TEXT,
  phone       TEXT,
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ESTUDIOS
-- ============================================================
CREATE TABLE studios (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  description     TEXT,
  neighborhood    TEXT NOT NULL,
  address         TEXT,
  lat             DECIMAL(10, 8),
  lng             DECIMAL(11, 8),
  phone           TEXT,
  instagram       TEXT,
  camara_code     TEXT UNIQUE,           -- Codigo de membresia asignado por la Camara
  is_member       BOOLEAN DEFAULT FALSE,
  member_since    DATE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- MEMBRESIAS
-- ============================================================
CREATE TABLE memberships (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  studio_id           UUID NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
  status              membership_status NOT NULL DEFAULT 'activa',
  start_date          DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date            DATE NOT NULL,
  monthly_price_ars   INTEGER NOT NULL DEFAULT 15000,
  matches_used_month  INTEGER NOT NULL DEFAULT 0,
  matches_limit       INTEGER,              -- NULL = ilimitado (socios)
  last_reset_date     DATE DEFAULT CURRENT_DATE,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INSTRUCTORES
-- ============================================================
CREATE TABLE instructors (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID REFERENCES users(id) ON DELETE SET NULL,  -- puede existir sin user aun
  full_name           TEXT NOT NULL,
  dni                 TEXT,
  email               TEXT,
  phone               TEXT,
  neighborhood        TEXT,
  bio                 TEXT,
  avatar_url          TEXT,
  verification_status verification_status DEFAULT 'pendiente',
  verified_at         TIMESTAMPTZ,
  verified_by         UUID REFERENCES users(id),
  added_by_studio     UUID REFERENCES studios(id),  -- quien lo dio de alta
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- CERTIFICACIONES
-- ============================================================
CREATE TABLE certifications (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  instructor_id  UUID NOT NULL REFERENCES instructors(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  institution    TEXT NOT NULL,
  year           INTEGER,
  hours          INTEGER,
  document_url   TEXT,
  verified       BOOLEAN DEFAULT FALSE,
  verified_at    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ESPECIALIDADES DEL INSTRUCTOR
-- ============================================================
CREATE TABLE instructor_specialties (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  instructor_id  UUID NOT NULL REFERENCES instructors(id) ON DELETE CASCADE,
  specialty      specialty NOT NULL,
  level          TEXT CHECK (level IN ('basico', 'intermedio', 'avanzado')),
  UNIQUE (instructor_id, specialty)
);

-- ============================================================
-- DISPONIBILIDAD
-- ============================================================
CREATE TABLE availability (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  instructor_id  UUID NOT NULL REFERENCES instructors(id) ON DELETE CASCADE,
  day_of_week    day_of_week NOT NULL,
  start_time     TIME NOT NULL,
  end_time       TIME NOT NULL,
  class_type     class_type NOT NULL DEFAULT 'reemplazo',
  is_active      BOOLEAN DEFAULT TRUE,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ZONAS DE TRABAJO DEL INSTRUCTOR
-- ============================================================
CREATE TABLE instructor_zones (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  instructor_id  UUID NOT NULL REFERENCES instructors(id) ON DELETE CASCADE,
  neighborhood   TEXT NOT NULL,
  UNIQUE (instructor_id, neighborhood)
);

-- ============================================================
-- TARIFAS DEL INSTRUCTOR
-- ============================================================
CREATE TABLE instructor_rates (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  instructor_id    UUID NOT NULL REFERENCES instructors(id) ON DELETE CASCADE UNIQUE,
  rate_regular     INTEGER NOT NULL DEFAULT 0,    -- ARS minimo por clase regular
  rate_replacement INTEGER NOT NULL DEFAULT 0,    -- ARS minimo por reemplazo
  updated_at       TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT replacement_gt_regular CHECK (rate_replacement >= rate_regular)
);

-- ============================================================
-- PRESUPUESTO DEL ESTUDIO
-- ============================================================
CREATE TABLE studio_budgets (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  studio_id           UUID NOT NULL REFERENCES studios(id) ON DELETE CASCADE UNIQUE,
  max_regular         INTEGER NOT NULL DEFAULT 0,    -- ARS maximo por clase regular
  max_replacement     INTEGER NOT NULL DEFAULT 0,    -- ARS maximo por reemplazo
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- EVALUACIONES
-- ============================================================
CREATE TABLE evaluations (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  studio_id             UUID NOT NULL REFERENCES studios(id),
  instructor_id         UUID NOT NULL REFERENCES instructors(id),
  class_type            class_type NOT NULL,
  class_date            DATE NOT NULL,
  score_technique       SMALLINT NOT NULL CHECK (score_technique BETWEEN 1 AND 10),
  score_punctuality     SMALLINT NOT NULL CHECK (score_punctuality BETWEEN 1 AND 10),
  score_student_care    SMALLINT NOT NULL CHECK (score_student_care BETWEEN 1 AND 10),
  score_presentation    SMALLINT NOT NULL CHECK (score_presentation BETWEEN 1 AND 10),
  average_score         DECIMAL(4,2) GENERATED ALWAYS AS (
    (score_technique + score_punctuality + score_student_care + score_presentation)::decimal / 4
  ) STORED,
  comment               TEXT,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- MATCHES (solicitudes de cobertura)
-- ============================================================
CREATE TABLE matches (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  studio_id        UUID NOT NULL REFERENCES studios(id),
  instructor_id    UUID NOT NULL REFERENCES instructors(id),
  class_type       class_type NOT NULL DEFAULT 'reemplazo',
  class_date       DATE NOT NULL,
  start_time       TIME NOT NULL,
  end_time         TIME NOT NULL,
  status           match_status NOT NULL DEFAULT 'pendiente',
  note_studio      TEXT,
  note_instructor  TEXT,
  agreed_rate      INTEGER,       -- tarifa acordada al concretar
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  responded_at     TIMESTAMPTZ,
  expires_at       TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours')
);

-- ============================================================
-- RANGOS DE TARIFAS (definidos por la Camara)
-- ============================================================
CREATE TABLE rate_ranges (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  class_type           class_type NOT NULL UNIQUE,
  min_ars              INTEGER NOT NULL,
  max_ars              INTEGER NOT NULL,
  updated_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_by           UUID REFERENCES users(id)
);

-- Valores iniciales
INSERT INTO rate_ranges (class_type, min_ars, max_ars) VALUES
  ('regular',    6000,  9000),
  ('reemplazo',  9000, 14000);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX idx_evaluations_instructor ON evaluations(instructor_id);
CREATE INDEX idx_evaluations_studio ON evaluations(studio_id);
CREATE INDEX idx_evaluations_date ON evaluations(class_date DESC);
CREATE INDEX idx_matches_studio ON matches(studio_id);
CREATE INDEX idx_matches_instructor ON matches(instructor_id);
CREATE INDEX idx_matches_status ON matches(status);
CREATE INDEX idx_availability_instructor ON availability(instructor_id);
CREATE INDEX idx_instructors_name_trgm ON instructors USING gin(full_name gin_trgm_ops);
CREATE INDEX idx_instructors_verification ON instructors(verification_status);

-- ============================================================
-- FUNCIONES Y TRIGGERS
-- ============================================================

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_studios_updated_at BEFORE UPDATE ON studios FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_memberships_updated_at BEFORE UPDATE ON memberships FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_instructors_updated_at BEFORE UPDATE ON instructors FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Reset matches counter mensual
CREATE OR REPLACE FUNCTION reset_monthly_matches()
RETURNS VOID AS $$
BEGIN
  UPDATE memberships
  SET matches_used_month = 0,
      last_reset_date = CURRENT_DATE
  WHERE last_reset_date < date_trunc('month', CURRENT_DATE);
END;
$$ LANGUAGE plpgsql;

-- Calcular promedio del instructor (materializado para performance)
CREATE OR REPLACE FUNCTION get_instructor_stats(p_instructor_id UUID)
RETURNS TABLE (
  total_evaluations  INTEGER,
  avg_score          DECIMAL,
  avg_technique      DECIMAL,
  avg_punctuality    DECIMAL,
  avg_student_care   DECIMAL,
  avg_presentation   DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::INTEGER,
    AVG(average_score),
    AVG(score_technique),
    AVG(score_punctuality),
    AVG(score_student_care),
    AVG(score_presentation)
  FROM evaluations
  WHERE instructor_id = p_instructor_id;
END;
$$ LANGUAGE plpgsql;

-- Verificar si un estudio puede hacer match (limite mensual)
CREATE OR REPLACE FUNCTION can_studio_match(p_studio_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_membership memberships%ROWTYPE;
BEGIN
  SELECT * INTO v_membership FROM memberships WHERE studio_id = p_studio_id AND status = 'activa';
  IF NOT FOUND THEN RETURN FALSE; END IF;
  -- Si matches_limit es NULL = ilimitado (miembro)
  IF v_membership.matches_limit IS NULL THEN RETURN TRUE; END IF;
  RETURN v_membership.matches_used_month < v_membership.matches_limit;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE studios ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE instructors ENABLE ROW LEVEL SECURITY;
ALTER TABLE certifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE instructor_specialties ENABLE ROW LEVEL SECURITY;
ALTER TABLE availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE instructor_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE instructor_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE studio_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_ranges ENABLE ROW LEVEL SECURITY;

-- Helper: obtener el rol del usuario actual
CREATE OR REPLACE FUNCTION auth_role()
RETURNS user_role AS $$
  SELECT role FROM users WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Users
CREATE POLICY "users_own" ON users FOR ALL USING (id = auth.uid());
CREATE POLICY "camara_read_users" ON users FOR SELECT USING (auth_role() = 'camara_admin');

-- Studios
CREATE POLICY "studio_own" ON studios FOR ALL USING (user_id = auth.uid());
CREATE POLICY "studio_public_read" ON studios FOR SELECT USING (TRUE);
CREATE POLICY "camara_manage_studios" ON studios FOR ALL USING (auth_role() = 'camara_admin');

-- Memberships
CREATE POLICY "studio_own_membership" ON memberships FOR SELECT USING (
  studio_id IN (SELECT id FROM studios WHERE user_id = auth.uid())
);
CREATE POLICY "camara_manage_memberships" ON memberships FOR ALL USING (auth_role() = 'camara_admin');

-- Instructors
CREATE POLICY "instructors_public_read" ON instructors FOR SELECT USING (verification_status = 'verificado');
CREATE POLICY "instructor_own" ON instructors FOR ALL USING (user_id = auth.uid());
CREATE POLICY "camara_manage_instructors" ON instructors FOR ALL USING (auth_role() = 'camara_admin');
CREATE POLICY "studio_read_all_instructors" ON instructors FOR SELECT USING (auth_role() = 'estudio');

-- Certifications
CREATE POLICY "cert_public_read" ON certifications FOR SELECT USING (TRUE);
CREATE POLICY "instructor_own_certs" ON certifications FOR ALL USING (
  instructor_id IN (SELECT id FROM instructors WHERE user_id = auth.uid())
);
CREATE POLICY "camara_manage_certs" ON certifications FOR ALL USING (auth_role() = 'camara_admin');

-- Instructor Rates (privadas - solo estudio ve si hay match)
CREATE POLICY "instructor_own_rates" ON instructor_rates FOR ALL USING (
  instructor_id IN (SELECT id FROM instructors WHERE user_id = auth.uid())
);
CREATE POLICY "camara_read_rates" ON instructor_rates FOR SELECT USING (auth_role() = 'camara_admin');

-- Studio Budgets (privadas)
CREATE POLICY "studio_own_budget" ON studio_budgets FOR ALL USING (
  studio_id IN (SELECT id FROM studios WHERE user_id = auth.uid())
);
CREATE POLICY "camara_read_budgets" ON studio_budgets FOR SELECT USING (auth_role() = 'camara_admin');

-- Evaluations
CREATE POLICY "studio_own_evals" ON evaluations FOR ALL USING (
  studio_id IN (SELECT id FROM studios WHERE user_id = auth.uid())
);
CREATE POLICY "instructor_see_own_evals" ON evaluations FOR SELECT USING (
  instructor_id IN (SELECT id FROM instructors WHERE user_id = auth.uid())
);
CREATE POLICY "camara_read_evals" ON evaluations FOR SELECT USING (auth_role() = 'camara_admin');

-- Matches
CREATE POLICY "studio_own_matches" ON matches FOR ALL USING (
  studio_id IN (SELECT id FROM studios WHERE user_id = auth.uid())
);
CREATE POLICY "instructor_see_own_matches" ON matches FOR SELECT USING (
  instructor_id IN (SELECT id FROM instructors WHERE user_id = auth.uid())
);

-- Rate ranges (lectura publica)
CREATE POLICY "rate_ranges_public_read" ON rate_ranges FOR SELECT USING (TRUE);
CREATE POLICY "camara_manage_ranges" ON rate_ranges FOR ALL USING (auth_role() = 'camara_admin');

-- Availability & zones (lectura publica)
CREATE POLICY "availability_public_read" ON availability FOR SELECT USING (TRUE);
CREATE POLICY "instructor_own_availability" ON availability FOR ALL USING (
  instructor_id IN (SELECT id FROM instructors WHERE user_id = auth.uid())
);
CREATE POLICY "zones_public_read" ON instructor_zones FOR SELECT USING (TRUE);
CREATE POLICY "instructor_own_zones" ON instructor_zones FOR ALL USING (
  instructor_id IN (SELECT id FROM instructors WHERE user_id = auth.uid())
);
CREATE POLICY "specialties_public_read" ON instructor_specialties FOR SELECT USING (TRUE);
CREATE POLICY "instructor_own_specialties" ON instructor_specialties FOR ALL USING (
  instructor_id IN (SELECT id FROM instructors WHERE user_id = auth.uid())
);
