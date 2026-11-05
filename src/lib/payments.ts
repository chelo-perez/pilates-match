// Suscripciones con Mercado Pago: precios, estado y acciones del estudio.
// El cobro lo arma la Edge Function 'mercadopago'; el plan se activa cuando
// Mercado Pago avisa al webhook. La app solo abre el checkout y refresca.
import { Platform } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import * as WebBrowser from 'expo-web-browser'
import { supabase } from './supabase'
import { UserError } from './errors'

export type PaidPlan = 'starter' | 'premium'
export interface PlanPrice { camara_id: string; plan_type: PaidPlan; price_ars: number; active: boolean }

/**
 * ¿Se puede pagar desde esta versión de la app?
 * Google Play no permite cobrar suscripciones de la app por fuera de su sistema de cobro, así que
 * la versión de la tienda no muestra precios ni el botón de Mercado Pago: el estudio paga desde
 * la versión web y el plan se activa solo en el celular. La versión de prueba (preview) sí lo muestra.
 */
export const IN_APP_PAYMENTS = Platform.OS === 'web' || process.env.EXPO_PUBLIC_IN_APP_PAYMENTS === '1'

/**
 * Precios de los planes pagos de una red (cada red tiene los suyos).
 * purpose 'purchase' (pantallas del estudio) devuelve vacío donde no se puede pagar;
 * 'info' (paneles de la entidad y de la plataforma) siempre los trae.
 */
export const usePlanPrices = (camaraId: string | null | undefined, purpose: 'purchase' | 'info' = 'purchase') =>
  useQuery({
    queryKey: ['plan-prices', camaraId, purpose],
    queryFn: async (): Promise<PlanPrice[]> => {
      if (purpose === 'purchase' && !IN_APP_PAYMENTS) return []
      const { data, error } = await supabase.from('plan_prices')
        .select('camara_id, plan_type, price_ars, active').eq('camara_id', camaraId!)
      if (error) return [] // tabla todavía no creada: sin pagos online
      return (data ?? []) as PlanPrice[]
    },
    enabled: !!camaraId,
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
