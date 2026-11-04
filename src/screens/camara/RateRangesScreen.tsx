import React, { useState, useEffect } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { db } from '../../lib/supabase'
import { camaraAPI } from '../../lib/api'
import { formatDate } from '../../lib/dates'
import { LoadingScreen, ErrorState, colors, spacing, radius, typography, shadows } from '../../components/ui'
import { errorText, UserError } from '../../lib/errors'
import Toast from '../../components/Toast'
import { useToast } from '../../hooks/useToast'
import SaveButton from '../../components/SaveButton'
import HeroHeader from '../../components/HeroHeader'

// Stepper compacto — solo + y - con valor en el medio
function Stepper({ value, onChange, min = 1, max = 200, accent = colors.sage }: {
  value: number; onChange: (v: number) => void; min?: number; max?: number; accent?: string
}) {
  return (
    <View style={st.stepper}>
      <TouchableOpacity style={st.stepBtn} onPress={() => onChange(Math.max(min, value - 1))} activeOpacity={0.7}>
        <Text style={[st.stepIcon, { color: accent }]}>−</Text>
      </TouchableOpacity>
      <Text style={[st.stepVal, { color: accent }]}>${(value * 1000).toLocaleString('es-AR')}</Text>
      <TouchableOpacity style={st.stepBtn} onPress={() => onChange(Math.min(max, value + 1))} activeOpacity={0.7}>
        <Text style={[st.stepIcon, { color: accent }]}>+</Text>
      </TouchableOpacity>
    </View>
  )
}

const st = StyleSheet.create({
  stepper:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 0.5, borderColor: colors.border, ...radius.leaf, overflow: 'hidden' },
  stepBtn:  { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.sageLighter },
  stepIcon: { fontSize: 22, fontFamily: 'Nunito-Regular', lineHeight: 26 },
  stepVal:  { fontFamily: 'Nunito-Bold', fontSize: 18, flex: 1, textAlign: 'center' },
})

