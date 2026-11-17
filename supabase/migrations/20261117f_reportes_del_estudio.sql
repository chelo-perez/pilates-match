-- Problemas que el estudio reporta al evaluar a un instructor.
-- Van en una tabla aparte para que el instructor nunca los lea (aunque vea la evaluación):
-- solo los ve el estudio que los cargó y la entidad (camara_admin / super_admin).
CREATE TABLE IF NOT EXISTS public.evaluation_issues (
  evaluation_id        uuid PRIMARY KEY REFERENCES public.evaluations(id) ON DELETE CASCADE,
  studio_id            uuid NOT NULL REFERENCES public.studios(id),
  instructor_id        uuid NOT NULL REFERENCES public.instructors(id),
  camara_id            uuid,
  class_date           date NOT NULL,
  issue_no_show        boolean NOT NULL DEFAULT false,
  issue_late           boolean NOT NULL DEFAULT false,
  issue_bad_treatment  boolean NOT NULL DEFAULT false,
  issue_last_minute    boolean NOT NULL DEFAULT false,
  created_at           timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_evaluation_issues_instructor ON public.evaluation_issues(instructor_id);
CREATE INDEX IF NOT EXISTS idx_evaluation_issues_camara ON public.evaluation_issues(camara_id);

-- camara_id se toma del estudio (mismo trigger que el resto de las tablas hijas)
DROP TRIGGER IF EXISTS trg_set_camara ON public.evaluation_issues;
CREATE TRIGGER trg_set_camara BEFORE INSERT ON public.evaluation_issues
  FOR EACH ROW EXECUTE FUNCTION public.set_child_camara();

ALTER TABLE public.evaluation_issues ENABLE ROW LEVEL SECURITY;

-- El estudio carga reportes solo sobre evaluaciones propias y con los mismos datos de la evaluación
DROP POLICY IF EXISTS studio_insert_issues ON public.evaluation_issues;
CREATE POLICY studio_insert_issues ON public.evaluation_issues FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.evaluations e JOIN public.studios s ON s.id = e.studio_id
    WHERE e.id = evaluation_id AND s.user_id = auth.uid()
      AND e.studio_id = evaluation_issues.studio_id
      AND e.instructor_id = evaluation_issues.instructor_id
      AND e.class_date = evaluation_issues.class_date
  )
);

DROP POLICY IF EXISTS studio_read_own_issues ON public.evaluation_issues;
CREATE POLICY studio_read_own_issues ON public.evaluation_issues FOR SELECT USING (
  studio_id IN (SELECT s.id FROM public.studios s WHERE s.user_id = auth.uid())
);

DROP POLICY IF EXISTS camara_read_issues ON public.evaluation_issues;
CREATE POLICY camara_read_issues ON public.evaluation_issues FOR SELECT USING (public.manages_camara(camara_id));
