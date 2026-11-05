-- =====================================================================
-- Match, paso 4: clases abiertas — 2026-11-06
-- El estudio publica una clase (sobre todo reemplazos urgentes) con su oferta. Los
-- instructores compatibles de su red reciben el aviso y tocan "Me anoto". El estudio
-- elige a uno: eso crea la propuesta ya aceptada con el monto acordado.
-- Publicar cuenta como una propuesta del plan. Todo lo que escribe pasa por funciones.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.open_classes (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id            uuid NOT NULL REFERENCES public.studios(id) ON DELETE CASCADE,
  camara_id            uuid REFERENCES public.camaras(id),
  class_type           public.class_type NOT NULL,
  class_date           date NOT NULL,
  start_time           time NOT NULL,
  end_time             time NOT NULL,
  schedule_days        public.day_of_week[],
  schedule_from        time,
  schedule_to          time,
  offered_rate         integer NOT NULL CHECK (offered_rate > 0),
  note                 text,
  status               text NOT NULL DEFAULT 'abierta' CHECK (status IN ('abierta', 'cubierta', 'cerrada', 'vencida')),
  chosen_instructor_id uuid REFERENCES public.instructors(id),
  match_id             uuid REFERENCES public.matches(id),
  expires_at           timestamptz NOT NULL,
  created_at           timestamptz NOT NULL DEFAULT now(),
  closed_at            timestamptz
);
CREATE INDEX IF NOT EXISTS open_classes_network_idx ON public.open_classes (camara_id, status, expires_at);
ALTER TABLE public.open_classes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS open_classes_read ON public.open_classes;
CREATE POLICY open_classes_read ON public.open_classes FOR SELECT TO authenticated USING (
  studio_id IN (SELECT id FROM public.studios WHERE user_id = auth.uid())
  OR public.manages_camara(camara_id)
  OR (public.auth_role() = 'instructor' AND camara_id = public.my_instructor_camara_id() AND status = 'abierta' AND expires_at > now())
  OR chosen_instructor_id IN (SELECT id FROM public.instructors WHERE user_id = auth.uid())
);
REVOKE ALL ON public.open_classes FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.open_classes FROM authenticated;

CREATE TABLE IF NOT EXISTS public.open_class_applications (
  open_class_id uuid NOT NULL REFERENCES public.open_classes(id) ON DELETE CASCADE,
  instructor_id uuid NOT NULL REFERENCES public.instructors(id) ON DELETE CASCADE,
  note          text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (open_class_id, instructor_id)
);
ALTER TABLE public.open_class_applications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS applications_instructor_own ON public.open_class_applications;
CREATE POLICY applications_instructor_own ON public.open_class_applications FOR ALL TO authenticated
  USING (instructor_id IN (SELECT id FROM public.instructors WHERE user_id = auth.uid()))
  WITH CHECK (
    instructor_id IN (SELECT id FROM public.instructors WHERE user_id = auth.uid() AND verification_status = 'verificado')
    AND open_class_id IN (SELECT id FROM public.open_classes WHERE status = 'abierta' AND expires_at > now() AND camara_id = public.my_instructor_camara_id())
  );
DROP POLICY IF EXISTS applications_studio_read ON public.open_class_applications;
CREATE POLICY applications_studio_read ON public.open_class_applications FOR SELECT TO authenticated
  USING (open_class_id IN (SELECT id FROM public.open_classes WHERE studio_id IN (SELECT id FROM public.studios WHERE user_id = auth.uid()) OR public.manages_camara(camara_id)));
REVOKE ALL ON public.open_class_applications FROM anon;

