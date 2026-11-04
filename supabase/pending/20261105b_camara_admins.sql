-- PENDIENTE: no aplicada todavía.
-- =====================================================================
-- Equipo de cada Cámara — 2026-11-05
--  * Varios administradores por Cámara: los nombra la plataforma o la propia Cámara
--  * Invitación a quien todavía no tiene cuenta: al registrarse con ese email
--    entra directo como administrador
--  * Quitar administradores y cancelar invitaciones
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.camara_admin_invites (
  email      text PRIMARY KEY,
  camara_id  uuid NOT NULL REFERENCES public.camaras(id) ON DELETE CASCADE,
  invited_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.camara_admin_invites ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS camara_admin_invites_read ON public.camara_admin_invites;
CREATE POLICY camara_admin_invites_read ON public.camara_admin_invites FOR SELECT TO authenticated
  USING (public.manages_camara(camara_id));
REVOKE ALL ON public.camara_admin_invites FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.camara_admin_invites FROM authenticated;

-- Nombra o invita. Devuelve 'promoted' (ya tenía cuenta) o 'invited' (queda la invitación)
CREATE OR REPLACE FUNCTION public.invite_camara_admin(p_email text, p_camara uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE
  v_email text := lower(trim(p_email));
  u record;
BEGIN
  IF NOT public.manages_camara(p_camara) THEN RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501'; END IF;
  IF v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' THEN RAISE EXCEPTION 'Revisá el email'; END IF;

  SELECT id, role, camara_id INTO u FROM public.users WHERE lower(email) = v_email;
  IF FOUND THEN
    IF u.role = 'super_admin' THEN RAISE EXCEPTION 'Esa cuenta es de la plataforma'; END IF;
    IF u.role = 'camara_admin' AND u.camara_id = p_camara THEN RETURN 'promoted'; END IF;
    IF u.role = 'camara_admin' THEN RAISE EXCEPTION 'Esa cuenta ya administra otra Cámara'; END IF;
    IF EXISTS (SELECT 1 FROM public.studios WHERE user_id = u.id)
       OR EXISTS (SELECT 1 FROM public.instructors WHERE user_id = u.id) THEN
      RAISE EXCEPTION 'Esa cuenta ya es de un estudio o un instructor. Pedile que use otro email.';
    END IF;
    UPDATE public.users SET role = 'camara_admin', camara_id = p_camara WHERE id = u.id;
    DELETE FROM public.camara_admin_invites WHERE email = v_email;
    RETURN 'promoted';
  END IF;

  INSERT INTO public.camara_admin_invites (email, camara_id, invited_by)
  VALUES (v_email, p_camara, auth.uid())
  ON CONFLICT (email) DO UPDATE SET camara_id = EXCLUDED.camara_id, invited_by = EXCLUDED.invited_by, created_at = now();
  RETURN 'invited';
END;
$fn$;
REVOKE EXECUTE ON FUNCTION public.invite_camara_admin(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.invite_camara_admin(text, uuid) TO authenticated;

-- Quita a un administrador: su cuenta queda sin perfil (al entrar elige estudio o instructor)
CREATE OR REPLACE FUNCTION public.remove_camara_admin(p_user uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE u record;
BEGIN
  SELECT id, role, camara_id INTO u FROM public.users WHERE id = p_user;
  IF NOT FOUND OR u.role <> 'camara_admin' OR NOT public.manages_camara(u.camara_id) THEN
    RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501';
  END IF;
  IF p_user = auth.uid() THEN RAISE EXCEPTION 'No podés quitarte a vos mismo'; END IF;
  UPDATE public.users SET role = 'estudio', camara_id = NULL WHERE id = p_user;
  DELETE FROM public.push_tokens WHERE user_id = p_user;
END;
$fn$;
REVOKE EXECUTE ON FUNCTION public.remove_camara_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.remove_camara_admin(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.cancel_camara_invite(p_email text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
BEGIN
  DELETE FROM public.camara_admin_invites
  WHERE email = lower(trim(p_email)) AND public.manages_camara(camara_id);
END;
$fn$;
REVOKE EXECUTE ON FUNCTION public.cancel_camara_invite(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_camara_invite(text) TO authenticated;

-- Reemplazada por invite_camara_admin
DROP FUNCTION IF EXISTS public.platform_set_camara_admin(text, uuid);

-- Alta de cuenta: si el email tiene una invitación, entra como administrador de esa Cámara
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE v_camara uuid;
BEGIN
  SELECT camara_id INTO v_camara FROM public.camara_admin_invites WHERE email = lower(NEW.email);
  INSERT INTO public.users (id, email, role, full_name, camara_id)
  VALUES (
    NEW.id,
    NEW.email,
    CASE WHEN v_camara IS NOT NULL THEN 'camara_admin'::public.user_role
         WHEN NEW.raw_user_meta_data->>'role' IN ('estudio', 'instructor')
         THEN (NEW.raw_user_meta_data->>'role')::public.user_role
         ELSE 'estudio'::public.user_role END,
    NEW.raw_user_meta_data->>'full_name',
    v_camara
  )
  ON CONFLICT (id) DO NOTHING;
  IF v_camara IS NOT NULL THEN
    DELETE FROM public.camara_admin_invites WHERE email = lower(NEW.email);
  END IF;
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'handle_new_user error: %', SQLERRM;
    RETURN NEW;
END;
$fn$;
