// La clase que el estudio necesita cubrir. Es el centro del match: la búsqueda se ordena
// para ESA clase, y la propuesta arranca ya cargada con estos datos.
import { create } from 'zustand'

export type ClassNeed = {
  classType: 'regular' | 'reemplazo'
  date: string          // reemplazo: YYYY-MM-DD
  days: string[]        // regular: lunes, martes...
  from: string          // HH:MM
  to: string            // HH:MM
}

const tomorrow = () => { const d = new Date(); d.setDate(d.getDate() + 1); return d }
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

interface State { need: ClassNeed; set: (n: Partial<ClassNeed>) => void }
export const useSearchNeed = create<State>()(set => ({
  need: { classType: 'reemplazo', date: iso(tomorrow()), days: ['lunes', 'miercoles'], from: '09:00', to: '13:00' }, // bloque habitual: 4 clases
  set: n => set(s => ({ need: { ...s.need, ...n } })),
}))

export const DAY_BY_JS_INDEX = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado']
export const DAY_SHORT: Record<string, string> = { lunes: 'Lun', martes: 'Mar', miercoles: 'Mié', jueves: 'Jue', viernes: 'Vie', sabado: 'Sáb', domingo: 'Dom' }
/** Días de la semana que pide la necesidad (para reemplazo, el de la fecha) */
export const needDays = (n: ClassNeed) => n.classType === 'reemplazo' ? [DAY_BY_JS_INDEX[new Date(n.date + 'T12:00:00').getDay()]] : n.days
export const parseLocal = (isoDate: string) => new Date(isoDate + 'T12:00:00')
export const fromHHMM = (hhmm: string) => { const [h, m] = hhmm.split(':').map(Number); const d = new Date(); d.setHours(h, m, 0, 0); return d }

/** Corre el inicio manteniendo la duración (por defecto, el bloque de 4 clases) */
export function shiftStart(newFrom: Date, oldFrom: Date, oldTo: Date) {
  const span = oldTo.getTime() - oldFrom.getTime()
  const to = new Date(newFrom.getTime() + (span > 0 ? span : 4 * 3600_000))
  if (to.getDate() !== newFrom.getDate()) to.setHours(23, 30, 0, 0)
  return to
}
