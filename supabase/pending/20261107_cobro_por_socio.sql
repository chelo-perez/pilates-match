-- PENDIENTE
-- Cobro por socio: la entidad contrata la app para su red y paga cada mes por
-- cada socio con cuenta (precio por escalas). El socio tiene 5 avisos cubiertos
-- por mes incluidos y puede pasar a Premium si necesita más.
-- Además, la cuota del plan ahora se consume al CUBRIR una clase (propuesta
-- aceptada o clase abierta con instructor elegido), no al proponer. Las
-- propuestas pendientes y las clases abiertas reservan lugar hasta resolverse.

-- ── 1. Modelo de cobro por red ───────────────────────────────────────
ALTER TABLE public.camaras
  ADD COLUMN IF NOT EXISTS billing_model text NOT NULL DEFAULT 'subscriptions'
    CHECK (billing_model IN ('subscriptions', 'per_member')),
  ADD COLUMN IF NOT EXISTS min_billable_members integer NOT NULL DEFAULT 0 CHECK (min_billable_members >= 0);

COMMENT ON COLUMN public.camaras.billing_model IS
  'subscriptions: cada estudio paga su plan y la entidad cobra un %. per_member: la entidad paga por cada socio con cuenta.';

-- Escalas marginales: el precio rige desde from_count hasta el from_count siguiente menos uno.
CREATE TABLE IF NOT EXISTS public.member_price_tiers (
  camara_id  uuid NOT NULL REFERENCES public.camaras(id) ON DELETE CASCADE,
  from_count integer NOT NULL CHECK (from_count >= 1),
  price_ars  numeric(12,2) NOT NULL CHECK (price_ars >= 0),
  PRIMARY KEY (camara_id, from_count)
);
ALTER TABLE public.member_price_tiers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tiers_read ON public.member_price_tiers;
CREATE POLICY tiers_read ON public.member_price_tiers FOR SELECT TO authenticated USING (public.manages_camara(camara_id));
DROP POLICY IF EXISTS tiers_platform ON public.member_price_tiers;
CREATE POLICY tiers_platform ON public.member_price_tiers FOR ALL TO authenticated
  USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());

-- ── 2. Facturas mensuales de la plataforma a la entidad ─────────────
CREATE TABLE IF NOT EXISTS public.camara_invoices (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  camara_id         uuid NOT NULL REFERENCES public.camaras(id) ON DELETE CASCADE,
  period            date NOT NULL,                       -- primer día del mes facturado
  billable_members  integer NOT NULL DEFAULT 0,
  amount_ars        numeric(12,2) NOT NULL DEFAULT 0,
  detail            jsonb NOT NULL DEFAULT '[]'::jsonb,   -- escalas aplicadas
  status            text NOT NULL DEFAULT 'pendiente' CHECK (status IN ('pendiente', 'enviada', 'pagada')),
  invoice_number    text,
  sent_at           timestamptz,
  paid_at           timestamptz,
  payment_reference text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (camara_id, period)
);
ALTER TABLE public.camara_invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS invoices_read ON public.camara_invoices;
CREATE POLICY invoices_read ON public.camara_invoices FOR SELECT TO authenticated USING (public.manages_camara(camara_id));

