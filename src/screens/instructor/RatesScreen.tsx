// src/screens/instructor/RatesScreen.tsx
import React, { useState, useEffect } from 'react'
import { View, Text, StyleSheet, ScrollView, Alert, TouchableOpacity } from 'react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { instructorAPI } from '../../lib/api'
import { useAuthStore } from '../../store'
import { colors, spacing, typography, radius } from '../../components/ui'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

export default function InstructorRatesScreen({ navigation }: any) {
  const user = useAuthStore(s => s.user)
  const qc = useQueryClient()

  const { data: instructor } = useQuery({
    queryKey: ['my-instructor-profile'],
    queryFn: async () => {
      const { data } = await supabase
        .from('instructors')
        .select(`*, rates:instructor_rates(*)`)
        .eq('user_id', user?.id)
        .single()
      return data
    },
  })

  const { data: ranges } = useQuery({
    queryKey: ['rate-ranges'],
    queryFn: async () => {
      const { data } = await supabase.from('rate_ranges').select('*')
      return data
    },
  })

  const regular     = ranges?.find((r: any) => r.class_type === 'regular')
  const replacement = ranges?.find((r: any) => r.class_type === 'reemplazo')

  const [rateRegular,     setRateRegular]     = useState(7000)
  const [rateReplacement, setRateReplacement] = useState(11000)

  useEffect(() => {
    if (instructor?.rates) {
      setRateRegular(instructor.rates.rate_regular)
      setRateReplacement(instructor.rates.rate_replacement)
    } else if (regular && replacement) {
      const midReg = Math.round((regular.min_ars + regular.max_ars) / 2 / 500) * 500
      const midRep = Math.round((replacement.min_ars + replacement.max_ars) / 2 / 500) * 500
      setRateRegular(midReg)
      setRateReplacement(midRep)
    }
  }, [instructor, regular, replacement])

  const saveMutation = useMutation({
    mutationFn: () => instructorAPI.updateRates(instructor!.id, {
      rate_regular:     rateRegular,
      rate_replacement: rateReplacement,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-instructor-profile'] })
      Alert.alert(
        '✓ Guardado',
        'Tus valores se actualizaron. Solo se revelan cuando hay compatibilidad con un estudio.',
        [{ text: 'Ok', onPress: () => navigation.goBack() }]
      )
    },
  })

  const fmt     = (n: number) => `$${n.toLocaleString('es-AR')}`
  const isValid = rateReplacement >= rateRegular

  const RateCard = ({ title, badge, value, setValue, rangeData, accentColor, accentBg }: any) => {
    const Slider = require('@react-native-community/slider').default
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>{title}</Text>
          <View style={[styles.badgePill, { backgroundColor: accentColor + '18', borderColor: accentColor + '40' }]}>
            <Text style={[styles.badgeText, { color: accentColor }]}>{badge}</Text>
          </View>
        </View>

        {/* Stepper */}
        <View style={[styles.valueDisplay, { backgroundColor: accentBg }]}>
          <TouchableOpacity
            style={[styles.stepBtn, { borderColor: accentColor }]}
            onPress={() => setValue((v: number) => Math.max(rangeData?.min_ars ?? 500, v - 500))}
            activeOpacity={0.7}
          >
            <Text style={[styles.stepIcon, { color: accentColor }]}>−</Text>
          </TouchableOpacity>
          <View style={styles.valueCenter}>
            <Text style={[styles.valueAmount, { color: accentColor }]}>{fmt(value)}</Text>
            <Text style={styles.valueUnit}>por hora</Text>
          </View>
          <TouchableOpacity
            style={[styles.stepBtn, { borderColor: accentColor }]}
            onPress={() => setValue((v: number) => Math.min(rangeData?.max_ars ?? 50000, v + 500))}
            activeOpacity={0.7}
          >
            <Text style={[styles.stepIcon, { color: accentColor }]}>+</Text>
          </TouchableOpacity>
        </View>

        {/* Slider */}
        {rangeData && (
          <View style={styles.sliderSection}>
            <Text style={styles.sliderLabel}>← deslizá para ajustar →</Text>
            <Slider
              minimumValue={rangeData.min_ars}
              maximumValue={rangeData.max_ars}
              step={500}
              value={value}
              onValueChange={(v: number) => setValue(v)}
              minimumTrackTintColor={accentColor}
              maximumTrackTintColor={colors.border}
              thumbTintColor={accentColor}
              style={{ marginHorizontal: -4 }}
            />
            <View style={styles.rangeRow}>
              <View>
                <Text style={styles.rangeValue}>{fmt(rangeData.min_ars)}</Text>
                <Text style={styles.rangeName}>Mínimo</Text>
              </View>
              <View style={[styles.rangeCenterPill, { backgroundColor: accentColor + '12' }]}>
                <Text style={[styles.rangeCenterText, { color: accentColor }]}>Rango Cámara</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.rangeValue}>{fmt(rangeData.max_ars)}</Text>
                <Text style={styles.rangeName}>Máximo</Text>
              </View>
            </View>
          </View>
        )}
      </View>
    )
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.intro}>
        Definí el valor mínimo que aceptás por hora. Solo se revelan a un estudio cuando hay compatibilidad con su presupuesto.
      </Text>

      <RateCard
        title="Clase regular"
        badge="Regular"
        value={rateRegular}
        setValue={setRateRegular}
        rangeData={regular}
        accentColor={colors.sage}
        accentBg={colors.sageLight}
      />

      <RateCard
        title="Reemplazo"
        badge="Reemplazo"
        value={rateReplacement}
        setValue={setRateReplacement}
        rangeData={replacement}
        accentColor={colors.gold}
        accentBg={colors.goldLight}
      />

      {/* Diferencia */}
      <View style={[styles.diffBox, !isValid && styles.diffBoxInvalid]}>
        <Text style={[styles.diffText, !isValid && styles.diffTextInvalid]}>
          {isValid
            ? `El reemplazo es ${fmt(rateReplacement - rateRegular)} más que la clase regular`
            : '⚠️ El reemplazo debe ser mayor o igual a la clase regular'
          }
        </Text>
      </View>

      {/* Privacidad */}
      <View style={styles.privacyRow}>
        <Text style={styles.privacyText}>
          Tus valores son privados y solo se comparten cuando hay match con el presupuesto del estudio.
        </Text>
      </View>

      {/* Guardar */}
      <TouchableOpacity
        style={[styles.saveBtn, (!isValid || !instructor) && styles.saveBtnDisabled]}
        onPress={() => saveMutation.mutate()}
        disabled={!isValid || !instructor || saveMutation.isPending}
        activeOpacity={0.85}
      >
        <Text style={styles.saveBtnText}>
          {saveMutation.isPending ? 'Guardando...' : 'Guardar valores'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F6F4F0' },
  content: { padding: spacing.lg, paddingTop: 52, paddingBottom: 40 },
  intro: { ...typography.body, color: colors.mid, lineHeight: 22, marginBottom: spacing.lg },

  card: {
    backgroundColor: colors.white, borderRadius: 16,
    padding: spacing.lg, marginBottom: spacing.md,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  cardTitle: { fontFamily: 'Nunito-SemiBold', fontSize: 16, color: colors.dark },
  badgePill: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 99, borderWidth: 1 },
  badgeText: { fontSize: 12, fontFamily: 'Nunito-SemiBold' },

  valueDisplay: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderRadius: 12, padding: spacing.md, marginBottom: spacing.md,
  },
  stepBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: colors.white,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1.5,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08, shadowRadius: 3, elevation: 1,
  },
  stepIcon: { fontSize: 22, lineHeight: 26, fontWeight: '300' },
  valueCenter: { alignItems: 'center', flex: 1 },
  valueAmount: { fontFamily: 'Nunito-SemiBold', fontSize: 30, lineHeight: 34 },
  valueUnit: { ...typography.small, color: colors.light, marginTop: 2 },

  sliderSection: { borderTopWidth: 0.5, borderTopColor: colors.borderLight, paddingTop: spacing.md },
  sliderLabel: { ...typography.small, color: colors.light, textAlign: 'center', marginBottom: 4, fontStyle: 'italic' },
  rangeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.xs },
  rangeValue: { fontFamily: 'Nunito-SemiBold', fontSize: 12, color: colors.dark },
  rangeName: { fontSize: 10, color: colors.light, marginTop: 1 },
  rangeCenterPill: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 6 },
  rangeCenterText: { fontSize: 10, fontFamily: 'Nunito-Medium' },

  diffBox: {
    backgroundColor: colors.sageLight, borderRadius: 10, padding: spacing.md,
    marginBottom: spacing.md, borderWidth: 0.5, borderColor: colors.sageMid + '50',
  },
  diffBoxInvalid: { backgroundColor: colors.redBg, borderColor: colors.redTx + '30' },
  diffText: { ...typography.small, color: colors.sage, fontFamily: 'Nunito-Medium', textAlign: 'center' },
  diffTextInvalid: { color: colors.redTx },

  privacyRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm,
    backgroundColor: colors.sageLighter, borderRadius: 10, padding: spacing.md, marginBottom: spacing.xl,
  },
  privacyText: { ...typography.small, color: colors.mid, flex: 1, lineHeight: 18 },

  saveBtn: { backgroundColor: colors.sage, borderRadius: 99, paddingVertical: 15, alignItems: 'center' },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { fontFamily: 'Nunito-SemiBold', fontSize: 16, color: colors.white },
})
