// Edge Function: cobros con Mercado Pago (cuenta de la plataforma).
//   POST { action: 'subscribe', plan: 'starter'|'premium', payer_email }  -> { init_point }   (estudio)
//   POST { action: 'cancel' }                                            -> { ok }           (estudio)
//   POST { action: 'placement_pay', match_id }                           -> { init_point }   (estudio: cargo de incorporación)
//   POST { action: 'placement_refund', match_id }                        -> { ok }           (plataforma: devolver el cargo)
//   POST { action: 'mp_connect', return_to? }                           -> { url }          (instructor: conectar su Mercado Pago)
//   POST { action: 'mp_disconnect' }                                     -> { ok }           (instructor)
//   POST { action: 'replacement_pay', match_id }                         -> { init_point }   (estudio: cobro garantizado, split)
//   POST { action: 'replacement_refund', match_id }                      -> { ok }           (devolver un reemplazo pagado)
// El precio depende de la Cámara del estudio. Los planes y el cargo los cobra la cuenta de la plataforma;
// los reemplazos los cobra la cuenta del instructor y Mercado Pago le transfiere a la plataforma su comisión.
// Secretos: MP_ACCESS_TOKEN; para reemplazos además MP_CLIENT_ID, MP_CLIENT_SECRET y MP_TOKEN_KEY.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import { challenge, instructorToken, oauthConfigured, randomToken, redirectUri } from '../_shared/mpAccounts.ts'

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

    const body = await req.json().catch(() => ({}))
    const mp = (path: string, init: RequestInit = {}) => fetch(MP + path, {
      ...init, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
    })

    // ── Instructor: conectar o desconectar su Mercado Pago (cobro garantizado de reemplazos) ──
    if (body.action === 'mp_connect' || body.action === 'mp_disconnect') {
      const { data: ins } = await admin.from('instructors').select('id').eq('user_id', user.id).maybeSingle()
      if (!ins) return json({ error: 'Solo los instructores conectan su Mercado Pago.' }, 403)
      if (body.action === 'mp_disconnect') {
        await admin.from('instructor_mp_accounts').delete().eq('instructor_id', ins.id)
        return json({ ok: true })
      }
      if (!oauthConfigured()) return json({ error: 'La conexión con Mercado Pago todavía no está disponible.' }, 503)
      const state = randomToken(24), verifier = randomToken(48)
      const returnTo = typeof body.return_to === 'string' && /^(https:\/\/app\.trabajo\.masfacil\.com\.ar|trabajomasfacil:\/\/|exp:\/\/)/.test(body.return_to) ? body.return_to : null
      await admin.from('mp_oauth_states').delete().lt('created_at', new Date(Date.now() - 864e5).toISOString())
      const { error } = await admin.from('mp_oauth_states').insert({ state, instructor_id: ins.id, code_verifier: verifier, return_to: returnTo })
      if (error) throw error
      const q = new URLSearchParams({ client_id: Deno.env.get('MP_CLIENT_ID')!, response_type: 'code', platform_id: 'mp', state,
        redirect_uri: redirectUri(), code_challenge: await challenge(verifier), code_challenge_method: 'S256' })
      return json({ url: `https://auth.mercadopago.com/authorization?${q}` })
    }

    // ── Devolver un reemplazo pagado (las partes, cuando corresponde, o la plataforma) ──
    if (body.action === 'replacement_refund') {
      const { data: m } = await admin.from('matches')
        .select('id, instructor_id, pay_status, pay_payment_id, studio:studios(user_id), instructor:instructors(user_id)')
        .eq('id', body.match_id).maybeSingle()
      if (!m) return json({ error: 'No encontramos este reemplazo.' }, 404)
      const { data: me } = await admin.from('users').select('role').eq('id', user.id).maybeSingle()
      const party = (m as any).studio?.user_id === user.id || (m as any).instructor?.user_id === user.id
      if (!party && me?.role !== 'super_admin') return json({ error: 'No podés devolver este pago.' }, 403)
      if (m.pay_status !== 'a_devolver' || !m.pay_payment_id) return json({ error: 'Este pago no está para devolver.' }, 409)
      const itok = await instructorToken(admin, m.instructor_id)
      if (!itok) return json({ error: 'No pudimos acceder a la cuenta de Mercado Pago del instructor. La plataforma lo va a resolver.' }, 409)
      const r = await fetch(`${MP}/v1/payments/${m.pay_payment_id}/refunds`, {
        method: 'POST', body: '{}', headers: { Authorization: `Bearer ${itok}`, 'Content-Type': 'application/json', 'X-Idempotency-Key': `replacement-refund-${m.id}` },
      })
      if (!r.ok) { console.error('replacement refund', r.status, (await r.text()).slice(0, 300)); return json({ error: 'Mercado Pago no pudo hacer la devolución. Probá de nuevo.' }, 502) }
      await admin.rpc('guaranteed_refunded', { p_match: m.id })
      return json({ ok: true })
    }

    // ── Plataforma: devolver un cargo de incorporación ──
    if (body.action === 'placement_refund') {
      const { data: me } = await admin.from('users').select('role').eq('id', user.id).maybeSingle()
      if (me?.role !== 'super_admin') return json({ error: 'Solo la plataforma puede devolver pagos.' }, 403)
      const { data: m } = await admin.from('matches').select('id, placement_status, placement_payment_id').eq('id', body.match_id).maybeSingle()
      if (!m || m.placement_status !== 'a_devolver' || !m.placement_payment_id) return json({ error: 'Este cargo no está para devolver.' }, 409)
      const r = await mp(`/v1/payments/${m.placement_payment_id}/refunds`, {
        method: 'POST', body: '{}', headers: { 'X-Idempotency-Key': `refund-${m.id}` },
      })
      if (!r.ok) { console.error('refund', r.status, await r.text()); return json({ error: 'Mercado Pago no pudo hacer la devolución. Probá de nuevo.' }, 502) }
      await admin.rpc('placement_refunded', { p_match: m.id })
      return json({ ok: true })
    }

    const { data: studio } = await admin.from('studios').select('id, name, camara_id').eq('user_id', user.id).maybeSingle()
    if (!studio) return json({ error: 'Solo los estudios pueden pagar.' }, 403)

    // ── Estudio: pagar el cargo de incorporación para confirmar la entrevista ──
    if (body.action === 'placement_pay') {
      const { data: m } = await admin.from('matches')
        .select('id, studio_id, placement_status, placement_fee_ars, placement_deadline, instructor:instructors(full_name)')
        .eq('id', body.match_id).maybeSingle()
      if (!m || m.studio_id !== studio.id) return json({ error: 'No encontramos esta entrevista.' }, 404)
      if (m.placement_status !== 'pendiente_pago') return json({ error: 'Esta entrevista no tiene un pago pendiente.' }, 409)
      const name = (m as any).instructor?.full_name ?? 'instructor'
      const r = await mp('/checkout/preferences', {
        method: 'POST',
        body: JSON.stringify({
          items: [{ id: m.id, title: `Cargo de incorporación · ${name}`, quantity: 1, unit_price: m.placement_fee_ars, currency_id: 'ARS' }],
          external_reference: `placement:${m.id}`,
          notification_url: `${url}/functions/v1/mp-webhook`,
          back_urls: { success: `${url}/functions/v1/mp-webhook?volver=1`, pending: `${url}/functions/v1/mp-webhook?volver=1`, failure: `${url}/functions/v1/mp-webhook?volver=1` },
          auto_return: 'approved',
          statement_descriptor: 'TRABAJOMASFACIL',
          ...(m.placement_deadline ? { expires: true, date_of_expiration: m.placement_deadline } : {}),
        }),
      })
      const pref = await r.json()
      if (!r.ok || !pref.init_point) { console.error('preference', r.status, JSON.stringify(pref)); return json({ error: 'Mercado Pago no pudo iniciar el pago. Probá de nuevo.' }, 502) }
      return json({ init_point: pref.init_point })
    }

    // ── Estudio: pagar un reemplazo con cobro garantizado (split: cobra el instructor, la plataforma recibe su comisión) ──
    if (body.action === 'replacement_pay') {
      const { data: m } = await admin.from('matches')
        .select('id, studio_id, instructor_id, class_date, start_time, pay_status, pay_total_ars, pay_fee_ars, pay_deadline, instructor:instructors(full_name)')
        .eq('id', body.match_id).maybeSingle()
      if (!m || m.studio_id !== studio.id) return json({ error: 'No encontramos este reemplazo.' }, 404)
      if (m.pay_status !== 'pendiente_pago') return json({ error: 'Este reemplazo no tiene un pago pendiente.' }, 409)
      const itok = await instructorToken(admin, m.instructor_id)
      if (!itok) return json({ error: 'El instructor tiene que volver a conectar su Mercado Pago. Ya le avisamos.' }, 409)
      const name = (m as any).instructor?.full_name ?? 'instructor'
      const r = await fetch(MP + '/checkout/preferences', {
        method: 'POST', headers: { Authorization: `Bearer ${itok}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [{ id: m.id, title: `Reemplazo ${String(m.class_date).split('-').reverse().slice(0, 2).join('/')} · ${name}`, quantity: 1, unit_price: m.pay_total_ars, currency_id: 'ARS' }],
          marketplace_fee: m.pay_fee_ars,
          external_reference: `replacement:${m.id}`,
          notification_url: `${url}/functions/v1/mp-webhook?m=${m.id}`,
          back_urls: { success: `${url}/functions/v1/mp-webhook?volver=1`, pending: `${url}/functions/v1/mp-webhook?volver=1`, failure: `${url}/functions/v1/mp-webhook?volver=1` },
          auto_return: 'approved',
          statement_descriptor: 'TRABAJOMASFACIL',
          ...(m.pay_deadline ? { expires: true, date_of_expiration: m.pay_deadline } : {}),
        }),
      })
      const pref = await r.json()
      if (!r.ok || !pref.init_point) { console.error('replacement preference', r.status, JSON.stringify(pref).slice(0, 300)); return json({ error: 'Mercado Pago no pudo iniciar el pago. Probá de nuevo.' }, 502) }
      return json({ init_point: pref.init_point })
    }

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
