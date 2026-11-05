-- =====================================================================
-- Preparación para Play Store — 2026-11-05
--  1. Eliminar la cuenta desde la app (Google lo exige)
--  2. La limpieza de pruebas solo la puede correr una cuenta de prueba
-- =====================================================================

-- ── 1. Eliminar mi cuenta ────────────────────────────────────────────
-- Borra el perfil, sus propuestas, evaluaciones, horarios, certificados y el acceso.
-- Los cobros ya hechos quedan (sin el estudio) porque son registros contables.
CREATE OR REPLACE FUNCTION public.delete_my_account()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE
  v_uid uuid := auth.uid();
  v_role text;
  v_studios uuid[];
  v_instructors uuid[];
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501'; END IF;
  SELECT role::text INTO v_role FROM public.users WHERE id = v_uid;
  IF v_role = 'super_admin' THEN
    RAISE EXCEPTION 'La cuenta de la plataforma no se puede eliminar desde la app';
  END IF;

  SELECT coalesce(array_agg(id), '{}') INTO v_studios FROM public.studios WHERE user_id = v_uid;
  SELECT coalesce(array_agg(id), '{}') INTO v_instructors FROM public.instructors WHERE user_id = v_uid;

  DELETE FROM public.studio_evaluations WHERE studio_id = ANY(v_studios) OR instructor_id = ANY(v_instructors);
  DELETE FROM public.evaluations        WHERE studio_id = ANY(v_studios) OR instructor_id = ANY(v_instructors);
  DELETE FROM public.matches            WHERE studio_id = ANY(v_studios) OR instructor_id = ANY(v_instructors);
  UPDATE public.instructors SET added_by_studio = NULL WHERE added_by_studio = ANY(v_studios);
  DELETE FROM public.instructors WHERE id = ANY(v_instructors);

  -- Referencias de lo que hizo como administrador de una entidad
  UPDATE public.instructors SET verified_by = NULL WHERE verified_by = v_uid;
  UPDATE public.rate_ranges SET updated_by = NULL WHERE updated_by = v_uid;
  UPDATE public.camara_rate_ranges SET updated_by = NULL WHERE updated_by = v_uid;
  UPDATE public.camara_instructor_notes SET created_by = NULL WHERE created_by = v_uid;
  UPDATE public.camara_studio_notes SET created_by = NULL WHERE created_by = v_uid;
  UPDATE public.camara_admin_invites SET invited_by = NULL WHERE invited_by = v_uid;

  -- El resto (estudio, membresía, suscripciones, avisos, push) se borra en cascada
  DELETE FROM auth.users WHERE id = v_uid;
END;
$fn$;
REVOKE EXECUTE ON FUNCTION public.delete_my_account() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_my_account() TO authenticated;

-- ── 2. Limpieza de pruebas: solo una cuenta de prueba ────────────────
CREATE OR REPLACE FUNCTION public.e2e_cleanup()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE
  v_qa uuid := public.qa_camara_id();
  v_users uuid[];
  v_count integer := 0;
BEGIN
  IF NOT public.is_test_user(auth.uid()) THEN RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501'; END IF;
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
REVOKE EXECUTE ON FUNCTION public.e2e_cleanup() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.e2e_cleanup() TO authenticated;
