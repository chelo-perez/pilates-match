-- =====================================================================
-- Endurecimiento de seguridad (revisión 2026-11-03)
--
-- Problemas que corrige:
--  1. users / instructors / instructor_availabilities tenían RLS apagado:
--     con la clave pública de la app cualquiera podía leer y modificar
--     emails, teléfonos, DNI, roles y estados de verificación.
--  2. handle_new_user tomaba el rol de los metadatos del signUp: cualquiera
--     podía registrarse como camara_admin o super_admin.
--  3. Un usuario podía cambiarse su propio rol y un instructor podía
--     marcarse a sí mismo como verificado.
--  4. TRUNCATE estaba concedido a anon/authenticated (TRUNCATE ignora RLS).
--  5. increment_match_counter se podía llamar sin sesión para cualquier estudio.
--  6. Los instructores no podían responder sus matches (no había policy de UPDATE).
--  7. Funciones sin search_path fijo.
--  8. instructors.user_id y studios.user_id no eran únicos: los upsert de
--     "Elegí tu rol" fallaban y el usuario quedaba sin perfil/estudio.
-- =====================================================================

-- ── Unicidad que necesitan los upsert de la app ─────────────────────
ALTER TABLE public.instructors ADD CONSTRAINT instructors_user_id_key UNIQUE (user_id);
ALTER TABLE public.studios     ADD CONSTRAINT studios_user_id_key     UNIQUE (user_id);

