// Reportes de la Cámara: lo que pagaron sus estudios, su parte y las liquidaciones.
// La plataforma cobra los abonos y cada mes le paga a la Cámara su porcentaje:
// la Cámara carga acá el número de su factura y después ve el pago.
import React, { useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Modal, Alert } from 'react-native'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { errorText } from '../../lib/errors'
import { formatARS, usePlanPrices } from '../../lib/payments'
import { monthLabel, rpc, SETTLEMENT_STATUS, Settlement, useCamara, useSettlements } from '../../lib/platform'
import { useAuthStore } from '../../store'
import { Button, Input, colors, spacing, radius, typography } from '../../components/ui'

const PLAN_LABEL: Record<string, string> = { starter: 'Starter', premium: 'Premium' }
const OK = new Set(['approved', 'processed'])

export default function PaymentsSection() {
  const qc = useQueryClient()
  const camaraId = useAuthStore(s => s.user?.camara_id) as string | undefined
  const { data: camara } = useCamara(camaraId)
  const { data: prices = [] } = usePlanPrices(camaraId, 'info')
  const { data: settlements = [] } = useSettlements()
  const [invoiceFor, setInvoiceFor] = useState<Settlement | null>(null)
  const [invoice, setInvoice] = useState('')
  const [saving, setSaving] = useState(false)

  // Cobros del mes en curso (la liquidación del mes se arma cuando termina)
  const { data: collected = 0 } = useQuery({
    queryKey: ['camara-collected-month'],
    queryFn: async () => {
      const start = new Date(); start.setDate(1); start.setHours(0, 0, 0, 0)
      const { data, error } = await supabase.from('payments').select('amount_ars, status').gte('paid_at', start.toISOString())
      if (error) return 0
      return (data ?? []).filter((p: any) => OK.has(p.status)).reduce((s: number, p: any) => s + Number(p.amount_ars ?? 0), 0)
    },
  })
  const pct = Number(camara?.revenue_share_pct ?? 0)
  const thisMonth = new Date(); thisMonth.setDate(1)
  const closed = (s: Settlement) => new Date(s.period + 'T00:00:00') < new Date(thisMonth.getFullYear(), thisMonth.getMonth(), 1)

  const sendInvoice = async () => {
    if (!invoiceFor) return
    try {
      setSaving(true)
      await rpc('submit_settlement_invoice', { p_id: invoiceFor.id, p_invoice: invoice })
      qc.invalidateQueries({ queryKey: ['settlements'] })
      setInvoiceFor(null)
    } catch (e) { Alert.alert('No pudimos cargar la factura', errorText(e)) }
    finally { setSaving(false) }
  }

  return (
    <View>
      <View style={s.kpis}>
        <View style={s.kpi}>
          <Text style={s.kpiNum}>{collected ? formatARS(collected) : '—'}</Text>
          <Text style={s.kpiLbl}>Abonos cobrados{'\n'}este mes</Text>
        </View>
        <View style={s.kpi}>
          <Text style={s.kpiNum}>{collected && pct ? formatARS(collected * pct / 100) : '—'}</Text>
          <Text style={s.kpiLbl}>Tu parte{pct ? ` (${pct.toLocaleString('es-AR')}%)` : ''}{'\n'}hasta hoy</Text>
        </View>
      </View>

      <View style={s.card}>
        <Text style={s.caption}>LIQUIDACIONES</Text>
        <Text style={s.hint}>
          Al cerrar cada mes calculamos tu parte. Emitís la factura por ese monto, cargás el número acá y te transferimos.
        </Text>
        {settlements.length === 0 ? (
          <Text style={s.empty}>Todavía no hay meses cerrados.</Text>
        ) : settlements.map(st => {
          const badge = SETTLEMENT_STATUS[st.status]
          return (
            <View key={st.id} style={s.row}>
              <View style={{ flex: 1 }}>
                <Text style={s.name}>{monthLabel(st.period)}</Text>
                <Text style={s.desc}>
                  Cobrado {formatARS(Number(st.collected_ars))} · {Number(st.share_pct).toLocaleString('es-AR')}%
                  {st.invoice_number ? ` · Factura ${st.invoice_number}` : ''}
                </Text>
                <View style={[s.badge, { backgroundColor: badge.bg }]}><Text style={[s.badgeTxt, { color: badge.tx }]}>{badge.label}</Text></View>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 6 }}>
                <Text style={s.amount}>{formatARS(Number(st.share_ars))}</Text>
                {st.status === 'pendiente' && closed(st) && Number(st.share_ars) > 0 ? (
                  <TouchableOpacity onPress={() => { setInvoice(''); setInvoiceFor(st) }}>
                    <Text style={s.link}>Cargar factura</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          )
        })}
      </View>

      {prices.some(p => p.active) && (
        <View style={s.card}>
          <Text style={s.caption}>PRECIOS PARA TUS ESTUDIOS</Text>
          {prices.filter(p => p.active).map(p => (
            <View key={p.plan_type} style={s.row}>
              <Text style={[s.name, { flex: 1 }]}>{PLAN_LABEL[p.plan_type] ?? p.plan_type}</Text>
              <Text style={s.amount}>{formatARS(p.price_ars)}<Text style={s.desc}> /mes</Text></Text>
            </View>
          ))}
        </View>
      )}

      <Modal visible={!!invoiceFor} transparent animationType="fade" onRequestClose={() => setInvoiceFor(null)}>
        <View style={s.overlay}>
          <View style={s.sheet}>
            <Text style={s.sheetTitle}>Factura de {invoiceFor ? monthLabel(invoiceFor.period) : ''}</Text>
            <Text style={s.sheetSub}>
              Emitila por {invoiceFor ? formatARS(Number(invoiceFor.share_ars)) : ''} a nombre de la plataforma y cargá el número.
            </Text>
            <Input label="NÚMERO DE FACTURA" value={invoice} onChangeText={setInvoice} placeholder="Ej: 0001-00001234" autoCapitalize="characters" />
            <Button label="Enviar" onPress={sendInvoice} isLoading={saving} fullWidth size="lg" />
            <TouchableOpacity onPress={() => setInvoiceFor(null)} style={{ alignItems: 'center', paddingVertical: spacing.md }}>
              <Text style={s.link}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const s = StyleSheet.create({
  kpis:       { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  kpi:        { flex: 1, backgroundColor: colors.white, ...radius.leaf, padding: spacing.md, borderWidth: 0.5, borderColor: colors.borderLight },
  kpiNum:     { fontFamily: 'Nunito-Bold', fontSize: 22, color: colors.gold },
  kpiLbl:     { fontFamily: 'Nunito-SemiBold', fontSize: 11, lineHeight: 14, color: colors.mid, marginTop: 4 },
  card:       { backgroundColor: colors.white, ...radius.leaf, padding: spacing.md, borderWidth: 0.5, borderColor: colors.borderLight, marginBottom: spacing.sm },
  caption:    { ...typography.caption },
  hint:       { fontFamily: 'Nunito-Regular', fontSize: 12, color: colors.mid, lineHeight: 17, marginTop: 4, marginBottom: spacing.sm },
  empty:      { fontFamily: 'Nunito-Regular', fontSize: 13, color: colors.light, paddingVertical: spacing.sm },
  row:        { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm, borderTopWidth: 0.5, borderTopColor: colors.borderLight },
  name:       { fontFamily: 'Nunito-Bold', fontSize: 14, color: colors.dark, marginBottom: 2 },
  desc:       { fontFamily: 'Nunito-Regular', fontSize: 12, color: colors.mid },
  amount:     { fontFamily: 'Nunito-Bold', fontSize: 15, color: colors.sage },
  badge:      { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, marginTop: 6 },
  badgeTxt:   { fontFamily: 'Nunito-Bold', fontSize: 10 },
  link:       { fontFamily: 'Nunito-Bold', fontSize: 13, color: colors.sage },
  overlay:    { flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', padding: spacing.lg },
  sheet:      { backgroundColor: colors.cream, borderRadius: 20, padding: spacing.lg },
  sheetTitle: { fontFamily: 'Nunito-Bold', fontSize: 18, color: colors.dark, marginBottom: 6 },
  sheetSub:   { fontFamily: 'Nunito-Regular', fontSize: 13, color: colors.mid, lineHeight: 19, marginBottom: spacing.md },
})
