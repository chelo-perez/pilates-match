-- Entrevista de clase regular con dos opciones de día y hora.
-- El estudio propone una segunda opción (alt_*). Al aceptar o contraofertar, el instructor puede elegirla
-- (alt_chosen = true) y la base la pasa a class_date / start_time / end_time, que es la fecha de la entrevista.
ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS alt_date date,
  ADD COLUMN IF NOT EXISTS alt_start_time time,
  ADD COLUMN IF NOT EXISTS alt_end_time time,
  ADD COLUMN IF NOT EXISTS alt_chosen boolean NOT NULL DEFAULT false;
CREATE OR REPLACE FUNCTION public.guard_matches_write()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE v_role text := public.auth_role()::text;
BEGIN
  IF current_user NOT IN ('anon', 'authenticated') OR public.is_admin() OR current_setting('app.open_class_pick', true) = '1' THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.offered_rate IS NULL THEN RAISE EXCEPTION 'Indicá cuánto pagás por clase' USING ERRCODE = 'P0001'; END IF;
    NEW.status := 'pendiente';
    NEW.agreed_rate := NULL; NEW.counter_rate := NULL; NEW.counter_at := NULL;
    NEW.note_instructor := NULL; NEW.responded_at := NULL;
    NEW.cancelled_by := NULL; NEW.cancel_reason := NULL; NEW.cancelled_at := NULL; NEW.late_cancel := false;
    NEW.held_studio := NULL; NEW.held_instructor := NULL; NEW.held_asked_at := NULL;
    NEW.reminded_24h_at := NULL; NEW.reminded_2h_at := NULL;
    NEW.hire_status := NULL; NEW.hire_decided_at := NULL; NEW.ended_at := NULL; NEW.ended_by := NULL;
    NEW.trial_paid := coalesce(NEW.trial_paid, false) AND NEW.class_type = 'regular';
    NEW.placement_fee_ars := NULL; NEW.placement_status := NULL; NEW.placement_deadline := NULL; NEW.placement_paid_at := NULL;
    NEW.placement_via := NULL; NEW.placement_payment_id := NULL;
    NEW.studio_continue := NULL; NEW.instructor_continue := NULL; NEW.instructor_reason := NULL;
    NEW.alt_chosen := false;
    -- Segunda opción de entrevista: solo en clases regulares y completa (día y hora)
    IF NEW.class_type <> 'regular' OR NEW.alt_date IS NULL OR NEW.alt_start_time IS NULL THEN
      NEW.alt_date := NULL; NEW.alt_start_time := NULL; NEW.alt_end_time := NULL;
    ELSIF NEW.alt_end_time IS NULL THEN
      NEW.alt_end_time := NEW.alt_start_time + (NEW.end_time - NEW.start_time);
    END IF;
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
  NEW.placement_fee_ars := OLD.placement_fee_ars; NEW.placement_status := OLD.placement_status; NEW.placement_deadline := OLD.placement_deadline;
  NEW.placement_paid_at := OLD.placement_paid_at; NEW.placement_via := OLD.placement_via; NEW.placement_payment_id := OLD.placement_payment_id;
  NEW.studio_continue := OLD.studio_continue; NEW.instructor_continue := OLD.instructor_continue; NEW.instructor_reason := OLD.instructor_reason;
  NEW.alt_date := OLD.alt_date; NEW.alt_start_time := OLD.alt_start_time; NEW.alt_end_time := OLD.alt_end_time;
  IF v_role = 'instructor' AND coalesce(NEW.alt_chosen, false) AND NOT coalesce(OLD.alt_chosen, false) AND OLD.alt_date IS NOT NULL THEN
    -- El instructor eligió la segunda opción: pasa a ser la fecha de la entrevista
    NEW.class_date := OLD.alt_date; NEW.start_time := OLD.alt_start_time; NEW.end_time := OLD.alt_end_time;
    NEW.alt_chosen := true;
  ELSE
    NEW.alt_chosen := OLD.alt_chosen;
  END IF;
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
$function$
;
