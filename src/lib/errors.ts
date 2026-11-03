// src/lib/errors.ts
// Traduce errores de Supabase / red a mensajes para el usuario.
// El detalle técnico queda solo en la consola.

/** Error cuyo mensaje ya está pensado para el usuario: humanizeError lo muestra tal cual. */
export class UserError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UserError'
  }
}

// Mensajes en castellano que lanzan las funciones de la base (RAISE EXCEPTION):
// se muestran tal cual (o con un texto mejor para la app).
const PASS_THROUGH: Record<string, string> = {
  'el dni no coincide con el del perfil': 'El DNI no coincide con el del perfil',
  'el perfil ya fue reclamado o no existe': 'El perfil ya fue reclamado o no existe',
  'ya tenés un perfil de instructor': 'Ya tenés un perfil de instructor',
  'match_limit_reached': 'Usaste todas las propuestas de tu plan este mes',
}

type AnyErr = { message?: string; code?: string; status?: number; details?: string } | null | undefined

const RULES: { test: (m: string, code: string) => boolean; msg: string }[] = [
  { test: (m) => m.includes('invalid login credentials'), msg: 'Email o contraseña incorrectos.' },
  { test: (m) => m.includes('email not confirmed'), msg: 'Confirmá tu email antes de entrar (revisá tu casilla).' },
  { test: (m) => m.includes('user already registered') || m.includes('already been registered'), msg: 'Ya existe una cuenta con ese email. Iniciá sesión.' },
  { test: (m) => m.includes('password should be at least') || m.includes('weak password'), msg: 'La contraseña es muy corta o débil.' },
  { test: (m) => m.includes('unable to validate email') || m.includes('invalid email') || (m.includes('email address') && m.includes('invalid')), msg: 'El email no es válido.' },
  { test: (m) => m.includes('rate limit') || m.includes('too many requests'), msg: 'Hiciste demasiados intentos. Esperá unos minutos y probá de nuevo.' },
  { test: (m) => m.includes('network request failed') || m.includes('failed to fetch') || m.includes('network'), msg: 'No hay conexión. Revisá tu internet y probá de nuevo.' },
  { test: (m) => m.includes('jwt expired') || m.includes('not authenticated') || m.includes('no hay sesión'), msg: 'Tu sesión venció. Volvé a iniciar sesión.' },
  { test: (m, c) => c === '23505' && m.includes('camara_code'), msg: 'Ese código de la Cámara ya está asociado a otro estudio.' },
  { test: (_m, c) => c === '23505', msg: 'Ese dato ya está registrado.' },
  { test: (_m, c) => c === '23514', msg: 'Algún valor no es válido. Revisá los datos.' },
  { test: (_m, c) => c === '42501' || _m.includes('row-level security') || _m.includes('not allowed'), msg: 'No tenés permiso para hacer esto.' },
  { test: (_m, c) => c === 'PGRST116', msg: 'No encontramos lo que buscabas.' },
]

export function humanizeError(e: unknown): string {
  if (e instanceof UserError) return e.message
  const err = e as AnyErr
  const raw = (typeof e === 'string' ? e : err?.message) ?? ''
  const m = raw.toLowerCase()
  const code = err?.code ?? ''
  if (__DEV__) console.warn('[error]', code, raw, err?.details ?? '')
  const known = Object.keys(PASS_THROUGH).find(k => m.includes(k))
  if (known) return PASS_THROUGH[known]
  for (const r of RULES) if (r.test(m, code)) return r.msg
  return 'No pudimos completar la operación. Probá de nuevo.'
}

/** Alias de humanizeError (nombre que usan algunas pantallas). */
export const errorText = humanizeError
