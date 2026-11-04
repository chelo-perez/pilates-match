-- PENDIENTE: no aplicada todavía.
-- =====================================================================
-- Notificaciones push para los tres perfiles (2026-11-04)
--
-- Todo se dispara desde la base, así llega aunque la app esté cerrada:
--   Instructor: propuesta nueva · verificación / corrección / rechazo · certificado rechazado
--   Estudio:    el instructor aceptó o rechazó la propuesta
--   Cámara:     instructor nuevo para verificar · certificado nuevo para revisar
-- Se envía directo a la API de Expo (no necesita la Edge Function).
-- =====================================================================

-- Envía una notificación a uno o más usuarios (todos sus tokens). Nunca falla:
-- un problema de notificaciones no puede frenar la operación que la disparó.
CREATE OR REPLACE FUNCTION public.send_push(p_user_ids uuid[], p_title text, p_body text, p_data jsonb DEFAULT '{}'::jsonb)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_messages jsonb;
BEGIN
  SELECT jsonb_agg(jsonb_build_object(
           'to', t.token, 'title', p_title, 'body', p_body, 'data', p_data,
           'sound', 'default', 'channelId', 'default', 'priority', 'high'))
  INTO v_messages
  FROM (SELECT DISTINCT token FROM public.push_tokens WHERE user_id = ANY(p_user_ids)) t;

  IF v_messages IS NULL THEN RETURN; END IF;

  PERFORM net.http_post(
    url     := 'https://exp.host/--/api/v2/push/send',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Accept', 'application/json'),
    body    := v_messages
  );
EXCEPTION WHEN others THEN
  RAISE LOG 'send_push error: %', SQLERRM;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.send_push(uuid[], text, text, jsonb) FROM PUBLIC, anon, authenticated;

-- Administradores de la Cámara que reciben los avisos
CREATE OR REPLACE FUNCTION public.camara_admin_ids()
RETURNS uuid[]
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT coalesce(array_agg(id), '{}') FROM public.users WHERE role IN ('camara_admin', 'super_admin');
$$;
REVOKE EXECUTE ON FUNCTION public.camara_admin_ids() FROM PUBLIC, anon, authenticated;

