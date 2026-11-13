// Qué pasa después de aceptar una propuesta: fase de la clase, contacto, calendario y acciones.
// Reemplazo: confirmada → (recordatorios) → ¿se dio? → evaluación.
// Regular: entrevista con clase de prueba → el estudio decide si la contrata → clase regular activa.
import { Linking, Platform } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { supabase } from './supabase'
import { UserError } from './errors'

export type Phase =
  | 'pendiente'      // todavía no respondida
  | 'proxima'        // confirmada, falta para que empiece
  | 'en_curso'       // empezó y no terminó
  | 'terminada'      // terminó: falta confirmar si se dio / decidir
  | 'contratado'     // regular activa
  | 'cerrada'        // no sigue, terminada o cerrada
  | 'cancelada'
  | 'otra'           // rechazada, vencida

/** Fecha y hora local de la clase (o de la clase de prueba) */
export const matchStart = (m: any) => new Date(`${m.class_date}T${String(m.start_time).slice(0, 5)}:00-03:00`)
export const matchEnd = (m: any) => new Date(`${m.class_date}T${String(m.end_time).slice(0, 5)}:00-03:00`)

export function phaseOf(m: any, now = new Date()): Phase {
  if (!m) return 'otra'
  if (m.status === 'cancelado') return 'cancelada'
  if (m.status === 'pendiente') return 'pendiente'
  if (m.status !== 'aceptado') return 'otra'
  if (m.hire_status === 'contratado') return m.ended_at ? 'cerrada' : 'contratado'
  if (m.hire_status === 'no_sigue') return 'cerrada'
  if (now < matchStart(m)) return 'proxima'
  if (now < matchEnd(m)) return 'en_curso'
  return 'terminada'
}

/** Lo que falta hacer de este lado (para mostrar un aviso en las listas) */
export function pendingAction(m: any, side: 'estudio' | 'instructor'): string | null {
  const ph = phaseOf(m)
  if (ph !== 'terminada') return null
  if (side === 'estudio' && m.class_type === 'regular') return '¿La sumás como clase regular?'
  const held = side === 'estudio' ? m.held_studio : m.held_instructor
  return held == null ? '¿Se dio la clase?' : null
}

export const isConfirmed = (m: any) => ['proxima', 'en_curso', 'terminada', 'contratado'].includes(phaseOf(m))

// ── Contacto ──────────────────────────────────────────────────────
/** Teléfono para WhatsApp: 54 + 9 + área y número (acepta 011 15..., 11..., +54...) */
export function waNumber(phone?: string | null) {
  let d = String(phone ?? '').replace(/\D/g, '')
  if (!d) return null
  if (d.startsWith('54')) d = d.slice(2)
  if (d.startsWith('0')) d = d.slice(1)
  if (d.startsWith('9')) d = d.slice(1)
  d = d.replace(/^(\d{2,4})15(\d{6,8})$/, '$1$2') // 11 15 4444 0000 → 11 4444 0000
  return d.length >= 10 ? '549' + d : null
}
export const openWhatsApp = (phone: string | null | undefined, text: string) => {
  const n = waNumber(phone)
  if (n) Linking.openURL(`https://wa.me/${n}?text=${encodeURIComponent(text)}`)
}
export const openCall = (phone: string | null | undefined) => { if (phone) Linking.openURL(`tel:${phone.replace(/[^\d+]/g, '')}`) }
export const openMaps = (address: string, area?: string | null) =>
  Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${address}${area ? ', ' + area : ''}, CABA`)}`)

/** Agregar a Google Calendar (funciona en Android, iPhone y web, sin permisos) */
export function addToCalendar(m: any, title: string, location?: string | null, details?: string) {
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const url = 'https://calendar.google.com/calendar/render?action=TEMPLATE'
    + `&text=${encodeURIComponent(title)}`
    + `&dates=${fmt(matchStart(m))}/${fmt(matchEnd(m))}`
    + (location ? `&location=${encodeURIComponent(location)}` : '')
    + (details ? `&details=${encodeURIComponent(details)}` : '')
  if (Platform.OS === 'web') window.open(url, '_blank'); else Linking.openURL(url)
}

