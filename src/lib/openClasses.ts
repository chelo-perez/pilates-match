// Clases abiertas: el estudio publica una clase con su oferta; los instructores compatibles
// se anotan; el estudio elige a uno y eso crea la propuesta ya aceptada.
import { useQuery } from '@tanstack/react-query'
import { supabase } from './supabase'
import { UserError } from './errors'

export type OpenClass = {
  id: string; studio_id: string; class_type: 'regular' | 'reemplazo'; class_date: string
  start_time: string; end_time: string; schedule_days: string[] | null; schedule_from: string | null; schedule_to: string | null
  offered_rate: number; note: string | null; status: 'abierta' | 'cubierta' | 'cerrada' | 'vencida'
  chosen_instructor_id: string | null; expires_at: string; created_at: string
  studio?: { id: string; name: string; neighborhood: string | null; logo_url: string | null } | null
  applications?: { instructor_id: string; note: string | null; created_at: string; instructor?: { id: string; full_name: string; avatar_url: string | null; neighborhood: string | null } | null }[]
}

const OPEN = 'id, studio_id, class_type, class_date, start_time, end_time, schedule_days, schedule_from, schedule_to, offered_rate, note, status, chosen_instructor_id, expires_at, created_at'

/** Clases abiertas de la red del instructor (solo las vigentes) + en cuáles ya se anotó */
export const useOpenClassesForInstructor = (instructorId: string | undefined) =>
  useQuery({
    queryKey: ['open-classes', 'instructor', instructorId],
    queryFn: async () => {
      const [cls, apps] = await Promise.all([
        supabase.from('open_classes').select(`${OPEN}, studio:studios(id, name, neighborhood, logo_url)`).eq('status', 'abierta').order('class_date').order('start_time'),
        supabase.from('open_class_applications').select('open_class_id').eq('instructor_id', instructorId!),
      ])
      if (cls.error) throw cls.error
      return { classes: (cls.data ?? []) as unknown as OpenClass[], applied: new Set((apps.data ?? []).map((a: any) => a.open_class_id as string)) }
    },
    enabled: !!instructorId,
  })

/** Clases abiertas del estudio, con los anotados */
export const useStudioOpenClasses = (studioId: string | undefined) =>
  useQuery({
    queryKey: ['open-classes', 'studio', studioId],
    queryFn: async () => {
      const { data, error } = await supabase.from('open_classes')
        .select(`${OPEN}, applications:open_class_applications(instructor_id, note, created_at, instructor:instructors(id, full_name, avatar_url, neighborhood))`)
        .eq('studio_id', studioId!).order('created_at', { ascending: false }).limit(20)
      if (error) throw error
      return (data ?? []) as unknown as OpenClass[]
    },
    enabled: !!studioId,
  })

export async function publishOpenClass(p: {
  classType: 'regular' | 'reemplazo'; classDate: string; start: string; end: string
  days?: string[]; from?: string; to?: string; offered: number; note?: string
}): Promise<string> {
  const { data, error } = await supabase.rpc('publish_open_class', {
    p_class_type: p.classType, p_class_date: p.classDate, p_start: p.start + ':00', p_end: p.end + ':00',
    p_days: p.days ?? null, p_from: p.from ? p.from + ':00' : null, p_to: p.to ? p.to + ':00' : null,
    p_offered: p.offered, p_note: p.note ?? null,
  })
  if (error) {
    if ((error.message ?? '').includes('MATCH_LIMIT_REACHED')) throw new Error('MATCH_LIMIT_REACHED')
    throw error
  }
  return data as string
}

export async function applyToOpenClass(openClassId: string, instructorId: string, on: boolean) {
  const q = on
    ? supabase.from('open_class_applications').insert({ open_class_id: openClassId, instructor_id: instructorId })
    : supabase.from('open_class_applications').delete().eq('open_class_id', openClassId).eq('instructor_id', instructorId)
  const { error } = await q
  if (error && (error as any).code !== '23505') {
    if ((error as any).code === '42501' || /row-level security/i.test(error.message)) throw new UserError('Esta clase ya no está abierta.')
    throw error
  }
}

export async function pickApplicant(openClassId: string, instructorId: string) {
  const { data, error } = await supabase.rpc('pick_open_class_applicant', { p_open_class: openClassId, p_instructor: instructorId })
  if (error) throw error
  return data as string
}

export async function closeOpenClass(openClassId: string) {
  const { error } = await supabase.rpc('close_open_class', { p_open_class: openClassId })
  if (error) throw error
}

export const DAYS_SHORT: Record<string, string> = { lunes: 'Lun', martes: 'Mar', miercoles: 'Mié', jueves: 'Jue', viernes: 'Vie', sabado: 'Sáb', domingo: 'Dom' }
export const hhmm = (t: string | null | undefined) => (t ?? '').slice(0, 5)
export const money = (n: number) => '$' + Math.round(Number(n)).toLocaleString('es-AR')
export const whenLabel = (c: OpenClass) => {
  if (c.class_type === 'regular') {
    const days = (c.schedule_days ?? []).map(d => DAYS_SHORT[d] ?? d).join(', ')
    return `${days || 'Clase regular'} · ${hhmm(c.schedule_from ?? c.start_time)}–${hhmm(c.schedule_to ?? c.end_time)}`
  }
  const d = new Date(c.class_date + 'T12:00:00').toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })
  return `${d} · ${hhmm(c.start_time)}–${hhmm(c.end_time)}`
}