-- Socios con cuenta en la app (cada sede con usuario cuenta)
CREATE OR REPLACE FUNCTION public.billable_members(p_camara uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $fn$
  SELECT count(*)::integer FROM public.studios s
  WHERE s.camara_id = p_camara AND s.is_member AND s.user_id IS NOT NULL;
$fn$;
REVOKE EXECUTE ON FUNCTION public.billable_members(uuid) FROM PUBLIC, anon, authenticated;

-- Cálculo del mes: cantidad facturable (con el mínimo) × escalas marginales
CREATE OR REPLACE FUNCTION public.member_billing_calc(p_camara uuid, p_members integer)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE
  v_min integer; v_n integer; v_total numeric := 0; v_rows jsonb := '[]'::jsonb; t record; v_qty integer;
BEGIN
  SELECT min_billable_members INTO v_min FROM public.camaras WHERE id = p_camara;
  v_n := greatest(coalesce(p_members, 0), coalesce(v_min, 0));
  FOR t IN
    SELECT from_count, price_ars, lead(from_count) OVER (ORDER BY from_count) - 1 AS to_count
    FROM public.member_price_tiers WHERE camara_id = p_camara ORDER BY from_count
  LOOP
    v_qty := greatest(0, least(v_n, coalesce(t.to_count, v_n)) - t.from_count + 1);
    v_rows := v_rows || jsonb_build_object('from', t.from_count, 'to', t.to_count, 'price', t.price_ars, 'qty', v_qty, 'subtotal', v_qty * t.price_ars);
    v_total := v_total + v_qty * t.price_ars;
  END LOOP;
  RETURN jsonb_build_object('members', coalesce(p_members, 0), 'min_members', coalesce(v_min, 0), 'billed_members', v_n,
                            'amount_ars', v_total, 'rows', v_rows);
END;
$fn$;
REVOKE EXECUTE ON FUNCTION public.member_billing_calc(uuid, integer) FROM PUBLIC, anon, authenticated;

-- Lo que ve la entidad (y la plataforma) en vivo: socios con cuenta hoy y estimado del mes
CREATE OR REPLACE FUNCTION public.camara_billing_preview(p_camara uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $fn$
  SELECT CASE WHEN public.manages_camara(p_camara)
    THEN public.member_billing_calc(p_camara, public.billable_members(p_camara))
      || jsonb_build_object('tiers', (SELECT coalesce(jsonb_agg(jsonb_build_object('from', from_count, 'price', price_ars) ORDER BY from_count), '[]'::jsonb)
                                      FROM public.member_price_tiers WHERE camara_id = p_camara))
    ELSE NULL END;
$fn$;
REVOKE EXECUTE ON FUNCTION public.camara_billing_preview(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.camara_billing_preview(uuid) TO authenticated;

-- Cierre de mes: una factura por red con cobro por socio (no pisa las ya enviadas)
CREATE OR REPLACE FUNCTION public.build_camara_invoices(p_period date)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE c record; v_calc jsonb; v_n integer := 0;
BEGIN
  FOR c IN SELECT id FROM public.camaras WHERE billing_model = 'per_member' AND is_active LOOP
    v_calc := public.member_billing_calc(c.id, public.billable_members(c.id));
    INSERT INTO public.camara_invoices (camara_id, period, billable_members, amount_ars, detail)
    VALUES (c.id, date_trunc('month', p_period)::date, (v_calc->>'billed_members')::integer, (v_calc->>'amount_ars')::numeric, v_calc->'rows')
    ON CONFLICT (camara_id, period) DO UPDATE
      SET billable_members = EXCLUDED.billable_members, amount_ars = EXCLUDED.amount_ars, detail = EXCLUDED.detail, updated_at = now()
      WHERE public.camara_invoices.status = 'pendiente';
    v_n := v_n + 1;
  END LOOP;
  RETURN v_n;
END;
$fn$;
REVOKE EXECUTE ON FUNCTION public.build_camara_invoices(date) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.platform_build_invoices(p_period date)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
BEGIN
  IF NOT public.is_platform_admin() THEN RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501'; END IF;
  RETURN public.build_camara_invoices(p_period);
END;
$fn$;
REVOKE EXECUTE ON FUNCTION public.platform_build_invoices(date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.platform_build_invoices(date) TO authenticated;

-- La plataforma emite la factura y le avisa a la entidad
CREATE OR REPLACE FUNCTION public.mark_invoice_sent(p_id uuid, p_invoice text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE v public.camara_invoices%ROWTYPE;
BEGIN
  IF NOT public.is_platform_admin() THEN RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v FROM public.camara_invoices WHERE id = p_id;
  IF v.id IS NULL THEN RAISE EXCEPTION 'No existe esa factura'; END IF;
  IF v.status = 'pagada' THEN RAISE EXCEPTION 'Esa factura ya está pagada'; END IF;
  UPDATE public.camara_invoices
  SET status = 'enviada', invoice_number = nullif(trim(p_invoice), ''), sent_at = now(), updated_at = now() WHERE id = p_id;
  PERFORM public.send_push(public.camara_admin_ids(v.camara_id), 'Factura de ' || to_char(v.period, 'MM/YYYY'),
    '$' || to_char(v.amount_ars, 'FM999G999G990') || ' por ' || v.billable_members || ' socios con cuenta. La ves en Reportes.',
    jsonb_build_object('screen', 'liquidaciones'));
END;
$fn$;
REVOKE EXECUTE ON FUNCTION public.mark_invoice_sent(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_invoice_sent(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.mark_invoice_paid(p_id uuid, p_reference text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
BEGIN
  IF NOT public.is_platform_admin() THEN RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501'; END IF;
  UPDATE public.camara_invoices
  SET status = 'pagada', paid_at = now(), payment_reference = nullif(trim(p_reference), ''), updated_at = now()
  WHERE id = p_id AND status <> 'pagada';
END;
$fn$;
REVOKE EXECUTE ON FUNCTION public.mark_invoice_paid(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_invoice_paid(uuid, text) TO authenticated;

-- El día 1 se factura el mes que terminó (socios con cuenta al cierre)
SELECT cron.unschedule('build-camara-invoices') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'build-camara-invoices');
SELECT cron.schedule('build-camara-invoices', '31 9 1 * *',
  $$SELECT public.build_camara_invoices((date_trunc('month', CURRENT_DATE) - interval '1 month')::date)$$);

-- ── 3. La cuota se consume al cubrir la clase ───────────────────────
-- Avisos cubiertos del mes (matches_used_month) + lo que está en curso
-- (propuestas pendientes y clases abiertas) no puede superar el límite.
CREATE OR REPLACE FUNCTION public.studio_quota(p_studio uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE m public.memberships%ROWTYPE; v_pending integer; v_open integer; v_used integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.studios s WHERE s.id = p_studio AND (s.user_id = auth.uid() OR public.manages_camara(s.camara_id))) THEN
    RETURN NULL;
  END IF;
  SELECT * INTO m FROM public.memberships WHERE studio_id = p_studio AND status = 'activa';
  SELECT count(*) INTO v_pending FROM public.matches WHERE studio_id = p_studio AND status = 'pendiente';
  SELECT count(*) INTO v_open FROM public.open_classes WHERE studio_id = p_studio AND status = 'abierta';
  v_used := CASE WHEN m.id IS NULL OR m.last_reset_date < date_trunc('month', CURRENT_DATE)::date THEN 0 ELSE coalesce(m.matches_used_month, 0) END;
  RETURN jsonb_build_object('active', m.id IS NOT NULL, 'limit', m.matches_limit, 'covered', v_used,
    'pending', v_pending, 'open', v_open,
    'available', CASE WHEN m.id IS NULL THEN 0 WHEN m.matches_limit IS NULL THEN NULL ELSE greatest(0, m.matches_limit - v_used - v_pending - v_open) END);
END;
$fn$;
REVOKE EXECUTE ON FUNCTION public.studio_quota(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.studio_quota(uuid) TO authenticated;

-- Frena (MATCH_LIMIT_REACHED) si el estudio no tiene lugar para una clase más
CREATE OR REPLACE FUNCTION public.assert_match_quota(p_studio uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE m public.memberships%ROWTYPE; v_reserved integer;
BEGIN
  SELECT * INTO m FROM public.memberships WHERE studio_id = p_studio AND status = 'activa' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'MATCH_LIMIT_REACHED' USING ERRCODE = 'P0001'; END IF;
  IF m.last_reset_date < date_trunc('month', CURRENT_DATE)::date THEN
    UPDATE public.memberships SET matches_used_month = 0, last_reset_date = date_trunc('month', CURRENT_DATE)::date WHERE id = m.id;
    m.matches_used_month := 0;
  END IF;
  IF m.matches_limit IS NULL THEN RETURN; END IF;
  SELECT (SELECT count(*) FROM public.matches WHERE studio_id = p_studio AND status = 'pendiente')
       + (SELECT count(*) FROM public.open_classes WHERE studio_id = p_studio AND status = 'abierta') INTO v_reserved;
  IF m.matches_used_month + v_reserved >= m.matches_limit THEN
    RAISE EXCEPTION 'MATCH_LIMIT_REACHED' USING ERRCODE = 'P0001';
  END IF;
END;
$fn$;
REVOKE EXECUTE ON FUNCTION public.assert_match_quota(uuid) FROM PUBLIC, anon, authenticated;

-- ¿Tiene lugar para una clase más? (misma regla que el trigger)
CREATE OR REPLACE FUNCTION public.can_studio_match(p_studio_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $fn$
  SELECT COALESCE((
    SELECT m.matches_limit IS NULL
        OR (CASE WHEN m.last_reset_date < date_trunc('month', CURRENT_DATE)::date THEN 0 ELSE m.matches_used_month END)
           + (SELECT count(*) FROM public.matches x WHERE x.studio_id = p_studio_id AND x.status = 'pendiente')
           + (SELECT count(*) FROM public.open_classes o WHERE o.studio_id = p_studio_id AND o.status = 'abierta')
           < m.matches_limit
    FROM public.memberships m
    WHERE m.studio_id = p_studio_id AND m.status = 'activa'
  ), false);
$fn$;

-- Al proponer: solo se controla el lugar (ya no se descuenta)
CREATE OR REPLACE FUNCTION public.enforce_match_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
BEGIN
  IF public.is_admin() OR current_setting('app.open_class_pick', true) = '1' THEN RETURN NEW; END IF;
  PERFORM public.assert_match_quota(NEW.studio_id);
  RETURN NEW;
END;
$fn$;

-- Al cubrir (propuesta aceptada o instructor elegido en clase abierta): se descuenta
CREATE OR REPLACE FUNCTION public.count_covered_match()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
BEGIN
  IF NEW.status = 'aceptado' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'aceptado') THEN
    UPDATE public.memberships
    SET matches_used_month = CASE WHEN last_reset_date < date_trunc('month', CURRENT_DATE)::date THEN 1 ELSE coalesce(matches_used_month, 0) + 1 END,
        last_reset_date = GREATEST(last_reset_date, date_trunc('month', CURRENT_DATE)::date)
    WHERE studio_id = NEW.studio_id AND status = 'activa';
  END IF;
  RETURN NEW;
END;
$fn$;
REVOKE EXECUTE ON FUNCTION public.count_covered_match() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_count_covered_match ON public.matches;
CREATE TRIGGER trg_count_covered_match
  AFTER INSERT OR UPDATE OF status ON public.matches
  FOR EACH ROW EXECUTE FUNCTION public.count_covered_match();

-- Publicar una clase abierta reserva lugar; se descuenta recién al elegir instructor
CREATE OR REPLACE FUNCTION public.publish_open_class(
  p_class_type text, p_class_date date, p_start time, p_end time,
  p_days text[], p_from time, p_to time, p_offered integer, p_note text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE
  v_studio record; v_id uuid; v_users uuid[]; v_when text;
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

  PERFORM public.assert_match_quota(v_studio.id);

  INSERT INTO public.open_classes (studio_id, camara_id, class_type, class_date, start_time, end_time, schedule_days, schedule_from, schedule_to, offered_rate, note, expires_at)
  VALUES (v_studio.id, v_studio.camara_id, p_class_type::public.class_type, p_class_date, p_start, p_end,
          CASE WHEN p_class_type = 'regular' THEN p_days::public.day_of_week[] END,
          CASE WHEN p_class_type = 'regular' THEN p_from END, CASE WHEN p_class_type = 'regular' THEN p_to END,
          p_offered, nullif(trim(coalesce(p_note, '')), ''),
          CASE WHEN p_class_type = 'regular' THEN now() + interval '72 hours'
               ELSE least(now() + interval '72 hours', (p_class_date + p_start) AT TIME ZONE 'America/Argentina/Buenos_Aires') END)
  RETURNING id INTO v_id;

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

-- ── 4. Un socio cuyo Premium vence vuelve a Socio, no a Freemium ────
CREATE OR REPLACE FUNCTION public.expire_paid_plans()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $fn$
  UPDATE public.memberships m
  SET plan_type = CASE WHEN s.is_member THEN 'socio' ELSE 'freemium' END,
      matches_limit = CASE WHEN s.is_member THEN 5 ELSE 1 END, price_ars = NULL,
      start_date = CURRENT_DATE, end_date = CURRENT_DATE + CASE WHEN s.is_member THEN interval '1 year' ELSE interval '10 years' END
  FROM public.studios s
  WHERE s.id = m.studio_id AND m.plan_type IN ('starter', 'premium') AND m.status = 'activa' AND m.end_date < CURRENT_DATE;
$fn$;
