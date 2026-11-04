// Suscripciones con Mercado Pago: precios, estado y acciones del estudio.
// El cobro lo arma la Edge Function 'mercadopago'; el plan se activa cuando
// Mercado Pago avisa al webhook. La app solo abre el checkout y refresca.
import { useQuery } from '@tanstack/react-query'
import * as WebBrowser from 'expo-web-browser'
import { supabase } from './supabase'
import { UserError } from './errors'

export type PaidPlan = 'starter' | 'premium'
export interface PlanPrice { plan_type: PaidPlan; price_ars: number; active: boolean }

export const usePlanPrices = () =>
  useQuery({
    queryKey: ['plan-prices'],
    queryFn: async (): Promise<PlanPrice[]> => {
      const { data, error } = await supabase.from('plan_prices').select('plan_type, price_ars, active')
      if (error) return [] // tabla todavía no creada: sin pagos online
      return (data ?? []) as PlanPrice[]
    },
  })

/** Última suscripción vigente (autorizada o pausada) del estudio, o null */
export const useStudioSubscription = (studioId: string | undefined) =>
  useQuery({
    queryKey: ['studio-subscription', studioId],
    queryFn: async () => {
      const { data, error } = await supabase.from('subscriptions')
        .select('id, plan_type, status, amount_ars, next_payment_date, payer_email')
        .eq('studio_id', studioId!).in('status', ['authorized', 'paused'])
        .order('created_at', { ascending: false }).limit(1).maybeSingle()
      if (error) return null
      return data
    },
    enabled: !!studioId,
  })

export const formatARS = (n: number) => '$' + Math.round(n).toLocaleString('es-AR')

async function call(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('mercadopago', { body })
  if (error) {
    // El mensaje útil viene en el cuerpo de la respuesta
    const msg = await (error as any).context?.json?.().then((j: any) => j?.error).catch(() => null)
    throw new UserError(msg ?? 'No pudimos conectar con Mercado Pago. Probá de nuevo.')
  }
  return data
}

/** Abre el checkout de Mercado Pago. Resuelve cuando la persona vuelve a la app. */
export async function startSubscription(plan: PaidPlan, payerEmail: string) {
  const { init_point } = await call({ action: 'subscribe', plan, payer_email: payerEmail })
  if (!init_point) throw new UserError('Mercado Pago no devolvió el link de pago.')
  await WebBrowser.openBrowserAsync(init_point)
}

export const cancelSubscription = () => call({ action: 'cancel' })
