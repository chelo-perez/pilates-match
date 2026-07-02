// src/screens/instructor/RatesScreen.tsx
import React, { useState, useEffect } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { instructorAPI } from '../../lib/api'
import { useAuthStore } from '../../store'
import { colors, spacing, radius } from '../../components/ui'
import Toast from '../../components/Toast'
import { useToast } from '../../hooks/useToast'
import HeroHeader from '../../components/HeroHeader'

export default function InstructorRatesScreen({ navigation }: any) {
  const user = useAuthStore(s => s.user)
  const { toast, showToast, hideToast } = useToast()
  const qc = useQueryClient()

  const { data: instructor } = useQuery({
    queryKey: ['my-instructor-profile'],
    queryFn: async () => {
      const { data } = await supabase
        .from('instructors').select('*, rates:instructor_rates(*)')
        .eq('user_id', user?.id).single()
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
      rate_regular: rateRegular, rate_replacement: rateReplacement,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-instructor-profile'] })
      showToast('Tarifas guardadas correctamente')
      setTimeout(() => navigation.goBack(), 1200)
    },
    onError: (e: any) => showToast(e.message ?? 'Error al guardar', 'error'),
  })

  const fmt     = (n: number) => `$${n.toLocaleString('es-AR')}`
  const isValid = rateReplacement >= rateRegular

  const RateCard = ({ title, badge, value, setValue, rangeData, accentColor, accentBg, blobColor }: any) => {
    const Slider = require('@react-native-community/slider').default
    return (
      <View style={[rc.card, { marginBottom: spacing.md }]}>
        {/* blobs */}
        <View style={[rc.blob1, { backgroundColor: blobColor + '0.18)' }]} />
        <View style={[rc.blob2, { backgroundColor: blobColor + '0.10)' }]} />
        <View style={rc.cardContent}>
          <View style={rc.cardHeader}>
            <Text style={rc.cardTitle}>{title}</Text>
            <View style={[rc.badgePill, { backgroundColor: accentColor + '18', borderColor: accentColor + '40' }]}>
              <Text style={[rc.badgeText, { color: accentColor }]}>{badge}</Text>
            </View>
          </View>

          {/* Stepper */}
          <View style={[rc.stepper, { backgroundColor: accentBg }]}>
            <TouchableOpacity
              style={[rc.stepBtn, { borderColor: accentColor + '60' }]}
              onPress={() => setValue((v: number) => Math.max(rangeData?.min_ars ?? 500, v - 500))}
              activeOpacity={0.7}
            >
              <Text style={[rc.stepIcon, { color: accentColor }]}>−</Text>
            </TouchableOpacity>
            <View style={rc.stepCenter}>
              <Text style={[rc.stepVal, { color: accentColor }]}>{fmt(value)}</Text>
              <Text style={rc.stepUnit}>por hora</Text>
            </View>
            <TouchableOpacity
              style={[rc.stepBtn, { borderColor: accentColor + '60' }]}
              onPress={() => setValue((v: number) => Math.min(rangeData?.max_ars ?? 50000, v + 500))}
              activeOpacity={0.7}
            >
              <Text style={[rc.stepIcon, { color: accentColor }]}>+</Text>
            </TouchableOpacity>
          </View>

          {/* Slider */}
          {rangeData && (
            <View style={rc.sliderSection}>
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
              <View style={rc.rangeRow}>
                <View>
                  <Text style={rc.rangeVal}>{fmt(rangeData.min_ars)}</Text>
                  <Text style={rc.rangeLbl}>Mínimo</Text>
                </View>
                <View style={[rc.rangePill, { backgroundColor: accentColor + '12' }]}>
                  <Text style={[rc.rangePillTxt, { color: accentColor }]}>Rango Cámara</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={rc.rangeVal}>{fmt(rangeData.max_ars)}</Text>
                  <Text style={rc.rangeLbl}>Máximo</Text>
                </View>
              </View>
            </View>
          )}
        </View>
      </View>
    )
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.cream }}>
      <HeroHeader
        title="Mis tarifas"
        subtitle="Solo visibles cuando hay match con un estudio"
        onBack={() => navigation.goBack()}
        backLabel="Mi perfil"
      />

      <ScrollView
        contentContainerStyle={rc.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={rc.intro}>
          Definí el valor mínimo que aceptás por hora. Tus tarifas son privadas.
        </Text>

        <RateCard
          title="Clase regular"
          badge="Regular"
          value={rateRegular}
          setValue={setRateRegular}
          rangeData={regular}
          accentColor={colors.sage}
          accentBg={colors.sageLight}
          blobColor="rgba(74,93,78,"
        />

        <RateCard
          title="Reemplazo"
          badge="Reemplazo"
          value={rateReplacement}
          setValue={setRateReplacement}
          rangeData={replacement}
          accentColor={colors.gold}
          accentBg={colors.goldLight}
          blobColor="rgba(184,150,12,"
        />

        {/* Diferencia */}
        <View style={[rc.diffBox, !isValid && rc.diffBoxInvalid]}>
          <Text style={[rc.diffTxt, !isValid && rc.diffTxtInvalid]}>
            {isValid
              ? `El reemplazo es ${fmt(rateReplacement - rateRegular)} más que la clase regular`
              : 'El reemplazo debe ser mayor o igual a la clase regular'}
          </Text>
        </View>

        {/* Privacidad */}
        <View style={rc.privacy}>
          <Text style={rc.privacyTxt}>
            Tus valores son privados y solo se comparten cuando hay match con el presupuesto del estudio.
          </Text>
        </View>

        {/* Guardar */}
        <TouchableOpacity
          style={[rc.saveBtn, (!isValid || !instructor) && rc.saveBtnDisabled]}
          onPress={() => saveMutation.mutate()}
          disabled={!isValid || !instructor || saveMutation.isPending}
          activeOpacity={0.85}
        >
          <View style={rc.saveBtnBlob} />
          <Text style={rc.saveBtnTxt}>
            {saveMutation.isPending ? 'Guardando...' : 'Guardar valores'}
          </Text>
        </TouchableOpacity>
      </ScrollView>

      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onHide={hideToast}
      />
    </View>
  )
}

