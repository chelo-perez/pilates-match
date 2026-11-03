-- PRUEBA SIN CAMBIOS: corre la migración + pruebas por rol y al final falla a propósito, así que TODO se deshace.
-- Copiá el texto del error que empieza con RESULTADOS y pegáselo a Claude.
BEGIN;
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
-- =====================================================================

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

DO $t$
DECLARE
  r text := '';
  v text;
  n int;
  EST constant uuid := '1b8e50d3-60eb-4551-a1d0-e78aa34b7912';
  EST_STUDIO constant uuid := '378a566f-adea-4522-b657-d4018db3b9c4';
  OTHER_STUDIO constant uuid := '4fc13cba-227b-4873-92e7-1cb623c70693';
  INS constant uuid := 'bd3251de-b6e6-435a-bce3-4fd562d183aa';
  INS_ID constant uuid := '1382ab0b-f361-47a6-a995-246c52f990c4';
  OTHER_INS_ID constant uuid := '7f54e565-1e75-4938-aae8-b57b5c14fb8c';
  CAM constant uuid := 'b8b9430e-6c55-4448-a0ec-a5b9e9483c3e';
  NEWU constant uuid := '00000000-0000-4000-8000-00000000abcd';
BEGIN
  -- ===== anon =====
  BEGIN SET LOCAL ROLE anon; PERFORM set_config('request.jwt.claims', '{"role":"anon"}', true);
    BEGIN SELECT count(*) INTO n FROM public.users; r := r||E'\nA1 anon lee users: PERMITIDO('||n||')'; EXCEPTION WHEN others THEN r := r||E'\nA1 anon lee users: bloqueado'; END;
    BEGIN SELECT count(*) INTO n FROM public.instructors; r := r||E'\nA2 anon lee instructors: PERMITIDO('||n||')'; EXCEPTION WHEN others THEN r := r||E'\nA2 anon lee instructors: bloqueado'; END;
    BEGIN SELECT count(*) INTO n FROM public.certifications; r := r||E'\nA3 anon lee certifications: filas='||n; EXCEPTION WHEN others THEN r := r||E'\nA3 anon lee certifications: bloqueado'; END;
    BEGIN SELECT count(*) INTO n FROM public.search_unclaimed_instructors('Cla'); r := r||E'\nA4 anon busca perfiles sin dueño: ok filas='||n; EXCEPTION WHEN others THEN r := r||E'\nA4 anon busca perfiles: ERROR '||SQLERRM; END;
    BEGIN PERFORM public.increment_match_counter(EST_STUDIO); r := r||E'\nA5 anon increment: PERMITIDO'; EXCEPTION WHEN others THEN r := r||E'\nA5 anon increment: bloqueado'; END;
    BEGIN EXECUTE 'TRUNCATE public.matches'; r := r||E'\nA6 anon truncate: PERMITIDO'; EXCEPTION WHEN others THEN r := r||E'\nA6 anon truncate: bloqueado'; END;
    BEGIN PERFORM public.get_instructor_stats(INS_ID); r := r||E'\nA7 anon stats: PERMITIDO'; EXCEPTION WHEN others THEN r := r||E'\nA7 anon stats: bloqueado'; END;
  RESET ROLE; END;

  -- ===== estudio =====
  BEGIN SET LOCAL ROLE authenticated; PERFORM set_config('request.jwt.claims', json_build_object('sub',EST,'role','authenticated')::text, true);
    SELECT count(*) INTO n FROM public.users; r := r||E'\nE1 estudio ve users: '||n||' (esperado 1)';
    SELECT count(*) INTO n FROM public.instructors; r := r||E'\nE2 estudio ve instructors: '||n||' (esperado 2)';
    SELECT count(*) INTO n FROM public.instructors i LEFT JOIN public.instructor_rates ra ON ra.instructor_id=i.id WHERE i.verification_status='verificado' AND i.is_active; r := r||E'\nE3 query búsqueda verificados: '||n;
    UPDATE public.users SET role='camara_admin', camara_id=NULL WHERE id=EST; SELECT role||'/'||coalesce(camara_id::text,'null') INTO v FROM public.users WHERE id=EST; r := r||E'\nE4 estudio intenta ser admin -> '||v;
    UPDATE public.instructors SET verification_status='rechazado' WHERE id=INS_ID; GET DIAGNOSTICS n = ROW_COUNT; r := r||E'\nE5 estudio edita instructor: filas='||n||' (esperado 0)';
    BEGIN PERFORM public.increment_match_counter(EST_STUDIO); r := r||E'\nE6 increment propio: ok'; EXCEPTION WHEN others THEN r := r||E'\nE6 increment propio: ERROR '||SQLERRM; END;
    BEGIN PERFORM public.increment_match_counter(OTHER_STUDIO); r := r||E'\nE7 increment ajeno: PERMITIDO'; EXCEPTION WHEN others THEN r := r||E'\nE7 increment ajeno: bloqueado'; END;
    BEGIN SELECT total_evaluations::text INTO v FROM public.get_instructor_stats(INS_ID); r := r||E'\nE8 stats: ok'; EXCEPTION WHEN others THEN r := r||E'\nE8 stats: ERROR '||SQLERRM; END;
    BEGIN SELECT count(*) INTO n FROM public.memberships; r := r||E'\nE9 estudio ve memberships: '||n; EXCEPTION WHEN others THEN r := r||E'\nE9 memberships: ERROR '||SQLERRM; END;
    BEGIN DELETE FROM public.users WHERE id=EST; r := r||E'\nE10 estudio borra su user: PERMITIDO'; EXCEPTION WHEN others THEN r := r||E'\nE10 estudio borra su user: bloqueado'; END;
  RESET ROLE; END;

  -- ===== instructor =====
  BEGIN SET LOCAL ROLE authenticated; PERFORM set_config('request.jwt.claims', json_build_object('sub',INS,'role','authenticated')::text, true);
    SELECT count(*) INTO n FROM public.instructors; r := r||E'\nI1 instructor ve instructors: '||n||' (esperado 1)';
    SELECT count(*) INTO n FROM public.users; r := r||E'\nI2 instructor ve users: '||n||' (esperado 1)';
    UPDATE public.instructors SET bio='test bio', verification_status='verificado', user_id=EST, is_active=false WHERE id=INS_ID; GET DIAGNOSTICS n = ROW_COUNT;
    SELECT coalesce(bio,'')||' / '||verification_status||' / dueño_igual='||(user_id=INS)::text||' / activo='||is_active::text INTO v FROM public.instructors WHERE id=INS_ID; r := r||E'\nI3 instructor edita perfil (filas '||n||'): '||v;
    UPDATE public.instructors SET bio='x' WHERE id=OTHER_INS_ID; GET DIAGNOSTICS n = ROW_COUNT; r := r||E'\nI4 instructor edita otro: filas='||n||' (esperado 0)';
    BEGIN UPDATE public.matches SET note_instructor='ok' WHERE instructor_id=INS_ID; GET DIAGNOSTICS n = ROW_COUNT; r := r||E'\nI5 responder matches propios: ok filas='||n; EXCEPTION WHEN others THEN r := r||E'\nI5 matches: ERROR '||SQLERRM; END;
    BEGIN SELECT count(*) INTO n FROM public.availability; r := r||E'\nI6 lee availability: '||n; EXCEPTION WHEN others THEN r := r||E'\nI6 availability: ERROR '||SQLERRM; END;
    BEGIN PERFORM public.claim_instructor_profile(OTHER_INS_ID); r := r||E'\nI7 reclamar perfil ajeno: PERMITIDO'; EXCEPTION WHEN others THEN r := r||E'\nI7 reclamar perfil ajeno: bloqueado ('||SQLERRM||')'; END;
  RESET ROLE; END;

  -- ===== camara_admin =====
  BEGIN SET LOCAL ROLE authenticated; PERFORM set_config('request.jwt.claims', json_build_object('sub',CAM,'role','authenticated')::text, true);
    SELECT count(*) INTO n FROM public.users; r := r||E'\nC1 cámara ve users: '||n||' (esperado 7)';
    SELECT count(*) INTO n FROM public.instructors; r := r||E'\nC2 cámara ve instructors: '||n||' (esperado 2)';
    UPDATE public.instructors SET verification_status='verificado', verified_at=now(), verified_by=CAM WHERE id=OTHER_INS_ID; GET DIAGNOSTICS n = ROW_COUNT;
    SELECT verification_status::text INTO v FROM public.instructors WHERE id=OTHER_INS_ID; r := r||E'\nC3 cámara verifica (filas '||n||'): '||v;
    UPDATE public.instructors SET is_active=false WHERE id=INS_ID; GET DIAGNOSTICS n = ROW_COUNT; r := r||E'\nC4 cámara desactiva: filas='||n;
    BEGIN SELECT count(*) INTO n FROM public.studios s LEFT JOIN public.users u ON u.id=s.user_id; r := r||E'\nC5 estudios+email: '||n; EXCEPTION WHEN others THEN r := r||E'\nC5: ERROR '||SQLERRM; END;
  RESET ROLE; END;

  -- ===== registro nuevo que pide rol admin =====
  BEGIN
    INSERT INTO auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
    VALUES (NEWU, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-test@example.com', '{"role":"camara_admin","full_name":"Test"}', now(), now());
    SELECT role::text INTO v FROM public.users WHERE id=NEWU; r := r||E'\nS1 signUp pidiendo camara_admin -> '||coalesce(v,'(sin fila)');
  EXCEPTION WHEN others THEN r := r||E'\nS1 signUp: ERROR '||SQLERRM; END;

  -- ===== registro de instructor (flujo SelectRole) =====
  BEGIN SET LOCAL ROLE authenticated; PERFORM set_config('request.jwt.claims', json_build_object('sub',NEWU,'role','authenticated')::text, true);
    INSERT INTO public.users (id, email, full_name, role) VALUES (NEWU, 'rls-test@example.com', 'Test', 'instructor')
      ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, full_name = EXCLUDED.full_name;
    SELECT role::text INTO v FROM public.users WHERE id=NEWU; r := r||E'\nS2 elige rol instructor -> '||v;
    INSERT INTO public.instructors (user_id, full_name, verification_status, is_active) VALUES (NEWU, 'Test', 'verificado', true)
      ON CONFLICT (user_id) DO UPDATE SET full_name = EXCLUDED.full_name;
    SELECT verification_status::text INTO v FROM public.instructors WHERE user_id=NEWU; r := r||E'\nS3 crea perfil pidiendo verificado -> '||v;
  EXCEPTION WHEN others THEN r := r||E'\nS2/S3: ERROR '||SQLERRM; END;
  RESET ROLE;

  RAISE EXCEPTION 'RESULTADOS:%', r;
END
$t$;
