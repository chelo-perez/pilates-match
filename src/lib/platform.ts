// Dueño de la plataforma y Cámaras: Cámaras, precios por Cámara y liquidaciones mensuales.
import { useQuery } from '@tanstack/react-query'
import { supabase } from './supabase'
import { colors } from '../components/ui'

export interface Camara {
  id: string; name: string; slug: string; sector: string; business_label: string; instructor_label: string
  revenue_share_pct: number; cuit: string | null; contact_email: string | null; is_active: boolean; logo_url: string | null
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

/** Liquidaciones visibles para quien consulta (la plataforma: todas; la Cámara: las suyas) */
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

export async function rpc(fn: string, args: Record<string, unknown>) {
  const { error } = await supabase.rpc(fn, args)
  if (error) throw error
}
