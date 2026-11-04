// Dueño de la plataforma: liquidaciones del mes a cada entidad (cobrado, su parte, factura y pago).
import React, { useState } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, Alert } from 'react-native'
import { useQueryClient } from '@tanstack/react-query'
import { Feather } from '@expo/vector-icons'
import { errorText } from '../../lib/errors'
import { formatARS } from '../../lib/payments'
import { isoMonth, monthLabel, monthStart, rpc, SETTLEMENT_STATUS, Settlement, useSettlements } from '../../lib/platform'
import HeroHeader from '../../components/HeroHeader'
import { Button, EmptyState, Input, colors, spacing, radius, typography } from '../../components/ui'

export default function PlatformSettlementsScreen() {
  const qc = useQueryClient()
  const [offset, setOffset] = useState(-1) // por defecto, el último mes cerrado
  const d = monthStart(); d.setMonth(d.getMonth() + offset)
  const period = isoMonth(d)
  const { data: list = [], isFetching } = useSettlements(period)
  const [paying, setPaying] = useState<Settlement | null>(null)
  const [ref, setRef] = useState('')
  const [busy, setBusy] = useState(false)

  const refresh = () => qc.invalidateQueries({ queryKey: ['settlements'] })
  const build = async () => {
    try { setBusy(true); await rpc('platform_build_settlements', { p_period: period }); refresh() }
    catch (e) { Alert.alert('No pudimos calcular el mes', errorText(e)) }
    finally { setBusy(false) }
  }
  const markPaid = async () => {
    if (!paying) return
    try { setBusy(true); await rpc('mark_settlement_paid', { p_id: paying.id, p_reference: ref }); setPaying(null); refresh() }
    catch (e) { Alert.alert('No pudimos marcarla como pagada', errorText(e)) }
    finally { setBusy(false) }
  }

  const collected = list.reduce((a, s) => a + Number(s.collected_ars), 0)
  const shares = list.reduce((a, s) => a + Number(s.share_ars), 0)
  const owed = list.filter(s => s.status !== 'pagada').reduce((a, s) => a + Number(s.share_ars), 0)

  return (
    <View style={{ flex: 1, backgroundColor: colors.cream }}>
      <HeroHeader
        title="Liquidaciones"
        subtitle="Lo que le corresponde a cada entidad"
        bottomElement={
          <View style={s.monthRow}>
            <TouchableOpacity onPress={() => setOffset(o => o - 1)} hitSlop={12}><Feather name="chevron-left" size={22} color={colors.white} /></TouchableOpacity>
            <Text style={s.month}>{monthLabel(period)}{offset === 0 ? ' (en curso)' : ''}</Text>
            <TouchableOpacity onPress={() => setOffset(o => Math.min(0, o + 1))} hitSlop={12} disabled={offset === 0}>
              <Feather name="chevron-right" size={22} color={offset === 0 ? 'rgba(255,255,255,0.3)' : colors.white} />
            </TouchableOpacity>
          </View>
        }
      />
      <ScrollView contentContainerStyle={s.content}>
        <View style={s.kpis}>
          <KPI n={formatARS(collected)} l="Cobrado" />
          <KPI n={formatARS(collected - shares)} l="Queda para la plataforma" />
          <KPI n={formatARS(owed)} l="Falta pagar a entidades" warn={owed > 0} />
        </View>

        {list.length === 0 ? (
          <EmptyState icon="file-text" title="Sin liquidación para este mes" message="Se calcula sola el día 1 de cada mes. También podés calcularla ahora." />
        ) : list.map(st => {
          const b = SETTLEMENT_STATUS[st.status]
          return (
            <View key={st.id} style={s.card}>
              <View style={s.head}>
                <Text style={s.name} numberOfLines={2}>{st.camara?.name ?? 'Entidad'}</Text>
                <View style={[s.badge, { backgroundColor: b.bg }]}><Text style={[s.badgeTxt, { color: b.tx }]}>{b.label}</Text></View>
              </View>
              <Row l="Cobrado a sus estudios" v={formatARS(Number(st.collected_ars))} />
              <Row l={`Su parte (${Number(st.share_pct).toLocaleString('es-AR')}%)`} v={formatARS(Number(st.share_ars))} strong />
              {st.invoice_number ? <Row l="Factura" v={st.invoice_number} /> : null}
              {st.payment_reference ? <Row l="Referencia del pago" v={st.payment_reference} /> : null}
              {st.status === 'facturada' && (
                <Button label="Marcar como pagada" onPress={() => { setRef(''); setPaying(st) }} fullWidth style={{ marginTop: spacing.sm }} />
              )}
            </View>
          )
        })}

        <Button label={list.length ? 'Recalcular este mes' : 'Calcular este mes'} variant="secondary" onPress={build} isLoading={busy || isFetching} fullWidth style={{ marginTop: spacing.sm }} />
        <Text style={s.note}>Recalcular no cambia las liquidaciones que la entidad ya facturó.</Text>
      </ScrollView>

      <Modal visible={!!paying} transparent animationType="fade" onRequestClose={() => setPaying(null)}>
        <View style={s.overlay}>
          <View style={s.sheet}>
            <Text style={s.sheetTitle}>Pago a {paying?.camara?.name}</Text>
            <Text style={s.sheetSub}>{paying ? `${formatARS(Number(paying.share_ars))} · factura ${paying.invoice_number}` : ''}</Text>
            <Input label="REFERENCIA DE LA TRANSFERENCIA (OPCIONAL)" value={ref} onChangeText={setRef} />
            <Button label="Confirmar pago" onPress={markPaid} isLoading={busy} fullWidth size="lg" />
            <TouchableOpacity onPress={() => setPaying(null)} style={{ alignItems: 'center', paddingVertical: spacing.md }}>
              <Text style={s.link}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const KPI = ({ n, l, warn }: { n: string; l: string; warn?: boolean }) => (
  <View style={s.kpi}><Text style={[s.kpiN, warn && { color: colors.warnTx }]} numberOfLines={1} adjustsFontSizeToFit>{n}</Text><Text style={s.kpiL}>{l}</Text></View>
)
const Row = ({ l, v, strong }: { l: string; v: string; strong?: boolean }) => (
  <View style={s.row}><Text style={s.rowL}>{l}</Text><Text style={[s.rowV, strong && { fontFamily: 'Nunito-Bold', color: colors.sage }]}>{v}</Text></View>
)

const s = StyleSheet.create({
  content:    { padding: spacing.md, paddingBottom: 100 },
  monthRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.sm },
  month:      { fontFamily: 'Nunito-Bold', fontSize: 15, color: colors.white },
  kpis:       { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  kpi:        { flex: 1, backgroundColor: colors.white, ...radius.leaf, padding: spacing.sm + 2, borderWidth: 0.5, borderColor: colors.borderLight },
  kpiN:       { fontFamily: 'Nunito-Bold', fontSize: 16, color: colors.gold },
  kpiL:       { fontFamily: 'Nunito-SemiBold', fontSize: 10, lineHeight: 13, color: colors.mid, marginTop: 2 },
  card:       { backgroundColor: colors.white, ...radius.leaf, padding: spacing.md, borderWidth: 0.5, borderColor: colors.borderLight, marginBottom: spacing.sm },
  head:       { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginBottom: spacing.sm },
  name:       { flex: 1, fontFamily: 'Nunito-Bold', fontSize: 14, color: colors.dark },
  badge:      { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  badgeTxt:   { fontFamily: 'Nunito-Bold', fontSize: 10 },
  row:        { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  rowL:       { fontFamily: 'Nunito-Regular', fontSize: 13, color: colors.mid },
  rowV:       { fontFamily: 'Nunito-SemiBold', fontSize: 13, color: colors.dark },
  note:       { ...typography.caption, textAlign: 'center', marginTop: spacing.sm, color: colors.light },
  link:       { fontFamily: 'Nunito-Bold', fontSize: 13, color: colors.sage },
  overlay:    { flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', padding: spacing.lg },
  sheet:      { backgroundColor: colors.cream, borderRadius: 20, padding: spacing.lg },
  sheetTitle: { fontFamily: 'Nunito-Bold', fontSize: 18, color: colors.dark, marginBottom: 6 },
  sheetSub:   { fontFamily: 'Nunito-Regular', fontSize: 13, color: colors.mid, marginBottom: spacing.md },
})
