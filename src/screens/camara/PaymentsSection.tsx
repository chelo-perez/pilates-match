// Reportes de la Cámara: precios de los planes que se pagan con Mercado Pago y últimos cobros.
import React, { useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Switch, Alert } from 'react-native'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Feather } from '@expo/vector-icons'
import { supabase } from '../../lib/supabase'
import { errorText } from '../../lib/errors'
import { formatARS, PaidPlan, usePlanPrices } from '../../lib/payments'
import { Button, Input, colors, spacing, radius, typography } from '../../components/ui'

const PLANS: { key: PaidPlan; label: string; desc: string }[] = [
  { key: 'starter', label: 'Starter', desc: '5 propuestas por mes' },
  { key: 'premium', label: 'Premium', desc: 'Propuestas sin límite' },
]
const OK = new Set(['approved', 'processed', 'authorized'])

export default function PaymentsSection() {
  const qc = useQueryClient()
  const { data: prices = [] } = usePlanPrices()
  const [editing, setEditing] = useState<PaidPlan | null>(null)
  const [value, setValue] = useState('')
  const [active, setActive] = useState(true)
  const [saving, setSaving] = useState(false)

  const { data: payments = [] } = useQuery({
    queryKey: ['camara-payments'],
    queryFn: async () => {
      const { data, error } = await supabase.from('payments')
        .select('id, amount_ars, status, paid_at, created_at, plan_type, studio:studios(name)')
        .order('created_at', { ascending: false }).limit(10)
      if (error) return []
      return data ?? []
    },
  })
  const { data: activeSubs = 0 } = useQuery({
    queryKey: ['camara-subscriptions-count'],
    queryFn: async () => {
      const { count } = await supabase.from('subscriptions').select('id', { count: 'exact', head: true }).eq('status', 'authorized')
      return count ?? 0
    },
  })

  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0)
  const collected = payments
    .filter((p: any) => OK.has(p.status) && new Date(p.paid_at ?? p.created_at) >= monthStart)
    .reduce((s: number, p: any) => s + Number(p.amount_ars ?? 0), 0)

  const open = (k: PaidPlan) => {
    const cur = prices.find(p => p.plan_type === k)
    setValue(cur ? String(cur.price_ars) : ''); setActive(cur?.active ?? true); setEditing(k)
  }
  const save = async () => {
    const n = parseInt(value.replace(/\D/g, ''), 10)
    if (!n) { Alert.alert('Ingresá un precio', 'El precio mensual tiene que ser mayor a cero.'); return }
    try {
      setSaving(true)
      const { error } = await supabase.from('plan_prices')
        .upsert({ plan_type: editing, price_ars: n, active, updated_at: new Date().toISOString() })
      if (error) throw error
      qc.invalidateQueries({ queryKey: ['plan-prices'] })
      setEditing(null)
    } catch (e) { Alert.alert('No pudimos guardar el precio', errorText(e)) }
    finally { setSaving(false) }
  }

  return (
    <View>
      <View style={s.kpis}>
        <View style={s.kpi}><Text style={s.kpiNum}>{collected ? formatARS(collected) : '—'}</Text><Text style={s.kpiLbl}>Cobrado este mes{'\n'}con Mercado Pago</Text></View>
        <View style={s.kpi}><Text style={s.kpiNum}>{activeSubs}</Text><Text style={s.kpiLbl}>Suscripciones{'\n'}con débito activo</Text></View>
      </View>

      <View style={s.card}>
        <Text style={s.caption}>PRECIOS DE LOS PLANES</Text>
        <Text style={s.hint}>Los estudios los pagan por mes con Mercado Pago. Un cambio de precio aplica a las suscripciones nuevas.</Text>
        {PLANS.map(p => {
          const cur = prices.find(x => x.plan_type === p.key)
          if (editing === p.key) return (
            <View key={p.key} style={s.edit}>
              <Text style={s.planName}>{p.label}</Text>
              <Input label="PRECIO POR MES (ARS)" value={value} onChangeText={setValue} keyboardType="number-pad" placeholder="Ej: 15000" />
              <View style={s.switchRow}>
                <Text style={s.switchTxt}>Se puede contratar desde la app</Text>
                <Switch value={active} onValueChange={setActive} trackColor={{ true: colors.sage, false: colors.border }} thumbColor={colors.white} />
              </View>
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <Button label="Cancelar" variant="secondary" onPress={() => setEditing(null)} style={{ flex: 1 }} />
                <Button label="Guardar" onPress={save} isLoading={saving} style={{ flex: 1 }} />
              </View>
            </View>
          )
          return (
            <TouchableOpacity key={p.key} style={s.row} onPress={() => open(p.key)}>
              <View style={{ flex: 1 }}>
                <Text style={s.planName}>{p.label}</Text>
                <Text style={s.planDesc}>{p.desc}{cur && !cur.active ? ' · pausado' : ''}</Text>
              </View>
              <Text style={[s.price, !cur && { color: colors.light }]}>{cur ? formatARS(cur.price_ars) : 'Cargar precio'}</Text>
              <Feather name="edit-2" size={14} color={colors.sageMid} />
            </TouchableOpacity>
          )
        })}
      </View>

      {payments.length > 0 && (
        <View style={s.card}>
          <Text style={s.caption}>ÚLTIMOS COBROS</Text>
          {payments.map((p: any) => (
            <View key={p.id} style={s.row}>
              <View style={{ flex: 1 }}>
                <Text style={s.planName} numberOfLines={1}>{p.studio?.name ?? 'Estudio'}</Text>
                <Text style={s.planDesc}>{new Date(p.paid_at ?? p.created_at).toLocaleDateString('es-AR')} · {OK.has(p.status) ? 'Cobrado' : p.status === 'rejected' ? 'Rechazado' : 'Pendiente'}</Text>
              </View>
              <Text style={[s.price, !OK.has(p.status) && { color: colors.light }]}>{formatARS(Number(p.amount_ars ?? 0))}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  )
}

const s = StyleSheet.create({
  kpis:     { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  kpi:      { flex: 1, backgroundColor: colors.white, ...radius.leaf, padding: spacing.md, borderWidth: 0.5, borderColor: colors.borderLight },
  kpiNum:   { fontFamily: 'Nunito-Bold', fontSize: 22, color: colors.gold },
  kpiLbl:   { fontFamily: 'Nunito-SemiBold', fontSize: 11, lineHeight: 14, color: colors.mid, marginTop: 4 },
  card:     { backgroundColor: colors.white, ...radius.leaf, padding: spacing.md, borderWidth: 0.5, borderColor: colors.borderLight, marginBottom: spacing.sm },
  caption:  { ...typography.caption },
  hint:     { fontFamily: 'Nunito-Regular', fontSize: 12, color: colors.mid, lineHeight: 17, marginTop: 4, marginBottom: spacing.sm },
  row:      { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm, borderTopWidth: 0.5, borderTopColor: colors.borderLight },
  edit:     { paddingVertical: spacing.sm, borderTopWidth: 0.5, borderTopColor: colors.borderLight },
  planName: { fontFamily: 'Nunito-Bold', fontSize: 14, color: colors.dark, marginBottom: 2 },
  planDesc: { fontFamily: 'Nunito-Regular', fontSize: 12, color: colors.mid },
  price:    { fontFamily: 'Nunito-Bold', fontSize: 15, color: colors.sage },
  switchRow:{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  switchTxt:{ fontFamily: 'Nunito-Regular', fontSize: 13, color: colors.dark },
})
