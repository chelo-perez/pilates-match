-- =====================================================================
-- Limpieza para las pruebas automáticas (tests/e2e)
--
-- Las pruebas crean cuentas reales con emails @e2e.pilatesmatch.test y las
-- borran al terminar. Esta función SOLO puede borrar cuentas de ese dominio,
-- así que no sirve para tocar cuentas reales.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.e2e_cleanup()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_users uuid[];
  v_count integer;
BEGIN
  SELECT array_agg(id) INTO v_users FROM auth.users
  WHERE email LIKE '%@e2e.pilatesmatch.test';
  IF v_users IS NULL THEN RETURN 0; END IF;

  -- Lo que no se borra en cascada
  DELETE FROM public.studio_evaluations WHERE studio_id IN (SELECT id FROM public.studios WHERE user_id = ANY(v_users))
                                         OR instructor_id IN (SELECT id FROM public.instructors WHERE user_id = ANY(v_users));
  DELETE FROM public.evaluations WHERE studio_id IN (SELECT id FROM public.studios WHERE user_id = ANY(v_users))
                                  OR instructor_id IN (SELECT id FROM public.instructors WHERE user_id = ANY(v_users));
  DELETE FROM public.matches WHERE studio_id IN (SELECT id FROM public.studios WHERE user_id = ANY(v_users))
                              OR instructor_id IN (SELECT id FROM public.instructors WHERE user_id = ANY(v_users));
  DELETE FROM public.instructors WHERE user_id = ANY(v_users);

  -- users, studios, memberships, budgets y push_tokens caen en cascada
  DELETE FROM auth.users WHERE id = ANY(v_users);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.e2e_cleanup() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.e2e_cleanup() TO anon, authenticated;
