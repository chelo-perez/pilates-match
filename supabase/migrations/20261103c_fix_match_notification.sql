-- =====================================================================
-- Arregla la creación de matches (2026-11-03)
--
-- El trigger on_match_created llamaba a net.http_post, pero pg_net no
-- estaba instalado y app.supabase_url no estaba configurado: TODA creación
-- de match fallaba con 'schema "net" does not exist'. Nunca se creó uno.
--
-- Ahora:
--  - se instala pg_net
--  - la URL es la del proyecto y la clave pública (anon) se lee del Vault
--    (secreto 'anon_key'; crearlo con: SELECT vault.create_secret('<anon key>', 'anon_key');)
--  - si el aviso falla, el match se crea igual (se registra en el log)
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION public.notify_instructor_on_match()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_key text;
BEGIN
  BEGIN
    SELECT decrypted_secret INTO v_key FROM vault.decrypted_secrets WHERE name = 'anon_key' LIMIT 1;
    PERFORM net.http_post(
      url     := 'https://tkhaiovstwgqzabvxxss.supabase.co/functions/v1/send-match-notification',
      headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || coalesce(v_key, '')),
      body    := jsonb_build_object('match_id', NEW.id)
    );
  EXCEPTION WHEN others THEN
    RAISE LOG 'notify_instructor_on_match error: %', SQLERRM;
  END;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.notify_instructor_on_match() FROM PUBLIC, anon, authenticated;
