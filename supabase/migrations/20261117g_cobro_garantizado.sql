-- Cobro garantizado de reemplazos (split de Mercado Pago).
--
-- * Cada entidad lo activa en su red (camaras.guaranteed_pay_enabled).
-- * El instructor conecta su cuenta de Mercado Pago una vez (OAuth). Los tokens se guardan cifrados
--   (instructor_mp_accounts) y solo los leen las Edge Functions (sin políticas para la app).
-- * Cuando se confirma un reemplazo, el estudio tiene que pagarlo por la app antes del plazo:
--     total = (bloque + comisión de la plataforma) / (1 − costo de Mercado Pago)
--   La plata va directo al Mercado Pago del instructor, que recibe el 100% del bloque. Mercado Pago le
--   descuenta a la plataforma su comisión (marketplace_fee) y cobra su costo sobre el total.
-- * Si no se paga a tiempo, el reemplazo se cancela. Si el instructor cancela, o el estudio cancela con más
--   de 24 h, se le devuelve al estudio. Si el estudio cancela con menos de 24 h, el instructor cobra igual.

ALTER TABLE public.camaras
  ADD COLUMN IF NOT EXISTS guaranteed_pay_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS guaranteed_fee_pct numeric NOT NULL DEFAULT 5 CHECK (guaranteed_fee_pct BETWEEN 0 AND 30);

CREATE TABLE IF NOT EXISTS public.platform_settings (
  key   text PRIMARY KEY,
  value numeric NOT NULL,
  note  text
);
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS platform_settings_read ON public.platform_settings;
CREATE POLICY platform_settings_read ON public.platform_settings FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS platform_settings_write ON public.platform_settings;
CREATE POLICY platform_settings_write ON public.platform_settings FOR ALL TO authenticated
  USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());
