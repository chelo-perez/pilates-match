-- PENDIENTE: no aplicada todavía.
-- =====================================================================
-- Cambios de base para la revisión completa de la app (2026-11-03)
-- =====================================================================

-- 1. Propuestas "regulares": días y franja horaria (antes la app mandaba
--    columnas inexistentes y toda propuesta regular fallaba)
ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS schedule_days public.day_of_week[],
  ADD COLUMN IF NOT EXISTS schedule_from time,
  ADD COLUMN IF NOT EXISTS schedule_to   time;

-- 2. La Cámara ve todas las propuestas (Reportes mostraba siempre 0)
DROP POLICY IF EXISTS matches_admin_read ON public.matches;
CREATE POLICY matches_admin_read ON public.matches FOR SELECT TO authenticated USING (public.is_admin());

-- 3. El admin de una Cámara puede editar el perfil de SU Cámara
DROP POLICY IF EXISTS camaras_admin_update ON public.camaras;
CREATE POLICY camaras_admin_update ON public.camaras FOR UPDATE TO authenticated
  USING (public.auth_role() = 'camara_admin' AND id = (SELECT camara_id FROM public.users WHERE id = auth.uid()))
  WITH CHECK (id = (SELECT camara_id FROM public.users WHERE id = auth.uid()));

-- 4. Motivo de rechazo/corrección visible para el instructor
ALTER TABLE public.instructors ADD COLUMN IF NOT EXISTS verification_note text;

CREATE OR REPLACE FUNCTION public.guard_instructors_write()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF current_user NOT IN ('anon', 'authenticated') OR public.is_admin() THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.verification_status := 'pendiente';
    NEW.verified_at := NULL;
    NEW.verified_by := NULL;
    NEW.verification_note := NULL;
  ELSE
    NEW.verification_status := OLD.verification_status;
    NEW.verified_at := OLD.verified_at;
    NEW.verified_by := OLD.verified_by;
    NEW.verification_note := OLD.verification_note;
    NEW.user_id := OLD.user_id;
    NEW.added_by_studio := OLD.added_by_studio;
    NEW.camara_id := OLD.camara_id;
  END IF;
  RETURN NEW;
END;
$$;

-- 5. Notas internas de la Cámara sobre estudios (la app escribía en una tabla inexistente)
CREATE TABLE IF NOT EXISTS public.camara_studio_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id uuid NOT NULL REFERENCES public.studios(id) ON DELETE CASCADE,
  note text NOT NULL,
  created_by uuid DEFAULT auth.uid() REFERENCES public.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.camara_studio_notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS camara_studio_notes_admin ON public.camara_studio_notes;
CREATE POLICY camara_studio_notes_admin ON public.camara_studio_notes FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
REVOKE ALL ON public.camara_studio_notes FROM anon;

-- 6. Las propuestas sin respuesta vencen solas (expires_at) cada hora
CREATE OR REPLACE FUNCTION public.expire_pending_matches()
RETURNS integer
LANGUAGE sql SECURITY DEFINER
SET search_path = ''
AS $$
  WITH u AS (
    UPDATE public.matches SET status = 'expirado'
    WHERE status = 'pendiente' AND expires_at < now()
    RETURNING 1
  ) SELECT count(*)::integer FROM u;
$$;
REVOKE EXECUTE ON FUNCTION public.expire_pending_matches() FROM PUBLIC, anon, authenticated;
SELECT cron.unschedule('expire-pending-matches') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'expire-pending-matches');
SELECT cron.schedule('expire-pending-matches', '7 * * * *', 'SELECT public.expire_pending_matches()');

-- 7. e2e_cleanup: también borra notas de estudios de prueba (cascada ya lo cubre)
