-- Disponibilidad solo para reemplazos: en clases regulares el horario lo propone el estudio.
-- La búsqueda de clases regulares puntúa zona, equipamiento y reputación.
CREATE OR REPLACE FUNCTION public.search_instructors(p_class_type text, p_days text[], p_from time without time zone, p_to time without time zone)
 RETURNS TABLE(id uuid, full_name text, neighborhood text, avatar_url text, avg_score numeric, total_evaluations integer, match_score integer, match_reasons text[], missing_reasons text[], worked_together boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_studio record;
  v_equip text[];
  v_days text[] := coalesce(p_days, '{}');
  -- Los instructores solo cargan horarios para reemplazos: en una clase regular el horario lo propone el estudio
  v_regular boolean := p_class_type = 'regular';
BEGIN
  IF v_regular THEN v_days := '{}'; END IF;
  IF public.auth_role() IS DISTINCT FROM 'estudio' THEN RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501'; END IF;
  SELECT s.id, s.neighborhood, s.equipment, s.camara_id INTO v_studio FROM public.studios s WHERE s.user_id = auth.uid() LIMIT 1;
  IF v_studio.id IS NULL THEN RETURN; END IF;
  SELECT coalesce(array_agg(e), '{}') INTO v_equip FROM unnest(coalesce(v_studio.equipment, '{}')) e
  WHERE e IN ('mat', 'reformer', 'cadillac', 'chair', 'barrel', 'prenatal', 'terapeutico', 'adultos_mayores');

  RETURN QUERY
  WITH base AS (
    SELECT i.id, i.full_name, i.neighborhood, i.avatar_url
    FROM public.instructors i
    WHERE i.verification_status = 'verificado' AND i.is_active AND i.camara_id = v_studio.camara_id
  ),
  zone AS (
    SELECT b.id, EXISTS (SELECT 1 FROM public.instructor_zones z WHERE z.instructor_id = b.id AND z.neighborhood = v_studio.neighborhood) AS ok,
           EXISTS (SELECT 1 FROM public.instructor_zones z WHERE z.instructor_id = b.id) AS any_zone
    FROM base b
  ),
  equip AS (
    SELECT b.id,
           (SELECT coalesce(array_agg(e), '{}') FROM unnest(v_equip) e WHERE EXISTS (SELECT 1 FROM public.instructor_specialties sp WHERE sp.instructor_id = b.id AND sp.specialty::text = e)) AS has,
           (SELECT coalesce(array_agg(e), '{}') FROM unnest(v_equip) e WHERE NOT EXISTS (SELECT 1 FROM public.instructor_specialties sp WHERE sp.instructor_id = b.id AND sp.specialty::text = e)) AS lacks
    FROM base b
  ),
  avail AS (
    SELECT b.id,
           (SELECT count(*) FROM unnest(v_days) d WHERE EXISTS (
              SELECT 1 FROM public.availability a WHERE a.instructor_id = b.id AND a.is_active
                AND a.day_of_week::text = d AND a.class_type::text = p_class_type
                AND a.start_time <= p_from AND a.end_time >= p_to)) AS days_ok,
           EXISTS (SELECT 1 FROM public.availability a WHERE a.instructor_id = b.id AND a.is_active AND a.class_type::text = 'reemplazo') AS any_avail
    FROM base b
  ),
  rep AS (
    SELECT b.id,
           (SELECT count(*) FILTER (WHERE m.status IN ('aceptado', 'rechazado'))::numeric
                   / nullif(count(*) FILTER (WHERE m.status IN ('aceptado', 'rechazado', 'expirado')), 0)
              FROM public.matches m WHERE m.instructor_id = b.id) AS response_rate,
           (SELECT avg(e.average_score) FROM public.evaluations e WHERE e.instructor_id = b.id) AS avg_score,
           (SELECT count(*)::integer FROM public.evaluations e WHERE e.instructor_id = b.id) AS total_evaluations,
           EXISTS (SELECT 1 FROM public.matches m WHERE m.instructor_id = b.id AND m.studio_id = v_studio.id AND m.status = 'aceptado') AS worked
    FROM base b
  )
  SELECT b.id, b.full_name, b.neighborhood, b.avatar_url,
         round(r.avg_score, 1), r.total_evaluations,
         least(100, (
             CASE WHEN z.ok THEN CASE WHEN v_regular THEN 40 ELSE 30 END ELSE 0 END
           + CASE WHEN cardinality(v_equip) > 0 THEN round(CASE WHEN v_regular THEN 40.0 ELSE 30.0 END * cardinality(e.has) / cardinality(v_equip)) ELSE 0 END
           + CASE WHEN cardinality(v_days) > 0 THEN round(25.0 * a.days_ok / cardinality(v_days)) ELSE 0 END
           + round(CASE WHEN v_regular THEN 20 ELSE 15 END * (0.5 * coalesce(r.response_rate, 0.7) + 0.5 * coalesce(r.avg_score / 10, 0.7)))
           + CASE WHEN r.worked THEN 10 ELSE 0 END
         ))::integer AS match_score,
         array_remove(ARRAY[
           CASE WHEN z.ok THEN 'Trabaja en ' || v_studio.neighborhood END,
           CASE WHEN cardinality(e.has) > 0 THEN 'Sabe usar ' || array_to_string(ARRAY(SELECT initcap(replace(x, '_', ' ')) FROM unnest(e.has) x), ', ') END,
           CASE WHEN cardinality(v_days) > 0 AND a.days_ok = cardinality(v_days) THEN 'Disponible en ese horario'
                WHEN a.days_ok > 0 THEN 'Disponible ' || a.days_ok || ' de ' || cardinality(v_days) || ' días' END,
           CASE WHEN r.response_rate >= 0.8 THEN 'Responde las propuestas' END,
           CASE WHEN r.avg_score >= 8 THEN 'Puntaje ' || round(r.avg_score, 1) END,
           CASE WHEN r.worked THEN 'Ya trabajaron juntos' END
         ], NULL),
         array_remove(ARRAY[
           CASE WHEN NOT z.ok AND z.any_zone THEN 'No trabaja en ' || v_studio.neighborhood WHEN NOT z.any_zone THEN 'No cargó zonas de trabajo' END,
           CASE WHEN cardinality(e.lacks) > 0 THEN 'No declaró ' || array_to_string(ARRAY(SELECT initcap(replace(x, '_', ' ')) FROM unnest(e.lacks) x), ', ') END,
           CASE WHEN v_regular THEN NULL WHEN NOT a.any_avail THEN 'No cargó horarios'
                WHEN cardinality(v_days) > 0 AND a.days_ok = 0 THEN 'Sin disponibilidad en ese horario' END,
           CASE WHEN r.response_rate IS NOT NULL AND r.response_rate < 0.5 THEN 'Suele no responder' END
         ], NULL),
         r.worked
  FROM base b
  JOIN zone z ON z.id = b.id JOIN equip e ON e.id = b.id JOIN avail a ON a.id = b.id JOIN rep r ON r.id = b.id
  ORDER BY 7 DESC, 5 DESC NULLS LAST, b.full_name;
END;
$function$

;

-- Los horarios para clases regulares dejan de existir: no se muestran ni se usan
DELETE FROM public.availability WHERE class_type::text = 'regular';
