-- PENDIENTE: no aplicada todavía.
-- =====================================================================
-- Match, paso 1: el precio es una oferta, no un filtro — 2026-11-06
--  * La propuesta lleva el monto por clase que el estudio va a pagar (offered_rate).
--  * El instructor acepta, rechaza o contraoferta una vez (counter_rate). El estudio
--    acepta o rechaza la contraoferta. Lo acordado queda en agreed_rate.
--  * La tarifa del instructor es privada: nunca se compara del lado del estudio.
--  * Después de la clase, el instructor responde "¿Te pagaron lo acordado?"
--    (studio_evaluations.paid_as_agreed). La entidad lo ve en el detalle del estudio.
-- =====================================================================

ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS offered_rate integer CHECK (offered_rate IS NULL OR offered_rate > 0),
  ADD COLUMN IF NOT EXISTS counter_rate integer CHECK (counter_rate IS NULL OR counter_rate > 0),
  ADD COLUMN IF NOT EXISTS counter_at   timestamptz;

ALTER TABLE public.studio_evaluations
  ADD COLUMN IF NOT EXISTS paid_as_agreed boolean;

-- ── Reglas de escritura sobre una propuesta ──────────────────────────
-- Estudio: crea con monto; puede cancelar, o aceptar/rechazar una contraoferta.
-- Instructor: acepta, rechaza o contraoferta (una vez). Nada más se puede tocar.
CREATE OR REPLACE FUNCTION public.guard_matches_write()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $fn$
DECLARE
  v_role text := public.auth_role()::text;
BEGIN
  IF current_user NOT IN ('anon', 'authenticated') OR public.is_admin() THEN RETURN NEW; END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.offered_rate IS NULL THEN
      RAISE EXCEPTION 'Indicá cuánto pagás por clase' USING ERRCODE = 'P0001';
    END IF;
    NEW.status := 'pendiente';
    NEW.agreed_rate := NULL; NEW.counter_rate := NULL; NEW.counter_at := NULL;
    NEW.note_instructor := NULL; NEW.responded_at := NULL;
    RETURN NEW;
  END IF;

  -- Campos que nunca cambian después de creada
  NEW.studio_id := OLD.studio_id; NEW.instructor_id := OLD.instructor_id; NEW.camara_id := OLD.camara_id;
  NEW.class_type := OLD.class_type; NEW.class_date := OLD.class_date;
  NEW.start_time := OLD.start_time; NEW.end_time := OLD.end_time;
  NEW.schedule_days := OLD.schedule_days; NEW.schedule_from := OLD.schedule_from; NEW.schedule_to := OLD.schedule_to;
  NEW.note_studio := OLD.note_studio; NEW.offered_rate := OLD.offered_rate;
  NEW.created_at := OLD.created_at; NEW.expires_at := OLD.expires_at;

  IF OLD.status <> 'pendiente' THEN
    RAISE EXCEPTION 'Esta propuesta ya fue respondida' USING ERRCODE = 'P0001';
  END IF;

  IF v_role = 'instructor' THEN
    NEW.agreed_rate := OLD.agreed_rate;
    IF NEW.counter_rate IS DISTINCT FROM OLD.counter_rate THEN
      -- Contraoferta: una sola vez, y queda pendiente para el estudio
      IF OLD.counter_rate IS NOT NULL THEN RAISE EXCEPTION 'Ya hiciste una contraoferta' USING ERRCODE = 'P0001'; END IF;
      IF NEW.counter_rate IS NULL THEN RAISE EXCEPTION 'Indicá el monto' USING ERRCODE = 'P0001'; END IF;
      NEW.status := 'pendiente'; NEW.counter_at := now(); NEW.responded_at := NULL;
      RETURN NEW;
    END IF;
    IF NEW.status NOT IN ('aceptado', 'rechazado') THEN
      RAISE EXCEPTION 'Respuesta no válida' USING ERRCODE = 'P0001';
    END IF;
    IF OLD.counter_rate IS NOT NULL THEN
      RAISE EXCEPTION 'Tu contraoferta está esperando al estudio' USING ERRCODE = 'P0001';
    END IF;
    IF NEW.status = 'aceptado' THEN NEW.agreed_rate := OLD.offered_rate; END IF;
    NEW.responded_at := now();
    RETURN NEW;
  END IF;

  IF v_role = 'estudio' THEN
    NEW.counter_rate := OLD.counter_rate; NEW.counter_at := OLD.counter_at; NEW.note_instructor := OLD.note_instructor;
    IF NEW.status = 'cancelado' THEN
      NEW.agreed_rate := NULL; NEW.responded_at := now(); RETURN NEW;
    END IF;
    IF NEW.status IN ('aceptado', 'rechazado') AND OLD.counter_rate IS NOT NULL THEN
      -- Responde la contraoferta del instructor
      NEW.agreed_rate := CASE WHEN NEW.status = 'aceptado' THEN OLD.counter_rate ELSE NULL END;
      NEW.responded_at := now(); RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Solo podés cancelar la propuesta o responder una contraoferta' USING ERRCODE = 'P0001';
  END IF;

  RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501';
