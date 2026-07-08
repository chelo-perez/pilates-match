import React, { useState, useEffect } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { db } from '../../lib/supabase'
import { camaraAPI } from '../../lib/api'
import { LoadingScreen, colors, spacing } from '../../components/ui'
import Toast from '../../components/Toast'
import { useToast } from '../../hooks/useToast'
import SaveButton from '../../components/SaveButton'
import HeroHeader from '../../components/HeroHeader'

// Stepper compacto — solo + y - con valor en el medio
function Stepper({ value, onChange, min = 1, max = 30, accent = colors.sage }: {
  value: number; onChange: (v: number) => void; min?: number; max?: number; accent?: string
}) {
  return (
    <View style={[st.stepper, { borderColor: accent + '40' }]}>
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
  stepper:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 0.5, borderTopLeftRadius: 12, borderTopRightRadius: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 12, overflow: 'hidden' },
  stepBtn:  { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.03)' },
  stepIcon: { fontSize: 22, fontFamily: 'Nunito-Regular', lineHeight: 26 },
  stepVal:  { fontFamily: 'Nunito-Bold', fontSize: 18, flex: 1, textAlign: 'center' },
})

export default function RateRangesScreen({ navigation }: any) {
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
    onError: (e: any) => showToast('Error: ' + e.message),
  })

  if (isLoading) return <LoadingScreen />

  const fmt = (n: number) => `$${(n * 1000).toLocaleString('es-AR')}`
  const lastUpdate = regular?.updated_at
    ? new Date(regular.updated_at).toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })
    : null

  return (
    <View style={{ flex: 1, backgroundColor: colors.cream }}>
      <HeroHeader
        title="Rangos de tarifas"
        subtitle="Referencia del mercado para la red"
        onBack={() => navigation.navigate('CamaraHome')}
        backLabel="Inicio"
      />

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

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
              <Text style={[s.halfLabel, { color: '#7A5000' }]}>MÍNIMO</Text>
              <Stepper value={repMin} onChange={setRepMin} max={repMax - 1} accent={colors.gold} />
            </View>
            <View style={[s.divider, { backgroundColor: 'rgba(184,150,12,0.2)' }]} />
            <View style={s.half}>
              <Text style={[s.halfLabel, { color: '#7A5000' }]}>MÁXIMO</Text>
              <Stepper value={repMax} onChange={setRepMax} min={repMin + 1} accent={colors.gold} />
            </View>
          </View>
          {repMin < regMin && (
            <Text style={s.warning}>⚠ El mínimo de reemplazo debería ser mayor al de clase regular</Text>
          )}
        </View>

        <SaveButton
          label="Guardar rangos"
          onPress={() => updateMutation.mutate()}
          isPending={updateMutation.isPending}
          isSuccess={updateMutation.isSuccess}
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
  content:       { padding: spacing.md, paddingBottom: 40 },
  rangeCard:     { backgroundColor: colors.white, borderTopLeftRadius: 20, borderTopRightRadius: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 20, padding: spacing.md, marginBottom: spacing.md, borderWidth: 0.5, borderColor: colors.border, shadowColor: '#2D3F31', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  rangeCardGold: { borderColor: 'rgba(184,150,12,0.3)', backgroundColor: '#FFFDF5' },
  rangeHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  rangeTitle:    { fontFamily: 'Nunito-Bold', fontSize: 17, color: colors.sage },
  rangeSummary:  { fontFamily: 'Nunito-Bold', fontSize: 13, color: colors.sage },
  row:           { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  half:          { flex: 1 },
  halfLabel:     { fontFamily: 'Nunito-Bold', fontSize: 9, color: colors.sageMid, letterSpacing: 0.7, marginBottom: 6 },
  divider:       { width: 1, height: 50, backgroundColor: colors.borderLight },
  warning:       { fontFamily: 'Nunito-SemiBold', fontSize: 11, color: colors.warnTx, marginTop: spacing.sm },
  lastUpdate:    { fontFamily: 'Nunito-Regular', fontSize: 11, color: colors.light, textAlign: 'center', marginTop: spacing.sm },
})
