-- PENDIENTE
-- Después de aceptar: ficha de la clase, recordatorios, cancelar con aviso,
-- "¿Se dio la clase?" y, para las regulares, entrevista con clase de prueba.

-- ── 1. Datos nuevos de la propuesta ─────────────────────────────────
ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS cancelled_by     text CHECK (cancelled_by IN ('estudio', 'instructor')),
  ADD COLUMN IF NOT EXISTS cancel_reason    text,
  ADD COLUMN IF NOT EXISTS cancelled_at     timestamptz,
  ADD COLUMN IF NOT EXISTS late_cancel      boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS held_studio      boolean,
  ADD COLUMN IF NOT EXISTS held_instructor  boolean,
  ADD COLUMN IF NOT EXISTS held_asked_at    timestamptz,
  ADD COLUMN IF NOT EXISTS reminded_24h_at  timestamptz,
  ADD COLUMN IF NOT EXISTS reminded_2h_at   timestamptz,
  -- Regular: class_date/start_time/end_time son la entrevista con clase de prueba
  ADD COLUMN IF NOT EXISTS trial_paid       boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS hire_status      text CHECK (hire_status IN ('contratado', 'no_sigue')),
  ADD COLUMN IF NOT EXISTS hire_decided_at  timestamptz,
  ADD COLUMN IF NOT EXISTS ended_at         timestamptz,
  ADD COLUMN IF NOT EXISTS ended_by         text CHECK (ended_by IN ('estudio', 'instructor'));

-- Inicio y fin de la clase en hora argentina
CREATE OR REPLACE FUNCTION public.match_start_ts(m public.matches)
RETURNS timestamptz LANGUAGE sql STABLE SET search_path = '' AS $fn$
  SELECT (m.class_date + m.start_time) AT TIME ZONE 'America/Argentina/Buenos_Aires';
$fn$;
CREATE OR REPLACE FUNCTION public.match_end_ts(m public.matches)
RETURNS timestamptz LANGUAGE sql STABLE SET search_path = '' AS $fn$
  SELECT (m.class_date + m.end_time) AT TIME ZONE 'America/Argentina/Buenos_Aires';
$fn$;

-- Qué lado es quien llama ('estudio' | 'instructor' | NULL) y los datos para avisar
CREATE OR REPLACE FUNCTION public.match_side(p_match uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $fn$
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM public.matches m JOIN public.studios s ON s.id = m.studio_id WHERE m.id = p_match AND s.user_id = auth.uid()) THEN 'estudio'
    WHEN EXISTS (SELECT 1 FROM public.matches m JOIN public.instructors i ON i.id = m.instructor_id WHERE m.id = p_match AND i.user_id = auth.uid()) THEN 'instructor'
  END;
