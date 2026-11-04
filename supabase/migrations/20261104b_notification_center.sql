-- =====================================================================
-- Centro de notificaciones (campanita) — 2026-11-04
-- Cada aviso que manda send_push queda guardado para el usuario, llegue o
-- no la notificación al celular (sin token, permisos apagados, etc.).
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.notifications (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title      text NOT NULL,
  body       text,
  data       jsonb NOT NULL DEFAULT '{}'::jsonb,
  read_at    timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notifications_user_created_idx ON public.notifications (user_id, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS notifications_own_read ON public.notifications;
CREATE POLICY notifications_own_read ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS notifications_own_update ON public.notifications;
CREATE POLICY notifications_own_update ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS notifications_own_delete ON public.notifications;
CREATE POLICY notifications_own_delete ON public.notifications FOR DELETE TO authenticated USING (user_id = auth.uid());
REVOKE ALL ON public.notifications FROM anon;
REVOKE INSERT, TRUNCATE ON public.notifications FROM authenticated;

-- send_push ahora también guarda el aviso en la campanita
CREATE OR REPLACE FUNCTION public.send_push(p_user_ids uuid[], p_title text, p_body text, p_data jsonb DEFAULT '{}'::jsonb)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_messages jsonb;
BEGIN
  INSERT INTO public.notifications (user_id, title, body, data)
  SELECT u, p_title, p_body, coalesce(p_data, '{}'::jsonb)
  FROM unnest(p_user_ids) AS u
  WHERE u IS NOT NULL AND EXISTS (SELECT 1 FROM public.users WHERE id = u);

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

-- Avisos de bienvenida para que la campanita no arranque vacía
INSERT INTO public.notifications (user_id, title, body, data)
SELECT id, 'Ya tenés notificaciones', 'Acá vas a ver las propuestas, respuestas y novedades de tu cuenta.', '{"screen":"inicio"}'::jsonb
FROM public.users
WHERE NOT EXISTS (SELECT 1 FROM public.notifications n WHERE n.user_id = users.id);
