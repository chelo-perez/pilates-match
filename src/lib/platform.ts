// Dueño de la plataforma y entidades: redes, precios por red y liquidaciones mensuales.
// (En la base cada red es una fila de 'camaras'.)
import { useQuery } from '@tanstack/react-query'
import { supabase } from './supabase'
import { colors } from '../components/ui'
import { useAuthStore } from '../store'

/**
 * Limita una consulta a la red de quien la hace. Los perfiles de estudio son de lectura
 * pública (los instructores ven a quién trabajan), así que el panel de una entidad tiene
 * que filtrar por su red; la plataforma ve todas.
 */
export function myNetwork<Q>(q: Q): Q {
  const u: any = useAuthStore.getState().user
  return u?.role === 'camara_admin' ? (q as any).eq('camara_id', u.camara_id ?? '00000000-0000-0000-0000-000000000000') : q
}

export interface Camara {
  id: string; name: string; slug: string; sector: string; business_label: string; instructor_label: string
  revenue_share_pct: number; entity_type?: string; entity_article?: 'la' | 'el'; cuit: string | null; contact_email: string | null; is_active: boolean; logo_url: string | null
  billing_model?: 'subscriptions' | 'per_member'; min_billable_members?: number; price_index?: 'fixed' | 'avg_hour'
}
/** Factura mensual de la plataforma a una entidad con cobro por socio */
export interface Invoice {
  id: string; camara_id: string; period: string; billable_members: number; amount_ars: number
  detail: { from: number; to: number | null; price: number; factor?: number; qty: number; subtotal: number }[]
  avg_hour?: number | null
  status: 'pendiente' | 'enviada' | 'pagada'; invoice_number: string | null; sent_at: string | null; paid_at: string | null; payment_reference: string | null
  camara?: { name: string } | null
}
export interface BillingPreview {
  members: number; min_members: number; billed_members: number; amount_ars: number
  rows: Invoice['detail']; tiers: { from: number; price: number; factor: number }[]
  price_index?: 'fixed' | 'avg_hour'; avg_hour?: number | null; current_avg_hour?: number | null
}
export const INVOICE_STATUS: Record<Invoice['status'], { label: string; bg: string; tx: string }> = {
  pendiente: { label: 'A emitir',  bg: colors.warnBg,    tx: colors.warnTx },
  enviada:   { label: 'Emitida · a pagar', bg: colors.sageLight, tx: colors.sage },
  pagada:    { label: 'Pagada',    bg: colors.okBg,      tx: colors.okTx },
}
export interface Settlement {
  id: string; camara_id: string; period: string; collected_ars: number; share_pct: number; share_ars: number
  status: 'pendiente' | 'facturada' | 'pagada'; invoice_number: string | null; paid_at: string | null; payment_reference: string | null
  camara?: { name: string } | null
}

export const SETTLEMENT_STATUS: Record<Settlement['status'], { label: string; bg: string; tx: string }> = {
  pendiente: { label: 'Falta la factura',    bg: colors.warnBg,    tx: colors.warnTx },
  facturada: { label: 'Facturada · a pagar', bg: colors.sageLight, tx: colors.sage },
  pagada:    { label: 'Pagada',              bg: colors.okBg,      tx: colors.okTx },
}

export const monthStart = (d = new Date()) => new Date(d.getFullYear(), d.getMonth(), 1)
export const isoMonth = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
export const monthLabel = (iso: string) => {
  const [y, m] = iso.split('-').map(Number)
  const s = new Date(y, m - 1, 1).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export const useCamaras = () =>
  useQuery({
    queryKey: ['platform-camaras'],
    queryFn: async (): Promise<Camara[]> => {
      const { data, error } = await supabase.from('camaras').select('*').order('created_at')
      if (error) throw error
      return (data ?? []) as Camara[]
    },
  })

export const useCamara = (id: string | null | undefined) =>
  useQuery({
    queryKey: ['camara', id],
    queryFn: async (): Promise<Camara | null> => {
      const { data, error } = await supabase.from('camaras').select('*').eq('id', id!).maybeSingle()
      if (error) throw error
      return data as Camara | null
    },
    enabled: !!id,
  })

/** Liquidaciones visibles para quien consulta (la plataforma: todas; la entidad: las suyas) */
export const useSettlements = (period?: string) =>
  useQuery({
    queryKey: ['settlements', period ?? 'all'],
    queryFn: async (): Promise<Settlement[]> => {
      let q = supabase.from('camara_settlements').select('*, camara:camaras(name)').order('period', { ascending: false })
      if (period) q = q.eq('period', period)
      const { data, error } = await q.limit(36)
      if (error) return []
      return (data ?? []) as Settlement[]
    },
  })

/** Socios con cuenta hoy y estimado del mes (entidad con cobro por socio, o la plataforma) */
export const useBillingPreview = (camaraId: string | null | undefined, enabled = true) =>
  useQuery({
    queryKey: ['billing-preview', camaraId],
    queryFn: async (): Promise<BillingPreview | null> => {
      const { data, error } = await supabase.rpc('camara_billing_preview', { p_camara: camaraId })
      if (error) return null
      return (data ?? null) as BillingPreview | null
    },
    enabled: !!camaraId && enabled,
  })

/** Facturas visibles para quien consulta (la plataforma: todas; la entidad: las suyas) */
export const useInvoices = (period?: string) =>
  useQuery({
    queryKey: ['invoices', period ?? 'all'],
    queryFn: async (): Promise<Invoice[]> => {
      let q = supabase.from('camara_invoices').select('*, camara:camaras(name)').order('period', { ascending: false })
      if (period) q = q.eq('period', period)
      const { data, error } = await q.limit(36)
      if (error) return []
      return (data ?? []) as Invoice[]
    },
  })

/** Cargos de incorporación pagados en un mes (plataforma) */
export const usePlacements = (period: string) =>
  useQuery({
    queryKey: ['placements', period],
    queryFn: async () => {
      const start = new Date(period + 'T00:00:00'); const end = new Date(start); end.setMonth(end.getMonth() + 1)
      const { data, error } = await supabase.from('matches')
        .select('id, placement_fee_ars, placement_status, placement_via, placement_paid_at, studio:studios(name), instructor:instructors(full_name), camara:camaras(name)')
        .not('placement_paid_at', 'is', null).gte('placement_paid_at', start.toISOString()).lt('placement_paid_at', end.toISOString())
        .order('placement_paid_at', { ascending: false })
      if (error) return []
      return (data ?? []) as any[]
    },
  })

export async function rpc(fn: string, args: Record<string, unknown>) {
  const { error } = await supabase.rpc(fn, args)
  if (error) throw error
}
