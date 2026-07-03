// src/screens/camara/RateRangesScreen.tsx
import React, { useState, useEffect } from 'react'
import { View, TouchableOpacity, Text, StyleSheet, ScrollView } from 'react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { db } from '../../lib/supabase'
import { camaraAPI } from '../../lib/api'
import { Card, Button, Badge, LoadingScreen, colors, spacing, typography, radius } from '../../components/ui'
import Toast from '../../components/Toast'
import { useToast } from '../../hooks/useToast'


function RangeInput({ value, onChange, min = 1, max = 20 }: { label: string; value: number; onChange: (v: number) => void; min?: number; max?: number }) {
  const fmt = (n: number) => '$' + (n * 1000).toLocaleString('es-AR')
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 8 }}>
      <TouchableOpacity
        onPress={() => onChange(Math.max(min, value - 1))}
        style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.sageLight, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.sage }}
      >
        <Text style={{ fontSize: 22, color: colors.sage, fontFamily: 'Nunito-Bold' }}>−</Text>
      </TouchableOpacity>
      <View style={{ flex: 1, alignItems: 'center' }}>
        <Text style={{ fontFamily: 'Nunito-Bold', fontSize: 22, color: colors.dark }}>{fmt(value)}</Text>
        <Text style={{ fontFamily: 'Nunito-Regular', fontSize: 11, color: colors.mid }}>por hora</Text>
      </View>
      <TouchableOpacity
        onPress={() => onChange(Math.min(max, value + 1))}
        style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.sageLight, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.sage }}
      >
        <Text style={{ fontSize: 22, color: colors.sage, fontFamily: 'Nunito-Bold' }}>+</Text>
      </TouchableOpacity>
    </View>
  )
}

export default function RateRangesScreen() {
  const qc = useQueryClient()
  const { toast, showToast, hideToast } = useToast()
  const { data: ranges, isLoading } = useQuery({
    queryKey: ['rate-ranges'],
    queryFn: async () => {
      const { data, error } = await db.rateRanges().select('*')
      if (error) throw error
      return data
    },
  })

  const regular = ranges?.find((r: any) => r.class_type === 'regular')
  const replacement = ranges?.find((r: any) => r.class_type === 'reemplazo')

  const [regMin, setRegMin] = useState(6000)
  const [regMax, setRegMax] = useState(9000)
  const [repMin, setRepMin] = useState(9000)
  const [repMax, setRepMax] = useState(14000)

  useEffect(() => {
    if (regular) { setRegMin(regular.min_ars); setRegMax(regular.max_ars) }
    if (replacement) { setRepMin(replacement.min_ars); setRepMax(replacement.max_ars) }
  }, [regular, replacement])

  const updateMutation = useMutation({
    mutationFn: async () => {
      await Promise.all([
        camaraAPI.updateRateRanges('regular', regMin, regMax),
        camaraAPI.updateRateRanges('reemplazo', repMin, repMax),
      ])
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rate-ranges'] })
      showToast('Rangos actualizados correctamente')
    },
    onError: (e: any) => showToast(e.message ?? 'Error al guardar', 'error'),
  })

  if (isLoading) return <LoadingScreen />

  const formatARS = (n: number) => `$${n.toLocaleString('es-AR')}`

  return (
    <>
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      <View style={styles.info}>
        <Text style={styles.infoText}>
          Estos rangos son visibles para todos los instructores y estudios como referencia del mercado. Actualizar regularmente según las condiciones actuales.
        </Text>
      </View>

      {/* Clases Regulares */}
      <Card style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Clases regulares</Text>
          <Badge label="Clases Regulares" color="sage" />
        </View>

        <Text style={styles.fieldLabel}>MÍNIMO</Text>
        <RangeInput label="" value={Math.round(regMin / 1000)} onChange={v => setRegMin(v * 1000)} />

        <Text style={styles.fieldLabel}>MÁXIMO</Text>
        <RangeInput label="" value={Math.round(regMax / 1000)} onChange={v => setRegMax(v * 1000)} />

        <View style={styles.rangeSummary}>
          <Text style={styles.rangeText}>Rango actual: {formatARS(regMin)} – {formatARS(regMax)}</Text>
        </View>
      </Card>

      {/* Reemplazos */}
      <Card style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Reemplazo</Text>
          <Badge label="Reemplazos" color="gold" />
        </View>

        <Text style={styles.fieldLabel}>MÍNIMO</Text>
        <RangeInput label="" value={Math.round(repMin / 1000)} onChange={v => setRepMin(v * 1000)} />

        <Text style={styles.fieldLabel}>MÁXIMO</Text>
        <RangeInput label="" value={Math.round(repMax / 1000)} onChange={v => setRepMax(v * 1000)} />

        <View style={styles.rangeSummary}>
          <Text style={styles.rangeText}>Rango actual: {formatARS(repMin)} – {formatARS(repMax)}</Text>
        </View>

        {repMin < regMin && (
          <View style={styles.warning}>
            <Text style={styles.warningText}>
              ⚠️ El mínimo de reemplazo ({formatARS(repMin)}) es menor al de clase regular ({formatARS(regMin)}). El reemplazo siempre debe ser mayor.
            </Text>
          </View>
        )}
      </Card>

      <Button
        label="Guardar rangos"
        onPress={() => updateMutation.mutate()}
        isLoading={updateMutation.isPending}
        disabled={repMin < regMin}
        fullWidth size="lg"
        style={{ marginTop: spacing.md }}
      />

      <Text style={styles.lastUpdate}>
        Última actualización:{' '}
        {regular?.updated_at
          ? new Date(regular.updated_at).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })
          : 'Nunca'
        }
      </Text>
    </ScrollView>
      <Toast visible={toast.visible} message={toast.message} type={toast.type} onHide={hideToast} />
    </>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  content: { padding: spacing.lg, paddingTop: 52, paddingBottom: spacing.xxl },
  info: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: colors.sageLight, borderTopLeftRadius: 14, borderTopRightRadius: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 14,
    padding: spacing.md, marginBottom: spacing.lg,
  },
  infoText: { ...typography.small, color: colors.mid, flex: 1, lineHeight: 18 },
  card: { padding: spacing.lg, marginBottom: spacing.md, backgroundColor: colors.white },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg },
  cardTitle: { fontFamily: 'Nunito-SemiBold', fontSize: 16, color: colors.dark },
  fieldLabel: { ...typography.label, color: colors.mid, marginBottom: spacing.xs },
  sliderRow: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: spacing.xs },
  sliderVal: { fontFamily: 'Nunito-SemiBold', fontSize: 18, color: colors.dark },
  rangeSummary: { backgroundColor: colors.sageLight, borderTopLeftRadius: 8, borderTopRightRadius: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 8, padding: spacing.sm, marginTop: spacing.sm },
  rangeText: { ...typography.small, color: colors.sage, textAlign: 'center', fontFamily: 'Nunito-Medium' },
  warning: { backgroundColor: colors.warnBg, borderTopLeftRadius: 8, borderTopRightRadius: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 8, padding: spacing.sm, marginTop: spacing.sm },
  warningText: { ...typography.small, color: colors.warnTx, lineHeight: 18 },
  lastUpdate: { ...typography.small, color: colors.light, textAlign: 'center', marginTop: spacing.lg },
})
