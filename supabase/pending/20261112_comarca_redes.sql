-- PENDIENTE
-- Co-marca por red: colores, tipografías y logos de cada red.
-- La app la lee con network_brand (también sin sesión, para el link de la red).

ALTER TABLE public.camaras ADD COLUMN IF NOT EXISTS brand jsonb;
COMMENT ON COLUMN public.camaras.brand IS
  'Co-marca: {enabled, short_name, colors:{sage,forest,gold,...}, fonts:{body,title}, logos:{wide,mark,markDark}}';

-- Datos públicos de marca de una red activa, por slug o por id
CREATE OR REPLACE FUNCTION public.network_brand(p_slug text DEFAULT NULL, p_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $fn$
  SELECT jsonb_build_object('id', c.id, 'slug', c.slug, 'name', c.name, 'entity_type', c.entity_type,
                            'entity_article', c.entity_article, 'brand', c.brand)
  FROM public.camaras c
  -- Por slug, solo redes activas; por id (la red propia), con sesión, aunque esté inactiva
  WHERE (c.is_active OR (p_id IS NOT NULL AND auth.uid() IS NOT NULL))
    AND ((p_slug IS NOT NULL AND c.slug = p_slug) OR (p_id IS NOT NULL AND c.id = p_id))
  LIMIT 1;
$fn$;
REVOKE EXECUTE ON FUNCTION public.network_brand(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.network_brand(text, uuid) TO anon, authenticated;

-- CAPIAF: paleta, Jost + DM Serif Display, logos
UPDATE public.camaras SET brand = jsonb_build_object(
  'enabled', true,
  'short_name', 'CAPIAF',
  'colors', jsonb_build_object(
    'sage', '#3F5A4C', 'sageMid', '#6E9080', 'sageLight', '#E7EDE6', 'sageLighter', '#EDF3F0',
    'forest', '#3F5A4C', 'forestDark', '#2E4238', 'forestDeep', '#232A26', 'mint', '#DDE6DF',
    'cream', '#F3F0E9', 'dark', '#232A26', 'mid', '#5E6E66', 'light', '#7A8A82',
    'border', '#DDD8CE', 'borderLight', '#E9E5DC',
    'gold', '#4E8580', 'goldLight', '#DCEBE9', 'goldBright', '#7FB3AE', 'toastOkBg', '#2E4238'),
  'fonts', jsonb_build_object('body', 'jost', 'title', 'dm-serif'),
  'logos', jsonb_build_object(
    'wide', 'https://masfacil.com.ar/redes/capiaf/horizontal.png',
    'mark', 'https://masfacil.com.ar/redes/capiaf/isologo.png',
    'markDark', 'https://masfacil.com.ar/redes/capiaf/isologo-reverso.png'))
WHERE slug = 'capiaf';
