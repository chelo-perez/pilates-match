-- =====================================================================
-- Match, paso 2: compatibilidad contra la clase concreta, en el servidor — 2026-11-06
--  * search_instructors(): el estudio dice qué necesita (tipo, días, horario) y recibe
--    los instructores de su red ordenados para ESA clase. Puntaje:
--      zona 30 · equipamiento 30 · disponibilidad en ese horario 25 · reputación 15
--      (+10 si ya trabajaron juntos). La reputación se gana: tasa de respuesta y evaluaciones.
--    Se calcula acá y no en el celular: las tarifas no se usan ni se exponen.
--  * studio_reputation(): lo que el instructor ve del estudio antes de aceptar
--    (clases dadas, puntualidad de pago, "paga lo acordado"). Solo agregados.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.search_instructors(
  p_class_type text, p_days text[], p_from time, p_to time
)
RETURNS TABLE (
  id uuid, full_name text, neighborhood text, avatar_url text,
  avg_score numeric, total_evaluations integer,
  match_score integer, match_reasons text[], missing_reasons text[], worked_together boolean
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE
  v_studio record;
  v_equip text[];
  v_days text[] := coalesce(p_days, '{}');
BEGIN
  IF public.auth_role() IS DISTINCT FROM 'estudio' THEN RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501'; END IF;
  SELECT s.id, s.neighborhood, s.equipment, s.camara_id INTO v_studio FROM public.studios s WHERE s.user_id = auth.uid() LIMIT 1;
  IF v_studio.id IS NULL THEN RETURN; END IF;
  -- Solo equipamiento que existe como especialidad
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
           EXISTS (SELECT 1 FROM public.availability a WHERE a.instructor_id = b.id AND a.is_active) AS any_avail
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
             CASE WHEN z.ok THEN 30 ELSE 0 END
           + CASE WHEN cardinality(v_equip) > 0 THEN round(30.0 * cardinality(e.has) / cardinality(v_equip)) ELSE 0 END
           + CASE WHEN cardinality(v_days) > 0 THEN round(25.0 * a.days_ok / cardinality(v_days)) ELSE 0 END
           + round(15 * (0.5 * coalesce(r.response_rate, 0.7) + 0.5 * coalesce(r.avg_score / 10, 0.7)))
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
           CASE WHEN NOT a.any_avail THEN 'No cargó horarios'
                WHEN cardinality(v_days) > 0 AND a.days_ok = 0 THEN 'Sin disponibilidad en ese horario' END,
           CASE WHEN r.response_rate IS NOT NULL AND r.response_rate < 0.5 THEN 'Suele no responder' END
         ], NULL),
         r.worked
  FROM base b
  JOIN zone z ON z.id = b.id JOIN equip e ON e.id = b.id JOIN avail a ON a.id = b.id JOIN rep r ON r.id = b.id
  ORDER BY 7 DESC, 5 DESC NULLS LAST, b.full_name;
END;
$fn$;
REVOKE EXECUTE ON FUNCTION public.search_instructors(text, text[], time, time) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_instructors(text, text[], time, time) TO authenticated;

-- Lo que el instructor ve del estudio: solo números agregados, nunca evaluaciones individuales
CREATE OR REPLACE FUNCTION public.studio_reputation(p_studio_id uuid)
RETURNS json LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $fn$
  SELECT json_build_object(
    'classes',     (SELECT count(*) FROM public.matches m WHERE m.studio_id = p_studio_id AND m.status = 'aceptado' AND m.class_date < CURRENT_DATE),
    'evals',       (SELECT count(*) FROM public.studio_evaluations e WHERE e.studio_id = p_studio_id),
    'avg_score',   (SELECT round(avg(e.average_score), 1) FROM public.studio_evaluations e WHERE e.studio_id = p_studio_id),
    'avg_payment', (SELECT round(avg(e.score_payment), 1) FROM public.studio_evaluations e WHERE e.studio_id = p_studio_id),
    'paid_ok',     (SELECT count(*) FROM public.studio_evaluations e WHERE e.studio_id = p_studio_id AND e.paid_as_agreed = true),
    'paid_total',  (SELECT count(*) FROM public.studio_evaluations e WHERE e.studio_id = p_studio_id AND e.paid_as_agreed IS NOT NULL)
  )
  WHERE public.auth_role() IN ('instructor', 'camara_admin', 'super_admin');
$fn$;
REVOKE EXECUTE ON FUNCTION public.studio_reputation(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.studio_reputation(uuid) TO authenticated;