$fn$;
REVOKE EXECUTE ON FUNCTION public.match_side(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.match_people(p_match uuid,
  OUT studio_user uuid, OUT studio_name text, OUT instr_user uuid, OUT instr_name text, OUT m public.matches)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $fn$
BEGIN
  SELECT * INTO m FROM public.matches WHERE id = p_match;
  SELECT s.user_id, s.name INTO studio_user, studio_name FROM public.studios s WHERE s.id = m.studio_id;
  SELECT i.user_id, i.full_name INTO instr_user, instr_name FROM public.instructors i WHERE i.id = m.instructor_id;
END;
$fn$;
REVOKE EXECUTE ON FUNCTION public.match_people(uuid) FROM PUBLIC, anon, authenticated;

-- ── 2. Cancelar una clase confirmada ────────────────────────────────
-- Avisa al otro lado. Si cancela el instructor, el aviso vuelve a la cuota del estudio
-- y el estudio puede republicarla como clase abierta. A menos de 24 h es "cancelación tardía".
CREATE OR REPLACE FUNCTION public.cancel_confirmed_match(p_match uuid, p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE v_side text := public.match_side(p_match); p record; v_late boolean; v_when text;
BEGIN
  IF v_side IS NULL THEN RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501'; END IF;
  SELECT * INTO p FROM public.match_people(p_match);
  IF (p.m).status <> 'aceptado' THEN RAISE EXCEPTION 'Esta clase no está confirmada' USING ERRCODE = 'P0001'; END IF;
  IF (p.m).hire_status = 'contratado' THEN RAISE EXCEPTION 'Es una clase regular activa: usá "Terminar"' USING ERRCODE = 'P0001'; END IF;
  IF public.match_start_ts(p.m) < now() THEN RAISE EXCEPTION 'La clase ya empezó' USING ERRCODE = 'P0001'; END IF;
  IF length(trim(coalesce(p_reason, ''))) < 3 THEN RAISE EXCEPTION 'Contá brevemente el motivo' USING ERRCODE = 'P0001'; END IF;
  v_late := public.match_start_ts(p.m) < now() + interval '24 hours';

  UPDATE public.matches SET status = 'cancelado', cancelled_by = v_side, cancel_reason = trim(p_reason),
         cancelled_at = now(), late_cancel = v_late
  WHERE id = p_match;

  -- Si cancela el instructor, el estudio recupera el aviso del mes
  IF v_side = 'instructor' THEN
    UPDATE public.memberships SET matches_used_month = greatest(0, matches_used_month - 1)
    WHERE studio_id = (p.m).studio_id AND status = 'activa'
      AND last_reset_date >= date_trunc('month', CURRENT_DATE)::date;
  END IF;

  v_when := to_char((p.m).class_date, 'DD/MM') || ' ' || to_char((p.m).start_time, 'HH24:MI');
  IF v_side = 'instructor' AND p.studio_user IS NOT NULL THEN
    PERFORM public.send_push(ARRAY[p.studio_user],
      coalesce(p.instr_name, 'El instructor') || ' canceló la clase del ' || v_when,
      '"' || trim(p_reason) || '". Tocá para publicarla como clase abierta y que se anoten otros.',
      jsonb_build_object('screen', 'clase', 'match_id', p_match));
  ELSIF v_side = 'estudio' AND p.instr_user IS NOT NULL THEN
    PERFORM public.send_push(ARRAY[p.instr_user],
      coalesce(p.studio_name, 'El estudio') || ' canceló la clase del ' || v_when,
      '"' || trim(p_reason) || '"',
      jsonb_build_object('screen', 'clase', 'match_id', p_match));
  END IF;
END;
$fn$;
REVOKE EXECUTE ON FUNCTION public.cancel_confirmed_match(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_confirmed_match(uuid, text) TO authenticated;

-- ── 3. ¿Se dio la clase? ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.confirm_class_held(p_match uuid, p_held boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE v_side text := public.match_side(p_match); p record;
BEGIN
  IF v_side IS NULL THEN RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501'; END IF;
  SELECT * INTO p FROM public.match_people(p_match);
  IF (p.m).status <> 'aceptado' THEN RAISE EXCEPTION 'Esta clase no está confirmada' USING ERRCODE = 'P0001'; END IF;
  IF public.match_start_ts(p.m) > now() THEN RAISE EXCEPTION 'La clase todavía no empezó' USING ERRCODE = 'P0001'; END IF;
  IF v_side = 'estudio' THEN UPDATE public.matches SET held_studio = p_held WHERE id = p_match;
  ELSE UPDATE public.matches SET held_instructor = p_held WHERE id = p_match; END IF;
END;
$fn$;
REVOKE EXECUTE ON FUNCTION public.confirm_class_held(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirm_class_held(uuid, boolean) TO authenticated;

-- ── 4. Regular: después de la clase de prueba, el estudio decide ────
CREATE OR REPLACE FUNCTION public.decide_hire(p_match uuid, p_hire boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE p record;
BEGIN
  IF public.match_side(p_match) IS DISTINCT FROM 'estudio' THEN RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501'; END IF;
  SELECT * INTO p FROM public.match_people(p_match);
  IF (p.m).class_type <> 'regular' OR (p.m).status <> 'aceptado' THEN RAISE EXCEPTION 'No es una entrevista confirmada' USING ERRCODE = 'P0001'; END IF;
  IF (p.m).hire_status IS NOT NULL THEN RAISE EXCEPTION 'Ya lo decidiste' USING ERRCODE = 'P0001'; END IF;
  IF public.match_start_ts(p.m) > now() THEN RAISE EXCEPTION 'Primero tiene que ser la clase de prueba' USING ERRCODE = 'P0001'; END IF;
  UPDATE public.matches SET hire_status = CASE WHEN p_hire THEN 'contratado' ELSE 'no_sigue' END,
         hire_decided_at = now(), held_studio = coalesce(held_studio, true)
  WHERE id = p_match;
  IF p.instr_user IS NOT NULL THEN
    PERFORM public.send_push(ARRAY[p.instr_user],
      CASE WHEN p_hire THEN '¡' || coalesce(p.studio_name, 'El estudio') || ' te sumó a su equipo!'
           ELSE coalesce(p.studio_name, 'El estudio') || ' no va a seguir con la clase regular' END,
      CASE WHEN p_hire THEN 'Clase regular activa por $' || to_char((p.m).agreed_rate, 'FM999G999G990') || ' la clase. Tocá para ver los días y horarios.'
           ELSE 'Gracias por la clase de prueba. Podés evaluar al estudio.' END,
      jsonb_build_object('screen', 'clase', 'match_id', p_match));
  END IF;
END;
$fn$;
REVOKE EXECUTE ON FUNCTION public.decide_hire(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.decide_hire(uuid, boolean) TO authenticated;

-- Terminar una clase regular activa (cualquiera de los dos)
CREATE OR REPLACE FUNCTION public.end_regular(p_match uuid, p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE v_side text := public.match_side(p_match); p record; v_to uuid;
BEGIN
  IF v_side IS NULL THEN RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501'; END IF;
  SELECT * INTO p FROM public.match_people(p_match);
  IF (p.m).hire_status IS DISTINCT FROM 'contratado' OR (p.m).ended_at IS NOT NULL THEN RAISE EXCEPTION 'No es una clase regular activa' USING ERRCODE = 'P0001'; END IF;
  UPDATE public.matches SET ended_at = now(), ended_by = v_side, cancel_reason = nullif(trim(coalesce(p_reason, '')), '') WHERE id = p_match;
  v_to := CASE WHEN v_side = 'estudio' THEN p.instr_user ELSE p.studio_user END;
  IF v_to IS NOT NULL THEN
    PERFORM public.send_push(ARRAY[v_to],
      CASE WHEN v_side = 'estudio' THEN coalesce(p.studio_name, 'El estudio') ELSE coalesce(p.instr_name, 'El instructor') END || ' terminó la clase regular',
      coalesce(nullif(trim(coalesce(p_reason, '')), ''), 'La clase regular quedó cerrada.'),
      jsonb_build_object('screen', 'clase', 'match_id', p_match));
  END IF;
END;
$fn$;
REVOKE EXECUTE ON FUNCTION public.end_regular(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.end_regular(uuid, text) TO authenticated;

-- ── 5. Recordatorios y pregunta de cierre (cada 10 minutos) ─────────
CREATE OR REPLACE FUNCTION public.match_reminders()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE r record; v_what text; v_at text;
BEGIN
  FOR r IN
    SELECT m.*, s.user_id AS su, s.name AS sn, s.address AS sa, i.user_id AS iu, i.full_name AS iname,
           public.match_start_ts(m) AS st, public.match_end_ts(m) AS en
    FROM public.matches m JOIN public.studios s ON s.id = m.studio_id JOIN public.instructors i ON i.id = m.instructor_id
    WHERE m.status = 'aceptado' AND m.class_date BETWEEN CURRENT_DATE - 2 AND CURRENT_DATE + 2
  LOOP
    v_what := CASE WHEN r.class_type = 'regular' THEN 'Entrevista y clase de prueba' ELSE 'Reemplazo' END;
    v_at := to_char(r.start_time, 'HH24:MI');
    -- Día anterior (solo si se confirmó con más de 24 h de anticipación)
    IF r.reminded_24h_at IS NULL AND r.st <= now() + interval '24 hours' AND r.st > now() + interval '2 hours'
       AND coalesce(r.responded_at, r.created_at) < r.st - interval '24 hours' THEN
      PERFORM public.send_push(ARRAY[r.iu], 'Mañana ' || v_at || ' · ' || v_what || ' en ' || r.sn,
        coalesce(r.sa, 'Tocá para ver la dirección y el contacto.'), jsonb_build_object('screen', 'clase', 'match_id', r.id));
      PERFORM public.send_push(ARRAY[r.su], 'Mañana ' || v_at || ' · ' || r.iname,
        lower(v_what) || ' confirmado. Si algo cambia, avisá desde la app.', jsonb_build_object('screen', 'clase', 'match_id', r.id));
      UPDATE public.matches SET reminded_24h_at = now() WHERE id = r.id;
    END IF;
    -- Dos horas antes
    IF r.reminded_2h_at IS NULL AND r.st <= now() + interval '2 hours' AND r.st > now() THEN
      PERFORM public.send_push(ARRAY[r.iu], 'Hoy ' || v_at || ' · ' || v_what || ' en ' || r.sn,
        coalesce(r.sa, 'Tocá para ver la dirección y el contacto.'), jsonb_build_object('screen', 'clase', 'match_id', r.id));
      PERFORM public.send_push(ARRAY[r.su], 'Hoy ' || v_at || ' · ' || r.iname || ' está confirmado',
        'Si algo cambia, avisá desde la app.', jsonb_build_object('screen', 'clase', 'match_id', r.id));
      UPDATE public.matches SET reminded_2h_at = now(), reminded_24h_at = coalesce(reminded_24h_at, now()) WHERE id = r.id;
    END IF;
    -- Terminó: ¿se dio la clase? (regular: el estudio decide si sigue)
    IF r.held_asked_at IS NULL AND r.en <= now() AND r.en > now() - interval '2 days' THEN
      IF r.class_type = 'regular' THEN
        PERFORM public.send_push(ARRAY[r.su], '¿Cómo te fue con ' || r.iname || '?',
          'Contanos si se dio la clase de prueba y si la sumás como clase regular.', jsonb_build_object('screen', 'clase', 'match_id', r.id));
      ELSE
        PERFORM public.send_push(ARRAY[r.su], '¿Se dio la clase con ' || r.iname || '?',
          'Confirmalo y evaluá cómo fue.', jsonb_build_object('screen', 'clase', 'match_id', r.id));
      END IF;
      PERFORM public.send_push(ARRAY[r.iu], '¿Se dio la clase en ' || r.sn || '?',
        'Confirmalo y evaluá al estudio.', jsonb_build_object('screen', 'clase', 'match_id', r.id));
      UPDATE public.matches SET held_asked_at = now() WHERE id = r.id;
    END IF;
  END LOOP;
END;
$fn$;
REVOKE EXECUTE ON FUNCTION public.match_reminders() FROM PUBLIC, anon, authenticated;
SELECT cron.unschedule('match-reminders') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'match-reminders');
SELECT cron.schedule('match-reminders', '*/10 * * * *', 'SELECT public.match_reminders()');

-- ── 6. Confiabilidad de cada lado (cancelaciones tardías y clases que no se dieron) ──
CREATE OR REPLACE FUNCTION public.reliability(p_studio uuid DEFAULT NULL, p_instructor uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $fn$
  SELECT jsonb_build_object(
    'confirmed',    count(*) FILTER (WHERE status = 'aceptado' OR cancelled_at IS NOT NULL),
    'late_cancels', count(*) FILTER (WHERE late_cancel AND cancelled_by = CASE WHEN p_studio IS NOT NULL THEN 'estudio' ELSE 'instructor' END),
    'no_shows',     count(*) FILTER (WHERE status = 'aceptado' AND CASE WHEN p_studio IS NOT NULL THEN held_instructor = false ELSE held_studio = false END))
  FROM public.matches
  WHERE auth.uid() IS NOT NULL
    AND ((p_studio IS NOT NULL AND studio_id = p_studio) OR (p_instructor IS NOT NULL AND instructor_id = p_instructor));
$fn$;
REVOKE EXECUTE ON FUNCTION public.reliability(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reliability(uuid, uuid) TO authenticated;

-- ── 7. Avisos de aceptación: llevan a la ficha de la clase ─────────
CREATE OR REPLACE FUNCTION public.notify_studio_on_match_response()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE v_studio_user uuid; v_instr_user uuid; v_instr text; v_studio text; v_amount text; v_trial text;
BEGIN
  SELECT user_id, name INTO v_studio_user, v_studio FROM public.studios WHERE id = NEW.studio_id;
  SELECT user_id, full_name INTO v_instr_user, v_instr FROM public.instructors WHERE id = NEW.instructor_id;

  IF NEW.counter_rate IS NOT NULL AND OLD.counter_rate IS NULL AND v_studio_user IS NOT NULL THEN
    PERFORM public.send_push(ARRAY[v_studio_user],
      coalesce(v_instr, 'El instructor') || ' propone otro monto',
      '$' || to_char(NEW.counter_rate, 'FM999G999G990') || ' por clase. Aceptalo o rechazalo desde Historial.',
      jsonb_build_object('screen', 'historial', 'match_id', NEW.id));
    RETURN NEW;
  END IF;

  IF OLD.status IS NOT DISTINCT FROM NEW.status OR NEW.status NOT IN ('aceptado', 'rechazado') THEN RETURN NEW; END IF;
  v_amount := CASE WHEN NEW.agreed_rate IS NOT NULL THEN ' por $' || to_char(NEW.agreed_rate, 'FM999G999G990') || ' la clase' ELSE '' END;
  v_trial := 'Entrevista y clase de prueba el ' || to_char(NEW.class_date, 'DD/MM') || ' a las ' || to_char(NEW.start_time, 'HH24:MI') || '.';

  IF OLD.counter_rate IS NOT NULL THEN
    IF v_instr_user IS NOT NULL THEN
      PERFORM public.send_push(ARRAY[v_instr_user],
        coalesce(v_studio, 'El estudio') || CASE WHEN NEW.status = 'aceptado' THEN ' aceptó tu contraoferta' ELSE ' no aceptó tu contraoferta' END,
        CASE WHEN NEW.status <> 'aceptado' THEN 'La propuesta quedó cerrada.'
             WHEN NEW.class_type = 'regular' THEN v_trial
             ELSE 'Clase confirmada' || v_amount || '.' END,
        jsonb_build_object('screen', CASE WHEN NEW.status = 'aceptado' THEN 'clase' ELSE 'propuestas' END, 'match_id', NEW.id));
    END IF;
    RETURN NEW;
  END IF;

  IF v_studio_user IS NOT NULL THEN
    PERFORM public.send_push(ARRAY[v_studio_user],
      coalesce(v_instr, 'El instructor') || CASE WHEN NEW.status = 'aceptado' AND NEW.class_type = 'regular' THEN ' aceptó la entrevista'
                                                  WHEN NEW.status = 'aceptado' THEN ' aceptó tu propuesta' ELSE ' rechazó tu propuesta' END,
      CASE WHEN NEW.status <> 'aceptado' THEN coalesce(nullif(NEW.note_instructor, ''), 'Podés buscar otro instructor.')
           WHEN NEW.class_type = 'regular' THEN v_trial
           ELSE 'Clase confirmada' || v_amount || '. Tocá para ver el contacto.' END,
      jsonb_build_object('screen', CASE WHEN NEW.status = 'aceptado' THEN 'clase' ELSE 'historial' END, 'match_id', NEW.id));
  END IF;
  RETURN NEW;
END;
$fn$;

-- ── 8. Teléfono del instructor: el estudio lo ve solo con una clase confirmada ──
CREATE OR REPLACE FUNCTION public.match_contact(p_match uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE v_side text := public.match_side(p_match); p record; s record; i record;
BEGIN
  IF v_side IS NULL THEN RETURN NULL; END IF;
  SELECT * INTO p FROM public.match_people(p_match);
  IF (p.m).status <> 'aceptado' OR (p.m).ended_at IS NOT NULL THEN RETURN NULL; END IF;
  IF v_side = 'estudio' THEN
    SELECT phone, email INTO i FROM public.instructors WHERE id = (p.m).instructor_id;
    RETURN jsonb_build_object('phone', i.phone, 'email', i.email);
  END IF;
  SELECT phone, address, instagram INTO s FROM public.studios WHERE id = (p.m).studio_id;
  RETURN jsonb_build_object('phone', s.phone, 'address', s.address, 'instagram', s.instagram);
END;
$fn$;
REVOKE EXECUTE ON FUNCTION public.match_contact(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.match_contact(uuid) TO authenticated;

-- Elegido en una clase abierta: el aviso lleva a la ficha de la clase
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
      CASE WHEN o.class_type = 'regular'
           THEN 'Entrevista y clase de prueba el ' || to_char(o.class_date, 'DD/MM') || ' a las ' || to_char(o.start_time, 'HH24:MI') || '.'
           ELSE 'Confirmada por $' || to_char(o.offered_rate, 'FM999G999G990') || ' la clase. Tocá para ver la dirección y el contacto.' END,
      jsonb_build_object('screen', 'clase', 'match_id', v_match));
  END IF;
  PERFORM public.send_push(v_others, 'La clase en ' || o.studio_name || ' ya se cubrió', 'Gracias por anotarte. Van a aparecer más clases abiertas.', jsonb_build_object('screen', 'clases_abiertas'));
  RETURN v_match;
END;
$fn$;

-- Los datos del ciclo posterior solo los cambian estas funciones (no la app directamente)
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
    -- El ciclo después de aceptar solo lo cambian las funciones de la base
    NEW.cancelled_by := NULL; NEW.cancel_reason := NULL; NEW.cancelled_at := NULL; NEW.late_cancel := false;
    NEW.held_studio := NULL; NEW.held_instructor := NULL; NEW.held_asked_at := NULL;
    NEW.reminded_24h_at := NULL; NEW.reminded_2h_at := NULL;
    NEW.hire_status := NULL; NEW.hire_decided_at := NULL; NEW.ended_at := NULL; NEW.ended_by := NULL;
    NEW.trial_paid := coalesce(NEW.trial_paid, false) AND NEW.class_type = 'regular';
    RETURN NEW;
  END IF;
  NEW.studio_id := OLD.studio_id; NEW.instructor_id := OLD.instructor_id; NEW.camara_id := OLD.camara_id;
  NEW.class_type := OLD.class_type; NEW.class_date := OLD.class_date;
  NEW.start_time := OLD.start_time; NEW.end_time := OLD.end_time;
  NEW.schedule_days := OLD.schedule_days; NEW.schedule_from := OLD.schedule_from; NEW.schedule_to := OLD.schedule_to;
  NEW.note_studio := OLD.note_studio; NEW.offered_rate := OLD.offered_rate;
  NEW.created_at := OLD.created_at; NEW.expires_at := OLD.expires_at;
  NEW.trial_paid := OLD.trial_paid;
  NEW.cancelled_by := OLD.cancelled_by; NEW.cancel_reason := OLD.cancel_reason; NEW.cancelled_at := OLD.cancelled_at; NEW.late_cancel := OLD.late_cancel;
  NEW.held_studio := OLD.held_studio; NEW.held_instructor := OLD.held_instructor; NEW.held_asked_at := OLD.held_asked_at;
  NEW.reminded_24h_at := OLD.reminded_24h_at; NEW.reminded_2h_at := OLD.reminded_2h_at;
  NEW.hire_status := OLD.hire_status; NEW.hire_decided_at := OLD.hire_decided_at; NEW.ended_at := OLD.ended_at; NEW.ended_by := OLD.ended_by;
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
