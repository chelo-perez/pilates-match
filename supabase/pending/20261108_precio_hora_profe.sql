-- PENDIENTE
-- Precio por sede atado a la hora profe: cada escala puede ser un monto fijo o un
-- factor de la hora profe promedio de la red (ej. 1,0 = una hora profe por sede).
-- El promedio sale de lo acordado en las clases cubiertas de los últimos 90 días;
-- si hay pocas, de las tarifas de los instructores verificados de la red.

ALTER TABLE public.camaras
  ADD COLUMN IF NOT EXISTS price_index text NOT NULL DEFAULT 'fixed' CHECK (price_index IN ('fixed', 'avg_hour'));
ALTER TABLE public.member_price_tiers
  ADD COLUMN IF NOT EXISTS hour_factor numeric(6,3) NOT NULL DEFAULT 1 CHECK (hour_factor >= 0);

-- Hora profe promedio de la red (por clase), redondeada a $100. NULL si no hay datos.
CREATE OR REPLACE FUNCTION public.network_avg_hour(p_camara uuid)
RETURNS numeric LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE v_avg numeric; v_n integer;
BEGIN
  SELECT avg(agreed_rate), count(*) INTO v_avg, v_n FROM public.matches
  WHERE camara_id = p_camara AND status = 'aceptado' AND agreed_rate > 0
    AND coalesce(responded_at, created_at) >= now() - interval '90 days';
  IF coalesce(v_n, 0) < 5 THEN
    SELECT avg(r.rate_regular) INTO v_avg FROM public.instructor_rates r
    JOIN public.instructors i ON i.id = r.instructor_id
    WHERE i.camara_id = p_camara AND i.verification_status = 'verificado' AND r.rate_regular > 0;
  END IF;
  RETURN CASE WHEN v_avg IS NULL THEN NULL ELSE round(v_avg / 100) * 100 END;
END;
$fn$;
REVOKE EXECUTE ON FUNCTION public.network_avg_hour(uuid) FROM PUBLIC, anon, authenticated;

-- Cálculo del mes con el precio de cada escala resuelto (fijo o factor × hora profe)
CREATE OR REPLACE FUNCTION public.member_billing_calc(p_camara uuid, p_members integer)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE
  v_min integer; v_index text; v_hour numeric; v_n integer; v_total numeric := 0; v_rows jsonb := '[]'::jsonb; t record; v_qty integer; v_price numeric;
BEGIN
  SELECT min_billable_members, price_index INTO v_min, v_index FROM public.camaras WHERE id = p_camara;
  v_hour := CASE WHEN v_index = 'avg_hour' THEN public.network_avg_hour(p_camara) END;
  v_n := greatest(coalesce(p_members, 0), coalesce(v_min, 0));
  FOR t IN
    SELECT from_count, price_ars, hour_factor, lead(from_count) OVER (ORDER BY from_count) - 1 AS to_count
    FROM public.member_price_tiers WHERE camara_id = p_camara ORDER BY from_count
  LOOP
    -- Sin promedio todavía (red nueva): rige el monto fijo de la escala
    v_price := CASE WHEN v_hour IS NOT NULL THEN round(v_hour * t.hour_factor / 100) * 100 ELSE t.price_ars END;
    v_qty := greatest(0, least(v_n, coalesce(t.to_count, v_n)) - t.from_count + 1);
    v_rows := v_rows || jsonb_build_object('from', t.from_count, 'to', t.to_count, 'price', v_price, 'factor', t.hour_factor, 'qty', v_qty, 'subtotal', v_qty * v_price);
    v_total := v_total + v_qty * v_price;
  END LOOP;
  RETURN jsonb_build_object('members', coalesce(p_members, 0), 'min_members', coalesce(v_min, 0), 'billed_members', v_n,
                            'price_index', v_index, 'avg_hour', v_hour, 'amount_ars', v_total, 'rows', v_rows);
END;
$fn$;

CREATE OR REPLACE FUNCTION public.camara_billing_preview(p_camara uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $fn$
  SELECT CASE WHEN public.manages_camara(p_camara)
    THEN public.member_billing_calc(p_camara, public.billable_members(p_camara))
      || jsonb_build_object('tiers', (SELECT coalesce(jsonb_agg(jsonb_build_object('from', from_count, 'price', price_ars, 'factor', hour_factor) ORDER BY from_count), '[]'::jsonb)
                                      FROM public.member_price_tiers WHERE camara_id = p_camara),
                            'current_avg_hour', public.network_avg_hour(p_camara))
    ELSE NULL END;
$fn$;

-- La factura guarda la hora profe que se usó
ALTER TABLE public.camara_invoices ADD COLUMN IF NOT EXISTS avg_hour numeric(12,2);
CREATE OR REPLACE FUNCTION public.build_camara_invoices(p_period date)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE c record; v_calc jsonb; v_n integer := 0;
BEGIN
  FOR c IN SELECT id FROM public.camaras WHERE billing_model = 'per_member' AND is_active LOOP
    v_calc := public.member_billing_calc(c.id, public.billable_members(c.id));
    INSERT INTO public.camara_invoices (camara_id, period, billable_members, amount_ars, detail, avg_hour)
    VALUES (c.id, date_trunc('month', p_period)::date, (v_calc->>'billed_members')::integer, (v_calc->>'amount_ars')::numeric, v_calc->'rows', (v_calc->>'avg_hour')::numeric)
    ON CONFLICT (camara_id, period) DO UPDATE
      SET billable_members = EXCLUDED.billable_members, amount_ars = EXCLUDED.amount_ars, detail = EXCLUDED.detail, avg_hour = EXCLUDED.avg_hour, updated_at = now()
      WHERE public.camara_invoices.status = 'pendiente';
    v_n := v_n + 1;
  END LOOP;
  RETURN v_n;
END;
$fn$;
