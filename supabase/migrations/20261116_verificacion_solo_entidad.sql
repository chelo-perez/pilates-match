-- La verificación de instructores y la revisión de certificados es tarea de la entidad
-- de cada red. La plataforma (super_admin) ve todo, pero no aprueba ni rechaza.
CREATE OR REPLACE FUNCTION public.guard_verification_by_entity()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $fn$
BEGIN
  IF current_user NOT IN ('anon', 'authenticated') OR NOT public.is_platform_admin() THEN RETURN NEW; END IF;
  IF TG_TABLE_NAME = 'instructors' AND (
       NEW.verification_status IS DISTINCT FROM OLD.verification_status
    OR NEW.verification_note IS DISTINCT FROM OLD.verification_note
    OR NEW.verified_at IS DISTINCT FROM OLD.verified_at
    OR NEW.verified_by IS DISTINCT FROM OLD.verified_by) THEN
    RAISE EXCEPTION 'La verificación de instructores la hace la entidad de cada red' USING ERRCODE = '42501';
  END IF;
  IF TG_TABLE_NAME = 'certifications' AND (
       NEW.review_status IS DISTINCT FROM OLD.review_status
    OR NEW.verified IS DISTINCT FROM OLD.verified
    OR NEW.review_note IS DISTINCT FROM OLD.review_note) THEN
    RAISE EXCEPTION 'La revisión de certificados la hace la entidad de cada red' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$fn$;
REVOKE EXECUTE ON FUNCTION public.guard_verification_by_entity() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_guard_verification ON public.instructors;
CREATE TRIGGER trg_guard_verification BEFORE UPDATE ON public.instructors
  FOR EACH ROW EXECUTE FUNCTION public.guard_verification_by_entity();
DROP TRIGGER IF EXISTS trg_guard_cert_review ON public.certifications;
CREATE TRIGGER trg_guard_cert_review BEFORE UPDATE ON public.certifications
  FOR EACH ROW EXECUTE FUNCTION public.guard_verification_by_entity();
