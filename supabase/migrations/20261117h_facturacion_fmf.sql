-- Facturación automática con Facturo Más Fácil (FMF).
--
-- Cada cobro que ya no tiene devolución posible entra en una cola (platform_invoices). La función
-- fmf-facturar (cada 15 min) emite cada una en FMF a nombre de Tecnología Más Fácil S.A.S.
-- (Responsable Inscripto: Factura A a quien tiene CUIT inscripto, B al resto; FMF decide con el padrón).
-- La clave de idempotencia en FMF es "<origen>:<id>": un reintento nunca factura dos veces.
--
-- Qué se factura y cuándo:
--   incorporacion  cargo de incorporación, cuando queda cobrado (las dos partes siguieron). No con crédito.
--   reemplazo      comisión del cobro garantizado, 24 h después de la clase si no se devolvió.
--   plan           cobro mensual de un plan (Mercado Pago, aprobado).
--   entidad        abono mensual de una entidad con cobro por sede (desde el panel: "Emitir con FMF").
--   manual         cualquier otro cobro, cargado desde el panel (ej.: patrocinios).

CREATE TABLE IF NOT EXISTS public.platform_invoices (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source         text NOT NULL CHECK (source IN ('incorporacion', 'reemplazo', 'plan', 'entidad', 'manual')),
  source_id      text NOT NULL,
  studio_id      uuid REFERENCES public.studios(id) ON DELETE SET NULL,
  camara_id      uuid REFERENCES public.camaras(id) ON DELETE SET NULL,
  customer_name  text NOT NULL,
  customer_cuit  text,
  concept        text NOT NULL,
  amount_ars     numeric NOT NULL CHECK (amount_ars > 0),
  status         text NOT NULL DEFAULT 'pendiente' CHECK (status IN ('pendiente', 'emitiendo', 'emitida', 'error', 'anulada')),
  attempts       integer NOT NULL DEFAULT 0,
  last_error     text,
  cae            text,
  cbte_nro       integer,
  letra          text,
  pdf_path       text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  emitted_at     timestamptz,
  UNIQUE (source, source_id)
);
CREATE INDEX IF NOT EXISTS platform_invoices_status ON public.platform_invoices (status, created_at);
ALTER TABLE public.platform_invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS platform_invoices_admin ON public.platform_invoices;
CREATE POLICY platform_invoices_admin ON public.platform_invoices FOR SELECT TO authenticated
  USING (public.is_platform_admin() OR (camara_id IS NOT NULL AND camara_id = public.my_camara_id() AND source = 'entidad'));

