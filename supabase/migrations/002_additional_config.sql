-- ============================================================
-- PilatesMatch — Script de configuración adicional
-- Ejecutar en Supabase Dashboard → SQL Editor
-- ============================================================

-- ── Push tokens (para notificaciones) ──────────────────────
CREATE TABLE IF NOT EXISTS push_tokens (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  token      TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "push_token_own" ON push_tokens
  FOR ALL USING (user_id = auth.uid());

-- ── Función para incrementar contador de matches ────────────
CREATE OR REPLACE FUNCTION increment_match_counter(p_studio_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE memberships
  SET matches_used_month = matches_used_month + 1
  WHERE studio_id = p_studio_id AND status = 'activa';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── Trigger: crear user profile automáticamente ─────────────
-- Cuando alguien se registra en Auth, crear su fila en 'users'
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, role, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'estudio')::user_role,
    NEW.raw_user_meta_data->>'full_name'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ── Cron job: reset de matches el 1° de cada mes ────────────
-- Requiere la extensión pg_cron (activar en Extensions)
-- SELECT cron.schedule('reset-matches-monthly', '0 0 1 * *', 'SELECT reset_monthly_matches()');

-- ── Storage policies ────────────────────────────────────────
-- Ejecutar después de crear los buckets 'avatars' y 'certifications'

-- Avatars: lectura pública, escritura solo del propio usuario
CREATE POLICY "avatar_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

CREATE POLICY "avatar_user_upload" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'avatars' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "avatar_user_update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'avatars' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Certifications: solo la Cámara puede leer, instructores pueden subir las suyas
CREATE POLICY "cert_instructor_upload" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'certifications' AND
    EXISTS (
      SELECT 1 FROM instructors
      WHERE user_id = auth.uid()
      AND id::text = (storage.foldername(name))[1]
    )
  );

CREATE POLICY "cert_camara_read" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'certifications' AND
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'camara_admin')
  );

CREATE POLICY "cert_instructor_read_own" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'certifications' AND
    EXISTS (
      SELECT 1 FROM instructors
      WHERE user_id = auth.uid()
      AND id::text = (storage.foldername(name))[1]
    )
  );

-- ── Verificación final ──────────────────────────────────────
-- Correr esto para confirmar que todo está bien:
SELECT
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
