-- =====================================================================
-- Red de prueba (QA) — 2026-11-05
-- Autorizado por el dueño de la plataforma para revisar visualmente el panel de la entidad.
--  * Red "Red de prueba (QA)" inactiva: no aparece en el registro
--  * Las cuentas de prueba (@e2e.pilatesmatch.test y @qa.pilatesmatch.test) quedan siempre en esa red
--  * Administrador de prueba qa-camara@qa.pilatesmatch.test (se crea al registrarse, por invitación).
--    Solo ve la red de prueba y no puede cambiar su equipo.
--  * e2e_cleanup borra los datos de la red de prueba (no toca la red real)
-- =====================================================================

INSERT INTO public.camaras (name, slug, is_active, sector, business_label, instructor_label, entity_type, entity_article,
                            revenue_share_pct, city, country)
VALUES ('Red de prueba (QA)', 'qa-pruebas', false, 'pilates', 'Estudio de Pilates', 'Instructor/a de Pilates', 'Cámara', 'la',
        25, 'Buenos Aires', 'Argentina')
ON CONFLICT (slug) DO NOTHING;

CREATE OR REPLACE FUNCTION public.qa_camara_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $fn$
  SELECT id FROM public.camaras WHERE slug = 'qa-pruebas';
$fn$;

CREATE OR REPLACE FUNCTION public.is_test_user(p_user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $fn$
  SELECT EXISTS (SELECT 1 FROM public.users WHERE id = p_user
                 AND (email LIKE '%@e2e.pilatesmatch.test' OR email LIKE '%@qa.pilatesmatch.test'));
$fn$;
REVOKE EXECUTE ON FUNCTION public.qa_camara_id(), public.is_test_user(uuid) FROM PUBLIC, anon, authenticated;

-- Red de un registro nuevo: prueba -> red de prueba; admin que carga en su red -> esa; si no, la elegida o la principal
CREATE OR REPLACE FUNCTION public.camara_for_insert(p_user uuid, p_camara uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $fn$
  SELECT CASE
    WHEN public.is_test_user(coalesce(p_user, auth.uid())) THEN public.qa_camara_id()
    WHEN p_camara IS NOT NULL AND public.manages_camara(p_camara) THEN p_camara
    ELSE public.resolve_camara(p_camara) END;
$fn$;
REVOKE EXECUTE ON FUNCTION public.camara_for_insert(uuid, uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.guard_studios_write()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $fn$
BEGIN
  IF TG_OP = 'INSERT' THEN NEW.camara_id := public.camara_for_insert(NEW.user_id, NEW.camara_id); END IF;
  IF current_user NOT IN ('anon', 'authenticated') OR public.is_admin() THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.is_member := false;
    NEW.member_since := NULL;
  ELSE
    NEW.is_member := OLD.is_member;
    NEW.member_since := OLD.member_since;
    NEW.camara_id := OLD.camara_id;
    NEW.user_id := OLD.user_id;
  END IF;
  RETURN NEW;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.guard_instructors_write()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $fn$
BEGIN
  IF TG_OP = 'INSERT' THEN NEW.camara_id := public.camara_for_insert(NEW.user_id, NEW.camara_id); END IF;
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
$fn$;

-- El equipo de la red de prueba no se puede cambiar (salvo la plataforma)
CREATE OR REPLACE FUNCTION public.invite_camara_admin(p_email text, p_camara uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE
  v_email text := lower(trim(p_email));
  u record;
BEGIN
  IF NOT public.manages_camara(p_camara) THEN RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501'; END IF;
  IF p_camara = public.qa_camara_id() AND NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'La red de prueba no admite cambios de equipo';
  END IF;
  IF v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' THEN RAISE EXCEPTION 'Revisá el email'; END IF;
  SELECT id, role, camara_id INTO u FROM public.users WHERE lower(email) = v_email;
  IF FOUND THEN
    IF u.role = 'super_admin' THEN RAISE EXCEPTION 'Esa cuenta es de la plataforma'; END IF;
    IF u.role = 'camara_admin' AND u.camara_id = p_camara THEN RETURN 'promoted'; END IF;
    IF u.role = 'camara_admin' THEN RAISE EXCEPTION 'Esa cuenta ya administra otra red'; END IF;
    IF EXISTS (SELECT 1 FROM public.studios WHERE user_id = u.id)
       OR EXISTS (SELECT 1 FROM public.instructors WHERE user_id = u.id) THEN
      RAISE EXCEPTION 'Esa cuenta ya es de un estudio o un instructor. Pedile que use otro email.';
    END IF;
    UPDATE public.users SET role = 'camara_admin', camara_id = p_camara WHERE id = u.id;
    DELETE FROM public.camara_admin_invites WHERE email = v_email;
    RETURN 'promoted';
  END IF;
  INSERT INTO public.camara_admin_invites (email, camara_id, invited_by)
  VALUES (v_email, p_camara, auth.uid())
  ON CONFLICT (email) DO UPDATE SET camara_id = EXCLUDED.camara_id, invited_by = EXCLUDED.invited_by, created_at = now();
  RETURN 'invited';
END;
$fn$;

CREATE OR REPLACE FUNCTION public.remove_camara_admin(p_user uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE u record;
BEGIN
  SELECT id, role, camara_id INTO u FROM public.users WHERE id = p_user;
  IF NOT FOUND OR u.role <> 'camara_admin' OR NOT public.manages_camara(u.camara_id) THEN
    RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501';
  END IF;
  IF u.camara_id = public.qa_camara_id() AND NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'La red de prueba no admite cambios de equipo';
  END IF;
  IF p_user = auth.uid() THEN RAISE EXCEPTION 'No podés quitarte a vos mismo'; END IF;
  UPDATE public.users SET role = 'estudio', camara_id = NULL WHERE id = p_user;
  DELETE FROM public.push_tokens WHERE user_id = p_user;
END;
$fn$;

-- Administrador de prueba: entra por invitación al registrarse
INSERT INTO public.camara_admin_invites (email, camara_id)
SELECT 'qa-camara@qa.pilatesmatch.test', public.qa_camara_id()
WHERE NOT EXISTS (SELECT 1 FROM public.users WHERE email = 'qa-camara@qa.pilatesmatch.test')
ON CONFLICT (email) DO NOTHING;

-- Limpieza de pruebas: cuentas @e2e y todo lo cargado en la red de prueba (nunca la red real)
CREATE OR REPLACE FUNCTION public.e2e_cleanup()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE
  v_qa uuid := public.qa_camara_id();
  v_users uuid[];
  v_count integer := 0;
BEGIN
  SELECT array_agg(id) INTO v_users FROM auth.users WHERE email LIKE '%@e2e.pilatesmatch.test';
  DELETE FROM public.studio_evaluations
  WHERE camara_id = v_qa
     OR studio_id IN (SELECT id FROM public.studios WHERE user_id = ANY(coalesce(v_users, '{}')))
     OR instructor_id IN (SELECT id FROM public.instructors WHERE user_id = ANY(coalesce(v_users, '{}')));
  DELETE FROM public.evaluations
  WHERE camara_id = v_qa
     OR studio_id IN (SELECT id FROM public.studios WHERE user_id = ANY(coalesce(v_users, '{}')))
     OR instructor_id IN (SELECT id FROM public.instructors WHERE user_id = ANY(coalesce(v_users, '{}')));
  DELETE FROM public.matches
  WHERE camara_id = v_qa
     OR studio_id IN (SELECT id FROM public.studios WHERE user_id = ANY(coalesce(v_users, '{}')))
     OR instructor_id IN (SELECT id FROM public.instructors WHERE user_id = ANY(coalesce(v_users, '{}')));
  DELETE FROM public.camara_instructor_notes WHERE camara_id = v_qa;
  DELETE FROM public.instructors WHERE user_id = ANY(coalesce(v_users, '{}')) OR (camara_id = v_qa AND user_id IS NULL);
  IF v_users IS NOT NULL THEN
    DELETE FROM auth.users WHERE id = ANY(v_users);
    GET DIAGNOSTICS v_count = ROW_COUNT;
  END IF;
  RETURN v_count;
END;
$fn$;

-- Los guards corren con el rol de quien inserta: necesitan poder llamar a camara_for_insert
GRANT EXECUTE ON FUNCTION public.camara_for_insert(uuid, uuid) TO authenticated;