-- ── Funciones auxiliares ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.auth_role()
RETURNS public.user_role
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT role FROM public.users WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(public.auth_role() IN ('camara_admin', 'super_admin'), false);
$$;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- Solo se aceptan roles no administrativos desde el registro
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.users (id, email, role, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    CASE WHEN NEW.raw_user_meta_data->>'role' IN ('estudio', 'instructor')
         THEN (NEW.raw_user_meta_data->>'role')::public.user_role
         ELSE 'estudio'::public.user_role END,
    NEW.raw_user_meta_data->>'full_name'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'handle_new_user error: %', SQLERRM;
    RETURN NEW;
END;
$$;
-- Es una función de trigger: no tiene que poder llamarse por la API
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- Solo el dueño del estudio (o un admin) puede sumar matches a su contador
CREATE OR REPLACE FUNCTION public.increment_match_counter(p_studio_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT (public.is_admin() OR EXISTS (
    SELECT 1 FROM public.studios s WHERE s.id = p_studio_id AND s.user_id = auth.uid()
  )) THEN
    RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501';
  END IF;
  UPDATE public.memberships
  SET matches_used_month = matches_used_month + 1
  WHERE studio_id = p_studio_id AND status = 'activa';
END;
$$;
REVOKE EXECUTE ON FUNCTION public.increment_match_counter(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.increment_match_counter(uuid) TO authenticated;

-- search_path fijo en el resto de las funciones
ALTER FUNCTION public.can_studio_match(uuid)      SET search_path = public;
ALTER FUNCTION public.reset_monthly_matches()     SET search_path = public;
ALTER FUNCTION public.update_updated_at()         SET search_path = public;
ALTER FUNCTION public.notify_instructor_on_match() SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.reset_monthly_matches() FROM PUBLIC, anon, authenticated;

-- ── TRUNCATE ignora RLS: nadie desde la API debe poder usarlo ────────
DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('REVOKE TRUNCATE, TRIGGER, REFERENCES ON public.%I FROM anon, authenticated', t.tablename);
  END LOOP;
END $$;

-- ── users ────────────────────────────────────────────────────────────

-- Un usuario no puede darse rol de admin ni cambiar de cámara
CREATE OR REPLACE FUNCTION public.guard_users_write()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  -- Solo aplica a pedidos desde la API (no a funciones SECURITY DEFINER ni al panel)
  IF current_user NOT IN ('anon', 'authenticated') THEN RETURN NEW; END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.role NOT IN ('estudio', 'instructor') THEN NEW.role := 'estudio'; END IF;
    NEW.camara_id := NULL;
  ELSE
    NEW.id := OLD.id;
    NEW.camara_id := OLD.camara_id;
    -- Solo se permite elegir entre estudio e instructor (pantalla "Elegí tu rol")
    IF NOT (OLD.role IN ('estudio', 'instructor') AND NEW.role IN ('estudio', 'instructor')) THEN
      NEW.role := OLD.role;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_guard_users_write ON public.users;
CREATE TRIGGER trg_guard_users_write
  BEFORE INSERT OR UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.guard_users_write();

DROP POLICY IF EXISTS users_own ON public.users;
DROP POLICY IF EXISTS camara_read_users ON public.users;
CREATE POLICY users_select_own   ON public.users FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY users_admin_read   ON public.users FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY users_insert_own   ON public.users FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY users_update_own   ON public.users FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

REVOKE ALL ON public.users FROM anon;
REVOKE DELETE ON public.users FROM authenticated;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- ── instructors ──────────────────────────────────────────────────────

-- Un instructor no puede verificarse solo ni cambiar de dueño su perfil
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
  ELSE
    NEW.verification_status := OLD.verification_status;
    NEW.verified_at := OLD.verified_at;
    NEW.verified_by := OLD.verified_by;
    NEW.user_id := OLD.user_id;
    NEW.added_by_studio := OLD.added_by_studio;
    NEW.camara_id := OLD.camara_id;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_guard_instructors_write ON public.instructors;
CREATE TRIGGER trg_guard_instructors_write
  BEFORE INSERT OR UPDATE ON public.instructors
  FOR EACH ROW EXECUTE FUNCTION public.guard_instructors_write();

DROP POLICY IF EXISTS camara_manage_instructors   ON public.instructors;
DROP POLICY IF EXISTS instructor_own              ON public.instructors;
DROP POLICY IF EXISTS instructors_public_read     ON public.instructors;
DROP POLICY IF EXISTS studio_read_all_instructors ON public.instructors;
CREATE POLICY instructors_admin_all   ON public.instructors FOR ALL    TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY instructors_select_own  ON public.instructors FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY instructors_studio_read ON public.instructors FOR SELECT TO authenticated USING (public.auth_role() = 'estudio');
CREATE POLICY instructors_insert_own  ON public.instructors FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND public.auth_role() = 'instructor');
CREATE POLICY instructors_update_own  ON public.instructors FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

REVOKE ALL ON public.instructors FROM anon;
ALTER TABLE public.instructors ENABLE ROW LEVEL SECURITY;

-- Búsqueda de perfiles sin dueño en el registro (todavía sin sesión):
-- devuelve solo datos no sensibles, nunca DNI, email ni teléfono.
CREATE OR REPLACE FUNCTION public.search_unclaimed_instructors(p_query text)
RETURNS TABLE(id uuid, full_name text, neighborhood text, verification_status public.verification_status)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT i.id, i.full_name, i.neighborhood, i.verification_status
  FROM public.instructors i
  WHERE i.user_id IS NULL
    AND length(trim(p_query)) >= 3
    AND i.full_name ILIKE '%' || trim(p_query) || '%'
  ORDER BY i.full_name
  LIMIT 5;
$$;
REVOKE EXECUTE ON FUNCTION public.search_unclaimed_instructors(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_unclaimed_instructors(text) TO anon, authenticated;

-- Reclamar un perfil del directorio (solo si no tiene dueño y el usuario no tiene otro)
CREATE OR REPLACE FUNCTION public.claim_instructor_profile(p_instructor_id uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL OR public.auth_role() IS DISTINCT FROM 'instructor' THEN
    RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (SELECT 1 FROM public.instructors WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Ya tenés un perfil de instructor';
  END IF;
  UPDATE public.instructors SET user_id = auth.uid()
  WHERE id = p_instructor_id AND user_id IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'El perfil ya fue reclamado o no existe'; END IF;
  RETURN p_instructor_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.claim_instructor_profile(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_instructor_profile(uuid) TO authenticated;

-- ── instructor_availabilities (tabla vieja, la app usa "availability") ──
CREATE POLICY inst_avail_read ON public.instructor_availabilities FOR SELECT TO authenticated USING (true);
CREATE POLICY inst_avail_own  ON public.instructor_availabilities FOR ALL TO authenticated
  USING (instructor_id IN (SELECT id FROM public.instructors WHERE user_id = auth.uid()))
  WITH CHECK (instructor_id IN (SELECT id FROM public.instructors WHERE user_id = auth.uid()));
REVOKE ALL ON public.instructor_availabilities FROM anon;
ALTER TABLE public.instructor_availabilities ENABLE ROW LEVEL SECURITY;

-- ── Certificados y disponibilidad: solo usuarios logueados ───────────
ALTER POLICY cert_public_read          ON public.certifications TO authenticated;
ALTER POLICY availability_public_read  ON public.availability   TO authenticated;

-- ── matches: el instructor puede responder sus propios matches ───────
CREATE POLICY instructor_respond_own_matches ON public.matches FOR UPDATE TO authenticated
  USING (instructor_id IN (SELECT id FROM public.instructors WHERE user_id = auth.uid()))
  WITH CHECK (instructor_id IN (SELECT id FROM public.instructors WHERE user_id = auth.uid()));