/** CUIT de 11 dígitos o null */
CREATE OR REPLACE FUNCTION public.clean_cuit(p text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path TO '' AS $$
  SELECT CASE WHEN length(regexp_replace(coalesce(p, ''), '\D', '', 'g')) = 11 THEN regexp_replace(p, '\D', '', 'g') END;
$$;

/** Pone en la cola lo que ya se puede facturar. Lo corre la tarea programada (y se puede correr a mano). */
CREATE OR REPLACE FUNCTION public.enqueue_due_invoices()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE n integer := 0; k integer;
BEGIN
  -- Cargo de incorporación cobrado (no el que se pagó con crédito)
  INSERT INTO public.platform_invoices (source, source_id, studio_id, camara_id, customer_name, customer_cuit, concept, amount_ars)
  SELECT 'incorporacion', m.id::text, s.id, m.camara_id, s.name, public.clean_cuit(s.cuit),
         'Cargo de incorporación de instructor (' || coalesce(i.full_name, 'instructor') || ')', m.placement_fee_ars
  FROM public.matches m JOIN public.studios s ON s.id = m.studio_id LEFT JOIN public.instructors i ON i.id = m.instructor_id
  WHERE m.placement_status = 'cobrado' AND coalesce(m.placement_via, '') <> 'credito' AND m.placement_fee_ars > 0
  ON CONFLICT (source, source_id) DO NOTHING;
  GET DIAGNOSTICS k = ROW_COUNT; n := n + k;

  -- Comisión del cobro garantizado: 24 h después de la clase, si no hubo devolución
  INSERT INTO public.platform_invoices (source, source_id, studio_id, camara_id, customer_name, customer_cuit, concept, amount_ars)
  SELECT 'reemplazo', m.id::text, s.id, m.camara_id, s.name, public.clean_cuit(s.cuit),
         'Servicio de gestión y cobro de reemplazo del ' || to_char(m.class_date, 'DD/MM/YYYY'), m.pay_fee_ars
  FROM public.matches m JOIN public.studios s ON s.id = m.studio_id
  WHERE m.pay_status = 'pagado' AND m.pay_fee_ars > 0 AND public.match_end_ts(m) < now() - interval '24 hours'
  ON CONFLICT (source, source_id) DO NOTHING;
  GET DIAGNOSTICS k = ROW_COUNT; n := n + k;

  -- Cobro mensual de un plan
  INSERT INTO public.platform_invoices (source, source_id, studio_id, camara_id, customer_name, customer_cuit, concept, amount_ars)
  SELECT 'plan', p.id, s.id, p.camara_id, s.name, public.clean_cuit(s.cuit),
         'Plan ' || initcap(coalesce(p.plan_type, '')) || ' de Trabajo Más Fácil', p.amount_ars
  FROM public.payments p JOIN public.studios s ON s.id = p.studio_id
  WHERE p.status = 'approved' AND p.amount_ars > 0
  ON CONFLICT (source, source_id) DO NOTHING;
  GET DIAGNOSTICS k = ROW_COUNT; n := n + k;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.enqueue_due_invoices() FROM PUBLIC, anon, authenticated;

/** Panel: emitir con FMF el abono mensual de una entidad */
CREATE OR REPLACE FUNCTION public.enqueue_entity_invoice(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE v public.camara_invoices%ROWTYPE; c public.camaras%ROWTYPE;
BEGIN
  IF NOT public.is_platform_admin() THEN RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v FROM public.camara_invoices WHERE id = p_id;
  IF v.id IS NULL OR coalesce(v.amount_ars, 0) <= 0 THEN RAISE EXCEPTION 'No hay nada para facturar' USING ERRCODE = 'P0001'; END IF;
  SELECT * INTO c FROM public.camaras WHERE id = v.camara_id;
  INSERT INTO public.platform_invoices (source, source_id, camara_id, customer_name, customer_cuit, concept, amount_ars)
  VALUES ('entidad', v.id::text, v.camara_id, c.name, public.clean_cuit(c.cuit),
          'Abono Trabajo Más Fácil ' || to_char(v.period, 'MM/YYYY') || ' (' || v.billable_members || ' sedes socias)', v.amount_ars)
  ON CONFLICT (source, source_id) DO NOTHING;
END $$;
REVOKE ALL ON FUNCTION public.enqueue_entity_invoice(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.enqueue_entity_invoice(uuid) TO authenticated;

/** Panel: facturar a mano cualquier otro cobro (patrocinios, etc.) */
CREATE OR REPLACE FUNCTION public.enqueue_manual_invoice(p_customer text, p_cuit text, p_concept text, p_amount numeric)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE v_id uuid := gen_random_uuid();
BEGIN
  IF NOT public.is_platform_admin() THEN RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501'; END IF;
  IF length(trim(coalesce(p_customer, ''))) < 2 OR length(trim(coalesce(p_concept, ''))) < 3 OR coalesce(p_amount, 0) <= 0 THEN
    RAISE EXCEPTION 'Completá cliente, concepto e importe' USING ERRCODE = 'P0001';
  END IF;
  INSERT INTO public.platform_invoices (id, source, source_id, customer_name, customer_cuit, concept, amount_ars)
  VALUES (v_id, 'manual', v_id::text, trim(p_customer), public.clean_cuit(p_cuit), trim(p_concept), p_amount);
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.enqueue_manual_invoice(text, text, text, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.enqueue_manual_invoice(text, text, text, numeric) TO authenticated;

/** Panel: reintentar una que dio error */
CREATE OR REPLACE FUNCTION public.retry_platform_invoice(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501'; END IF;
  UPDATE public.platform_invoices SET status = 'pendiente', last_error = NULL WHERE id = p_id AND status = 'error';
END $$;
REVOKE ALL ON FUNCTION public.retry_platform_invoice(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.retry_platform_invoice(uuid) TO authenticated;

-- PDFs de las facturas (privado: los lee la plataforma con link firmado)
INSERT INTO storage.buckets (id, name, public) VALUES ('facturas', 'facturas', false) ON CONFLICT (id) DO NOTHING;
DROP POLICY IF EXISTS facturas_platform_read ON storage.objects;
CREATE POLICY facturas_platform_read ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'facturas' AND public.is_platform_admin());

-- Interruptor general: la emisión real arranca apagada (1 = emite). Se prende cuando Tecnología Más Fácil
-- tiene en FMF el certificado y el punto de venta listos.
ALTER TABLE public.platform_invoices ADD COLUMN IF NOT EXISTS claimed_at timestamptz;
INSERT INTO public.platform_settings (key, value, note)
VALUES ('fmf_invoicing_on', 0, 'Facturación automática con FMF: 1 emite, 0 solo encola')
ON CONFLICT (key) DO NOTHING;

/** La función fmf-facturar toma hasta p_n facturas para emitir (las trabadas hace más de 30 min vuelven a la cola;
    reintentar es seguro porque la clave en FMF es idempotente). Solo service_role. */
CREATE OR REPLACE FUNCTION public.claim_platform_invoices(p_n integer)
RETURNS SETOF public.platform_invoices LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
BEGIN
  UPDATE public.platform_invoices SET status = 'pendiente'
   WHERE status = 'emitiendo' AND claimed_at < now() - interval '30 minutes';
  RETURN QUERY
  UPDATE public.platform_invoices p SET status = 'emitiendo', claimed_at = now(), attempts = p.attempts + 1
   WHERE p.id IN (SELECT id FROM public.platform_invoices WHERE status = 'pendiente'
                  ORDER BY created_at LIMIT p_n FOR UPDATE SKIP LOCKED)
  RETURNING p.*;
END $$;
REVOKE ALL ON FUNCTION public.claim_platform_invoices(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_platform_invoices(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.enqueue_due_invoices() TO service_role;

-- Cada 15 minutos: encola lo facturable y emite (si el interruptor está prendido)
SELECT cron.unschedule('fmf-facturar') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'fmf-facturar');
SELECT cron.schedule('fmf-facturar', '*/15 * * * *',
  $$SELECT net.http_post(url := 'https://tkhaiovstwgqzabvxxss.supabase.co/functions/v1/fmf-facturar', body := '{}'::jsonb)$$);

-- Abono de entidad emitido en FMF: queda "enviada" con su número y se le avisa a la entidad (como al cargarla a mano)
CREATE OR REPLACE FUNCTION public.on_platform_invoice_emitted()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE v public.camara_invoices%ROWTYPE;
BEGIN
  IF NEW.source <> 'entidad' OR NEW.status <> 'emitida' OR OLD.status = 'emitida' THEN RETURN NEW; END IF;
  SELECT * INTO v FROM public.camara_invoices WHERE id = NEW.source_id::uuid;
  IF v.id IS NULL OR v.status <> 'pendiente' THEN RETURN NEW; END IF;
  UPDATE public.camara_invoices
     SET status = 'enviada', invoice_number = trim(coalesce(NEW.letra, '') || ' ' || NEW.cbte_nro), sent_at = now(), updated_at = now()
   WHERE id = v.id;
  PERFORM public.send_push(public.camara_admin_ids(v.camara_id), 'Factura de ' || to_char(v.period, 'MM/YYYY'),
    '$' || to_char(v.amount_ars, 'FM999G999G990') || ' por ' || v.billable_members || ' socios con cuenta. La ves en Reportes.',
    jsonb_build_object('screen', 'liquidaciones'));
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS platform_invoice_emitted ON public.platform_invoices;
CREATE TRIGGER platform_invoice_emitted AFTER UPDATE OF status ON public.platform_invoices
  FOR EACH ROW EXECUTE FUNCTION public.on_platform_invoice_emitted();

/** Panel: estado del interruptor (los admins de plataforma lo leen) */
CREATE OR REPLACE FUNCTION public.fmf_invoicing_on()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $$
  SELECT public.is_platform_admin() AND coalesce((SELECT value = 1 FROM public.platform_settings WHERE key = 'fmf_invoicing_on'), false);
$$;
GRANT EXECUTE ON FUNCTION public.fmf_invoicing_on() TO authenticated;
