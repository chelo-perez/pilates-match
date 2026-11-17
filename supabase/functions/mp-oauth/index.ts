// Edge Function: vuelta de la conexión de Mercado Pago del instructor (OAuth). Se publica sin verificación de JWT:
// la valida el "state" de un solo uso que creó la función mercadopago (acción mp_connect).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import { MP, oauthConfigured, redirectUri, saveTokens } from '../_shared/mpAccounts.ts'

const APP = 'https://app.trabajo.masfacil.com.ar'
const page = (title: string, msg: string, ok: boolean, back: string) => new Response(`<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
<style>body{margin:0;font-family:system-ui,sans-serif;background:#163235;color:#fff;display:flex;min-height:100vh;align-items:center;justify-content:center;text-align:center;padding:24px}
.c{max-width:420px}h1{font-size:24px;margin:0 0 10px}p{color:#cfe7e3;line-height:1.5}a{display:inline-block;margin-top:18px;background:#fff;color:#163235;font-weight:700;padding:12px 22px;border-radius:12px;text-decoration:none}</style>
</head><body><div class="c"><h1>${ok ? '✓ ' : ''}${title}</h1><p>${msg}</p><a href="${back}">Volver a Trabajo Más Fácil</a></div>
${ok ? `<script>setTimeout(function(){location.href=${JSON.stringify(back)}},1500)</script>` : ''}</body></html>`,
  { status: ok ? 200 : 400, headers: { 'Content-Type': 'text/html; charset=utf-8' } })

Deno.serve(async (req) => {
  const url = new URL(req.url)
  const code = url.searchParams.get('code'), state = url.searchParams.get('state')
  const fallback = `${APP}/?mp=1`
  if (!oauthConfigured()) return page('Todavía no está disponible', 'La conexión con Mercado Pago no está configurada.', false, fallback)
  if (!state) return page('No se pudo conectar', 'Falta información de la conexión. Volvé a intentarlo desde tu perfil.', false, fallback)

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { data: st } = await admin.from('mp_oauth_states').select('*').eq('state', state).maybeSingle()
  if (st) await admin.from('mp_oauth_states').delete().eq('state', state) // un solo uso
  const back = st?.return_to || fallback
  if (!st || Date.now() - new Date(st.created_at).getTime() > 30 * 60_000) {
    return page('La conexión venció', 'Volvé a tocar "Conectar Mercado Pago" en tu perfil.', false, back)
  }
  if (!code) return page('No se conectó', 'Cancelaste la conexión con Mercado Pago. Podés volver a intentarlo cuando quieras.', false, back)

  const r = await fetch(`${MP}/oauth/token`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: Deno.env.get('MP_CLIENT_ID'), client_secret: Deno.env.get('MP_CLIENT_SECRET'),
      grant_type: 'authorization_code', code, redirect_uri: redirectUri(), code_verifier: st.code_verifier }),
  })
  if (!r.ok) { console.error('oauth/token', r.status, (await r.text()).slice(0, 200)); return page('No se pudo conectar', 'Mercado Pago no confirmó la conexión. Probá de nuevo.', false, back) }
  const data = await r.json()
  await saveTokens(admin, st.instructor_id, data)
  // Email de la cuenta, para mostrarle al instructor cuál conectó
  try {
    const me = await fetch(`${MP}/users/me`, { headers: { Authorization: `Bearer ${data.access_token}` } })
    if (me.ok) { const u = await me.json(); await admin.from('instructor_mp_accounts').update({ mp_email: u.email ?? null }).eq('instructor_id', st.instructor_id) }
  } catch { /* no es crítico */ }
  return page('Mercado Pago conectado', 'Listo: los estudios te van a pagar los reemplazos por la app y la plata llega directo a tu cuenta.', true, back)
})
