// src/screens/studio/studioQueries.ts
// Consultas y helpers que comparten las pantallas del estudio.
import { Alert, Linking } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { toLocalISODate } from '../../lib/dates'

// ── Evaluaciones pendientes ─────────────────────────────────
// Clases aceptadas con fecha anterior a hoy (hora local) que todavía no se evaluaron.
// La clave empieza con 'pending-evaluations' para que useCreateEvaluation la invalide.
export const usePendingEvaluationMatches = (studioId: string | undefined) =>
  useQuery({
    queryKey: ['pending-evaluations', studioId, 'matches'],
    queryFn: async () => {
      const today = toLocalISODate(new Date())
      const { data, error } = await supabase
        .from('matches')
        .select('*, instructor:instructors(id, full_name, avatar_url, neighborhood)')
        .eq('studio_id', studioId!)
        .eq('status', 'aceptado')
        .lt('class_date', today)
        .order('class_date', { ascending: true })
      if (error) throw error

      const { data: evaluated, error: evalError } = await supabase
        .from('evaluations')
        .select('instructor_id, class_date')
        .eq('studio_id', studioId!)
      if (evalError) throw evalError

      const evalSet = new Set((evaluated ?? []).map((e: any) => `${e.instructor_id}_${e.class_date}`))
      return (data ?? []).filter((m: any) => !evalSet.has(`${m.instructor_id}_${m.class_date}`))
    },
    enabled: !!studioId,
  })

// ── Membresía del estudio ───────────────────────────────────
export const useStudioMembership = (studioId: string | undefined) =>
  useQuery({
    queryKey: ['studio-membership', studioId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('memberships')
        .select('*')
        .eq('studio_id', studioId!)
        .maybeSingle()
      if (error) throw error
      return data
    },
    enabled: !!studioId,
  })

// ── Contacto de la Cámara ───────────────────────────────────
export const DEFAULT_CONTACT_EMAIL = 'contacto@trabajomasfacil.com'

export interface CamaraContact {
  name: string | null
  email: string | null
  phone: string | null
}

export const useCamaraContact = (camaraId: string | null | undefined) =>
  useQuery({
    queryKey: ['camara-contact', camaraId],
    queryFn: async (): Promise<CamaraContact> => {
      const { data, error } = await supabase
        .from('camaras')
        .select('name, contact_email, contact_phone, phone')
        .eq('id', camaraId!)
        .maybeSingle()
      if (error) {
        // Si no se puede leer, se usa el contacto general (no bloquea la pantalla)
        console.warn('useCamaraContact', error)
        return { name: null, email: null, phone: null }
      }
      return {
        name: data?.name ?? null,
        email: data?.contact_email ?? null,
        phone: data?.contact_phone ?? data?.phone ?? null,
      }
    },
    enabled: !!camaraId,
    staleTime: 30 * 60 * 1000,
  })

/** Abre mail o WhatsApp para pedirle a la Cámara un cambio de plan. */
export function contactCamaraForPlan(contact: CamaraContact | undefined, studioName?: string | null) {
  const email = contact?.email || DEFAULT_CONTACT_EMAIL
  const phone = (contact?.phone ?? '').replace(/\D/g, '')
  const subject = 'Cambio de plan'
  const body = `Hola, somos ${studioName ?? 'un estudio'} y queremos actualizar nuestro plan en Trabajo Más Fácil.`

  const openMail = () =>
    Linking.openURL(`mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`)
      .catch(() => Alert.alert('No pudimos abrir el correo', `Escribinos a ${email}`))
  const openWhatsApp = () =>
    Linking.openURL(`https://wa.me/${phone}?text=${encodeURIComponent(body)}`)
      .catch(() => Alert.alert('No pudimos abrir WhatsApp', `Escribinos a ${email}`))

  if (!phone) { openMail(); return }
  Alert.alert(
    'Pedile a la Cámara que actualice tu plan',
    `¿Cómo querés contactar a ${contact?.name ?? 'la Cámara'}?`,
    [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'WhatsApp', onPress: openWhatsApp },
      { text: 'Correo', onPress: openMail },
    ]
  )
}

// ── Disponibilidad ──────────────────────────────────────────
/** Índice de Date.getDay() → valor del enum day_of_week. */
export const DAY_BY_JS_INDEX = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado']

/** ¿Alguna franja activa del instructor cubre ese día/horario (HH:MM) para ese tipo de clase? */
export function availabilityCovers(
  availability: any[] | undefined,
  day: string,
  classType: 'regular' | 'reemplazo',
  from: string,
  to: string,
): boolean {
  return (availability ?? []).some((a: any) =>
    a.is_active !== false &&
    a.day_of_week === day &&
    a.class_type === classType &&
    String(a.start_time).slice(0, 5) <= from &&
    String(a.end_time).slice(0, 5) >= to
  )
}

/** Próxima fecha (desde hoy inclusive) que cae en alguno de los días indicados. */
export function nextDateForDays(days: string[], from = new Date()): Date {
  const d = new Date(from)
  d.setHours(0, 0, 0, 0)
  for (let i = 0; i < 7; i++) {
    if (days.includes(DAY_BY_JS_INDEX[d.getDay()])) return d
    d.setDate(d.getDate() + 1)
  }
  return d
}

// ── Planes ──────────────────────────────────────────────────
export const limitText = (limit: number | null | undefined) =>
  limit == null ? 'Propuestas ilimitadas' : `${limit} propuesta${limit === 1 ? '' : 's'} por mes`

export const nextResetLabel = () => {
  const d = new Date()
  const first = new Date(d.getFullYear(), d.getMonth() + 1, 1)
  return first.toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })
}
