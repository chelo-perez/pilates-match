// Cuentas de Mercado Pago de los instructores (cobro garantizado de reemplazos).
// Los tokens se guardan cifrados con AES-GCM; la clave sale del secreto MP_TOKEN_KEY (cualquier frase larga).
// Secretos: MP_CLIENT_ID, MP_CLIENT_SECRET (aplicación de Mercado Pago de la plataforma), MP_TOKEN_KEY.
export const MP = 'https://api.mercadopago.com'

async function key() {
  const raw = Deno.env.get('MP_TOKEN_KEY')
  if (!raw || raw.length < 16) throw new Error('Falta el secreto MP_TOKEN_KEY')
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw))
  return crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['encrypt', 'decrypt'])
}
const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u))
const unb64 = (s: string) => Uint8Array.from(atob(s), c => c.charCodeAt(0))

export async function encrypt(text: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await key(), new TextEncoder().encode(text)))
  return `${b64(iv)}.${b64(ct)}`
}
export async function decrypt(enc: string) {
  const [iv, ct] = enc.split('.')
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(iv) }, await key(), unb64(ct))
  return new TextDecoder().decode(pt)
}

export const oauthConfigured = () => !!(Deno.env.get('MP_CLIENT_ID') && Deno.env.get('MP_CLIENT_SECRET') && Deno.env.get('MP_TOKEN_KEY'))
export const redirectUri = () => `${Deno.env.get('SUPABASE_URL')}/functions/v1/mp-oauth`

/** Guarda (o renueva) la conexión con lo que devuelve POST /oauth/token */
export async function saveTokens(admin: any, instructorId: string, data: any) {
  const row: any = {
    instructor_id: instructorId, access_token_enc: await encrypt(data.access_token),
    expires_at: data.expires_in ? new Date(Date.now() + Number(data.expires_in) * 1000).toISOString() : null,
    status: 'active', updated_at: new Date().toISOString(),
  }
  if (data.refresh_token) row.refresh_token_enc = await encrypt(data.refresh_token)
  if (data.user_id != null) row.mp_user_id = Number(data.user_id)
  const { error } = await admin.from('instructor_mp_accounts').upsert(row, { onConflict: 'instructor_id' })
  if (error) throw error
}

/** Token vigente del instructor (lo renueva si vence en menos de un día). null si no está conectado. */
export async function instructorToken(admin: any, instructorId: string): Promise<string | null> {
  const { data: acc } = await admin.from('instructor_mp_accounts').select('*').eq('instructor_id', instructorId).maybeSingle()
  if (!acc || acc.status !== 'active') return null
  const soon = acc.expires_at && new Date(acc.expires_at).getTime() < Date.now() + 864e5
  if (soon && acc.refresh_token_enc) {
    const r = await fetch(`${MP}/oauth/token`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: Deno.env.get('MP_CLIENT_ID'), client_secret: Deno.env.get('MP_CLIENT_SECRET'),
        grant_type: 'refresh_token', refresh_token: await decrypt(acc.refresh_token_enc) }),
    })
    if (r.ok) { const data = await r.json(); await saveTokens(admin, instructorId, data); return data.access_token }
    if (r.status === 400 || r.status === 401) await admin.from('instructor_mp_accounts').update({ status: 'revoked' }).eq('instructor_id', instructorId)
    return null
  }
  return decrypt(acc.access_token_enc)
}

// PKCE (S256), como la conexión de Mercado Pago de Facturo Más Fácil
export function randomToken(bytes = 32) {
  return b64(crypto.getRandomValues(new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
export async function challenge(verifier: string) {
  const d = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)))
  return b64(d).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
