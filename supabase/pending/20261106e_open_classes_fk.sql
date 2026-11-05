-- PENDIENTE: no aplicada todavía.
-- Clases abiertas: si se borra la propuesta o el instructor (eliminar cuenta, limpieza de pruebas),
-- la clase abierta queda sin esa referencia en vez de bloquear el borrado.
ALTER TABLE public.open_classes DROP CONSTRAINT IF EXISTS open_classes_match_id_fkey;
ALTER TABLE public.open_classes ADD CONSTRAINT open_classes_match_id_fkey
  FOREIGN KEY (match_id) REFERENCES public.matches(id) ON DELETE SET NULL;
ALTER TABLE public.open_classes DROP CONSTRAINT IF EXISTS open_classes_chosen_instructor_id_fkey;
ALTER TABLE public.open_classes ADD CONSTRAINT open_classes_chosen_instructor_id_fkey
  FOREIGN KEY (chosen_instructor_id) REFERENCES public.instructors(id) ON DELETE SET NULL;

-- La limpieza de pruebas también borra las clases abiertas de la red de prueba
CREATE OR REPLACE FUNCTION public.e2e_cleanup()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE
  v_qa uuid := public.qa_camara_id();
  v_users uuid[];
  v_count integer := 0;
BEGIN
  IF NOT public.is_test_user(auth.uid()) THEN RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501'; END IF;
  SELECT array_agg(id) INTO v_users FROM auth.users WHERE email LIKE '%@e2e.pilatesmatch.test';
  DELETE FROM public.open_classes WHERE camara_id = v_qa OR studio_id IN (SELECT id FROM public.studios WHERE user_id = ANY(coalesce(v_users, '{}')));
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
