// Cobros de la plataforma, mes por mes:
// - Por sede: facturas a las entidades con cobro por socio (emitir y marcar cobradas).
// - Incorporación: cargos de incorporación de clases regulares (cobrados, créditos y devoluciones).
// - Reemplazos: cobro garantizado (split de Mercado Pago): pagos, comisión de la plataforma y devoluciones.
// - Liquidaciones: lo que se le paga a las entidades con suscripciones.
// - Facturas: las que emite Facturo Más Fácil (FMF) a nombre de la SAS, solas o a mano (patrocinios, otros cobros).
import React, { useEffect, useState } from 'react'
import { View, Text, StyleSheet, Modal, Pressable, Platform, Alert, Linking } from 'react-native'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { errorText } from '../../lib/errors'
import { formatARS } from '../../lib/payments'
import { PAY_STATUS, PLACEMENT_STATUS, refundPlacement, refundReplacement } from '../../lib/matchFlow'
import { ADMIN_KEYS, one, shortDate, useAdminPending } from '../../lib/admin'
import { INVOICE_STATUS, Invoice, isoMonth, monthLabel, monthStart, rpc, SETTLEMENT_STATUS, Settlement, useInvoices, usePlacements, useSettlements } from '../../lib/platform'
import { ActionButton, AdminPage, Card, CellTitle, DataTable, Kpi, KpiGrid, MonthPicker, Pill, Segmented, Toolbar, Tone } from '../../components/admin/AdminUI'
import { Input, colors, spacing } from '../../components/ui'

type Tab = 'socios' | 'incorporacion' | 'reemplazos' | 'liquidaciones' | 'facturas'
const DEFAULT_OFFSET: Record<Tab, number> = { socios: -1, incorporacion: 0, reemplazos: 0, liquidaciones: -1, facturas: 0 }
const FACTURA_ORIGEN: Record<string, string> = { incorporacion: 'Incorporación', reemplazo: 'Reemplazo', plan: 'Plan', entidad: 'Abono de entidad', manual: 'Manual' }
const FACTURA_ESTADO: Record<string, { label: string; tone: Tone }> = {
  pendiente: { label: 'En cola', tone: 'neutral' }, emitiendo: { label: 'Emitiendo', tone: 'info' },
  emitida: { label: 'Emitida', tone: 'ok' }, error: { label: 'Con error', tone: 'red' }, anulada: { label: 'Anulada', tone: 'neutral' },
}
const tone = (bg: string): Tone => bg === colors.okBg ? 'ok' : bg === colors.warnBg ? 'warn' : 'brand'
// En la web Alert no se muestra
const notify = (title: string, msg: string) => Platform.OS === 'web' ? window.alert(`${title}\n\n${msg}`) : Alert.alert(title, msg)
const ask = (msg: string) => Platform.OS === 'web' ? Promise.resolve(window.confirm(msg))
  : new Promise<boolean>(res => Alert.alert('Confirmar', msg, [{ text: 'Cancelar', style: 'cancel', onPress: () => res(false) }, { text: 'Confirmar', onPress: () => res(true) }]))

