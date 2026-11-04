-- =====================================================================
-- Varias Cámaras (sectores) + cobros con Mercado Pago + liquidaciones — 2026-11-05
--
-- Modelo: la plataforma cobra los abonos de los estudios (Mercado Pago de la
-- plataforma) y cada mes le paga a cada Cámara un % de lo cobrado en su red.
-- La Cámara carga su factura en la app y la plataforma la marca como pagada.
--
--  1. Cámaras con sector, etiquetas y % de reparto
--  2. Funciones de permisos: dueño de la plataforma (super_admin) y Cámara
--  3. Todo registro nuevo queda asignado a una Cámara (la elegida o la principal)
--  4. Cada Cámara ve y gestiona solo lo de su red
--  5. Avisos de verificación solo a la Cámara que corresponde
--  6. Precios por Cámara, suscripciones y cobros
--  7. Liquidaciones mensuales a cada Cámara
--  8. Planes pagos vencidos vuelven a Freemium
-- Se puede correr más de una vez.
-- =====================================================================

-- ── 1. Cámaras ───────────────────────────────────────────────────────
ALTER TABLE public.camaras
  ADD COLUMN IF NOT EXISTS sector            text NOT NULL DEFAULT 'pilates',
  ADD COLUMN IF NOT EXISTS business_label    text NOT NULL DEFAULT 'Estudio de Pilates',
  ADD COLUMN IF NOT EXISTS instructor_label  text NOT NULL DEFAULT 'Instructor/a de Pilates',
  ADD COLUMN IF NOT EXISTS revenue_share_pct numeric(5,2) NOT NULL DEFAULT 25,
  ADD COLUMN IF NOT EXISTS cuit              text;
DO $do$ BEGIN
  ALTER TABLE public.camaras ADD CONSTRAINT camaras_share_pct_check CHECK (revenue_share_pct BETWEEN 0 AND 100);
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- ── 2. Permisos ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $fn$
  SELECT coalesce(public.auth_role() = 'super_admin', false);
$fn$;

CREATE OR REPLACE FUNCTION public.my_camara_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $fn$
  SELECT camara_id FROM public.users WHERE id = auth.uid() AND role = 'camara_admin';
$fn$;

