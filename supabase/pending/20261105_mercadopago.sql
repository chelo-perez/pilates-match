-- PENDIENTE: no aplicada todavía.
-- =====================================================================
-- Suscripciones con Mercado Pago — 2026-11-05
--  * plan_prices: precio mensual de cada plan pago (lo edita la Cámara)
--  * subscriptions: una fila por suscripción de Mercado Pago (preapproval)
--  * payments: cada cobro que hace Mercado Pago
--  Solo las Edge Functions (service role) escriben suscripciones y pagos.
--  * Los planes pagos vencen solos: si pasa la fecha de vencimiento sin un
--    cobro nuevo, el estudio vuelve a Freemium.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.plan_prices (
  plan_type  text PRIMARY KEY CHECK (plan_type IN ('starter', 'premium')),
  price_ars  integer NOT NULL CHECK (price_ars > 0),
  active     boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.plan_prices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS plan_prices_read ON public.plan_prices;
CREATE POLICY plan_prices_read ON public.plan_prices FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS plan_prices_admin_write ON public.plan_prices;
CREATE POLICY plan_prices_admin_write ON public.plan_prices FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
REVOKE ALL ON public.plan_prices FROM anon;

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id                text PRIMARY KEY,
  studio_id         uuid NOT NULL REFERENCES public.studios(id) ON DELETE CASCADE,
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
  USING (public.is_admin() OR studio_id IN (SELECT id FROM public.studios WHERE user_id = auth.uid()));
REVOKE ALL ON public.subscriptions FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.subscriptions FROM authenticated;

CREATE TABLE IF NOT EXISTS public.payments (
  id              text PRIMARY KEY,
  subscription_id text,
  studio_id       uuid REFERENCES public.studios(id) ON DELETE SET NULL,
  plan_type       text,
  amount_ars      numeric,
  status          text NOT NULL,
  paid_at         timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS payments_studio_idx ON public.payments (studio_id, created_at DESC);
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS payments_read ON public.payments;
CREATE POLICY payments_read ON public.payments FOR SELECT TO authenticated
  USING (public.is_admin() OR studio_id IN (SELECT id FROM public.studios WHERE user_id = auth.uid()));
REVOKE ALL ON public.payments FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.payments FROM authenticated;

-- Planes pagos vencidos vuelven a Freemium (corre todos los días)
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