export default function AdminBillingScreen({ route }: any) {
  const qc = useQueryClient()
  const [tab, setTab] = useState<Tab>(route?.params?.tab ?? 'socios')
  const initialTab: Tab = route?.params?.tab ?? 'socios'
  const [offset, setOffset] = useState<number>(DEFAULT_OFFSET[initialTab])
  useEffect(() => { if (route?.params?.tab) { setTab(route.params.tab); setOffset(DEFAULT_OFFSET[route.params.tab as Tab]) } }, [route?.params?.tab])
  const d = monthStart(); d.setMonth(d.getMonth() + offset)
  const period = isoMonth(d)
  const { data: settlements = [] } = useSettlements(period)
  const { data: invoices = [] } = useInvoices(period)
  const { data: placements = [] } = usePlacements(period)
  const { data: pending } = useAdminPending()
  // Reemplazos con cobro garantizado pagados en el mes, más los que haya que devolver (de cualquier mes)
  const { data: repPays = [] } = useQuery({
    queryKey: ['replacement-pays', period],
    queryFn: async () => {
      const start = new Date(period + 'T00:00:00'); const end = new Date(start); end.setMonth(end.getMonth() + 1)
      const { data } = await supabase.from('matches')
        .select('id, class_date, pay_status, pay_block_ars, pay_fee_ars, pay_total_ars, pay_paid_at, studio:studios(name), instructor:instructors(full_name), camara:camaras(name)')
        .or(`and(pay_paid_at.gte.${start.toISOString()},pay_paid_at.lt.${end.toISOString()}),pay_status.eq.a_devolver`)
        .order('pay_paid_at', { ascending: false })
      return (data ?? []) as any[]
    },
  })
  // Facturas de la plataforma emitidas con FMF (las del mes, más las que quedaron en cola o con error)
  const { data: fmfInvoices = [] } = useQuery({
    queryKey: ['platform-invoices', period],
    queryFn: async () => {
      const start = new Date(period + 'T00:00:00'); const end = new Date(start); end.setMonth(end.getMonth() + 1)
      const { data } = await supabase.from('platform_invoices')
        .select('id, source, customer_name, customer_cuit, concept, amount_ars, status, last_error, letra, cbte_nro, cae, pdf_path, created_at, emitted_at')
        .or(`and(created_at.gte.${start.toISOString()},created_at.lt.${end.toISOString()}),status.in.(pendiente,emitiendo,error)`)
        .order('created_at', { ascending: false })
      return (data ?? []) as any[]
    },
  })
  const { data: fmfOn = false } = useQuery({ queryKey: ['fmf-on'], queryFn: async () => (await supabase.rpc('fmf_invoicing_on')).data === true })
  const [manual, setManual] = useState<{ customer: string; cuit: string; concept: string; amount: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [action, setAction] = useState<{ kind: 'send' | 'paid' | 'settle'; id: string; title: string; amount: number } | null>(null)
  const [text, setText] = useState('')

  const refresh = () => { ADMIN_KEYS.forEach(k => qc.invalidateQueries({ queryKey: k })); qc.invalidateQueries({ queryKey: ['replacement-pays'] }); qc.invalidateQueries({ queryKey: ['platform-invoices'] }) }
  const run = async (fn: () => Promise<void>, fail: string) => {
    try { setBusy(true); await fn(); refresh() } catch (e) { notify(fail, errorText(e)) } finally { setBusy(false) }
  }
  const build = () => run(async () => {
    await rpc('platform_build_settlements', { p_period: period })
    await rpc('platform_build_invoices', { p_period: period })
  }, 'No pudimos calcular el mes')
  const refund = async (id: string, amount: number, studio: string) => {
    if (!(await ask(`¿Devolver ${formatARS(amount)} a ${studio}? Se devuelve en Mercado Pago al medio de pago original.`))) return
    run(() => refundPlacement(id), 'No pudimos devolver')
  }
  // Emite ya lo que esté en cola (si no, lo hace la tarea de cada 15 minutos)
  const emitNow = () => run(async () => {
    const { data, error } = await supabase.functions.invoke('fmf-facturar', { body: {} })
    if (error) throw error
    if (data?.apagado) notify('Emisión apagada', 'Las facturas quedan en cola hasta que se prenda la emisión con FMF.')
  }, 'No pudimos emitir')
  const emitEntityWithFmf = () => action && run(async () => {
    await rpc('enqueue_entity_invoice', { p_id: action.id })
    setAction(null)
    if (fmfOn) await supabase.functions.invoke('fmf-facturar', { body: {} })
  }, 'No pudimos emitir')
  const submitManual = () => manual && run(async () => {
    await rpc('enqueue_manual_invoice', { p_customer: manual.customer, p_cuit: manual.cuit, p_concept: manual.concept, p_amount: Number(manual.amount.replace(/\./g, '').replace(',', '.')) })
    setManual(null)
    if (fmfOn) await supabase.functions.invoke('fmf-facturar', { body: {} })
  }, 'No pudimos cargar la factura')
  const openPdf = async (path: string) => {
    const { data, error } = await supabase.storage.from('facturas').createSignedUrl(path, 300)
    if (error || !data?.signedUrl) return notify('No pudimos abrir el PDF', errorText(error))
    if (Platform.OS === 'web') window.open(data.signedUrl, '_blank'); else Linking.openURL(data.signedUrl)
  }
  const submitAction = () => action && run(async () => {
    if (action.kind === 'send') await rpc('mark_invoice_sent', { p_id: action.id, p_invoice: text })
    else if (action.kind === 'paid') await rpc('mark_invoice_paid', { p_id: action.id, p_reference: text })
    else await rpc('mark_settlement_paid', { p_id: action.id, p_reference: text })
    setAction(null)
  }, 'No pudimos guardar')

  // Totales del mes
  const invoiced = invoices.reduce((a, i) => a + Number(i.amount_ars), 0)
  const toCollect = invoices.filter(i => i.status !== 'pagada').reduce((a, i) => a + Number(i.amount_ars), 0)
  const placementsCharged = placements.filter(p => p.placement_status === 'cobrado' && p.placement_via !== 'credito').reduce((a, p) => a + Number(p.placement_fee_ars), 0)
  const placementsHeld = placements.filter(p => p.placement_status === 'pagado' && p.placement_via !== 'credito').reduce((a, p) => a + Number(p.placement_fee_ars), 0)
  const collected = settlements.reduce((a, s) => a + Number(s.collected_ars), 0)
  const shares = settlements.reduce((a, s) => a + Number(s.share_ars), 0)
  const owed = settlements.filter(s => s.status !== 'pagada').reduce((a, s) => a + Number(s.share_ars), 0)
  const refunds = pending?.refunds ?? []
  const repFees = repPays.filter(r => r.pay_status === 'pagado').reduce((a, r) => a + Number(r.pay_fee_ars ?? 0), 0)
  const repToRefund = repPays.filter(r => r.pay_status === 'a_devolver')
  const income = invoiced + placementsCharged + (collected - shares) + repFees

  const switchTab = (t: Tab) => { setTab(t); setOffset(DEFAULT_OFFSET[t]) }

  return (
    <AdminPage title="Cobros" subtitle="Lo que la plataforma cobra y lo que le paga a cada entidad">
      <KpiGrid>
        <Kpi label={`Ingreso de ${monthLabel(period).toLowerCase()}`} value={formatARS(income)} icon="trending-up" hint="Por sede + incorporación + reemplazos + parte de suscripciones" />
        <Kpi label="Facturas por cobrar" value={formatARS(toCollect)} icon="file-text" tone={toCollect ? 'warn' : 'neutral'} hint={`${invoices.filter(i => i.status !== 'pagada').length} facturas del mes`} onPress={() => switchTab('socios')} />
        <Kpi label="Cargos retenidos" value={formatARS(placementsHeld)} icon="lock" tone="info" hint="Pagados, a resolver después de la clase de prueba" onPress={() => switchTab('incorporacion')} />
        <Kpi label="Devoluciones pendientes" value={refunds.length} icon="rotate-ccw" tone={refunds.length ? 'red' : 'neutral'} hint={refunds.length ? formatARS(refunds.reduce((a, r) => a + Number(r.placement_fee_ars), 0)) : 'Ninguna'} onPress={() => switchTab('incorporacion')} />
        <Kpi label="A pagar a entidades" value={formatARS(owed)} icon="send" tone={owed ? 'warn' : 'neutral'} hint="Liquidaciones de suscripciones" onPress={() => switchTab('liquidaciones')} />
      </KpiGrid>

      <Toolbar>
        <Segmented value={tab} onChange={switchTab} items={[
          { key: 'socios', label: 'Por sede', count: invoices.length },
          { key: 'incorporacion', label: 'Incorporación', count: placements.length },
          { key: 'reemplazos', label: 'Reemplazos', count: repPays.length },
          { key: 'liquidaciones', label: 'Liquidaciones', count: settlements.length },
          { key: 'facturas', label: 'Facturas', count: fmfInvoices.length },
        ]} />
        <MonthPicker label={`${monthLabel(period)}${offset === 0 ? ' · en curso' : ''}`} onPrev={() => setOffset(o => o - 1)} onNext={() => setOffset(o => Math.min(0, o + 1))} nextDisabled={offset === 0} />
        {tab === 'facturas' ? <ActionButton label="Factura manual" icon="plus" variant="secondary" onPress={() => setManual({ customer: '', cuit: '', concept: '', amount: '' })} /> : null}
        {tab === 'facturas' ? <ActionButton label="Emitir ahora" icon="send" onPress={emitNow} loading={busy} /> : null}
        {tab === 'socios' || tab === 'liquidaciones' ? <ActionButton label={(tab === 'socios' ? invoices : settlements).length ? 'Recalcular el mes' : 'Calcular el mes'} icon="refresh-cw" variant="secondary" onPress={build} loading={busy} /> : null}
      </Toolbar>

      {tab === 'socios' ? (
        <Card title="Facturas a las entidades con cobro por sede" subtitle="Se generan solas el día 1 con las sedes socias con cuenta al cierre del mes. Recalcular no cambia las ya emitidas." pad={false}>
          <View style={s.inner}>
            <DataTable rows={invoices} keyOf={r => r.id} empty="No hay facturas para este mes."
              columns={[
                { key: 'n', label: 'Entidad', flex: 2, render: r => <CellTitle title={r.camara?.name ?? 'Entidad'} sub={r.invoice_number ? `Factura ${r.invoice_number}` : null} /> },
                { key: 'm', label: 'Sedes', width: 80, align: 'right', render: r => String(r.billable_members) },
                { key: 'd', label: 'Detalle', flex: 2, hideOnNarrow: true, render: r => (r.detail ?? []).filter(x => x.qty > 0).map(x => `${x.qty} × ${formatARS(Number(x.price))}`).join(' + ') || '—' },
                { key: 't', label: 'Total', width: 120, align: 'right', render: r => <Text style={s.amount}>{formatARS(Number(r.amount_ars))}</Text> },
                { key: 'e', label: 'Estado', width: 150, align: 'right', render: r => <Pill label={INVOICE_STATUS[r.status].label} tone={tone(INVOICE_STATUS[r.status].bg)} /> },
                { key: 'a', label: '', width: 150, align: 'right', render: r => r.status === 'pendiente' && Number(r.amount_ars) > 0
                  ? <ActionButton label="Emitir factura" onPress={() => { setText(''); setAction({ kind: 'send', id: r.id, title: `Factura a ${r.camara?.name}`, amount: Number(r.amount_ars) }) }} />
                  : r.status === 'enviada' ? <ActionButton label="Marcar cobrada" variant="secondary" onPress={() => { setText(''); setAction({ kind: 'paid', id: r.id, title: `Cobro de ${r.camara?.name}`, amount: Number(r.amount_ars) }) }} /> : null },
              ]} />
          </View>
        </Card>
      ) : null}

      {tab === 'incorporacion' ? (
        <>
          {refunds.length ? (
            <Card title="Devoluciones pendientes" subtitle="La profe no siguió o canceló: el cargo vuelve al estudio" pad={false}>
              <View style={s.inner}>
                <DataTable rows={refunds} keyOf={r => r.id}
                  columns={[
                    { key: 'n', label: 'Estudio', flex: 2, render: r => <CellTitle title={one<any>(r.studio)?.name ?? 'Estudio'} sub={`Pagado el ${shortDate(r.placement_paid_at)}`} /> },
                    { key: 't', label: 'Monto', width: 120, align: 'right', render: r => <Text style={s.amount}>{formatARS(Number(r.placement_fee_ars))}</Text> },
                    { key: 'a', label: '', width: 200, align: 'right', render: r => <ActionButton label="Devolver en Mercado Pago" variant="danger" loading={busy}
                      onPress={() => refund(r.id, Number(r.placement_fee_ars), one<any>(r.studio)?.name ?? 'el estudio')} /> },
                  ]} />
              </View>
            </Card>
          ) : null}
          <Card title="Cargos de incorporación del mes" subtitle={`Cobrados: ${formatARS(placementsCharged)} · Retenidos: ${formatARS(placementsHeld)}`} pad={false}>
            <View style={s.inner}>
              <DataTable rows={placements} keyOf={r => r.id} empty="No hubo cargos pagados en este mes."
                columns={[
                  { key: 'n', label: 'Estudio → Instructor', flex: 2.4, render: r => <CellTitle title={r.studio?.name ?? 'Estudio'} sub={`→ ${r.instructor?.full_name ?? 'Instructor'}`} /> },
                  { key: 'r', label: 'Red', flex: 1.4, render: r => r.camara?.name ?? '—' },
                  { key: 'f', label: 'Pagado', width: 110, render: r => shortDate(r.placement_paid_at) },
                  { key: 't', label: 'Monto', width: 120, align: 'right', render: r => <Text style={s.amount}>{formatARS(Number(r.placement_fee_ars))}</Text> },
                  { key: 'e', label: 'Estado', flex: 1.6, align: 'right', render: r => (
                    <Pill label={`${PLACEMENT_STATUS[r.placement_status] ?? r.placement_status}${r.placement_via === 'credito' ? ' (crédito)' : ''}`}
                      tone={r.placement_status === 'cobrado' ? 'ok' : r.placement_status === 'a_devolver' ? 'red' : r.placement_status === 'pagado' ? 'info' : 'neutral'} />
                  ) },
                ]} />
            </View>
          </Card>
        </>
      ) : null}

      {tab === 'reemplazos' ? (
        <Card title="Reemplazos con cobro garantizado" subtitle={`Comisión de la plataforma del mes: ${formatARS(repFees)}${repToRefund.length ? ` · ${repToRefund.length} para devolver` : ''}. La plata del bloque va directo al instructor.`} pad={false}>
          <View style={s.inner}>
            <DataTable rows={repPays} keyOf={r => r.id} empty="No hubo reemplazos pagados por la app en este mes."
              columns={[
                { key: 'n', label: 'Estudio → Instructor', flex: 2.4, render: r => <CellTitle title={one<any>(r.studio)?.name ?? 'Estudio'} sub={`→ ${one<any>(r.instructor)?.full_name ?? 'Instructor'} · clase ${shortDate(r.class_date)}`} /> },
                { key: 'r', label: 'Red', flex: 1.2, hideOnNarrow: true, render: r => one<any>(r.camara)?.name ?? '—' },
                { key: 't', label: 'Pagó el estudio', width: 130, align: 'right', render: r => <Text style={s.amount}>{formatARS(Number(r.pay_total_ars))}</Text> },
                { key: 'f', label: 'Comisión', width: 110, align: 'right', render: r => formatARS(Number(r.pay_fee_ars)) },
                { key: 'e', label: 'Estado', width: 150, align: 'right', render: r => <Pill label={PAY_STATUS[r.pay_status] ?? r.pay_status} tone={r.pay_status === 'pagado' ? 'ok' : r.pay_status === 'a_devolver' ? 'red' : 'neutral'} /> },
                { key: 'a', label: '', width: 190, align: 'right', render: r => r.pay_status === 'a_devolver'
                  ? <ActionButton label="Devolver" variant="danger" loading={busy} onPress={async () => {
                      if (await ask(`¿Devolver ${formatARS(Number(r.pay_total_ars))} a ${one<any>(r.studio)?.name ?? 'el estudio'}?`)) run(() => refundReplacement(r.id), 'No pudimos devolver')
                    }} />
                  : r.pay_status === 'pagado' ? <ActionButton label="Devolver (no se dio)" variant="secondary" onPress={async () => {
                      if (!(await ask('¿La clase no se dio? Se le devuelve el total al estudio desde la cuenta del instructor.'))) return
                      run(async () => { await rpc('guaranteed_mark_refund', { p_match: r.id }); await refundReplacement(r.id) }, 'No pudimos devolver')
                    }} /> : null },
              ]} />
          </View>
        </Card>
      ) : null}

      {tab === 'liquidaciones' ? (
        <Card title="Liquidaciones a las entidades con suscripciones" subtitle={`Cobrado a sus estudios: ${formatARS(collected)} · Parte de las entidades: ${formatARS(shares)}`} pad={false}>
          <View style={s.inner}>
            <DataTable rows={settlements} keyOf={r => r.id} empty="No hay liquidaciones para este mes."
              columns={[
                { key: 'n', label: 'Entidad', flex: 2, render: r => <CellTitle title={r.camara?.name ?? 'Entidad'} sub={r.invoice_number ? `Factura ${r.invoice_number}` : null} /> },
                { key: 'c', label: 'Cobrado', width: 120, align: 'right', render: r => formatARS(Number(r.collected_ars)) },
                { key: 'p', label: 'Su parte', width: 140, align: 'right', render: r => <Text style={s.amount}>{formatARS(Number(r.share_ars))} ({Number(r.share_pct).toLocaleString('es-AR')}%)</Text> },
                { key: 'e', label: 'Estado', width: 160, align: 'right', render: r => <Pill label={SETTLEMENT_STATUS[r.status].label} tone={tone(SETTLEMENT_STATUS[r.status].bg)} /> },
                { key: 'a', label: '', width: 150, align: 'right', render: r => r.status === 'facturada'
                  ? <ActionButton label="Marcar pagada" onPress={() => { setText(''); setAction({ kind: 'settle', id: r.id, title: `Pago a ${r.camara?.name}`, amount: Number(r.share_ars) }) }} /> : null },
              ]} />
          </View>
        </Card>
      ) : null}

      {tab === 'facturas' ? (
        <Card title="Facturas emitidas con Facturo Más Fácil"
          subtitle={fmfOn
            ? 'Se emiten solas a nombre de Tecnología Más Fácil S.A.S.: incorporaciones cobradas, comisión de reemplazos (24 h después de la clase) y planes. Los abonos de entidades, desde «Por sede».'
            : 'La emisión está apagada: las facturas quedan en cola y no se emite nada en ARCA hasta prenderla.'} pad={false}>
          <View style={s.inner}>
            <DataTable rows={fmfInvoices} keyOf={r => r.id} empty="No hay facturas en este mes."
              columns={[
                { key: 'n', label: 'Cliente', flex: 2, render: r => <CellTitle title={r.customer_name} sub={`${FACTURA_ORIGEN[r.source] ?? r.source} · ${r.concept}`} /> },
                { key: 'c', label: 'CUIT', width: 120, hideOnNarrow: true, render: r => r.customer_cuit ?? 'Cons. final' },
                { key: 't', label: 'Total', width: 120, align: 'right', render: r => <Text style={s.amount}>{formatARS(Number(r.amount_ars))}</Text> },
                { key: 'f', label: 'Factura', width: 130, align: 'right', hideOnNarrow: true, render: r => r.cbte_nro ? `${r.letra ?? ''} ${r.cbte_nro}` : '—' },
                { key: 'e', label: 'Estado', width: 130, align: 'right', render: r => <Pill label={FACTURA_ESTADO[r.status]?.label ?? r.status} tone={FACTURA_ESTADO[r.status]?.tone ?? 'neutral'} /> },
                { key: 'a', label: '', width: 150, align: 'right', render: r => r.status === 'emitida' && r.pdf_path
                  ? <ActionButton label="Ver PDF" variant="secondary" onPress={() => openPdf(r.pdf_path)} />
                  : r.status === 'error' ? <ActionButton label="Reintentar" variant="secondary" onPress={() => {
                      notify('Error de FMF', r.last_error ?? 'Sin detalle')
                      run(() => rpc('retry_platform_invoice', { p_id: r.id }), 'No pudimos reintentar')
                    }} /> : null },
              ]} />
          </View>
        </Card>
      ) : null}

      <Modal visible={!!manual} transparent animationType="fade" onRequestClose={() => setManual(null)}>
        <Pressable style={s.overlay} onPress={() => setManual(null)}>
          <Pressable style={s.sheet} onPress={() => {}}>
            <Text style={s.sheetTitle}>Factura manual</Text>
            <Text style={s.sheetSub}>Patrocinios y otros cobros. El importe es el total, con IVA incluido.</Text>
            {manual ? <>
              <Input label="CLIENTE" value={manual.customer} onChangeText={v => setManual({ ...manual, customer: v })} placeholder="Razón social" />
              <Input label="CUIT (VACÍO = CONSUMIDOR FINAL)" value={manual.cuit} onChangeText={v => setManual({ ...manual, cuit: v })} placeholder="30-12345678-9" keyboardType="numeric" />
              <Input label="CONCEPTO" value={manual.concept} onChangeText={v => setManual({ ...manual, concept: v })} placeholder="Ej: Patrocinio en Beneficios de tu red, marzo" />
              <Input label="TOTAL" value={manual.amount} onChangeText={v => setManual({ ...manual, amount: v })} placeholder="Ej: 150000" keyboardType="numeric" />
            </> : null}
            <View style={{ flexDirection: 'row', gap: spacing.sm, justifyContent: 'flex-end' }}>
              <ActionButton label="Cancelar" variant="secondary" onPress={() => setManual(null)} />
              <ActionButton label={fmfOn ? 'Emitir' : 'Dejar en cola'} onPress={submitManual} loading={busy}
                disabled={!manual || manual.customer.trim().length < 2 || manual.concept.trim().length < 3 || !(Number(manual.amount.replace(/\./g, '').replace(',', '.')) > 0)} />
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={!!action} transparent animationType="fade" onRequestClose={() => setAction(null)}>
        <Pressable style={s.overlay} onPress={() => setAction(null)}>
          <Pressable style={s.sheet} onPress={() => {}}>
            <Text style={s.sheetTitle}>{action?.title}</Text>
            <Text style={s.sheetSub}>{action ? formatARS(action.amount) : ''}</Text>
            <Input label={action?.kind === 'send' ? 'NÚMERO DE FACTURA' : 'REFERENCIA DEL PAGO (OPCIONAL)'} value={text} onChangeText={setText}
              placeholder={action?.kind === 'send' ? 'Ej: 0001-00001234' : 'Ej: transferencia 123456'} autoCapitalize="characters" />
            {action?.kind === 'send' ? <>
              <ActionButton label={fmfOn ? 'Emitir con Facturo Más Fácil' : 'Emitir con FMF (queda en cola)'} icon="file-text" onPress={emitEntityWithFmf} loading={busy} />
              <Text style={s.or}>o cargá el número de una factura ya hecha</Text>
            </> : null}
            <View style={{ flexDirection: 'row', gap: spacing.sm, justifyContent: 'flex-end' }}>
              <ActionButton label="Cancelar" variant="secondary" onPress={() => setAction(null)} />
              <ActionButton label={action?.kind === 'send' ? 'Avisar a la entidad' : 'Confirmar'} onPress={submitAction} loading={busy}
                disabled={action?.kind === 'send' && !text.trim()} />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </AdminPage>
  )
}

const s = StyleSheet.create({
  inner:      { padding: 12, paddingTop: 0 },
  amount:     { fontFamily: 'Nunito-Bold', fontSize: 13, color: colors.dark },
  overlay:    { flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', alignItems: 'center', padding: spacing.lg },
  sheet:      { width: '100%', maxWidth: 460, backgroundColor: colors.white, borderRadius: 16, padding: spacing.lg },
  sheetTitle: { fontFamily: 'Nunito-Bold', fontSize: 18, color: colors.dark },
  or:         { fontFamily: 'Nunito-Regular', fontSize: 12, color: colors.mid, textAlign: 'center', marginVertical: spacing.sm },
  sheetSub:   { fontFamily: 'Nunito-Bold', fontSize: 15, color: colors.sage, marginTop: 2, marginBottom: spacing.md },
})
