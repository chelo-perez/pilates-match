-- PENDIENTE: no aplicada todavía.
-- =====================================================================
-- Privacidad de estudios entre redes — 2026-11-05
-- Antes cualquier cuenta podía leer todos los estudios (studio_public_read = true),
-- incluidos los de otras redes con email, teléfono y CUIT. Ahora un estudio lo ven:
--  * su dueño, * la entidad de su red (y la plataforma), * los instructores de su misma red.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.my_instructor_camara_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $fn$
  SELECT camara_id FROM public.instructors WHERE user_id = auth.uid() LIMIT 1;
$fn$;
REVOKE EXECUTE ON FUNCTION public.my_instructor_camara_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_instructor_camara_id() TO authenticated;

DROP POLICY IF EXISTS studio_public_read ON public.studios;
DROP POLICY IF EXISTS studio_network_read ON public.studios;
CREATE POLICY studio_network_read ON public.studios FOR SELECT TO authenticated USING (
  user_id = auth.uid()
  OR public.manages_camara(camara_id)
  OR camara_id = public.my_instructor_camara_id()
);
