// Datos del panel de administración de la plataforma (super_admin ve todas las redes por RLS).
import { useQuery } from '@tanstack/react-query'
import { supabase } from './supabase'

const list = async (q: any) => { const { data, error } = await q; if (error) throw error; return (data ?? []) as any[] }

export const useAdminStudios = () =>
  useQuery({
    queryKey: ['admin-studios'],
    queryFn: () => list(supabase.from('studios')
      .select('id, name, neighborhood, is_member, member_since, camara_id, created_at, logo_url, owner_email, user_id, placement_credits, membership:memberships(plan_type, status, matches_used_month, matches_limit, last_reset_date)')
      .order('created_at', { ascending: false })),
  })

export const useAdminInstructors = () =>
  useQuery({
    queryKey: ['admin-instructors'],
    queryFn: () => list(supabase.from('instructors')
      .select('id, full_name, email, phone, neighborhood, avatar_url, verification_status, created_at, camara_id, is_active')
      .order('created_at', { ascending: false })),
  })

export const useAdminMatches = () =>
  useQuery({
    queryKey: ['admin-matches'],
    queryFn: () => list(supabase.from('matches')
      .select(`id, created_at, responded_at, class_type, class_date, start_time, end_time, status, offered_rate, agreed_rate, camara_id,
        cancelled_by, cancel_reason, late_cancel, held_studio, held_instructor, hire_status, placement_status, placement_fee_ars, placement_paid_at,
        studio:studios(id, name), instructor:instructors(id, full_name, avatar_url)`)
      .order('created_at', { ascending: false }).limit(500)),
  })

/** Cargos de incorporación devueltos o por devolver, facturas sin cobrar y liquidaciones sin pagar (sin importar el mes) */
export const useAdminPending = () =>
  useQuery({
    queryKey: ['admin-pending'],
    queryFn: async () => {
      const [refunds, invoices, settlements] = await Promise.all([
        supabase.from('matches').select('id, placement_fee_ars, placement_paid_at, studio:studios(name)').eq('placement_status', 'a_devolver'),
        supabase.from('camara_invoices').select('id, period, amount_ars, status, camara:camaras(name)').neq('status', 'pagada'),
        supabase.from('camara_settlements').select('id, period, share_ars, status, camara:camaras(name)').neq('status', 'pagada'),
      ])
      return { refunds: refunds.data ?? [], invoices: invoices.data ?? [], settlements: settlements.data ?? [] } as Record<string, any[]>
    },
  })

export const ADMIN_KEYS = [['admin-studios'], ['admin-instructors'], ['admin-matches'], ['admin-pending'], ['platform-camaras'],
  ['invoices'], ['settlements'], ['placements']]

// ── Formatos ──────────────────────────────────────────────────────
export const shortDate = (iso?: string | null) => iso
  ? new Date(iso.length === 10 ? iso + 'T12:00:00' : iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' }).replace('.', '').replace(/ de /g, ' ')
  : '—'
export const monthStartIso = (d = new Date()) => new Date(d.getFullYear(), d.getMonth(), 1).toISOString()
export const usedThisMonth = (m: any) => {
  if (!m) return 0
  const reset = m.last_reset_date ? new Date(m.last_reset_date + 'T12:00:00') : null
  const now = new Date()
  return reset && (reset.getFullYear() < now.getFullYear() || reset.getMonth() < now.getMonth()) ? 0 : (m.matches_used_month ?? 0)
}
export const one = <T,>(x: T | T[] | null | undefined): T | null => Array.isArray(x) ? (x[0] ?? null) : (x ?? null)

export const PLAN_LABEL: Record<string, string> = { freemium: 'Freemium', starter: 'Starter', socio: 'Socio', premium: 'Premium' }
export const VERIF: Record<string, { label: string; tone: 'ok' | 'warn' | 'red' | 'neutral' }> = {
  verificado: { label: 'Verificado', tone: 'ok' }, pendiente: { label: 'Por verificar', tone: 'warn' },
  rechazado: { label: 'Rechazado', tone: 'red' }, en_revision: { label: 'En revisión', tone: 'warn' },
}

/** Estado legible de una propuesta, con el detalle de lo que pasó después de aceptar */
export function matchState(m: any): { label: string; tone: 'ok' | 'warn' | 'red' | 'neutral' | 'info' } {
  if (m.status === 'pendiente') return { label: 'Pendiente', tone: 'warn' }
  if (m.status === 'rechazado') return { label: 'Rechazada', tone: 'neutral' }
  if (m.status === 'expirado') return { label: 'Vencida', tone: 'neutral' }
  if (m.status === 'cancelado') return m.cancelled_by
    ? { label: `Cancelada por ${m.cancelled_by === 'estudio' ? 'el estudio' : 'el instructor'}${m.late_cancel ? ' (tarde)' : ''}`, tone: 'red' }
    : { label: 'Cancelada', tone: 'neutral' }
  if (m.placement_status === 'pendiente_pago') return { label: 'Falta pagar el cargo', tone: 'warn' }
  if (m.hire_status === 'contratado') return { label: 'Regular activa', tone: 'ok' }
  if (m.hire_status === 'no_sigue') return { label: 'No siguió', tone: 'neutral' }
  if (m.held_studio === false || m.held_instructor === false) return { label: 'No se dio', tone: 'red' }
  if (m.held_studio || m.held_instructor) return { label: 'Se dio', tone: 'ok' }
  return { label: m.class_type === 'regular' ? 'Entrevista confirmada' : 'Confirmada', tone: 'info' }
}