export default function RateRangesScreen() {
  const qc = useQueryClient()
  const { toast, showToast, hideToast } = useToast()

  const { data: ranges, isLoading, isError, refetch } = useQuery({
    queryKey: ['rate-ranges'],
    queryFn: async () => {
      const { data, error } = await db.rateRanges().select('*')
      if (error) throw error
      return data
    },
  })

  const regular     = ranges?.find((r: any) => r.class_type === 'regular')
  const replacement = ranges?.find((r: any) => r.class_type === 'reemplazo')

  const [regMin, setRegMin] = useState(6)
  const [regMax, setRegMax] = useState(9)
  const [repMin, setRepMin] = useState(9)
  const [repMax, setRepMax] = useState(14)

  useEffect(() => {
    if (regular)     { setRegMin(Math.round(regular.min_ars / 1000));     setRegMax(Math.round(regular.max_ars / 1000)) }
    if (replacement) { setRepMin(Math.round(replacement.min_ars / 1000)); setRepMax(Math.round(replacement.max_ars / 1000)) }
  }, [regular, replacement])

  const updateMutation = useMutation({
    mutationFn: async () => {
      await Promise.all([
        camaraAPI.updateRateRanges('regular',   regMin * 1000, regMax * 1000),
        camaraAPI.updateRateRanges('reemplazo', repMin * 1000, repMax * 1000),
      ])
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rate-ranges'] })
      showToast('Rangos actualizados')
    },
    onError: (e: any) => showToast(errorText(e), 'error'),
  })

  if (isLoading) return <LoadingScreen message="Cargando rangos..." />
  if (isError) return <ErrorState message="No pudimos cargar los rangos de tarifas." onRetry={refetch} />

  const invalid = repMin < regMin || repMax < regMax

  const fmt = (n: number) => `$${(n * 1000).toLocaleString('es-AR')}`
  const lastDate = [regular?.updated_at, replacement?.updated_at].filter(Boolean).sort().pop()
  const lastUpdate = lastDate ? formatDate(lastDate, { day: 'numeric', month: 'long', year: 'numeric' }) : null

  return (
    <View style={{ flex: 1, backgroundColor: colors.cream }}>
      <HeroHeader
        title="Rangos de tarifas"
        subtitle="Referencia del mercado para la red"
      />

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <Text style={s.intro}>Los instructores ven este rango como guía al cargar sus tarifas por clase. Los montos se ajustan de a $1.000.</Text>

        {/* Regular */}
        <View style={s.rangeCard}>
          <View style={s.rangeHeader}>
            <Text style={s.rangeTitle}>Clase regular</Text>
            <Text style={s.rangeSummary}>{fmt(regMin)} – {fmt(regMax)}</Text>
          </View>
          <View style={s.row}>
            <View style={s.half}>
              <Text style={s.halfLabel}>MÍNIMO</Text>
              <Stepper value={regMin} onChange={setRegMin} max={regMax - 1} accent={colors.sage} />
            </View>
            <View style={s.divider} />
            <View style={s.half}>
              <Text style={s.halfLabel}>MÁXIMO</Text>
              <Stepper value={regMax} onChange={setRegMax} min={regMin + 1} accent={colors.sage} />
            </View>
          </View>
        </View>

        {/* Reemplazo */}
        <View style={[s.rangeCard, s.rangeCardGold]}>
          <View style={s.rangeHeader}>
            <Text style={[s.rangeTitle, { color: colors.gold }]}>Reemplazo</Text>
            <Text style={[s.rangeSummary, { color: colors.gold }]}>{fmt(repMin)} – {fmt(repMax)}</Text>
          </View>
          <View style={s.row}>
            <View style={s.half}>
              <Text style={[s.halfLabel, { color: colors.gold }]}>MÍNIMO</Text>
              <Stepper value={repMin} onChange={setRepMin} max={repMax - 1} accent={colors.gold} />
            </View>
            <View style={[s.divider, { backgroundColor: 'rgba(42,151,142,0.2)' }]} />
            <View style={s.half}>
              <Text style={[s.halfLabel, { color: colors.gold }]}>MÁXIMO</Text>
              <Stepper value={repMax} onChange={setRepMax} min={repMin + 1} accent={colors.gold} />
            </View>
          </View>
          {invalid && (
            <Text style={s.warning}>El reemplazo no puede ser más barato que la clase regular: revisá mínimo y máximo.</Text>
          )}
        </View>

        <SaveButton
          label="Guardar rangos"
          onPress={() => updateMutation.mutate()}
          isPending={updateMutation.isPending}
          isSuccess={updateMutation.isSuccess}
          disabled={invalid}
        />

        {lastUpdate && (
          <Text style={s.lastUpdate}>Última actualización: {lastUpdate}</Text>
        )}

      </ScrollView>
      <Toast visible={toast.visible} message={toast.message} type={toast.type} onHide={hideToast} />
    </View>
  )
}

const s = StyleSheet.create({
  content:       { padding: spacing.md, paddingBottom: 100 },
  intro:         { fontFamily: 'Nunito-SemiBold', fontSize: 13, color: colors.mid, lineHeight: 19, marginBottom: spacing.md },
  rangeCard:     { backgroundColor: colors.white, ...radius.leaf, padding: spacing.md, marginBottom: spacing.md, borderWidth: 0.5, borderColor: colors.border, ...shadows.card },
  rangeCardGold: { borderColor: 'rgba(42,151,142,0.3)', backgroundColor: colors.goldLight },
  rangeHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  rangeTitle:    { fontFamily: 'Nunito-Bold', fontSize: 17, color: colors.sage },
  rangeSummary:  { fontFamily: 'Nunito-Bold', fontSize: 13, color: colors.sage },
  row:           { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  half:          { flex: 1 },
  halfLabel:     { ...typography.caption, color: colors.sageMid, marginBottom: 6 },
  divider:       { width: 1, height: 50, backgroundColor: colors.borderLight },
  warning:       { fontFamily: 'Nunito-SemiBold', fontSize: 11, color: colors.warnTx, marginTop: spacing.sm },
  lastUpdate:    { fontFamily: 'Nunito-Regular', fontSize: 11, color: colors.light, textAlign: 'center', marginTop: spacing.sm },
})
