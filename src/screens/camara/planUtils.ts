// src/screens/camara/planUtils.ts
// Cambio de plan de un estudio desde la Cámara: una sola lógica para StudiosScreen y StudioDetailScreen
import { supabase } from '../../lib/supabase'
import { toLocalISODate } from '../../lib/dates'
import { PLANS } from '../../constants/plans'

export type PlanKey = 'freemium' | 'starter' | 'socio' | 'premium'

export const PAID_PLANS: PlanKey[] = ['starter', 'premium']

// Duración de cada plan al asignarlo. Freemium no vence (end_date es NOT NULL: se pone lejos).
const PLAN_MONTHS: Record<PlanKey, number> = { freemium: 120, starter: 1, socio: 12, premium: 1 }

export const planEndDate = (plan: PlanKey) => {
  const end = new Date()
  end.setMonth(end.getMonth() + PLAN_MONTHS[plan])
  return toLocalISODate(end)
}

export const planDurationLabel = (plan: PlanKey) =>
  plan === 'freemium' ? 'sin vencimiento' : PLAN_MONTHS[plan] === 12 ? 'por 12 meses' : 'por 1 mes'

export const membershipOf = (studio: any) =>
  Array.isArray(studio?.membership) ? studio.membership[0] ?? null : studio?.membership ?? null

/**
 * Asigna un plan: upsert de la membresía + is_member (solo plan 'socio') + nota opcional.
 * Lanza error si algo falla (la membresía se escribe primero para no dejar al estudio marcado como socio sin plan).
 */
export async function applyPlan(studioId: string, plan: PlanKey, note?: string) {
  const def = PLANS.find((p: any) => p.key === plan)
  const today = toLocalISODate(new Date())

  const { error: memError } = await supabase.from('memberships').upsert(
    {
      studio_id: studioId,
      status: 'activa',
      plan_type: plan,
      matches_limit: def ? def.limit : null,
      matches_used_month: 0,
      last_reset_date: today,
      start_date: today,
      end_date: planEndDate(plan),
    },
    { onConflict: 'studio_id' }
  )
  if (memError) throw memError

  const isMember = plan === 'socio'
  const { data, error: stError } = await supabase.from('studios')
    .update({ is_member: isMember, member_since: isMember ? today : null })
    .eq('id', studioId)
    .select('id')
  if (stError) throw stError
  if (!data?.length) throw new Error('No tenés permiso para modificar este estudio.')

  if (note?.trim()) {
    const { error: noteError } = await supabase.from('camara_studio_notes')
      .insert({ studio_id: studioId, note: `Cambio a ${def?.label ?? plan}: ${note.trim()}` })
    if (noteError) return { noteSaved: false }
  }
  return { noteSaved: true }
}

/** Keys que hay que refrescar después de tocar planes o estudios */
export const STUDIO_KEYS = [
  ['camara-studios-full'], ['studio-detail'], ['camara-stats'], ['camara-reports'],
  ['potential-members'], ['camara-studios'],
]
