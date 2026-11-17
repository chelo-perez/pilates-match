// Edge Function: emite en Facturo Más Fácil (FMF) las facturas de la cola platform_invoices.
// La corre la tarea programada cada 15 minutos (y el panel con "Emitir ahora"). No recibe datos:
// solo procesa la cola, así que se publica sin verificación de JWT.
// Secreto: FMF_API_TOKEN (token de servicio de FMF con scope comprobantes:emitir para el CUIT de la SAS).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const FMF = 'https://app.masfacil.com.ar/api/v1/integraciones'
const CUIT_SAS = '30719693454'
const LOTE = 20
const MAX_INTENTOS = 5

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  const token = Deno.env.get('FMF_API_TOKEN')
  if (!token) return json({ ok: false, error: 'not configured' }, 503)
  // ?check=1: prueba el token y el CUIT sin emitir (un pedido sin datos: 422 = token y CUIT bien; 401/403 = no)
  if (new URL(req.url).searchParams.get('check') === '1') {
    const res = await fetch(`${FMF}/clientes/${CUIT_SAS}/comprobantes/emitir`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-MF-Api-Key': token }, body: '{}',
    })
    return json({ ok: res.status === 422, fmf_status: res.status, detalle: res.status === 422 ? 'Token y CUIT habilitados' : await res.text() })
  }
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  const { data: encoladas } = await db.rpc('enqueue_due_invoices')
  const { data: sw } = await db.from('platform_settings').select('value').eq('key', 'fmf_invoicing_on').maybeSingle()
  if (Number(sw?.value ?? 0) !== 1) return json({ ok: true, encoladas, emitidas: 0, apagado: true })

  const { data: filas, error } = await db.rpc('claim_platform_invoices', { p_n: LOTE })
  if (error) return json({ ok: false, error: error.message }, 500)

  let emitidas = 0
  for (const f of filas ?? []) {
    const cuerpo: Record<string, unknown> = {
      clave: `${f.source}:${f.source_id}`,
      importe: Number(f.amount_ars).toFixed(2),
      concepto: f.concept,
      tipo_concepto: 2,
      cliente_nombre: f.customer_name,
    }
    if (f.customer_cuit) cuerpo.cliente_cuit = f.customer_cuit
    let status = 0
    let r: any = {}
    try {
      const res = await fetch(`${FMF}/clientes/${CUIT_SAS}/comprobantes/emitir`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-MF-Api-Key': token },
        body: JSON.stringify(cuerpo),
      })
      status = res.status
      r = await res.json().catch(() => ({}))
    } catch (e) {
      r = { error: `Sin conexión con FMF: ${(e as Error).message}` }
    }

    if ((status === 201 || status === 200) && r.ok) {
      let pdf_path: string | null = null
      if (r.pdf_b64) {
        const bytes = Uint8Array.from(atob(r.pdf_b64), c => c.charCodeAt(0))
        pdf_path = `${f.source}/${f.id}.pdf`
        const up = await db.storage.from('facturas').upload(pdf_path, bytes, { contentType: 'application/pdf', upsert: true })
        if (up.error) pdf_path = null
      }
      await db.from('platform_invoices').update({
        status: 'emitida', cae: r.cae ?? null, cbte_nro: r.cbte_nro ?? null, letra: r.letra ?? null,
        pdf_path, last_error: null, emitted_at: new Date().toISOString(),
      }).eq('id', f.id)
      emitidas++
      continue
    }

    // 409 = FMF todavía la está emitiendo; sin conexión o 5xx = reintento. Lo demás es un error a revisar.
    const transitorio = status === 409 || status === 0 || status >= 500
    const otraVez = transitorio && f.attempts < MAX_INTENTOS
    await db.from('platform_invoices').update({
      status: otraVez ? 'pendiente' : 'error',
      last_error: String(r.error ?? r.detail ?? `FMF respondió ${status}`).slice(0, 500),
    }).eq('id', f.id)
  }
  return json({ ok: true, encoladas, emitidas, procesadas: filas?.length ?? 0 })
})