END;
$fn$;
DROP TRIGGER IF EXISTS trg_guard_matches_write ON public.matches;
CREATE TRIGGER trg_guard_matches_write
  BEFORE INSERT OR UPDATE ON public.matches
  FOR EACH ROW EXECUTE FUNCTION public.guard_matches_write();

-- ── Avisos ───────────────────────────────────────────────────────────
-- Nueva propuesta: incluye el monto
CREATE OR REPLACE FUNCTION public.notify_instructor_on_match()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE v_user uuid; v_studio text; v_when text;
BEGIN
  SELECT user_id INTO v_user FROM public.instructors WHERE id = NEW.instructor_id;
  SELECT name INTO v_studio FROM public.studios WHERE id = NEW.studio_id;
  IF v_user IS NULL THEN RETURN NEW; END IF;
  v_when := CASE WHEN NEW.class_type = 'regular'
    THEN 'Clase regular, ' || to_char(coalesce(NEW.schedule_from, NEW.start_time), 'HH24:MI') || ' a ' || to_char(coalesce(NEW.schedule_to, NEW.end_time), 'HH24:MI')
    ELSE 'Reemplazo el ' || to_char(NEW.class_date, 'DD/MM') || ', ' || to_char(NEW.start_time, 'HH24:MI') || ' a ' || to_char(NEW.end_time, 'HH24:MI') END;
  IF NEW.offered_rate IS NOT NULL THEN
    v_when := v_when || ' · $' || to_char(NEW.offered_rate, 'FM999G999G990') || ' por clase';
  END IF;
  PERFORM public.send_push(ARRAY[v_user], 'Nueva propuesta de ' || coalesce(v_studio, 'un estudio'), v_when,
    jsonb_build_object('screen', 'propuestas', 'match_id', NEW.id));
  RETURN NEW;
END;
$fn$;

-- Respuesta: al estudio cuando responde el instructor (o contraoferta);
-- al instructor cuando el estudio responde su contraoferta.
CREATE OR REPLACE FUNCTION public.notify_studio_on_match_response()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE v_studio_user uuid; v_instr_user uuid; v_instr text; v_studio text; v_amount text;
BEGIN
  SELECT user_id, name INTO v_studio_user, v_studio FROM public.studios WHERE id = NEW.studio_id;
  SELECT user_id, full_name INTO v_instr_user, v_instr FROM public.instructors WHERE id = NEW.instructor_id;

  -- Contraoferta nueva → estudio
  IF NEW.counter_rate IS NOT NULL AND OLD.counter_rate IS NULL AND v_studio_user IS NOT NULL THEN
    PERFORM public.send_push(ARRAY[v_studio_user],
      coalesce(v_instr, 'El instructor') || ' propone otro monto',
      '$' || to_char(NEW.counter_rate, 'FM999G999G990') || ' por clase. Aceptalo o rechazalo desde Historial.',
      jsonb_build_object('screen', 'historial', 'match_id', NEW.id));
    RETURN NEW;
  END IF;

  IF OLD.status IS NOT DISTINCT FROM NEW.status OR NEW.status NOT IN ('aceptado', 'rechazado') THEN RETURN NEW; END IF;
  v_amount := CASE WHEN NEW.agreed_rate IS NOT NULL THEN ' por $' || to_char(NEW.agreed_rate, 'FM999G999G990') || ' la clase' ELSE '' END;

  IF OLD.counter_rate IS NOT NULL THEN
    -- Respondió el estudio → instructor
    IF v_instr_user IS NOT NULL THEN
      PERFORM public.send_push(ARRAY[v_instr_user],
        coalesce(v_studio, 'El estudio') || CASE WHEN NEW.status = 'aceptado' THEN ' aceptó tu contraoferta' ELSE ' no aceptó tu contraoferta' END,
        CASE WHEN NEW.status = 'aceptado' THEN 'Clase confirmada' || v_amount || '.' ELSE 'La propuesta quedó cerrada.' END,
        jsonb_build_object('screen', 'propuestas', 'match_id', NEW.id));
    END IF;
    RETURN NEW;
  END IF;

  -- Respondió el instructor → estudio
  IF v_studio_user IS NOT NULL THEN
    PERFORM public.send_push(ARRAY[v_studio_user],
      coalesce(v_instr, 'El instructor') || CASE WHEN NEW.status = 'aceptado' THEN ' aceptó tu propuesta' ELSE ' rechazó tu propuesta' END,
      CASE WHEN NEW.status = 'aceptado' THEN 'Clase confirmada' || v_amount || '. Coordiná los detalles.' ELSE coalesce(nullif(NEW.note_instructor, ''), 'Podés buscar otro instructor.') END,
      jsonb_build_object('screen', 'historial', 'match_id', NEW.id));
  END IF;
  RETURN NEW;
END;
$fn$;

-- El aviso también tiene que dispararse cuando aparece una contraoferta
DROP TRIGGER IF EXISTS on_match_responded ON public.matches;
CREATE TRIGGER on_match_responded AFTER UPDATE OF status, counter_rate ON public.matches
  FOR EACH ROW EXECUTE FUNCTION public.notify_studio_on_match_response();
