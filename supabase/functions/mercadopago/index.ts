// Edge Function: el estudio se suscribe o cancela su plan con Mercado Pago.
//   POST { action: 'subscribe', plan: 'starter'|'premium', payer_email }  -> { init_point }
//   POST { action: 'cancel' }                                            -> { ok }
// El precio depende de la Cámara del estudio. Cobra la cuenta de Mercado Pago de la plataforma.
// Secretos: MP_ACCESS_TOKEN.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const MP = 'https://api.mercadopago.com'
const LABEL: Record<string, string> = { starter: 'Starter', premium: 'Premium' }
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const token = Deno.env.get('MP_ACCESS_TOKEN')
    if (!token) return json({ error: 'Los pagos todavía no están configurados.' }, 503)

    const url = Deno.env.get('SUPABASE_URL')!
    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const jwt = (req.headers.get('Authorization') ?? '').replace('Bearer ', '')
    const { data: { user } } = await admin.auth.getUser(jwt)
    if (!user) return json({ error: 'Sesión vencida. Volvé a entrar.' }, 401)

    const { data: studio } = await admin.from('studios').select('id, name, camara_id').eq('user_id', user.id).maybeSingle()
    if (!studio) return json({ error: 'Solo los estudios pueden suscribirse.' }, 403)

    const body = await req.json().catch(() => ({}))
    const mp = (path: string, init: RequestInit = {}) => fetch(MP + path, {
      ...init, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
    })

    if (body.action === 'cancel') {
      const { data: subs } = await admin.from('subscriptions').select('id')
        .eq('studio_id', studio.id).in('status', ['authorized', 'paused'])
      for (const s of subs ?? []) {
        const r = await mp(`/preapproval/${s.id}`, { method: 'PUT', body: JSON.stringify({ status: 'cancelled' }) })
        if (!r.ok) return json({ error: 'Mercado Pago no pudo cancelar la suscripción. Probá de nuevo.' }, 502)
        await admin.from('subscriptions').update({ status: 'cancelled', updated_at: new Date().toISOString() }).eq('id', s.id)
      }
      return json({ ok: true })
    }

    if (body.action !== 'subscribe') return json({ error: 'Acción desconocida' }, 400)
    const plan = String(body.plan ?? '')
    const email = String(body.payer_email ?? '').trim().toLowerCase()
    if (!LABEL[plan]) return json({ error: 'Ese plan no se puede contratar online.' }, 400)
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'Revisá el email de Mercado Pago.' }, 400)

    const { data: price } = await admin.from('plan_prices').select('price_ars, active')
      .eq('camara_id', studio.camara_id).eq('plan_type', plan).maybeSingle()
    if (!price?.active) return json({ error: 'Este plan todavía no está disponible.' }, 409)

    const r = await mp('/preapproval', {
      method: 'POST',
      body: JSON.stringify({
        reason: `Trabajo Más Fácil · Plan ${LABEL[plan]}`,
        external_reference: studio.id,
        payer_email: email,
        back_url: `${url}/functions/v1/mp-webhook?volver=1`,
        status: 'pending',
        auto_recurring: { frequency: 1, frequency_type: 'months', transaction_amount: price.price_ars, currency_id: 'ARS' },
      }),
    })
    const pre = await r.json()
    if (!r.ok || !pre.init_point) {
      console.error('preapproval', r.status, JSON.stringify(pre))
      return json({ error: 'Mercado Pago no pudo iniciar la suscripción. Revisá el email y probá de nuevo.' }, 502)
    }

    await admin.from('subscriptions').upsert({
      id: pre.id, studio_id: studio.id, camara_id: studio.camara_id, plan_type: plan, status: pre.status ?? 'pending',
      amount_ars: price.price_ars, payer_email: email, init_point: pre.init_point,
    })
    return json({ init_point: pre.init_point })
  } catch (e) {
    console.error(e)
    return json({ error: 'Algo salió mal. Probá de nuevo.' }, 500)
  }
})
