-- Patrocinios: "Beneficios de tu red" y formaciones publicadas como avisos pagos.
--
-- * Un aviso (sponsor_offers) lo carga la plataforma o la entidad de una red. Puede ser un beneficio
--   (descuento, código) o una formación (curso). Se dirige a estudios, instructores o ambos.
-- * Se publica por red (sponsor_offer_networks). La entidad de cada red lo aprueba antes de que se vea.
--   Lo que carga la entidad para su propia red queda aprobado.
-- * Cada red tiene su monto mensual y el porcentaje que le corresponde a la entidad, que depende de quién
--   consiguió al patrocinador: camaras.sponsor_share_own_pct (lo consiguió la entidad) o
--   camaras.sponsor_share_platform_pct (lo consiguió la plataforma).
-- * Vistas, clics y códigos copiados se registran (sponsor_events) para mostrarle resultados al patrocinador.

ALTER TABLE public.camaras
  ADD COLUMN IF NOT EXISTS sponsor_share_own_pct numeric NOT NULL DEFAULT 70 CHECK (sponsor_share_own_pct BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS sponsor_share_platform_pct numeric NOT NULL DEFAULT 20 CHECK (sponsor_share_platform_pct BETWEEN 0 AND 100);

CREATE TABLE IF NOT EXISTS public.sponsor_offers (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind             text NOT NULL DEFAULT 'beneficio' CHECK (kind IN ('beneficio', 'formacion')),
  sponsor_name     text NOT NULL CHECK (length(trim(sponsor_name)) > 0),
  logo_url         text,
  title            text NOT NULL CHECK (length(trim(title)) > 0),
  summary          text,
  details          text,
  perk             text,          -- "15% de descuento", "Primera clase sin cargo"
  promo_code       text,
  url              text,
  contact_whatsapp text,
  audience         text NOT NULL DEFAULT 'ambos' CHECK (audience IN ('estudio', 'instructor', 'ambos')),
  modality         text CHECK (modality IN ('presencial', 'online', 'mixta')),   -- formaciones
  course_start     date,
  course_hours     integer CHECK (course_hours IS NULL OR course_hours > 0),
  starts_on        date NOT NULL DEFAULT current_date,
  ends_on          date,
  is_active        boolean NOT NULL DEFAULT true,
  origin           text NOT NULL DEFAULT 'plataforma' CHECK (origin IN ('plataforma', 'entidad')),
  origin_camara_id uuid REFERENCES public.camaras(id) ON DELETE CASCADE,
  created_by       uuid REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_on IS NULL OR ends_on >= starts_on),
  CHECK (origin = 'plataforma' OR origin_camara_id IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS public.sponsor_offer_networks (
  offer_id         uuid NOT NULL REFERENCES public.sponsor_offers(id) ON DELETE CASCADE,
  camara_id        uuid NOT NULL REFERENCES public.camaras(id) ON DELETE CASCADE,
  status           text NOT NULL DEFAULT 'pendiente' CHECK (status IN ('pendiente', 'aprobado', 'rechazado')),
  monthly_fee_ars  numeric NOT NULL DEFAULT 0 CHECK (monthly_fee_ars >= 0),
  entity_share_pct numeric CHECK (entity_share_pct BETWEEN 0 AND 100),
  note             text,
  decided_by       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  decided_at       timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (offer_id, camara_id)
);
CREATE INDEX IF NOT EXISTS sponsor_offer_networks_camara ON public.sponsor_offer_networks (camara_id, status);

CREATE TABLE IF NOT EXISTS public.sponsor_events (
  id         bigserial PRIMARY KEY,
  offer_id   uuid NOT NULL REFERENCES public.sponsor_offers(id) ON DELETE CASCADE,
  camara_id  uuid REFERENCES public.camaras(id) ON DELETE SET NULL,
  user_id    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  role       text,
  action     text NOT NULL CHECK (action IN ('vista', 'link', 'codigo', 'whatsapp')),
  created_on date NOT NULL DEFAULT current_date,
  created_at timestamptz NOT NULL DEFAULT now()
);
-- Una vista o un clic por persona, aviso y día (para que los números sean de personas, no de toques)
CREATE UNIQUE INDEX IF NOT EXISTS sponsor_events_once ON public.sponsor_events (offer_id, user_id, action, created_on);
CREATE INDEX IF NOT EXISTS sponsor_events_offer ON public.sponsor_events (offer_id, created_on);

ALTER TABLE public.sponsor_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sponsor_offer_networks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sponsor_events ENABLE ROW LEVEL SECURITY;

-- ── Avisos ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS sponsor_offers_read ON public.sponsor_offers;
CREATE POLICY sponsor_offers_read ON public.sponsor_offers FOR SELECT TO authenticated USING (
  public.is_platform_admin()
  OR origin_camara_id = public.my_camara_id()
  OR EXISTS (SELECT 1 FROM public.sponsor_offer_networks n WHERE n.offer_id = sponsor_offers.id AND n.camara_id = public.my_camara_id())
);
DROP POLICY IF EXISTS sponsor_offers_insert ON public.sponsor_offers;
CREATE POLICY sponsor_offers_insert ON public.sponsor_offers FOR INSERT TO authenticated WITH CHECK (
  (public.is_platform_admin() AND origin = 'plataforma')
  OR (public.my_camara_id() IS NOT NULL AND origin = 'entidad' AND origin_camara_id = public.my_camara_id())
);
DROP POLICY IF EXISTS sponsor_offers_update ON public.sponsor_offers;
CREATE POLICY sponsor_offers_update ON public.sponsor_offers FOR UPDATE TO authenticated
  USING (public.is_platform_admin() OR (origin = 'entidad' AND origin_camara_id = public.my_camara_id()))
  WITH CHECK (public.is_platform_admin() OR (origin = 'entidad' AND origin_camara_id = public.my_camara_id()));
DROP POLICY IF EXISTS sponsor_offers_delete ON public.sponsor_offers;
CREATE POLICY sponsor_offers_delete ON public.sponsor_offers FOR DELETE TO authenticated
  USING (public.is_platform_admin() OR (origin = 'entidad' AND origin_camara_id = public.my_camara_id()));

-- ── Publicación por red ────────────────────────────────────────────
DROP POLICY IF EXISTS sponsor_networks_read ON public.sponsor_offer_networks;
CREATE POLICY sponsor_networks_read ON public.sponsor_offer_networks FOR SELECT TO authenticated
  USING (public.is_platform_admin() OR camara_id = public.my_camara_id());
DROP POLICY IF EXISTS sponsor_networks_insert ON public.sponsor_offer_networks;
CREATE POLICY sponsor_networks_insert ON public.sponsor_offer_networks FOR INSERT TO authenticated WITH CHECK (
  public.is_platform_admin()
  OR (camara_id = public.my_camara_id() AND EXISTS (
    SELECT 1 FROM public.sponsor_offers o WHERE o.id = offer_id AND o.origin = 'entidad' AND o.origin_camara_id = public.my_camara_id()))
);
DROP POLICY IF EXISTS sponsor_networks_update ON public.sponsor_offer_networks;
CREATE POLICY sponsor_networks_update ON public.sponsor_offer_networks FOR UPDATE TO authenticated
  USING (public.is_platform_admin() OR camara_id = public.my_camara_id())
  WITH CHECK (public.is_platform_admin() OR camara_id = public.my_camara_id());
DROP POLICY IF EXISTS sponsor_networks_delete ON public.sponsor_offer_networks;
CREATE POLICY sponsor_networks_delete ON public.sponsor_offer_networks FOR DELETE TO authenticated
  USING (public.is_platform_admin());

-- ── Eventos: se escriben por track_sponsor; leen la plataforma y la entidad de esa red ──
DROP POLICY IF EXISTS sponsor_events_read ON public.sponsor_events;
CREATE POLICY sponsor_events_read ON public.sponsor_events FOR SELECT TO authenticated
  USING (public.is_platform_admin() OR camara_id = public.my_camara_id());

-- Reglas al publicar en una red: porcentaje según quién lo consiguió, aprobación automática para lo propio,
-- y la entidad solo decide (aprobar/rechazar) o pone el monto de lo que consiguió ella.
CREATE OR REPLACE FUNCTION public.guard_sponsor_network()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE v_offer public.sponsor_offers; v_cam public.camaras; v_own boolean;
BEGIN
  SELECT * INTO v_offer FROM public.sponsor_offers WHERE id = NEW.offer_id;
  SELECT * INTO v_cam FROM public.camaras WHERE id = NEW.camara_id;
  v_own := v_offer.origin = 'entidad' AND v_offer.origin_camara_id = NEW.camara_id;
  IF TG_OP = 'INSERT' THEN
    IF NEW.entity_share_pct IS NULL OR NOT public.is_platform_admin() THEN
      NEW.entity_share_pct := CASE WHEN v_own THEN v_cam.sponsor_share_own_pct ELSE v_cam.sponsor_share_platform_pct END;
    END IF;
    IF v_own THEN NEW.status := 'aprobado'; NEW.decided_by := auth.uid(); NEW.decided_at := now();
    ELSIF NOT public.is_platform_admin() THEN NEW.status := 'pendiente';
    END IF;
  ELSE
    IF NOT public.is_platform_admin() THEN
      NEW.entity_share_pct := OLD.entity_share_pct;
      IF NOT v_own THEN NEW.monthly_fee_ars := OLD.monthly_fee_ars; END IF;
      NEW.offer_id := OLD.offer_id; NEW.camara_id := OLD.camara_id;
    END IF;
    IF NEW.status IS DISTINCT FROM OLD.status THEN NEW.decided_by := auth.uid(); NEW.decided_at := now(); END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS guard_sponsor_network ON public.sponsor_offer_networks;
CREATE TRIGGER guard_sponsor_network BEFORE INSERT OR UPDATE ON public.sponsor_offer_networks
  FOR EACH ROW EXECUTE FUNCTION public.guard_sponsor_network();

CREATE OR REPLACE FUNCTION public.touch_sponsor_offer()
RETURNS trigger LANGUAGE plpgsql SET search_path TO '' AS $$
BEGIN
  NEW.updated_at := now();
  -- El origen no cambia después de creado
  IF TG_OP = 'UPDATE' THEN NEW.origin := OLD.origin; NEW.origin_camara_id := OLD.origin_camara_id; NEW.created_by := OLD.created_by; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS touch_sponsor_offer ON public.sponsor_offers;
CREATE TRIGGER touch_sponsor_offer BEFORE UPDATE ON public.sponsor_offers FOR EACH ROW EXECUTE FUNCTION public.touch_sponsor_offer();

-- Aviso a los administradores de la entidad cuando la plataforma les propone un aviso para aprobar
CREATE OR REPLACE FUNCTION public.notify_sponsor_pending()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE v_title text; v_admins uuid[];
BEGIN
  IF NEW.status <> 'pendiente' THEN RETURN NEW; END IF;
  SELECT CASE WHEN kind = 'formacion' THEN 'Nueva formación para aprobar' ELSE 'Nuevo beneficio para aprobar' END || ': ' || sponsor_name
    INTO v_title FROM public.sponsor_offers WHERE id = NEW.offer_id;
  SELECT array_agg(id) INTO v_admins FROM public.users WHERE role = 'camara_admin' AND camara_id = NEW.camara_id;
  IF v_admins IS NOT NULL THEN
    PERFORM public.send_push(v_admins, v_title, 'Revisalo y decidí si se publica en tu red.', jsonb_build_object('screen', 'patrocinios', 'offer_id', NEW.offer_id));
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS notify_sponsor_pending ON public.sponsor_offer_networks;
CREATE TRIGGER notify_sponsor_pending AFTER INSERT ON public.sponsor_offer_networks FOR EACH ROW EXECUTE FUNCTION public.notify_sponsor_pending();

-- ── Lo que ve un estudio o un instructor: avisos aprobados en su red, vigentes y para su rol ──
CREATE OR REPLACE FUNCTION public.my_sponsor_offers()
RETURNS TABLE (id uuid, kind text, sponsor_name text, logo_url text, title text, summary text, details text, perk text,
  promo_code text, url text, contact_whatsapp text, audience text, modality text, course_start date, course_hours integer, ends_on date)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $$
  WITH me AS (
    SELECT u.role::text AS role, coalesce(public.my_studio_camara_id(), public.my_instructor_camara_id()) AS camara_id
    FROM public.users u WHERE u.id = auth.uid()
  )
  SELECT o.id, o.kind, o.sponsor_name, o.logo_url, o.title, o.summary, o.details, o.perk, o.promo_code, o.url,
         o.contact_whatsapp, o.audience, o.modality, o.course_start, o.course_hours, o.ends_on
  FROM public.sponsor_offers o
  JOIN public.sponsor_offer_networks n ON n.offer_id = o.id AND n.status = 'aprobado'
  JOIN me ON me.camara_id = n.camara_id
  WHERE o.is_active AND o.starts_on <= current_date AND (o.ends_on IS NULL OR o.ends_on >= current_date)
    AND (o.audience = 'ambos' OR o.audience = me.role)
  ORDER BY o.kind, o.created_at DESC;
$$;
REVOKE ALL ON FUNCTION public.my_sponsor_offers() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_sponsor_offers() TO authenticated;

CREATE OR REPLACE FUNCTION public.track_sponsor(p_offer uuid, p_action text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE v_role text; v_cam uuid;
BEGIN
  IF p_action NOT IN ('vista', 'link', 'codigo', 'whatsapp') THEN RETURN; END IF;
  SELECT role::text INTO v_role FROM public.users WHERE id = auth.uid();
  v_cam := coalesce(public.my_studio_camara_id(), public.my_instructor_camara_id());
  IF v_cam IS NULL OR NOT EXISTS (SELECT 1 FROM public.sponsor_offer_networks WHERE offer_id = p_offer AND camara_id = v_cam AND status = 'aprobado') THEN RETURN; END IF;
  INSERT INTO public.sponsor_events (offer_id, camara_id, user_id, role, action) VALUES (p_offer, v_cam, auth.uid(), v_role, p_action)
  ON CONFLICT DO NOTHING;
END $$;
REVOKE ALL ON FUNCTION public.track_sponsor(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.track_sponsor(uuid, text) TO authenticated;

-- Resultados por aviso y red (personas distintas), para los paneles
CREATE OR REPLACE FUNCTION public.sponsor_stats(p_since date DEFAULT (current_date - 30))
RETURNS TABLE (offer_id uuid, camara_id uuid, vistas bigint, links bigint, codigos bigint, whatsapp bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $$
  SELECT e.offer_id, e.camara_id,
    count(DISTINCT e.user_id) FILTER (WHERE action = 'vista'),
    count(DISTINCT e.user_id) FILTER (WHERE action = 'link'),
    count(DISTINCT e.user_id) FILTER (WHERE action = 'codigo'),
    count(DISTINCT e.user_id) FILTER (WHERE action = 'whatsapp')
  FROM public.sponsor_events e
  WHERE e.created_on >= p_since AND (public.is_platform_admin() OR e.camara_id = public.my_camara_id())
  GROUP BY e.offer_id, e.camara_id;
$$;
REVOKE ALL ON FUNCTION public.sponsor_stats(date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sponsor_stats(date) TO authenticated;
