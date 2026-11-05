-- =====================================================================
-- Match, paso 3: "Me interesa trabajar acá" — 2026-11-06
-- El instructor marca estudios de su red. El estudio lo ve primero al buscar
-- ("Le interesa tu estudio") y recibe un aviso. Una marca por estudio, se puede quitar.
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.instructor_interests (
  instructor_id uuid NOT NULL REFERENCES public.instructors(id) ON DELETE CASCADE,
  studio_id     uuid NOT NULL REFERENCES public.studios(id) ON DELETE CASCADE,
  created_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (instructor_id, studio_id)
);
ALTER TABLE public.instructor_interests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS interests_instructor_own ON public.instructor_interests;
CREATE POLICY interests_instructor_own ON public.instructor_interests FOR ALL TO authenticated
  USING (instructor_id IN (SELECT id FROM public.instructors WHERE user_id = auth.uid()))
  WITH CHECK (
    instructor_id IN (SELECT id FROM public.instructors WHERE user_id = auth.uid())
    AND studio_id IN (SELECT id FROM public.studios WHERE camara_id = public.my_instructor_camara_id())
  );
DROP POLICY IF EXISTS interests_studio_read ON public.instructor_interests;
CREATE POLICY interests_studio_read ON public.instructor_interests FOR SELECT TO authenticated
  USING (studio_id IN (SELECT id FROM public.studios WHERE user_id = auth.uid() OR public.manages_camara(camara_id)));
REVOKE ALL ON public.instructor_interests FROM anon;

CREATE OR REPLACE FUNCTION public.notify_on_interest()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE v_user uuid; v_name text;
BEGIN
  SELECT user_id INTO v_user FROM public.studios WHERE id = NEW.studio_id;
  SELECT full_name INTO v_name FROM public.instructors WHERE id = NEW.instructor_id;
  IF v_user IS NOT NULL THEN
    PERFORM public.send_push(ARRAY[v_user], coalesce(v_name, 'Un instructor') || ' quiere trabajar en tu estudio',
      'Lo vas a ver primero cuando busques instructores.', jsonb_build_object('screen', 'buscar'));
  END IF;
  RETURN NEW;
END;
$fn$;
DROP TRIGGER IF EXISTS on_interest_created ON public.instructor_interests;
CREATE TRIGGER on_interest_created AFTER INSERT ON public.instructor_interests FOR EACH ROW EXECUTE FUNCTION public.notify_on_interest();
