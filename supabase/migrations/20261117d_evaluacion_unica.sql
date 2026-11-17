-- Una sola evaluación del estudio por instructor y fecha de clase.
-- La app ya oculta el formulario si existe; esto lo asegura también en la base.
CREATE UNIQUE INDEX IF NOT EXISTS evaluations_studio_instructor_date_key
  ON public.evaluations (studio_id, instructor_id, class_date);
