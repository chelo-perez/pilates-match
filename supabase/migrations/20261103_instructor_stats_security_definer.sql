-- get_instructor_stats corría con los permisos del que llama: por RLS, un estudio
-- solo veía el promedio de SUS evaluaciones. Ahora corre como dueño (SECURITY DEFINER)
-- y promedia todas. Solo devuelve agregados: no expone filas, comentarios ni estudios.
CREATE OR REPLACE FUNCTION public.get_instructor_stats(p_instructor_id uuid)
RETURNS TABLE(total_evaluations integer, avg_score numeric, avg_technique numeric,
              avg_punctuality numeric, avg_student_care numeric, avg_presentation numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    COUNT(*)::integer,
    AVG(e.average_score),
    AVG(e.score_technique),
    AVG(e.score_punctuality),
    AVG(e.score_student_care),
    AVG(e.score_presentation)
  FROM public.evaluations e
  WHERE e.instructor_id = p_instructor_id;
$$;

-- Solo usuarios logueados (antes también anon/PUBLIC)
REVOKE EXECUTE ON FUNCTION public.get_instructor_stats(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_instructor_stats(uuid) TO authenticated;
