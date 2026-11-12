// Co-marca por red: cada red puede tener sus colores, sus tipografías y sus logos.
//
// Cómo funciona: los estilos de las pantallas se calculan una sola vez, al abrir la app,
// con los valores de `colors` (src/components/ui). Para no reescribir cada pantalla, la marca
// de la red se guarda en el dispositivo y se lee DE FORMA SINCRÓNICA antes de que se calcule
// cualquier estilo: `applyBrandColors` pisa los tokens de `colors` y todas las pantallas
// salen con la paleta de la red. Cuando cambia la red del usuario (o su marca), se guarda la
// nueva y la app se recarga una vez.
//
// Este archivo no puede importar src/components/ui (ui lo importa a él).
import { Platform } from 'react-native'

/** Tokens de color que una red puede cambiar (mismos nombres que `colors`) */
export const BRAND_TOKENS = [
  'sage', 'sageMid', 'sageLight', 'sageLighter', 'forest', 'forestDark', 'forestDeep', 'mint', 'cream',
  'dark', 'mid', 'light', 'border', 'borderLight', 'gold', 'goldLight', 'goldBright', 'toastOkBg',
] as const
export type BrandToken = typeof BRAND_TOKENS[number]

export interface NetworkBrand {
  camaraId: string
  slug: string
  name: string
  shortName: string
  entityType?: string | null
  entityArticle?: 'la' | 'el' | null
  colors: Partial<Record<BrandToken, string>>
  /** body: reemplaza Nunito en toda la app; title: títulos de encabezados */
  fonts: { body?: 'jost' | null; title?: 'dm-serif' | null }
  /** wide: logo horizontal sobre fondo claro; mark: isologo sobre claro; markDark: isologo sobre oscuro */
  logos: { wide?: string | null; mark?: string | null; markDark?: string | null }
}

const KEY = 'network-brand-v1'

// ── Guardado sincrónico ─────────────────────────────────────────────
function brandFile() {
  // Import diferido: en web no existe el módulo nativo
  const { File, Paths } = require('expo-file-system')
  return new File(Paths.document, `${KEY}.json`)
}

export function readCachedBrand(): NetworkBrand | null {
  try {
    if (Platform.OS === 'web') {
      const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null
      return raw ? JSON.parse(raw) : null
    }
    const f = brandFile()
    return f.exists ? JSON.parse(f.textSync()) : null
  } catch {
    return null
  }
}

export function writeCachedBrand(b: NetworkBrand | null) {
  try {
    if (Platform.OS === 'web') {
      if (b) localStorage.setItem(KEY, JSON.stringify(b)); else localStorage.removeItem(KEY)
      return
    }
    const f = brandFile()
    if (b) { if (!f.exists) f.create(); f.write(JSON.stringify(b)) }
    else if (f.exists) f.delete()
  } catch { /* sin espacio o sin permiso: queda la marca anterior */ }
}

/** Marca con la que arrancó esta sesión de la app (no cambia hasta recargar) */
export const activeBrand: NetworkBrand | null = readCachedBrand()

// ── Colores ─────────────────────────────────────────────────────────
const HEX = /^#[0-9a-f]{6}$/i
const mix = (a: string, b: string, t: number) => {
  const p = (h: string, i: number) => parseInt(h.slice(1 + i * 2, 3 + i * 2), 16)
  return '#' + [0, 1, 2].map(i => Math.round(p(a, i) * (1 - t) + p(b, i) * t).toString(16).padStart(2, '0')).join('')
}

/**
 * Completa la paleta a partir de los colores que cargó la red. Con solo `sage` (principal),
 * `forest` (encabezados) y `gold` (acento) ya se arma una paleta coherente.
 */
export function completePalette(c: Partial<Record<BrandToken, string>>): Partial<Record<BrandToken, string>> {
  const v: Partial<Record<BrandToken, string>> = {}
  for (const k of BRAND_TOKENS) if (c[k] && HEX.test(c[k]!)) v[k] = c[k]
  const W = '#ffffff', K = '#000000'
  if (v.sage) {
    if (!v.sageMid) v.sageMid = mix(v.sage, W, 0.3)
    if (!v.sageLight) v.sageLight = mix(v.sage, W, 0.86)
    if (!v.sageLighter) v.sageLighter = mix(v.sage, W, 0.92)
    if (!v.mint) v.mint = mix(v.sage, W, 0.8)
    if (!v.forest) v.forest = v.sage
  }
  if (v.forest) {
    if (!v.forestDark) v.forestDark = mix(v.forest, K, 0.25)
    if (!v.forestDeep) v.forestDeep = mix(v.forest, K, 0.45)
    if (!v.toastOkBg) v.toastOkBg = v.forestDeep
  }
  if (v.gold) {
    if (!v.goldLight) v.goldLight = mix(v.gold, W, 0.82)
    if (!v.goldBright) v.goldBright = mix(v.gold, W, 0.35)
  }
  return v
}

