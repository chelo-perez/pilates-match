// src/lib/errors.ts
// Traduce errores de Supabase / red a mensajes para el usuario.
// El detalle técnico queda solo en la consola.

type AnyErr = { message?: string; code?: string; status?: number; details?: string } | null | undefined

const RULES: { test: (m: string, code: string) => boolean; msg: string }[] = [
  { test: (m) => m.includes('match_limit_reached'), msg: 'Llegaste al límite de propuestas de tu plan este mes.' },
  { test: (m) => m.includes('invalid login credentials'), msg: 'Email o contraseña incorrectos.' },
  { test: (m) => m.includes('email not confirmed'), msg: 'Confirmá tu email antes de entrar (revisá tu casilla).' },
  { test: (m) => m.includes('user already registered') || m.includes('already been registered'), msg: 'Ya existe una cuenta con ese email. Iniciá sesión.' },
  { test: (m) => m.includes('password should be at least') || m.includes('weak password'), msg: 'La contraseña es muy corta o débil.' },
  { test: (m) => m.includes('unable to validate email') || m.includes('invalid email') || (m.includes('email address') && m.includes('invalid')), msg: 'El email no es válido.' },
  { test: (m) => m.includes('rate limit') || m.includes('too many requests'), msg: 'Hiciste demasiados intentos. Esperá unos minutos y probá de nuevo.' },
  { test: (m) => m.includes('network request failed') || m.includes('failed to fetch') || m.includes('network'), msg: 'No hay conexión. Revisá tu internet y probá de nuevo.' },
  { test: (m) => m.includes('jwt expired') || m.includes('not authenticated') || m.includes('no hay sesión'), msg: 'Tu sesión venció. Volvé a iniciar sesión.' },
  { test: (m) => m.includes('dni'), msg: 'El DNI no coincide con el perfil que querés reclamar.' },
  { test: (m) => m.includes('ya fue reclamado'), msg: 'Ese perfil ya fue reclamado por otra cuenta.' },
  { test: (m) => m.includes('ya tenés un perfil'), msg: 'Tu cuenta ya tiene un perfil de instructor.' },
  { test: (m, c) => c === '23505' && m.includes('camara_code'), msg: 'Ese código de la Cámara ya está asociado a otro estudio.' },
  { test: (_m, c) => c === '23505', msg: 'Ese dato ya está registrado.' },
  { test: (_m, c) => c === '23514', msg: 'Algún valor no es válido. Revisá los datos.' },
  { test: (_m, c) => c === '42501' || _m.includes('row-level security') || _m.includes('not allowed'), msg: 'No tenés permiso para hacer esto.' },
  { test: (_m, c) => c === 'PGRST116', msg: 'No encontramos lo que buscabas.' },
]

export function humanizeError(e: unknown): string {
  const err = e as AnyErr
  const raw = (typeof e === 'string' ? e : err?.message) ?? ''
  const m = raw.toLowerCase()
  const code = err?.code ?? ''
  if (__DEV__) console.warn('[error]', code, raw, err?.details ?? '')
  for (const r of RULES) if (r.test(m, code)) return r.msg
  return 'No pudimos completar la operación. Probá de nuevo.'
}
