-- Evaluación a ciegas: la evaluación que hace el estudio queda oculta para el
-- instructor, y no cuenta en su promedio, hasta que el instructor evalúa al estudio
-- por esa misma clase o pasan 7 días desde que el estudio la cargó.

CREATE OR REPLACE FUNCTION public.evaluation_revealed(
  p_instructor uuid, p_studio uuid, p_date date, p_created timestamptz
) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $$
  SELECT p_created < now() - interval '7 days'
      OR EXISTS (
        SELECT 1 FROM public.studio_evaluations se
        WHERE se.instructor_id = p_instructor AND se.studio_id = p_studio AND se.class_date = p_date
      );
$$;
REVOKE ALL ON FUNCTION public.evaluation_revealed(uuid, uuid, date, timestamptz) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.evaluation_revealed(uuid, uuid, date, timestamptz) TO authenticated;

-- 1) El instructor solo lee sus evaluaciones ya reveladas
DROP POLICY IF EXISTS instructor_see_own_evals ON public.evaluations;
CREATE POLICY instructor_see_own_evals ON public.evaluations FOR SELECT USING (
  instructor_id IN (SELECT i.id FROM public.instructors i WHERE i.user_id = auth.uid())
  AND public.evaluation_revealed(instructor_id, studio_id, class_date, created_at)
);

-- 2) Promedio del instructor (perfil, panel del instructor, admin): solo reveladas
CREATE OR REPLACE FUNCTION public.get_instructor_stats(p_instructor_id uuid)
 RETURNS TABLE(total_evaluations integer, avg_score numeric, avg_technique numeric, avg_punctuality numeric, avg_student_care numeric, avg_presentation numeric)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
  SELECT
    COUNT(*)::integer,
    AVG(e.average_score),
    AVG(e.score_technique),
    AVG(e.score_punctuality),
    AVG(e.score_student_care),
    AVG(e.score_presentation)
  FROM public.evaluations e
  WHERE e.instructor_id = p_instructor_id
    AND public.evaluation_revealed(e.instructor_id, e.studio_id, e.class_date, e.created_at);
$function$;

-- 3) Búsqueda de instructores: puntaje y cantidad de evaluaciones solo con reveladas
DO $do$
DECLARE
  v_def text := pg_get_functiondef('public.search_instructors(text, text[], time, time)'::regprocedure);
  v_old_avg text := '(SELECT avg(e.average_score) FROM public.evaluations e WHERE e.instructor_id = b.id) AS avg_score';
  v_old_cnt text := '(SELECT count(*)::integer FROM public.evaluations e WHERE e.instructor_id = b.id) AS total_evaluations';
  v_cond text := ' AND public.evaluation_revealed(e.instructor_id, e.studio_id, e.class_date, e.created_at)';
BEGIN
  IF position(v_old_avg IN v_def) = 0 OR position(v_old_cnt IN v_def) = 0 THEN
    RAISE EXCEPTION 'search_instructors cambió: revisar esta migración a mano';
  END IF;
  v_def := replace(v_def, v_old_avg, replace(v_old_avg, 'e.instructor_id = b.id)', 'e.instructor_id = b.id' || v_cond || ')'));
  v_def := replace(v_def, v_old_cnt, replace(v_old_cnt, 'e.instructor_id = b.id)', 'e.instructor_id = b.id' || v_cond || ')'));
  EXECUTE v_def;
END
$do$;
