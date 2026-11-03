-- =====================================================================
-- Reglas de negocio del lado del servidor (revisión 2026-11-03)
--
--  1. Un estudio ya no puede darse membresía ni matches ilimitados al
--     registrarse: el código de la Cámara queda como pedido y la Cámara
--     activa la membresía. Al registrarse, el estudio recibe Freemium (1/mes).
--  2. El límite de matches se controla en la base: cada match nuevo se
--     cuenta al insertarse y se rechaza si se pasó del límite.
--  3. Reclamar un perfil del directorio exige el DNI cuando el perfil lo
--     tiene, y el perfil vuelve a "pendiente" hasta que la Cámara lo revise.
--  4. Estudios sin membresía reciben la que les corresponde.
-- =====================================================================

-- ── 1. Estudios: membresía y cámara las asigna solo un admin ──────────
CREATE OR REPLACE FUNCTION public.guard_studios_write()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF current_user NOT IN ('anon', 'authenticated') OR public.is_admin() THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.is_member := false;
    NEW.member_since := NULL;
    NEW.camara_id := NULL;
  ELSE
    NEW.is_member := OLD.is_member;
    NEW.member_since := OLD.member_since;
    NEW.camara_id := OLD.camara_id;
    NEW.user_id := OLD.user_id;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_guard_studios_write ON public.studios;
CREATE TRIGGER trg_guard_studios_write
  BEFORE INSERT OR UPDATE ON public.studios
  FOR EACH ROW EXECUTE FUNCTION public.guard_studios_write();

-- El estudio solo puede crearse su membresía Freemium inicial
DROP POLICY IF EXISTS studio_insert_own_membership ON public.memberships;
CREATE POLICY studio_insert_own_membership ON public.memberships FOR INSERT TO authenticated
  WITH CHECK (
    studio_id IN (SELECT id FROM public.studios WHERE user_id = auth.uid())
    AND plan_type = 'freemium'
    AND matches_limit = 1
    AND matches_used_month = 0
    AND status = 'activa'
  );

-- ── 2. Límite de matches en la base ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.can_studio_match(p_studio_id uuid)
RETURNS boolean
LANGUAGE sql STABLE
SET search_path = ''
AS $$
  SELECT COALESCE((
    SELECT m.matches_limit IS NULL
        OR (CASE WHEN m.last_reset_date < date_trunc('month', CURRENT_DATE)::date
                 THEN 0 ELSE m.matches_used_month END) < m.matches_limit
    FROM public.memberships m
    WHERE m.studio_id = p_studio_id AND m.status = 'activa'
  ), false);
$$;

CREATE OR REPLACE FUNCTION public.enforce_match_limit()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  m public.memberships%ROWTYPE;
BEGIN
  -- La Cámara puede crear matches sin límite
  IF public.is_admin() THEN RETURN NEW; END IF;

  SELECT * INTO m FROM public.memberships
  WHERE studio_id = NEW.studio_id AND status = 'activa'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'MATCH_LIMIT_REACHED' USING ERRCODE = 'P0001';
  END IF;

  -- Reinicio mensual por si el cron no corrió
  IF m.last_reset_date < date_trunc('month', CURRENT_DATE)::date THEN
    m.matches_used_month := 0;
  END IF;

  IF m.matches_limit IS NOT NULL AND m.matches_used_month >= m.matches_limit THEN
    RAISE EXCEPTION 'MATCH_LIMIT_REACHED' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.memberships
  SET matches_used_month = m.matches_used_month + 1,
      last_reset_date = GREATEST(m.last_reset_date, date_trunc('month', CURRENT_DATE)::date)
  WHERE id = m.id;

  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.enforce_match_limit() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_enforce_match_limit ON public.matches;
CREATE TRIGGER trg_enforce_match_limit
  BEFORE INSERT ON public.matches
  FOR EACH ROW EXECUTE FUNCTION public.enforce_match_limit();

-- El contador ahora lo maneja el trigger: la app ya no lo llama
REVOKE EXECUTE ON FUNCTION public.increment_match_counter(uuid) FROM authenticated;

-- ── 3. Reclamar perfil: DNI y nueva verificación ─────────────────────
DROP FUNCTION IF EXISTS public.claim_instructor_profile(uuid);
CREATE OR REPLACE FUNCTION public.claim_instructor_profile(p_instructor_id uuid, p_dni text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_dni text;
BEGIN
  IF auth.uid() IS NULL OR public.auth_role() IS DISTINCT FROM 'instructor' THEN
    RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (SELECT 1 FROM public.instructors WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Ya tenés un perfil de instructor';
  END IF;

  SELECT dni INTO v_dni FROM public.instructors
  WHERE id = p_instructor_id AND user_id IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'El perfil ya fue reclamado o no existe'; END IF;

  IF v_dni IS NOT NULL
     AND regexp_replace(v_dni, '\D', '', 'g') <> regexp_replace(coalesce(p_dni, ''), '\D', '', 'g') THEN
    RAISE EXCEPTION 'El DNI no coincide con el del perfil';
  END IF;

  -- Vuelve a pendiente: la Cámara confirma que es la misma persona
  UPDATE public.instructors
  SET user_id = auth.uid(),
      verification_status = 'pendiente',
      verified_at = NULL,
      verified_by = NULL
  WHERE id = p_instructor_id;

  RETURN p_instructor_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.claim_instructor_profile(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_instructor_profile(uuid, text) TO authenticated;

-- ── 4. Estudios existentes sin membresía ─────────────────────────────
-- Socios de la Cámara -> plan Socio (5/mes); el resto -> Freemium (1/mes)
-- Vencimiento como en la app: Freemium a 10 años, socio a 1 año
INSERT INTO public.memberships (studio_id, status, plan_type, matches_limit, matches_used_month, start_date, end_date, last_reset_date)
SELECT s.id, 'activa',
       CASE WHEN s.is_member THEN 'socio' ELSE 'freemium' END,
       CASE WHEN s.is_member THEN 5 ELSE 1 END,
       0, CURRENT_DATE,
       CASE WHEN s.is_member THEN CURRENT_DATE + interval '1 year' ELSE CURRENT_DATE + interval '10 years' END,
       CURRENT_DATE
FROM public.studios s
WHERE NOT EXISTS (SELECT 1 FROM public.memberships m WHERE m.studio_id = s.id);