const rc = StyleSheet.create({
  content:     { padding: spacing.md, paddingBottom: 48 },
  intro:       { fontFamily: 'Nunito-SemiBold', fontSize: 13, color: colors.mid, lineHeight: 20, marginBottom: spacing.md },

  card:        { backgroundColor: colors.white, ...radius.lg, borderWidth: 0.5, borderColor: colors.border, overflow: 'hidden', shadowColor: '#2D3F31', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.07, shadowRadius: 8, elevation: 3 },
  blob1:       { position: 'absolute', width: 140, height: 140, borderRadius: 70, top: -40, left: -30 },
  blob2:       { position: 'absolute', width: 100, height: 100, borderRadius: 50, bottom: -30, right: -20 },
  cardContent: { position: 'relative', zIndex: 1, padding: spacing.md },
  cardHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  cardTitle:   { fontFamily: 'Nunito-Bold', fontSize: 15, color: colors.dark },
  badgePill:   { paddingVertical: 3, paddingHorizontal: 10, borderRadius: 999, borderWidth: 1 },
  badgeText:   { fontFamily: 'Nunito-Bold', fontSize: 10 },

  stepper:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', ...radius.md, padding: spacing.md, marginBottom: spacing.md },
  stepBtn:     { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 3, elevation: 1 },
  stepIcon:    { fontSize: 20, lineHeight: 24, fontFamily: 'Nunito-Regular' },
  stepCenter:  { alignItems: 'center', flex: 1 },
  stepVal:     { fontFamily: 'Nunito-Bold', fontSize: 28, lineHeight: 32 },
  stepUnit:    { fontFamily: 'Nunito-SemiBold', fontSize: 10, color: colors.light, marginTop: 2 },

  sliderSection:{ borderTopWidth: 0.5, borderTopColor: colors.borderLight, paddingTop: spacing.md },
  rangeRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.xs },
  rangeVal:    { fontFamily: 'Nunito-Bold', fontSize: 11, color: colors.dark },
  rangeLbl:    { fontFamily: 'Nunito-SemiBold', fontSize: 9, color: colors.light, marginTop: 1 },
  rangePill:   { ...radius.sm, paddingVertical: 3, paddingHorizontal: 8 },
  rangePillTxt:{ fontFamily: 'Nunito-Bold', fontSize: 9 },

  diffBox:        { backgroundColor: colors.sageLight, ...radius.md, padding: spacing.md, marginBottom: spacing.md, borderWidth: 0.5, borderColor: colors.border },
  diffBoxInvalid: { backgroundColor: colors.redBg, borderColor: colors.redTx + '30' },
  diffTxt:        { fontFamily: 'Nunito-Bold', fontSize: 11, color: colors.sage, textAlign: 'center' },
  diffTxtInvalid: { color: colors.redTx },

  privacy:     { ...radius.md, backgroundColor: colors.sageLighter, padding: spacing.md, marginBottom: spacing.xl, borderWidth: 0.5, borderColor: colors.border },
  privacyTxt:  { fontFamily: 'Nunito-SemiBold', fontSize: 11, color: colors.mid, lineHeight: 17 },

  saveBtn:         { backgroundColor: colors.sage, ...radius.md, padding: 16, alignItems: 'center', overflow: 'hidden', position: 'relative' },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnBlob:     { position: 'absolute', width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(255,255,255,0.1)', top: -30, right: -10 },
  saveBtnTxt:      { fontFamily: 'Nunito-Bold', fontSize: 15, color: '#fff', position: 'relative', zIndex: 1 },
})
