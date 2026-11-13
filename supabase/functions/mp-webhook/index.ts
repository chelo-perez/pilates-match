// Edge Function: avisos de Mercado Pago (Webhooks). Se publica sin verificación de JWT.
// Nunca confía en el contenido del aviso: consulta el estado real en la API de Mercado Pago.
// Secretos: MP_ACCESS_TOKEN y MP_WEBHOOK_SECRET (clave secreta del webhook en Mercado Pago).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const MP = 'https://api.mercadopago.com'
const LIMIT: Record<string, number | null> = { starter: 5, premium: null }
const GRACE_DAYS = 5 // días extra por si el cobro se demora

const text = (t: string, status = 200) => new Response(t, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })

async function validSignature(req: Request, dataId: string, secret: string) {
  const sig = req.headers.get('x-signature') ?? ''
  const requestId = req.headers.get('x-request-id') ?? ''
  const parts = Object.fromEntries(sig.split(',').map(p => p.trim().split('=') as [string, string]))
  if (!parts.ts || !parts.v1) return false
  const manifest = `id:${dataId};request-id:${requestId};ts:${parts.ts};`
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(manifest))
  const hex = [...new Uint8Array(mac)].map(b => b.toString(16).padStart(2, '0')).join('')
  return hex === parts.v1
}

const isoDate = (d: Date) => d.toISOString().slice(0, 10)

Deno.serve(async (req) => {
  const url = new URL(req.url)
  // Página a la que vuelve la persona después de pagar
  if (req.method === 'GET') return text('Listo. Ya podés volver a la app Trabajo Más Fácil.')
  if (req.method !== 'POST') return text('ok')

  const token = Deno.env.get('MP_ACCESS_TOKEN')
  if (!token) return text('not configured', 503)
  const body = await req.json().catch(() => ({} as any))
  const type = body.type ?? url.searchParams.get('type') ?? body.topic ?? url.searchParams.get('topic')
  const rawId = String(url.searchParams.get('data.id') ?? body?.data?.id ?? url.searchParams.get('id') ?? '')
  if (!rawId) return text('ok')

  const secret = Deno.env.get('MP_WEBHOOK_SECRET')
  if (secret && !(await validSignature(req, /^[a-z0-9]+$/i.test(rawId) ? rawId.toLowerCase() : rawId, secret))) {
    return text('bad signature', 401)
  }

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const mp = async (path: string) => {
    const r = await fetch(MP + path, { headers: { Authorization: `Bearer ${token}` } })
    return r.ok ? r.json() : null
  }

  // Actualiza la suscripción y, si está autorizada, activa el plan hasta el próximo cobro (+ gracia)
  async function syncPreapproval(id: string) {
    const pre = await mp(`/preapproval/${id}`)
    if (!pre) return
    const { data: sub } = await admin.from('subscriptions').select('*').eq('id', id).maybeSingle()
    if (!sub) return // solo suscripciones creadas por la app
    await admin.from('subscriptions').update({
      status: pre.status, next_payment_date: pre.next_payment_date ?? null, updated_at: new Date().toISOString(),
    }).eq('id', id)
    if (pre.status !== 'authorized') return

    const next = pre.next_payment_date ? new Date(pre.next_payment_date) : new Date(Date.now() + 30 * 864e5)
    const end = new Date(next.getTime() + GRACE_DAYS * 864e5)
    const { data: m } = await admin.from('memberships').select('plan_type').eq('studio_id', sub.studio_id).maybeSingle()
    const today = isoDate(new Date())
    const changed = m?.plan_type !== sub.plan_type
    await admin.from('memberships').upsert({
      studio_id: sub.studio_id, status: 'activa', plan_type: sub.plan_type,
      matches_limit: LIMIT[sub.plan_type] ?? null, price_ars: Math.round(Number(sub.amount_ars)), end_date: isoDate(end),
      ...(changed ? { start_date: today, matches_used_month: 0, last_reset_date: today } : {}),
    }, { onConflict: 'studio_id' })

    // Cambio de plan: se da de baja la suscripción anterior para no cobrar dos veces
    const { data: others } = await admin.from('subscriptions').select('id')
      .eq('studio_id', sub.studio_id).eq('status', 'authorized').neq('id', id)
    for (const o of others ?? []) {
      const r = await fetch(`${MP}/preapproval/${o.id}`, {
        method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cancelled' }),
      })
      if (r.ok) await admin.from('subscriptions').update({ status: 'cancelled', updated_at: new Date().toISOString() }).eq('id', o.id)
    }
  }

  try {
    if (type === 'payment') {
      // Pago único: cargo de incorporación de una clase regular
      const pay = await mp(`/v1/payments/${rawId}`)
      const ref = String(pay?.external_reference ?? '')
      if (pay?.status === 'approved' && ref.startsWith('placement:')) {
        const { error } = await admin.rpc('placement_paid', { p_match: ref.slice(10), p_payment_id: String(pay.id), p_amount: Number(pay.transaction_amount) })
        if (error) throw error
      }
    } else if (type === 'subscription_preapproval' || type === 'preapproval') {
      await syncPreapproval(rawId)
    } else if (type === 'subscription_authorized_payment') {
      const ap = await mp(`/authorized_payments/${rawId}`)
      if (ap?.preapproval_id) {
        const { data: sub } = await admin.from('subscriptions').select('studio_id, camara_id, plan_type').eq('id', ap.preapproval_id).maybeSingle()
        if (sub) {
          await admin.from('payments').upsert({
            id: `ap_${rawId}`, subscription_id: ap.preapproval_id, studio_id: sub.studio_id, camara_id: sub.camara_id, plan_type: sub.plan_type,
            amount_ars: ap.transaction_amount, status: ap.payment?.status ?? ap.status ?? 'unknown',
            paid_at: ap.debit_date ?? ap.date_created ?? null,
          })
          await syncPreapproval(ap.preapproval_id)
        }
      }
    }
  } catch (e) {
    console.error('mp-webhook', e)
    return text('error', 500) // Mercado Pago reintenta
  }
  return text('ok')
})