// ── Datos ─────────────────────────────────────────────────────────
const MATCH_FIELDS = `*, studio:studios(id, name, neighborhood, logo_url),
  instructor:instructors(id, full_name, neighborhood, avatar_url)`

export const useMatchDetail = (matchId: string | undefined) =>
  useQuery({
    queryKey: ['match-detail', matchId],
    queryFn: async () => {
      const { data, error } = await supabase.from('matches').select(MATCH_FIELDS).eq('id', matchId!).maybeSingle()
      if (error) throw error
      return data as any
    },
    enabled: !!matchId,
  })

/** Teléfono y dirección del otro lado: solo con la clase confirmada */
export const useMatchContact = (matchId: string | undefined, enabled: boolean) =>
  useQuery({
    queryKey: ['match-contact', matchId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('match_contact', { p_match: matchId })
      if (error) return null
      return data as { phone?: string | null; email?: string | null; address?: string | null; instagram?: string | null } | null
    },
    enabled: !!matchId && enabled,
  })

/** ¿Ya evaluó esta clase? (estudio → evaluations por instructor y fecha; instructor → studio_evaluations por propuesta) */
export const useEvaluated = (m: any, side: 'estudio' | 'instructor') =>
  useQuery({
    queryKey: ['match-evaluated', m?.id, side],
    queryFn: async () => {
      const q = side === 'estudio'
        ? supabase.from('evaluations').select('id', { count: 'exact', head: true })
            .eq('studio_id', m.studio_id).eq('instructor_id', m.instructor_id).eq('class_date', m.class_date)
        : supabase.from('studio_evaluations').select('id', { count: 'exact', head: true }).eq('match_id', m.id)
      const { count } = await q
      return (count ?? 0) > 0
    },
    enabled: !!m?.id,
  })

export interface Reliability { confirmed: number; late_cancels: number; no_shows: number }
export const useReliability = (who: { studioId?: string; instructorId?: string }) =>
  useQuery({
    queryKey: ['reliability', who.studioId ?? null, who.instructorId ?? null],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('reliability', { p_studio: who.studioId ?? null, p_instructor: who.instructorId ?? null })
      if (error) return null
      return data as Reliability
    },
    enabled: !!(who.studioId || who.instructorId),
    staleTime: 5 * 60_000,
  })

/** Texto de alerta de confiabilidad, o null si no hay nada para avisar */
export function reliabilityWarning(r: Reliability | null | undefined) {
  if (!r) return null
  const parts: string[] = []
  if (r.late_cancels) parts.push(`canceló ${r.late_cancels} clase${r.late_cancels === 1 ? '' : 's'} con menos de 24 h`)
  if (r.no_shows) parts.push(`${r.no_shows} clase${r.no_shows === 1 ? '' : 's'} que no se dio`)
  return parts.length ? parts.join(' · ').replace(/^./, c => c.toUpperCase()) : null
}

async function rpc(fn: string, args: Record<string, unknown>) {
  const { error } = await supabase.rpc(fn, args)
  if (error) throw new UserError(error.message?.replace(/^.*?: /, '') || 'No se pudo completar')
}
export const cancelConfirmed = (matchId: string, reason: string) => rpc('cancel_confirmed_match', { p_match: matchId, p_reason: reason })
export const confirmHeld = (matchId: string, held: boolean) => rpc('confirm_class_held', { p_match: matchId, p_held: held })
export const decideHire = (matchId: string, hire: boolean) => rpc('decide_hire', { p_match: matchId, p_hire: hire })
export const endRegular = (matchId: string, reason: string) => rpc('end_regular', { p_match: matchId, p_reason: reason })

export const MATCH_KEYS = [['match-detail'], ['match-contact'], ['studio-matches'], ['instructor-matches'], ['studio-history-recent'],
  ['studio-quota'], ['studio-membership'], ['can-match'], ['reliability'], ['match-evaluated']]