-- ── Publicar: consume una propuesta del plan y avisa a los compatibles ──
CREATE OR REPLACE FUNCTION public.publish_open_class(
  p_class_type text, p_class_date date, p_start time, p_end time,
  p_days text[], p_from time, p_to time, p_offered integer, p_note text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE
  v_studio record; m public.memberships%ROWTYPE; v_id uuid; v_users uuid[]; v_when text;
  v_days text[] := CASE WHEN p_class_type = 'regular' THEN coalesce(p_days, '{}')
                        ELSE ARRAY[(ARRAY['domingo','lunes','martes','miercoles','jueves','viernes','sabado'])[extract(dow from p_class_date)::int + 1]] END;
  v_from time := CASE WHEN p_class_type = 'regular' THEN coalesce(p_from, p_start) ELSE p_start END;
  v_to   time := CASE WHEN p_class_type = 'regular' THEN coalesce(p_to, p_end) ELSE p_end END;
BEGIN
  IF public.auth_role() IS DISTINCT FROM 'estudio' THEN RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501'; END IF;
  SELECT id, name, neighborhood, camara_id INTO v_studio FROM public.studios WHERE user_id = auth.uid() LIMIT 1;
  IF v_studio.id IS NULL THEN RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501'; END IF;
  IF p_offered IS NULL OR p_offered < 1000 THEN RAISE EXCEPTION 'Indicá cuánto pagás por clase' USING ERRCODE = 'P0001'; END IF;
  IF p_end <= p_start THEN RAISE EXCEPTION 'La hora de fin tiene que ser posterior a la de inicio' USING ERRCODE = 'P0001'; END IF;

  -- Cuenta como una propuesta del plan (misma regla que enforce_match_limit)
  SELECT * INTO m FROM public.memberships WHERE studio_id = v_studio.id AND status = 'activa' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'MATCH_LIMIT_REACHED' USING ERRCODE = 'P0001'; END IF;
  IF m.last_reset_date < date_trunc('month', CURRENT_DATE)::date THEN m.matches_used_month := 0; END IF;
  IF m.matches_limit IS NOT NULL AND m.matches_used_month >= m.matches_limit THEN RAISE EXCEPTION 'MATCH_LIMIT_REACHED' USING ERRCODE = 'P0001'; END IF;
  UPDATE public.memberships SET matches_used_month = m.matches_used_month + 1,
    last_reset_date = GREATEST(m.last_reset_date, date_trunc('month', CURRENT_DATE)::date) WHERE id = m.id;

  INSERT INTO public.open_classes (studio_id, camara_id, class_type, class_date, start_time, end_time, schedule_days, schedule_from, schedule_to, offered_rate, note, expires_at)
  VALUES (v_studio.id, v_studio.camara_id, p_class_type::public.class_type, p_class_date, p_start, p_end,
          CASE WHEN p_class_type = 'regular' THEN p_days::public.day_of_week[] END,
          CASE WHEN p_class_type = 'regular' THEN p_from END, CASE WHEN p_class_type = 'regular' THEN p_to END,
          p_offered, nullif(trim(coalesce(p_note, '')), ''),
          CASE WHEN p_class_type = 'regular' THEN now() + interval '72 hours'
               ELSE least(now() + interval '72 hours', (p_class_date + p_start) AT TIME ZONE 'America/Argentina/Buenos_Aires') END)
  RETURNING id INTO v_id;

  -- Aviso a los instructores compatibles de la red (zona o disponibilidad en ese horario)
  SELECT coalesce(array_agg(i.user_id), '{}') INTO v_users
  FROM public.instructors i
  WHERE i.camara_id = v_studio.camara_id AND i.verification_status = 'verificado' AND i.is_active AND i.user_id IS NOT NULL
    AND (EXISTS (SELECT 1 FROM public.instructor_zones z WHERE z.instructor_id = i.id AND z.neighborhood = v_studio.neighborhood)
         OR EXISTS (SELECT 1 FROM public.availability a JOIN unnest(v_days) d ON a.day_of_week::text = d
                    WHERE a.instructor_id = i.id AND a.is_active AND a.class_type::text = p_class_type AND a.start_time <= v_from AND a.end_time >= v_to));
  v_when := CASE WHEN p_class_type = 'regular' THEN 'Clase regular ' || to_char(v_from, 'HH24:MI') || '–' || to_char(v_to, 'HH24:MI')
                 ELSE 'Reemplazo el ' || to_char(p_class_date, 'DD/MM') || ', ' || to_char(p_start, 'HH24:MI') || '–' || to_char(p_end, 'HH24:MI') END
            || ' · $' || to_char(p_offered, 'FM999G999G990') || ' por clase. Tocá para anotarte.';
  PERFORM public.send_push(v_users, 'Clase abierta en ' || v_studio.name, v_when, jsonb_build_object('screen', 'clases_abiertas', 'open_class_id', v_id));
  RETURN v_id;
END;
$fn$;
REVOKE EXECUTE ON FUNCTION public.publish_open_class(text, date, time, time, text[], time, time, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.publish_open_class(text, date, time, time, text[], time, time, integer, text) TO authenticated;

-- ── Me anoto: aviso al estudio ──
CREATE OR REPLACE FUNCTION public.notify_on_application()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE v_user uuid; v_name text; v_n integer;
BEGIN
  SELECT s.user_id INTO v_user FROM public.open_classes o JOIN public.studios s ON s.id = o.studio_id WHERE o.id = NEW.open_class_id;
  SELECT full_name INTO v_name FROM public.instructors WHERE id = NEW.instructor_id;
  SELECT count(*) INTO v_n FROM public.open_class_applications WHERE open_class_id = NEW.open_class_id;
  IF v_user IS NOT NULL THEN
    PERFORM public.send_push(ARRAY[v_user], coalesce(v_name, 'Un instructor') || ' se anotó para tu clase abierta',
      CASE WHEN v_n > 1 THEN v_n || ' anotados. Elegí con quién hacerla.' ELSE 'Mirá su perfil y elegilo si te sirve.' END,
      jsonb_build_object('screen', 'clases_abiertas', 'open_class_id', NEW.open_class_id));
  END IF;
  RETURN NEW;
END;
$fn$;
DROP TRIGGER IF EXISTS on_application_created ON public.open_class_applications;
CREATE TRIGGER on_application_created AFTER INSERT ON public.open_class_applications FOR EACH ROW EXECUTE FUNCTION public.notify_on_application();

-- ── Elegir: crea la propuesta ya aceptada ──
-- Los triggers de propuestas respetan la marca app.open_class_pick (la pone esta función)
CREATE OR REPLACE FUNCTION public.pick_open_class_applicant(p_open_class uuid, p_instructor uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE o record; v_match uuid; v_chosen uuid; v_others uuid[]; v_studio text;
BEGIN
  SELECT oc.*, s.user_id AS studio_user, s.name AS studio_name INTO o
  FROM public.open_classes oc JOIN public.studios s ON s.id = oc.studio_id WHERE oc.id = p_open_class FOR UPDATE;
  IF NOT FOUND OR o.studio_user IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501'; END IF;
  IF o.status <> 'abierta' THEN RAISE EXCEPTION 'Esta clase ya no está abierta' USING ERRCODE = 'P0001'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.open_class_applications WHERE open_class_id = p_open_class AND instructor_id = p_instructor) THEN
    RAISE EXCEPTION 'Ese instructor no se anotó' USING ERRCODE = 'P0001';
  END IF;

  PERFORM set_config('app.open_class_pick', '1', true);
  INSERT INTO public.matches (studio_id, instructor_id, class_type, class_date, start_time, end_time, schedule_days, schedule_from, schedule_to,
                              note_studio, offered_rate, agreed_rate, status, responded_at, camara_id)
  VALUES (o.studio_id, p_instructor, o.class_type, o.class_date, o.start_time, o.end_time, o.schedule_days, o.schedule_from, o.schedule_to,
          o.note, o.offered_rate, o.offered_rate, 'aceptado', now(), o.camara_id)
  RETURNING id INTO v_match;
  PERFORM set_config('app.open_class_pick', '', true);

  UPDATE public.open_classes SET status = 'cubierta', chosen_instructor_id = p_instructor, match_id = v_match, closed_at = now() WHERE id = p_open_class;

  SELECT user_id INTO v_chosen FROM public.instructors WHERE id = p_instructor;
  SELECT coalesce(array_agg(i.user_id), '{}') INTO v_others FROM public.open_class_applications a JOIN public.instructors i ON i.id = a.instructor_id
  WHERE a.open_class_id = p_open_class AND a.instructor_id <> p_instructor AND i.user_id IS NOT NULL;
  IF v_chosen IS NOT NULL THEN
    PERFORM public.send_push(ARRAY[v_chosen], o.studio_name || ' te eligió para la clase',
      'Confirmada por $' || to_char(o.offered_rate, 'FM999G999G990') || ' la clase. Coordiná los detalles.', jsonb_build_object('screen', 'propuestas', 'match_id', v_match));
  END IF;
  PERFORM public.send_push(v_others, 'La clase en ' || o.studio_name || ' ya se cubrió', 'Gracias por anotarte. Van a aparecer más clases abiertas.', jsonb_build_object('screen', 'clases_abiertas'));
  RETURN v_match;
END;
$fn$;
REVOKE EXECUTE ON FUNCTION public.pick_open_class_applicant(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pick_open_class_applicant(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.close_open_class(p_open_class uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE o record; v_users uuid[];
BEGIN
  SELECT oc.*, s.user_id AS studio_user, s.name AS studio_name INTO o
  FROM public.open_classes oc JOIN public.studios s ON s.id = oc.studio_id WHERE oc.id = p_open_class FOR UPDATE;
  IF NOT FOUND OR o.studio_user IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501'; END IF;
  IF o.status <> 'abierta' THEN RETURN; END IF;
  UPDATE public.open_classes SET status = 'cerrada', closed_at = now() WHERE id = p_open_class;
  SELECT coalesce(array_agg(i.user_id), '{}') INTO v_users FROM public.open_class_applications a JOIN public.instructors i ON i.id = a.instructor_id
  WHERE a.open_class_id = p_open_class AND i.user_id IS NOT NULL;
  PERFORM public.send_push(v_users, o.studio_name || ' cerró la clase abierta', 'Ya no busca instructor para esa clase.', jsonb_build_object('screen', 'clases_abiertas'));
END;
$fn$;
REVOKE EXECUTE ON FUNCTION public.close_open_class(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.close_open_class(uuid) TO authenticated;

-- Vencen solas: cada hora
CREATE OR REPLACE FUNCTION public.expire_open_classes()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE r record;
BEGIN
  FOR r IN UPDATE public.open_classes SET status = 'vencida', closed_at = now()
           WHERE status = 'abierta' AND expires_at < now() RETURNING id, studio_id, class_date LOOP
    PERFORM public.send_push(ARRAY[(SELECT user_id FROM public.studios WHERE id = r.studio_id)],
      'Tu clase abierta venció', 'Nadie fue elegido para la clase del ' || to_char(r.class_date, 'DD/MM') || '. Podés publicar otra o buscar un instructor.',
      jsonb_build_object('screen', 'buscar'));
  END LOOP;
END;
$fn$;
REVOKE EXECUTE ON FUNCTION public.expire_open_classes() FROM PUBLIC, anon, authenticated;
SELECT cron.unschedule('expire-open-classes') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'expire-open-classes');
SELECT cron.schedule('expire-open-classes', '13 * * * *', 'SELECT public.expire_open_classes()');

-- ── Los triggers de propuestas dejan pasar la propuesta que crea "Elegir" ──
CREATE OR REPLACE FUNCTION public.enforce_match_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE m public.memberships%ROWTYPE;
BEGIN
  IF public.is_admin() OR current_setting('app.open_class_pick', true) = '1' THEN RETURN NEW; END IF;
  SELECT * INTO m FROM public.memberships WHERE studio_id = NEW.studio_id AND status = 'activa' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'MATCH_LIMIT_REACHED' USING ERRCODE = 'P0001'; END IF;
  IF m.last_reset_date < date_trunc('month', CURRENT_DATE)::date THEN m.matches_used_month := 0; END IF;
  IF m.matches_limit IS NOT NULL AND m.matches_used_month >= m.matches_limit THEN RAISE EXCEPTION 'MATCH_LIMIT_REACHED' USING ERRCODE = 'P0001'; END IF;
  UPDATE public.memberships SET matches_used_month = m.matches_used_month + 1,
    last_reset_date = GREATEST(m.last_reset_date, date_trunc('month', CURRENT_DATE)::date) WHERE id = m.id;
  RETURN NEW;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.guard_matches_write()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $fn$
DECLARE v_role text := public.auth_role()::text;
BEGIN
  IF current_user NOT IN ('anon', 'authenticated') OR public.is_admin() OR current_setting('app.open_class_pick', true) = '1' THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.offered_rate IS NULL THEN RAISE EXCEPTION 'Indicá cuánto pagás por clase' USING ERRCODE = 'P0001'; END IF;
    NEW.status := 'pendiente';
    NEW.agreed_rate := NULL; NEW.counter_rate := NULL; NEW.counter_at := NULL;
    NEW.note_instructor := NULL; NEW.responded_at := NULL;
    RETURN NEW;
  END IF;
  NEW.studio_id := OLD.studio_id; NEW.instructor_id := OLD.instructor_id; NEW.camara_id := OLD.camara_id;
  NEW.class_type := OLD.class_type; NEW.class_date := OLD.class_date;
  NEW.start_time := OLD.start_time; NEW.end_time := OLD.end_time;
  NEW.schedule_days := OLD.schedule_days; NEW.schedule_from := OLD.schedule_from; NEW.schedule_to := OLD.schedule_to;
  NEW.note_studio := OLD.note_studio; NEW.offered_rate := OLD.offered_rate;
  NEW.created_at := OLD.created_at; NEW.expires_at := OLD.expires_at;
  IF OLD.status <> 'pendiente' THEN RAISE EXCEPTION 'Esta propuesta ya fue respondida' USING ERRCODE = 'P0001'; END IF;
  IF v_role = 'instructor' THEN
    NEW.agreed_rate := OLD.agreed_rate;
    IF NEW.counter_rate IS DISTINCT FROM OLD.counter_rate THEN
      IF OLD.counter_rate IS NOT NULL THEN RAISE EXCEPTION 'Ya hiciste una contraoferta' USING ERRCODE = 'P0001'; END IF;
      IF NEW.counter_rate IS NULL THEN RAISE EXCEPTION 'Indicá el monto' USING ERRCODE = 'P0001'; END IF;
      NEW.status := 'pendiente'; NEW.counter_at := now(); NEW.responded_at := NULL;
      RETURN NEW;
    END IF;
    IF NEW.status NOT IN ('aceptado', 'rechazado') THEN RAISE EXCEPTION 'Respuesta no válida' USING ERRCODE = 'P0001'; END IF;
    IF OLD.counter_rate IS NOT NULL THEN RAISE EXCEPTION 'Tu contraoferta está esperando al estudio' USING ERRCODE = 'P0001'; END IF;
    IF NEW.status = 'aceptado' THEN NEW.agreed_rate := OLD.offered_rate; END IF;
    NEW.responded_at := now();
    RETURN NEW;
  END IF;
  IF v_role = 'estudio' THEN
    NEW.counter_rate := OLD.counter_rate; NEW.counter_at := OLD.counter_at; NEW.note_instructor := OLD.note_instructor;
    IF NEW.status = 'cancelado' THEN NEW.agreed_rate := NULL; NEW.responded_at := now(); RETURN NEW; END IF;
    IF NEW.status IN ('aceptado', 'rechazado') AND OLD.counter_rate IS NOT NULL THEN
      NEW.agreed_rate := CASE WHEN NEW.status = 'aceptado' THEN OLD.counter_rate ELSE NULL END;
      NEW.responded_at := now(); RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Solo podés cancelar la propuesta o responder una contraoferta' USING ERRCODE = 'P0001';
  END IF;
  RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501';
END;
$fn$;

-- "Nueva propuesta" no se manda cuando la propuesta nace de una clase abierta (va "te eligió")
CREATE OR REPLACE FUNCTION public.notify_instructor_on_match()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE v_user uuid; v_studio text; v_when text;
BEGIN
  IF current_setting('app.open_class_pick', true) = '1' THEN RETURN NEW; END IF;
  SELECT user_id INTO v_user FROM public.instructors WHERE id = NEW.instructor_id;
  SELECT name INTO v_studio FROM public.studios WHERE id = NEW.studio_id;
  IF v_user IS NULL THEN RETURN NEW; END IF;
  v_when := CASE WHEN NEW.class_type = 'regular'
    THEN 'Clase regular, ' || to_char(coalesce(NEW.schedule_from, NEW.start_time), 'HH24:MI') || ' a ' || to_char(coalesce(NEW.schedule_to, NEW.end_time), 'HH24:MI')
    ELSE 'Reemplazo el ' || to_char(NEW.class_date, 'DD/MM') || ', ' || to_char(NEW.start_time, 'HH24:MI') || ' a ' || to_char(NEW.end_time, 'HH24:MI') END;
  IF NEW.offered_rate IS NOT NULL THEN v_when := v_when || ' · $' || to_char(NEW.offered_rate, 'FM999G999G990') || ' por clase'; END IF;
  PERFORM public.send_push(ARRAY[v_user], 'Nueva propuesta de ' || coalesce(v_studio, 'un estudio'), v_when,
    jsonb_build_object('screen', 'propuestas', 'match_id', NEW.id));
  RETURN NEW;
END;
$fn$;