-- Dueño de la plataforma: todo. Admin de Cámara: solo su Cámara.
CREATE OR REPLACE FUNCTION public.manages_camara(p_camara uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $fn$
  SELECT public.is_platform_admin() OR (p_camara IS NOT NULL AND p_camara = public.my_camara_id());
$fn$;

CREATE OR REPLACE FUNCTION public.my_studio_camara_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $fn$
  SELECT camara_id FROM public.studios WHERE user_id = auth.uid() LIMIT 1;
$fn$;

CREATE OR REPLACE FUNCTION public.default_camara_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $fn$
  SELECT id FROM public.camaras WHERE is_active ORDER BY created_at LIMIT 1;
$fn$;

-- La Cámara elegida si existe y está activa; si no, la principal
CREATE OR REPLACE FUNCTION public.resolve_camara(p_camara uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $fn$
  SELECT coalesce((SELECT id FROM public.camaras WHERE id = p_camara AND is_active), public.default_camara_id());
$fn$;

REVOKE EXECUTE ON FUNCTION public.is_platform_admin(), public.my_camara_id(), public.manages_camara(uuid),
  public.my_studio_camara_id(), public.default_camara_id(), public.resolve_camara(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_platform_admin(), public.my_camara_id(), public.manages_camara(uuid),
  public.my_studio_camara_id(), public.default_camara_id(), public.resolve_camara(uuid) TO authenticated;

-- ── 3. Asignación de Cámara ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.guard_studios_write()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $fn$
BEGIN
  IF TG_OP = 'INSERT' THEN NEW.camara_id := public.resolve_camara(NEW.camara_id); END IF;
  IF current_user NOT IN ('anon', 'authenticated') OR public.is_admin() THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.is_member := false;
    NEW.member_since := NULL;
  ELSE
    NEW.is_member := OLD.is_member;
    NEW.member_since := OLD.member_since;
    NEW.camara_id := OLD.camara_id;
    NEW.user_id := OLD.user_id;
  END IF;
  RETURN NEW;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.guard_instructors_write()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $fn$
BEGIN
  IF TG_OP = 'INSERT' THEN NEW.camara_id := public.resolve_camara(NEW.camara_id); END IF;
  IF current_user NOT IN ('anon', 'authenticated') OR public.is_admin() THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.verification_status := 'pendiente';
    NEW.verified_at := NULL;
    NEW.verified_by := NULL;
    NEW.verification_note := NULL;
  ELSE
    NEW.verification_status := OLD.verification_status;
    NEW.verified_at := OLD.verified_at;
    NEW.verified_by := OLD.verified_by;
    NEW.verification_note := OLD.verification_note;
    NEW.user_id := OLD.user_id;
    NEW.added_by_studio := OLD.added_by_studio;
    NEW.camara_id := OLD.camara_id;
  END IF;
  RETURN NEW;
END;
$fn$;

-- Propuestas, membresías, evaluaciones y certificados heredan la Cámara
CREATE OR REPLACE FUNCTION public.set_child_camara()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE v_inst uuid;
BEGIN
  IF TG_TABLE_NAME = 'certifications' THEN
    SELECT camara_id INTO NEW.camara_id FROM public.instructors WHERE id = NEW.instructor_id;
  ELSE
    SELECT camara_id INTO NEW.camara_id FROM public.studios WHERE id = NEW.studio_id;
  END IF;
  IF TG_TABLE_NAME = 'matches' THEN
    SELECT camara_id INTO v_inst FROM public.instructors WHERE id = NEW.instructor_id;
    IF v_inst IS DISTINCT FROM NEW.camara_id THEN
      RAISE EXCEPTION 'Ese instructor no es parte de tu red' USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN NEW;
END;
$fn$;
REVOKE EXECUTE ON FUNCTION public.set_child_camara() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_set_camara ON public.matches;
CREATE TRIGGER trg_set_camara BEFORE INSERT ON public.matches FOR EACH ROW EXECUTE FUNCTION public.set_child_camara();
DROP TRIGGER IF EXISTS trg_set_camara ON public.memberships;
CREATE TRIGGER trg_set_camara BEFORE INSERT ON public.memberships FOR EACH ROW EXECUTE FUNCTION public.set_child_camara();
DROP TRIGGER IF EXISTS trg_set_camara ON public.certifications;
CREATE TRIGGER trg_set_camara BEFORE INSERT ON public.certifications FOR EACH ROW EXECUTE FUNCTION public.set_child_camara();
DROP TRIGGER IF EXISTS trg_set_camara ON public.evaluations;
CREATE TRIGGER trg_set_camara BEFORE INSERT ON public.evaluations FOR EACH ROW EXECUTE FUNCTION public.set_child_camara();
DROP TRIGGER IF EXISTS trg_set_camara ON public.studio_evaluations;
CREATE TRIGGER trg_set_camara BEFORE INSERT ON public.studio_evaluations FOR EACH ROW EXECUTE FUNCTION public.set_child_camara();

-- Datos existentes
UPDATE public.studios     SET camara_id = public.default_camara_id() WHERE camara_id IS NULL;
UPDATE public.instructors SET camara_id = public.default_camara_id() WHERE camara_id IS NULL;
UPDATE public.matches m            SET camara_id = s.camara_id FROM public.studios s WHERE s.id = m.studio_id AND m.camara_id IS DISTINCT FROM s.camara_id;
UPDATE public.memberships m        SET camara_id = s.camara_id FROM public.studios s WHERE s.id = m.studio_id AND m.camara_id IS DISTINCT FROM s.camara_id;
UPDATE public.evaluations e        SET camara_id = s.camara_id FROM public.studios s WHERE s.id = e.studio_id AND e.camara_id IS DISTINCT FROM s.camara_id;
UPDATE public.studio_evaluations e SET camara_id = s.camara_id FROM public.studios s WHERE s.id = e.studio_id AND e.camara_id IS DISTINCT FROM s.camara_id;
UPDATE public.certifications c     SET camara_id = i.camara_id FROM public.instructors i WHERE i.id = c.instructor_id AND c.camara_id IS DISTINCT FROM i.camara_id;

-- ── 4. Cada Cámara ve lo suyo ────────────────────────────────────────
DROP POLICY IF EXISTS instructors_admin_all ON public.instructors;
CREATE POLICY instructors_admin_all ON public.instructors FOR ALL TO authenticated
  USING (public.manages_camara(camara_id)) WITH CHECK (public.manages_camara(camara_id));
-- Los estudios ven solo a los instructores de su red
DROP POLICY IF EXISTS instructors_studio_read ON public.instructors;
CREATE POLICY instructors_studio_read ON public.instructors FOR SELECT TO authenticated
  USING (public.auth_role() = 'estudio' AND camara_id = public.my_studio_camara_id());

DROP POLICY IF EXISTS camara_manage_studios ON public.studios;
CREATE POLICY camara_manage_studios ON public.studios FOR ALL TO authenticated
  USING (public.manages_camara(camara_id)) WITH CHECK (public.manages_camara(camara_id));

DROP POLICY IF EXISTS matches_admin_read ON public.matches;
CREATE POLICY matches_admin_read ON public.matches FOR SELECT TO authenticated USING (public.manages_camara(camara_id));

DROP POLICY IF EXISTS camara_manage_memberships ON public.memberships;
CREATE POLICY camara_manage_memberships ON public.memberships FOR ALL TO authenticated
  USING (public.manages_camara(camara_id)) WITH CHECK (public.manages_camara(camara_id));

DROP POLICY IF EXISTS camara_manage_certs ON public.certifications;
CREATE POLICY camara_manage_certs ON public.certifications FOR ALL TO authenticated
  USING (public.manages_camara(camara_id)) WITH CHECK (public.manages_camara(camara_id));

DROP POLICY IF EXISTS camara_read_evals ON public.evaluations;
CREATE POLICY camara_read_evals ON public.evaluations FOR SELECT TO authenticated USING (public.manages_camara(camara_id));

DROP POLICY IF EXISTS studio_evals_camara ON public.studio_evaluations;
CREATE POLICY studio_evals_camara ON public.studio_evaluations FOR SELECT TO authenticated USING (public.manages_camara(camara_id));

DROP POLICY IF EXISTS camara_read_rates ON public.instructor_rates;
CREATE POLICY camara_read_rates ON public.instructor_rates FOR SELECT TO authenticated
  USING (instructor_id IN (SELECT id FROM public.instructors WHERE public.manages_camara(camara_id)));

DROP POLICY IF EXISTS camara_read_budgets ON public.studio_budgets;
CREATE POLICY camara_read_budgets ON public.studio_budgets FOR SELECT TO authenticated
  USING (studio_id IN (SELECT id FROM public.studios WHERE public.manages_camara(camara_id)));

DROP POLICY IF EXISTS camara_studio_notes_admin ON public.camara_studio_notes;
CREATE POLICY camara_studio_notes_admin ON public.camara_studio_notes FOR ALL TO authenticated
  USING (studio_id IN (SELECT id FROM public.studios WHERE public.manages_camara(camara_id)))
  WITH CHECK (studio_id IN (SELECT id FROM public.studios WHERE public.manages_camara(camara_id)));

DROP POLICY IF EXISTS "camara_admin puede ver sus notas" ON public.camara_instructor_notes;
DROP POLICY IF EXISTS camara_instructor_notes_admin ON public.camara_instructor_notes;
CREATE POLICY camara_instructor_notes_admin ON public.camara_instructor_notes FOR ALL TO authenticated
  USING (public.manages_camara(camara_id)) WITH CHECK (public.manages_camara(camara_id));

DROP POLICY IF EXISTS users_admin_read ON public.users;
CREATE POLICY users_admin_read ON public.users FOR SELECT TO authenticated USING (
  public.is_platform_admin()
  OR (public.my_camara_id() IS NOT NULL AND (
       camara_id = public.my_camara_id()
       OR id IN (SELECT user_id FROM public.studios WHERE camara_id = public.my_camara_id())
       OR id IN (SELECT user_id FROM public.instructors WHERE camara_id = public.my_camara_id()))));

-- El dueño de la plataforma nombra a los admins de cada Cámara (la persona ya tiene que tener cuenta)
CREATE OR REPLACE FUNCTION public.platform_set_camara_admin(p_email text, p_camara uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
BEGIN
  IF NOT public.is_platform_admin() THEN RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.camaras WHERE id = p_camara) THEN RAISE EXCEPTION 'La Cámara no existe'; END IF;
  UPDATE public.users SET role = 'camara_admin', camara_id = p_camara
  WHERE lower(email) = lower(trim(p_email)) AND role <> 'super_admin';
  IF NOT FOUND THEN RAISE EXCEPTION 'No encontramos una cuenta con ese email. Pedile que se registre primero.'; END IF;
END;
$fn$;
REVOKE EXECUTE ON FUNCTION public.platform_set_camara_admin(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.platform_set_camara_admin(text, uuid) TO authenticated;

-- ── 5. Avisos a la Cámara que corresponde ────────────────────────────
CREATE OR REPLACE FUNCTION public.camara_admin_ids(p_camara uuid)
RETURNS uuid[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $fn$
  SELECT coalesce(array_agg(id), '{}') FROM public.users WHERE role = 'camara_admin' AND camara_id = p_camara;
$fn$;
REVOKE EXECUTE ON FUNCTION public.camara_admin_ids(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.platform_admin_ids()
RETURNS uuid[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $fn$
  SELECT coalesce(array_agg(id), '{}') FROM public.users WHERE role = 'super_admin';
$fn$;
REVOKE EXECUTE ON FUNCTION public.platform_admin_ids() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.notify_on_instructor_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
BEGIN
  IF NEW.user_id IS NOT NULL AND NEW.verification_status = 'pendiente'
     AND (TG_OP = 'INSERT' OR OLD.user_id IS DISTINCT FROM NEW.user_id) THEN
    PERFORM public.send_push(public.camara_admin_ids(NEW.camara_id), 'Instructor nuevo para verificar',
      NEW.full_name || ' se registró y espera la verificación.',
      jsonb_build_object('screen', 'verificar', 'instructor_id', NEW.id));
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.user_id IS NOT NULL THEN
    IF NEW.verification_status = 'verificado' AND OLD.verification_status IS DISTINCT FROM 'verificado' THEN
      PERFORM public.send_push(ARRAY[NEW.user_id], '¡Tu perfil fue verificado!',
        'Ya aparecés en las búsquedas de los estudios.', jsonb_build_object('screen', 'inicio'));
    ELSIF NEW.verification_status = 'rechazado' AND OLD.verification_status IS DISTINCT FROM 'rechazado' THEN
      PERFORM public.send_push(ARRAY[NEW.user_id], 'Tu perfil no fue aprobado',
        coalesce(nullif(NEW.verification_note, ''), 'Revisá el motivo en tu perfil.'), jsonb_build_object('screen', 'perfil'));
    ELSIF NEW.verification_status = 'pendiente' AND nullif(NEW.verification_note, '') IS NOT NULL
          AND NEW.verification_note IS DISTINCT FROM OLD.verification_note THEN
      PERFORM public.send_push(ARRAY[NEW.user_id], 'La Cámara te pidió una corrección',
        NEW.verification_note, jsonb_build_object('screen', 'perfil'));
    END IF;
  END IF;
  RETURN NEW;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.notify_on_certification_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE v_instr record;
BEGIN
  SELECT id, user_id, full_name, camara_id INTO v_instr FROM public.instructors WHERE id = NEW.instructor_id;
  IF NEW.document_url IS NOT NULL AND coalesce(NEW.review_status, 'pending') = 'pending'
     AND (TG_OP = 'INSERT' OR OLD.document_url IS DISTINCT FROM NEW.document_url) THEN
    PERFORM public.send_push(public.camara_admin_ids(v_instr.camara_id), 'Certificado para revisar',
      coalesce(v_instr.full_name, 'Un instructor') || ' subió «' || NEW.name || '».',
      jsonb_build_object('screen', 'verificar', 'instructor_id', NEW.instructor_id));
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.review_status = 'rejected' AND OLD.review_status IS DISTINCT FROM 'rejected'
     AND v_instr.user_id IS NOT NULL THEN
    PERFORM public.send_push(ARRAY[v_instr.user_id], 'Un certificado fue rechazado',
      '«' || NEW.name || '»: ' || coalesce(nullif(NEW.review_note, ''), 'revisá el motivo en tu perfil.'),
      jsonb_build_object('screen', 'perfil'));
  END IF;
  RETURN NEW;
END;
$fn$;

-- ── 6. Precios, suscripciones y cobros ───────────────────────────────
-- Precio mensual de cada plan pago, por Cámara. Lo define la plataforma.
CREATE TABLE IF NOT EXISTS public.plan_prices (
  camara_id  uuid NOT NULL REFERENCES public.camaras(id) ON DELETE CASCADE,
  plan_type  text NOT NULL CHECK (plan_type IN ('starter', 'premium')),
  price_ars  integer NOT NULL CHECK (price_ars > 0),
  active     boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (camara_id, plan_type)
);
ALTER TABLE public.plan_prices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS plan_prices_read ON public.plan_prices;
CREATE POLICY plan_prices_read ON public.plan_prices FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS plan_prices_platform_write ON public.plan_prices;
CREATE POLICY plan_prices_platform_write ON public.plan_prices FOR ALL TO authenticated
  USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());
REVOKE ALL ON public.plan_prices FROM anon;

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id                text PRIMARY KEY,
  studio_id         uuid NOT NULL REFERENCES public.studios(id) ON DELETE CASCADE,
  camara_id         uuid REFERENCES public.camaras(id),
  plan_type         text NOT NULL,
  status            text NOT NULL DEFAULT 'pending',
  amount_ars        numeric NOT NULL,
  payer_email       text,
  init_point        text,
  next_payment_date timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS subscriptions_studio_idx ON public.subscriptions (studio_id, created_at DESC);
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS subscriptions_read ON public.subscriptions;
CREATE POLICY subscriptions_read ON public.subscriptions FOR SELECT TO authenticated
  USING (public.manages_camara(camara_id) OR studio_id IN (SELECT id FROM public.studios WHERE user_id = auth.uid()));
REVOKE ALL ON public.subscriptions FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.subscriptions FROM authenticated;

CREATE TABLE IF NOT EXISTS public.payments (
  id              text PRIMARY KEY,
  subscription_id text,
  studio_id       uuid REFERENCES public.studios(id) ON DELETE SET NULL,
  camara_id       uuid REFERENCES public.camaras(id),
  plan_type       text,
  amount_ars      numeric,
  status          text NOT NULL,
  paid_at         timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS payments_camara_idx ON public.payments (camara_id, paid_at DESC);
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS payments_read ON public.payments;
CREATE POLICY payments_read ON public.payments FOR SELECT TO authenticated
  USING (public.manages_camara(camara_id) OR studio_id IN (SELECT id FROM public.studios WHERE user_id = auth.uid()));
REVOKE ALL ON public.payments FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.payments FROM authenticated;

-- ── 7. Liquidaciones mensuales ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.camara_settlements (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  camara_id            uuid NOT NULL REFERENCES public.camaras(id) ON DELETE CASCADE,
  period               date NOT NULL,                 -- primer día del mes liquidado
  collected_ars        numeric NOT NULL DEFAULT 0,    -- lo cobrado a los estudios de esa Cámara
  share_pct            numeric(5,2) NOT NULL,
  share_ars            numeric NOT NULL DEFAULT 0,    -- lo que se le paga a la Cámara
  status               text NOT NULL DEFAULT 'pendiente' CHECK (status IN ('pendiente', 'facturada', 'pagada')),
  invoice_number       text,
  invoice_submitted_at timestamptz,
  paid_at              timestamptz,
  payment_reference    text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (camara_id, period)
);
ALTER TABLE public.camara_settlements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS settlements_read ON public.camara_settlements;
CREATE POLICY settlements_read ON public.camara_settlements FOR SELECT TO authenticated USING (public.manages_camara(camara_id));
REVOKE ALL ON public.camara_settlements FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.camara_settlements FROM authenticated;

-- Calcula (o recalcula, si todavía no se facturó) la liquidación de un mes
CREATE OR REPLACE FUNCTION public.build_camara_settlements(p_period date)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE v_start date := date_trunc('month', p_period)::date;
BEGIN
  INSERT INTO public.camara_settlements (camara_id, period, collected_ars, share_pct, share_ars)
  SELECT c.id, v_start, coalesce(t.total, 0), c.revenue_share_pct,
         round(coalesce(t.total, 0) * c.revenue_share_pct / 100, 2)
  FROM public.camaras c
  LEFT JOIN (
    SELECT camara_id, sum(amount_ars) AS total FROM public.payments
    WHERE status IN ('approved', 'processed')
      AND paid_at >= v_start AND paid_at < (v_start + interval '1 month')
    GROUP BY camara_id
  ) t ON t.camara_id = c.id
  WHERE c.is_active
  ON CONFLICT (camara_id, period) DO UPDATE
    SET collected_ars = EXCLUDED.collected_ars, share_pct = EXCLUDED.share_pct,
        share_ars = EXCLUDED.share_ars, updated_at = now()
    WHERE public.camara_settlements.status = 'pendiente';
END;
$fn$;
REVOKE EXECUTE ON FUNCTION public.build_camara_settlements(date) FROM PUBLIC, anon, authenticated;

-- La plataforma puede recalcular un mes a pedido (por ejemplo, el mes en curso)
CREATE OR REPLACE FUNCTION public.platform_build_settlements(p_period date)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
BEGIN
  IF NOT public.is_platform_admin() THEN RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501'; END IF;
  PERFORM public.build_camara_settlements(p_period);
END;
$fn$;
REVOKE EXECUTE ON FUNCTION public.platform_build_settlements(date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.platform_build_settlements(date) TO authenticated;

-- La Cámara informa el número de su factura
CREATE OR REPLACE FUNCTION public.submit_settlement_invoice(p_id uuid, p_invoice text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE v record;
BEGIN
  SELECT s.*, c.name AS camara_name INTO v FROM public.camara_settlements s JOIN public.camaras c ON c.id = s.camara_id WHERE s.id = p_id;
  IF NOT FOUND OR NOT public.manages_camara(v.camara_id) THEN RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501'; END IF;
  IF v.status = 'pagada' THEN RAISE EXCEPTION 'Esta liquidación ya fue pagada'; END IF;
  IF v.period >= date_trunc('month', CURRENT_DATE)::date THEN RAISE EXCEPTION 'El mes todavía no cerró'; END IF;
  IF nullif(trim(p_invoice), '') IS NULL THEN RAISE EXCEPTION 'Ingresá el número de factura'; END IF;
  UPDATE public.camara_settlements
  SET status = 'facturada', invoice_number = trim(p_invoice), invoice_submitted_at = now(), updated_at = now()
  WHERE id = p_id;
  PERFORM public.send_push(public.platform_admin_ids(), 'Factura de ' || v.camara_name,
    'Cargó la factura ' || trim(p_invoice) || ' por $' || to_char(v.share_ars, 'FM999G999G990'),
    jsonb_build_object('screen', 'liquidaciones'));
END;
$fn$;
REVOKE EXECUTE ON FUNCTION public.submit_settlement_invoice(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_settlement_invoice(uuid, text) TO authenticated;

-- La plataforma marca la liquidación como pagada
CREATE OR REPLACE FUNCTION public.mark_settlement_paid(p_id uuid, p_reference text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE v record;
BEGIN
  IF NOT public.is_platform_admin() THEN RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v FROM public.camara_settlements WHERE id = p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'No existe la liquidación'; END IF;
  IF v.status <> 'facturada' THEN RAISE EXCEPTION 'Primero la Cámara tiene que cargar su factura'; END IF;
  UPDATE public.camara_settlements
  SET status = 'pagada', paid_at = now(), payment_reference = nullif(trim(p_reference), ''), updated_at = now()
  WHERE id = p_id;
  PERFORM public.send_push(public.camara_admin_ids(v.camara_id), 'Te transferimos la liquidación',
    'Ya pagamos $' || to_char(v.share_ars, 'FM999G999G990') || ' de ' || to_char(v.period, 'MM/YYYY') || '.',
    jsonb_build_object('screen', 'liquidaciones'));
END;
$fn$;
REVOKE EXECUTE ON FUNCTION public.mark_settlement_paid(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_settlement_paid(uuid, text) TO authenticated;

-- El día 1 de cada mes se cierra el mes anterior
SELECT cron.unschedule('build-camara-settlements') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'build-camara-settlements');
SELECT cron.schedule('build-camara-settlements', '23 9 1 * *',
  $$SELECT public.build_camara_settlements((date_trunc('month', CURRENT_DATE) - interval '1 month')::date)$$);

-- ── 8. Planes pagos vencidos vuelven a Freemium ──────────────────────
CREATE OR REPLACE FUNCTION public.expire_paid_plans()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $fn$
  UPDATE public.memberships
  SET plan_type = 'freemium', matches_limit = 1, price_ars = NULL,
      start_date = CURRENT_DATE, end_date = CURRENT_DATE + interval '10 years'
  WHERE plan_type IN ('starter', 'premium') AND status = 'activa' AND end_date < CURRENT_DATE;
$fn$;
REVOKE EXECUTE ON FUNCTION public.expire_paid_plans() FROM PUBLIC, anon, authenticated;
SELECT cron.unschedule('expire-paid-plans') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'expire-paid-plans');
SELECT cron.schedule('expire-paid-plans', '17 6 * * *', 'SELECT public.expire_paid_plans()');