INSERT INTO public.platform_settings (key, value, note) VALUES
  ('mp_cost_pct', 7.61, 'Costo de Mercado Pago sobre el total con dinero disponible al instante: 6,29% + IVA. Ajustar si cambia la tarifa o el plazo de acreditación.')
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.instructor_mp_accounts (
  instructor_id     uuid PRIMARY KEY REFERENCES public.instructors(id) ON DELETE CASCADE,
  mp_user_id        bigint,
  mp_email          text,
  access_token_enc  text NOT NULL,
  refresh_token_enc text,
  expires_at        timestamptz,
  status            text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  connected_at      timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.instructor_mp_accounts ENABLE ROW LEVEL SECURITY; -- sin políticas: solo service_role

CREATE TABLE IF NOT EXISTS public.mp_oauth_states (
  state         text PRIMARY KEY,
  instructor_id uuid NOT NULL REFERENCES public.instructors(id) ON DELETE CASCADE,
  code_verifier text NOT NULL,
  return_to     text,
  created_at    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.mp_oauth_states ENABLE ROW LEVEL SECURITY; -- sin políticas: solo service_role

ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS pay_status text CHECK (pay_status IN ('pendiente_pago', 'pagado', 'vencido', 'a_devolver', 'devuelto', 'anulado')),
  ADD COLUMN IF NOT EXISTS pay_block_ars integer,
  ADD COLUMN IF NOT EXISTS pay_fee_ars integer,
  ADD COLUMN IF NOT EXISTS pay_total_ars integer,
  ADD COLUMN IF NOT EXISTS pay_deadline timestamptz,
  ADD COLUMN IF NOT EXISTS pay_paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS pay_payment_id text,
  ADD COLUMN IF NOT EXISTS pay_refunded_at timestamptz;

-- ── Cálculos ────────────────────────────────────────────────────────
/** Cantidad de clases de un reemplazo: una por hora del bloque (mínimo 1) */
CREATE OR REPLACE FUNCTION public.match_classes(m public.matches)
RETURNS integer LANGUAGE sql IMMUTABLE SET search_path TO '' AS $$
  SELECT greatest(1, floor(extract(epoch FROM (m.end_time - m.start_time)) / 3600)::integer);
$$;

/** Bloque, comisión, costo de Mercado Pago y total que paga el estudio, para una red */
CREATE OR REPLACE FUNCTION public.guaranteed_amounts(p_block numeric, p_camara uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $$
DECLARE v_on boolean; v_fee_pct numeric; v_mp numeric; v_fee integer; v_total integer;
BEGIN
  SELECT guaranteed_pay_enabled, guaranteed_fee_pct INTO v_on, v_fee_pct FROM public.camaras WHERE id = p_camara;
  SELECT value INTO v_mp FROM public.platform_settings WHERE key = 'mp_cost_pct';
  v_mp := coalesce(v_mp, 7.61);
  v_fee := round(p_block * coalesce(v_fee_pct, 5) / 100);
  v_total := ceil((p_block + v_fee) / (1 - v_mp / 100));
  RETURN jsonb_build_object('enabled', coalesce(v_on, false), 'block', round(p_block), 'fee', v_fee, 'fee_pct', v_fee_pct,
    'mp_cost', v_total - round(p_block) - v_fee, 'mp_pct', v_mp, 'total', v_total);
END $$;

/** Para el estudio: cuánto pagaría por un reemplazo con este bloque en su red */
CREATE OR REPLACE FUNCTION public.guaranteed_quote(p_block integer)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $$
  SELECT public.guaranteed_amounts(p_block, public.my_studio_camara_id());
$$;
REVOKE ALL ON FUNCTION public.guaranteed_quote(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.guaranteed_quote(integer) TO authenticated;
REVOKE ALL ON FUNCTION public.guaranteed_amounts(numeric, uuid) FROM PUBLIC, anon, authenticated;

/** Para el instructor: si su red usa cobro garantizado y si ya conectó su Mercado Pago */
CREATE OR REPLACE FUNCTION public.my_mp_connection()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $$
  SELECT jsonb_build_object(
    'required', coalesce((SELECT c.guaranteed_pay_enabled FROM public.instructors i JOIN public.camaras c ON c.id = i.camara_id WHERE i.user_id = auth.uid()), false),
    'connected', a.instructor_id IS NOT NULL AND a.status = 'active',
    'email', a.mp_email, 'connected_at', a.connected_at)
  FROM (SELECT 1) x
  LEFT JOIN public.instructors i ON i.user_id = auth.uid()
  LEFT JOIN public.instructor_mp_accounts a ON a.instructor_id = i.id;
$$;
REVOKE ALL ON FUNCTION public.my_mp_connection() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_mp_connection() TO authenticated;

-- ── Para aceptar un reemplazo con cobro garantizado, el instructor tiene que tener su Mercado Pago conectado ──
CREATE OR REPLACE FUNCTION public.require_mp_for_guaranteed()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
BEGIN
  IF NEW.class_type <> 'reemplazo' OR current_setting('app.open_class_pick', true) = '1' THEN RETURN NEW; END IF;
  IF NOT ((NEW.status = 'aceptado' AND OLD.status = 'pendiente') OR (NEW.counter_rate IS DISTINCT FROM OLD.counter_rate AND NEW.counter_rate IS NOT NULL)) THEN RETURN NEW; END IF;
  IF NOT coalesce((SELECT guaranteed_pay_enabled FROM public.camaras WHERE id = NEW.camara_id), false) THEN RETURN NEW; END IF;
  IF EXISTS (SELECT 1 FROM public.instructor_mp_accounts WHERE instructor_id = NEW.instructor_id AND status = 'active') THEN RETURN NEW; END IF;
  IF public.auth_role()::text = 'instructor' THEN
    RAISE EXCEPTION 'Conectá tu Mercado Pago para aceptar reemplazos: el estudio te paga por la app.' USING ERRCODE = 'P0001';
  END IF;
  RAISE EXCEPTION 'El instructor todavía no conectó su Mercado Pago para cobrar por la app.' USING ERRCODE = 'P0001';
END $$;
DROP TRIGGER IF EXISTS trg_require_mp ON public.matches;
CREATE TRIGGER trg_require_mp BEFORE UPDATE ON public.matches FOR EACH ROW EXECUTE FUNCTION public.require_mp_for_guaranteed();

-- ── Al confirmarse un reemplazo en una red con cobro garantizado: queda pendiente de pago ──
CREATE OR REPLACE FUNCTION public.start_guaranteed_pay()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE v_amt jsonb; v_user uuid; v_start timestamptz; v_deadline timestamptz; v_block integer;
BEGIN
  IF NEW.status <> 'aceptado' OR NEW.class_type <> 'reemplazo' OR NEW.pay_status IS NOT NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'aceptado' THEN RETURN NEW; END IF;
  IF NOT coalesce((SELECT guaranteed_pay_enabled FROM public.camaras WHERE id = NEW.camara_id), false) THEN RETURN NEW; END IF;
  v_block := coalesce(NEW.agreed_rate, NEW.offered_rate) * public.match_classes(NEW);
  v_amt := public.guaranteed_amounts(v_block, NEW.camara_id);
  v_start := public.match_start_ts(NEW);
  -- Hasta 24 h para pagar, y siempre antes de la clase (1 h antes; si es muy pronto, 15 min antes)
  v_deadline := least(now() + interval '24 hours', v_start - interval '1 hour');
  IF v_deadline < now() + interval '20 minutes' THEN v_deadline := v_start - interval '15 minutes'; END IF;
  UPDATE public.matches SET pay_status = 'pendiente_pago', pay_block_ars = v_block, pay_fee_ars = (v_amt->>'fee')::integer,
    pay_total_ars = (v_amt->>'total')::integer, pay_deadline = v_deadline WHERE id = NEW.id;
  SELECT user_id INTO v_user FROM public.studios WHERE id = NEW.studio_id;
  PERFORM public.send_push(ARRAY[v_user], 'Pagá el reemplazo para confirmarlo: $' || to_char((v_amt->>'total')::integer, 'FM999G999G990'),
    'Tenés tiempo hasta el ' || to_char(v_deadline AT TIME ZONE 'America/Argentina/Buenos_Aires', 'DD/MM HH24:MI') || '. Si el instructor cancela, te lo devolvemos.',
    jsonb_build_object('screen', 'clase', 'match_id', NEW.id));
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_start_guaranteed_pay ON public.matches;
CREATE TRIGGER trg_start_guaranteed_pay AFTER INSERT OR UPDATE ON public.matches FOR EACH ROW EXECUTE FUNCTION public.start_guaranteed_pay();

-- ── El pago se acreditó (lo llama el webhook de Mercado Pago, con service_role) ──
CREATE OR REPLACE FUNCTION public.guaranteed_paid(p_match uuid, p_payment_id text, p_amount numeric)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE p record;
BEGIN
  SELECT * INTO p FROM public.match_people(p_match);
  IF (p.m).id IS NULL OR (p.m).pay_status NOT IN ('pendiente_pago', 'vencido', 'anulado') THEN RETURN; END IF;
  IF p_amount < (p.m).pay_total_ars THEN RETURN; END IF;
  IF (p.m).pay_status <> 'pendiente_pago' THEN
    -- Llegó tarde (venció o se canceló): se devuelve
    UPDATE public.matches SET pay_status = 'a_devolver', pay_payment_id = p_payment_id, pay_paid_at = now() WHERE id = p_match;
    RETURN;
  END IF;
  UPDATE public.matches SET pay_status = 'pagado', pay_payment_id = p_payment_id, pay_paid_at = now() WHERE id = p_match;
  PERFORM public.send_push(ARRAY[p.instr_user], coalesce(p.studio_name, 'El estudio') || ' pagó el reemplazo',
    '$' || to_char((p.m).pay_block_ars, 'FM999G999G990') || ' ya están en tu Mercado Pago. Clase el ' || to_char((p.m).class_date, 'DD/MM')
    || ' a las ' || to_char((p.m).start_time, 'HH24:MI') || '.', jsonb_build_object('screen', 'clase', 'match_id', p_match));
  PERFORM public.send_push(ARRAY[p.studio_user], 'Reemplazo confirmado',
    'Ya podés ver el contacto de ' || coalesce(p.instr_name, 'el instructor') || '.', jsonb_build_object('screen', 'clase', 'match_id', p_match));
END $$;
REVOKE ALL ON FUNCTION public.guaranteed_paid(uuid, text, numeric) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.guaranteed_refunded(p_match uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE p record;
BEGIN
  SELECT * INTO p FROM public.match_people(p_match);
  IF (p.m).pay_status <> 'a_devolver' THEN RETURN; END IF;
  UPDATE public.matches SET pay_status = 'devuelto', pay_refunded_at = now() WHERE id = p_match;
  PERFORM public.send_push(ARRAY[p.studio_user], 'Te devolvimos el pago del reemplazo',
    '$' || to_char((p.m).pay_total_ars, 'FM999G999G990') || ' vuelven al mismo medio de pago.', jsonb_build_object('screen', 'clase', 'match_id', p_match));
END $$;
REVOKE ALL ON FUNCTION public.guaranteed_refunded(uuid) FROM PUBLIC, anon, authenticated;

/** La plataforma decide devolver un pago (por ejemplo, la clase no se dio) */
CREATE OR REPLACE FUNCTION public.guaranteed_mark_refund(p_match uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501'; END IF;
  UPDATE public.matches SET pay_status = 'a_devolver' WHERE id = p_match AND pay_status = 'pagado';
END $$;
REVOKE ALL ON FUNCTION public.guaranteed_mark_refund(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.guaranteed_mark_refund(uuid) TO authenticated;

-- ── Funciones existentes: campos de pago protegidos, contacto oculto hasta pagar, vencimiento y devoluciones ──
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
    NEW.pay_status := NULL; NEW.pay_block_ars := NULL; NEW.pay_fee_ars := NULL; NEW.pay_total_ars := NULL;
    NEW.pay_deadline := NULL; NEW.pay_paid_at := NULL; NEW.pay_payment_id := NULL; NEW.pay_refunded_at := NULL;
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
  NEW.pay_status := OLD.pay_status; NEW.pay_block_ars := OLD.pay_block_ars; NEW.pay_fee_ars := OLD.pay_fee_ars; NEW.pay_total_ars := OLD.pay_total_ars;
  NEW.pay_deadline := OLD.pay_deadline; NEW.pay_paid_at := OLD.pay_paid_at; NEW.pay_payment_id := OLD.pay_payment_id; NEW.pay_refunded_at := OLD.pay_refunded_at;
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
$function$;

CREATE OR REPLACE FUNCTION public.match_contact(p_match uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_side text := public.match_side(p_match); p record; s record; i record;
BEGIN
  IF v_side IS NULL THEN RETURN NULL; END IF;
  SELECT * INTO p FROM public.match_people(p_match);
  IF (p.m).status <> 'aceptado' OR (p.m).ended_at IS NOT NULL THEN RETURN NULL; END IF;
  IF (p.m).placement_status = 'pendiente_pago' THEN RETURN NULL; END IF;
  IF (p.m).pay_status = 'pendiente_pago' THEN RETURN NULL; END IF;
  IF v_side = 'estudio' THEN
    SELECT phone, email INTO i FROM public.instructors WHERE id = (p.m).instructor_id;
    RETURN jsonb_build_object('phone', i.phone, 'email', i.email);
  END IF;
  SELECT phone, address, instagram INTO s FROM public.studios WHERE id = (p.m).studio_id;
  RETURN jsonb_build_object('phone', s.phone, 'address', s.address, 'instagram', s.instagram);
END;
$function$;

CREATE OR REPLACE FUNCTION public.match_reminders()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE r record; v_what text; v_at text;
BEGIN
  -- Reemplazos con cobro garantizado que no se pagaron a tiempo
  FOR r IN
    SELECT m.id, s.user_id AS su, s.name AS sn, i.user_id AS iu, i.full_name AS iname
    FROM public.matches m JOIN public.studios s ON s.id = m.studio_id JOIN public.instructors i ON i.id = m.instructor_id
    WHERE m.status = 'aceptado' AND m.pay_status = 'pendiente_pago' AND m.pay_deadline < now()
  LOOP
    UPDATE public.matches SET status = 'cancelado', cancelled_by = 'estudio', cancel_reason = 'No se pagó a tiempo',
           cancelled_at = now(), pay_status = 'vencido' WHERE id = r.id;
    PERFORM public.send_push(ARRAY[r.iu], 'Se canceló el reemplazo en ' || r.sn,
      'El estudio no lo pagó a tiempo. Te avisamos cuando haya otras propuestas.', jsonb_build_object('screen', 'clase', 'match_id', r.id));
    PERFORM public.send_push(ARRAY[r.su], 'Se canceló el reemplazo con ' || r.iname,
      'No se pagó a tiempo. Podés volver a proponerlo.', jsonb_build_object('screen', 'clase', 'match_id', r.id));
  END LOOP;

  FOR r IN
    SELECT m.id, s.user_id AS su, s.name AS sn, i.user_id AS iu, i.full_name AS iname, m.class_date, m.start_time
    FROM public.matches m JOIN public.studios s ON s.id = m.studio_id JOIN public.instructors i ON i.id = m.instructor_id
    WHERE m.status = 'aceptado' AND m.placement_status = 'pendiente_pago' AND m.placement_deadline < now()
  LOOP
    UPDATE public.matches SET status = 'cancelado', cancelled_by = 'estudio', cancel_reason = 'No se confirmó a tiempo',
           cancelled_at = now(), placement_status = 'vencido' WHERE id = r.id;
    PERFORM public.send_push(ARRAY[r.iu], 'Se canceló la entrevista en ' || r.sn,
      'El estudio no la confirmó a tiempo. Te avisamos cuando haya otras propuestas.', jsonb_build_object('screen', 'clase', 'match_id', r.id));
    PERFORM public.send_push(ARRAY[r.su], 'Se canceló la entrevista con ' || r.iname,
      'No se pagó el cargo de incorporación a tiempo. Podés volver a proponerla.', jsonb_build_object('screen', 'clase', 'match_id', r.id));
  END LOOP;

  FOR r IN
    SELECT m.*, s.user_id AS su, s.name AS sn, s.address AS sa, i.user_id AS iu, i.full_name AS iname,
           public.match_start_ts(m) AS st, public.match_end_ts(m) AS en
    FROM public.matches m JOIN public.studios s ON s.id = m.studio_id JOIN public.instructors i ON i.id = m.instructor_id
    WHERE m.status = 'aceptado' AND m.class_date BETWEEN CURRENT_DATE - 2 AND CURRENT_DATE + 2
      AND m.placement_status IS DISTINCT FROM 'pendiente_pago'
      AND m.pay_status IS DISTINCT FROM 'pendiente_pago'
  LOOP
    v_what := CASE WHEN r.class_type = 'regular' THEN 'Entrevista y clase de prueba' ELSE 'Reemplazo' END;
    v_at := to_char(r.start_time, 'HH24:MI');
    IF r.reminded_24h_at IS NULL AND r.st <= now() + interval '24 hours' AND r.st > now() + interval '2 hours'
       AND coalesce(r.responded_at, r.created_at) < r.st - interval '24 hours' THEN
      PERFORM public.send_push(ARRAY[r.iu], 'Mañana ' || v_at || ' · ' || v_what || ' en ' || r.sn,
        coalesce(r.sa, 'Tocá para ver la dirección y el contacto.'), jsonb_build_object('screen', 'clase', 'match_id', r.id));
      PERFORM public.send_push(ARRAY[r.su], 'Mañana ' || v_at || ' · ' || r.iname,
        lower(v_what) || ' confirmado. Si algo cambia, avisá desde la app.', jsonb_build_object('screen', 'clase', 'match_id', r.id));
      UPDATE public.matches SET reminded_24h_at = now() WHERE id = r.id;
    END IF;
    IF r.reminded_2h_at IS NULL AND r.st <= now() + interval '2 hours' AND r.st > now() THEN
      PERFORM public.send_push(ARRAY[r.iu], 'Hoy ' || v_at || ' · ' || v_what || ' en ' || r.sn,
        coalesce(r.sa, 'Tocá para ver la dirección y el contacto.'), jsonb_build_object('screen', 'clase', 'match_id', r.id));
      PERFORM public.send_push(ARRAY[r.su], 'Hoy ' || v_at || ' · ' || r.iname || ' está confirmado',
        'Si algo cambia, avisá desde la app.', jsonb_build_object('screen', 'clase', 'match_id', r.id));
      UPDATE public.matches SET reminded_2h_at = now(), reminded_24h_at = coalesce(reminded_24h_at, now()) WHERE id = r.id;
    END IF;
    IF r.held_asked_at IS NULL AND r.en <= now() AND r.en > now() - interval '2 days' THEN
      IF r.class_type = 'regular' THEN
        PERFORM public.send_push(ARRAY[r.su], '¿Cómo te fue con ' || r.iname || '?',
          'Contanos si se dio la clase de prueba y si la sumás como clase regular.', jsonb_build_object('screen', 'clase', 'match_id', r.id));
      ELSE
        PERFORM public.send_push(ARRAY[r.su], '¿Se dio la clase con ' || r.iname || '?',
          'Confirmalo y evaluá cómo fue.', jsonb_build_object('screen', 'clase', 'match_id', r.id));
      END IF;
      PERFORM public.send_push(ARRAY[r.iu],
        CASE WHEN r.class_type = 'regular' THEN '¿Cómo te fue en ' || r.sn || '?' ELSE '¿Se dio la clase en ' || r.sn || '?' END,
        CASE WHEN r.class_type = 'regular' THEN 'Contanos si querés tomar la clase regular.' ELSE 'Confirmalo y evaluá al estudio.' END,
        jsonb_build_object('screen', 'clase', 'match_id', r.id));
      UPDATE public.matches SET held_asked_at = now() WHERE id = r.id;
    END IF;
  END LOOP;
END;
$function$;

CREATE OR REPLACE FUNCTION public.cancel_confirmed_match(p_match uuid, p_reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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

  IF (p.m).placement_status = 'pendiente_pago' THEN
    UPDATE public.matches SET placement_status = 'anulado' WHERE id = p_match;
  ELSIF (p.m).placement_status = 'pagado' THEN
    PERFORM public.settle_placement(p_match, CASE WHEN v_side = 'instructor' THEN 'devolver' ELSE 'credito' END);
  END IF;

  -- Cobro garantizado: si cancela el instructor, o el estudio con más de 24 h, se devuelve.
  -- Si el estudio cancela con menos de 24 h, el instructor cobra igual (para eso es la garantía).
  IF (p.m).pay_status = 'pendiente_pago' THEN
    UPDATE public.matches SET pay_status = 'anulado' WHERE id = p_match;
  ELSIF (p.m).pay_status = 'pagado' AND (v_side = 'instructor' OR NOT v_late) THEN
    UPDATE public.matches SET pay_status = 'a_devolver' WHERE id = p_match;
  END IF;

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
$function$;
