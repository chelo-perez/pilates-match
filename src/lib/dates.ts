// src/lib/dates.ts
// Fechas en hora local de Argentina. Nunca usar toISOString().split('T')[0]
// ni new Date('YYYY-MM-DD'): ambos trabajan en UTC y corren el día (después de
// las 21 h, "hoy" pasa a ser mañana).

const pad = (n: number) => String(n).padStart(2, '0')

/** Date → 'YYYY-MM-DD' en hora local. */
export function toLocalISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** 'YYYY-MM-DD' (o un timestamp ISO) → Date local, sin corrimiento UTC. */
export function parseLocalDate(s: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s ?? '')
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return new Date(s)
}

/** Formato corto es-AR, por defecto "3 nov". */
export function formatDate(
  s: string | Date | null | undefined,
  opts?: Intl.DateTimeFormatOptions,
): string {
  if (!s) return ''
  const d = typeof s === 'string' ? parseLocalDate(s) : s
  if (isNaN(d.getTime())) return ''
  // Por defecto "3 nov"; si es de otro año, "1 ene 2036"
  const o = opts ?? (d.getFullYear() === new Date().getFullYear()
    ? { day: 'numeric', month: 'short' }
    : { day: 'numeric', month: 'short', year: 'numeric' })
  return d.toLocaleDateString('es-AR', o).replace('.', '')
}

/** Date → 'HH:MM' (24 h), para mandar a columnas time de la base. */
export function toHHMM(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** true si la fecha (YYYY-MM-DD) es anterior a hoy (hora local). */
export function isPastDate(s: string | Date): boolean {
  const d = typeof s === 'string' ? parseLocalDate(s) : s
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  return day.getTime() < today.getTime()
}

/** Hoy en 'YYYY-MM-DD' local. */
export const todayISO = () => toLocalISODate(new Date())