-- Un celular = un token. Si otra cuenta usó este celular, el token deja de ser
-- suyo: así una cuenta no recibe avisos de otra que se usó en el mismo teléfono.
CREATE OR REPLACE FUNCTION public.claim_push_token(p_token text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL OR coalesce(p_token, '') = '' THEN RETURN; END IF;
  DELETE FROM public.push_tokens WHERE token = p_token AND user_id <> auth.uid();
  INSERT INTO public.push_tokens (user_id, token, updated_at)
  VALUES (auth.uid(), p_token, now())
  ON CONFLICT (user_id) DO UPDATE SET token = EXCLUDED.token, updated_at = now();
END;
$$;
REVOKE EXECUTE ON FUNCTION public.claim_push_token(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_push_token(text) TO authenticated;

-- ── Propuestas ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_instructor_on_match()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user uuid; v_studio text; v_when text;
BEGIN
  SELECT user_id INTO v_user FROM public.instructors WHERE id = NEW.instructor_id;
  SELECT name INTO v_studio FROM public.studios WHERE id = NEW.studio_id;
  IF v_user IS NULL THEN RETURN NEW; END IF;
  v_when := CASE WHEN NEW.class_type = 'regular'
    THEN 'Clase regular, ' || to_char(coalesce(NEW.schedule_from, NEW.start_time), 'HH24:MI') || ' a ' || to_char(coalesce(NEW.schedule_to, NEW.end_time), 'HH24:MI')
    ELSE 'Reemplazo el ' || to_char(NEW.class_date, 'DD/MM') || ', ' || to_char(NEW.start_time, 'HH24:MI') || ' a ' || to_char(NEW.end_time, 'HH24:MI') END;
  PERFORM public.send_push(ARRAY[v_user], 'Nueva propuesta de ' || coalesce(v_studio, 'un estudio'), v_when,
    jsonb_build_object('screen', 'propuestas', 'match_id', NEW.id));
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.notify_instructor_on_match() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.notify_studio_on_match_response()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user uuid; v_instr text;
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status OR NEW.status NOT IN ('aceptado', 'rechazado') THEN RETURN NEW; END IF;
  SELECT user_id INTO v_user FROM public.studios WHERE id = NEW.studio_id;
  SELECT full_name INTO v_instr FROM public.instructors WHERE id = NEW.instructor_id;
  IF v_user IS NULL THEN RETURN NEW; END IF;
  PERFORM public.send_push(ARRAY[v_user],
    coalesce(v_instr, 'El instructor') || CASE WHEN NEW.status = 'aceptado' THEN ' aceptó tu propuesta' ELSE ' rechazó tu propuesta' END,
    CASE WHEN NEW.status = 'aceptado' THEN 'Coordiná los detalles de la clase.' ELSE coalesce(nullif(NEW.note_instructor, ''), 'Podés buscar otro instructor.') END,
    jsonb_build_object('screen', 'historial', 'match_id', NEW.id));
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.notify_studio_on_match_response() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS on_match_responded ON public.matches;
CREATE TRIGGER on_match_responded AFTER UPDATE OF status ON public.matches
  FOR EACH ROW EXECUTE FUNCTION public.notify_studio_on_match_response();

-- ── Instructores ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_on_instructor_change()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Instructor nuevo (o perfil reclamado) pendiente → Cámara
  IF NEW.user_id IS NOT NULL AND NEW.verification_status = 'pendiente'
     AND (TG_OP = 'INSERT' OR OLD.user_id IS DISTINCT FROM NEW.user_id) THEN
    PERFORM public.send_push(public.camara_admin_ids(), 'Instructor nuevo para verificar',
      NEW.full_name || ' se registró y espera la verificación.',
      jsonb_build_object('screen', 'verificar', 'instructor_id', NEW.id));
  END IF;

  -- Cambio de estado decidido por la Cámara → instructor
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
$$;
REVOKE EXECUTE ON FUNCTION public.notify_on_instructor_change() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS on_instructor_change ON public.instructors;
CREATE TRIGGER on_instructor_change AFTER INSERT OR UPDATE OF user_id, verification_status, verification_note ON public.instructors
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_instructor_change();

-- ── Certificados ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_on_certification_change()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_instr record;
BEGIN
  SELECT id, user_id, full_name INTO v_instr FROM public.instructors WHERE id = NEW.instructor_id;

  -- Archivo nuevo para revisar → Cámara
  IF NEW.document_url IS NOT NULL AND coalesce(NEW.review_status, 'pending') = 'pending'
     AND (TG_OP = 'INSERT' OR OLD.document_url IS DISTINCT FROM NEW.document_url) THEN
    PERFORM public.send_push(public.camara_admin_ids(), 'Certificado para revisar',
      coalesce(v_instr.full_name, 'Un instructor') || ' subió «' || NEW.name || '».',
      jsonb_build_object('screen', 'verificar', 'instructor_id', NEW.instructor_id));
  END IF;

  -- Certificado rechazado → instructor
  IF TG_OP = 'UPDATE' AND NEW.review_status = 'rejected' AND OLD.review_status IS DISTINCT FROM 'rejected'
     AND v_instr.user_id IS NOT NULL THEN
    PERFORM public.send_push(ARRAY[v_instr.user_id], 'Un certificado fue rechazado',
      '«' || NEW.name || '»: ' || coalesce(nullif(NEW.review_note, ''), 'revisá el motivo en tu perfil.'),
      jsonb_build_object('screen', 'perfil'));
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.notify_on_certification_change() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS on_certification_change ON public.certifications;
CREATE TRIGGER on_certification_change AFTER INSERT OR UPDATE OF document_url, review_status ON public.certifications
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_certification_change();

-- Limpieza: un token por celular (quedan los más recientes)
DELETE FROM public.push_tokens p
WHERE EXISTS (SELECT 1 FROM public.push_tokens q WHERE q.token = p.token AND q.updated_at > p.updated_at);