/** Pisa los tokens de `colors` con los de la marca guardada. Se llama una vez, en ui. */
export function applyBrandColors(colors: Record<string, string>) {
  if (!activeBrand) return
  Object.assign(colors, completePalette(activeBrand.colors ?? {}))
}

// ── Tipografías ─────────────────────────────────────────────────────
/**
 * Archivos de fuente a cargar. Las pantallas usan los nombres 'Nunito-*' como "rol"
 * (normal, medio, semi, negrita): si la red usa Jost, esos mismos nombres apuntan a Jost.
 */
export function brandFontFiles() {
  const jost = activeBrand?.fonts?.body === 'jost'
  return {
    'Nunito-Regular':  jost ? require('../../assets/fonts/Jost_400Regular.ttf')  : require('../../assets/fonts/Nunito-Regular.ttf'),
    'Nunito-Medium':   jost ? require('../../assets/fonts/Jost_500Medium.ttf')   : require('../../assets/fonts/Nunito-Medium.ttf'),
    'Nunito-SemiBold': jost ? require('../../assets/fonts/Jost_600SemiBold.ttf') : require('../../assets/fonts/Nunito-SemiBold.ttf'),
    'Nunito-Bold':     jost ? require('../../assets/fonts/Jost_700Bold.ttf')     : require('../../assets/fonts/Nunito-Bold.ttf'),
    'Brand-Title':     activeBrand?.fonts?.title === 'dm-serif'
      ? require('../../assets/fonts/DMSerifDisplay_400Regular.ttf') : require('../../assets/fonts/Nunito-Bold.ttf'),
  }
}

/** Fuente de los títulos grandes (encabezados, login) */
export const titleFont = activeBrand?.fonts?.title ? 'Brand-Title' : 'Nunito-Bold'
/** Las serif de display se ven mejor un poco más grandes y sin el espaciado negativo */
export const titleTweak = activeBrand?.fonts?.title ? { fontSize: 24, letterSpacing: 0 } : null

// ── Datos de la red desde la base ───────────────────────────────────
export function brandFromRow(r: any): NetworkBrand | null {
  const b = r?.brand
  if (!r?.id || !b || b.enabled === false) return null
  return {
    camaraId: r.id, slug: r.slug, name: r.name, shortName: b.short_name || r.name,
    entityType: r.entity_type ?? null, entityArticle: r.entity_article ?? null,
    colors: b.colors ?? {}, fonts: b.fonts ?? {}, logos: b.logos ?? {},
  }
}

const canon = (b: NetworkBrand | null) => JSON.stringify(b ?? null)
export const sameBrand = (a: NetworkBrand | null, b: NetworkBrand | null) => canon(a) === canon(b)

/** Guarda la marca nueva y recarga la app para aplicarla (una vez por cambio) */
export async function switchBrand(b: NetworkBrand | null) {
  if (sameBrand(b, activeBrand)) return
  writeCachedBrand(b)
  // Si no se pudo guardar, recargar no cambiaría nada (y se repetiría): se deja como está
  if (!sameBrand(readCachedBrand(), b)) return
  try {
    if (Platform.OS === 'web') { window.location.reload(); return }
    const Updates = require('expo-updates')
    await Updates.reloadAsync()
  } catch { /* en desarrollo no se puede recargar: se aplica al próximo arranque */ }
}

// ── Link de la red (web): app.trabajo.masfacil.com.ar/?red=capiaf ────
/** Slug pedido por URL, si lo hay. Se recuerda para preseleccionar la red al registrarse. */
export function requestedSlug(): string | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null
  const q = new URLSearchParams(window.location.search).get('red')
  return q && /^[a-z0-9-]{2,40}$/.test(q) ? q : null
}
