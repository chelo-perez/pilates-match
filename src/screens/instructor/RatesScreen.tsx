import React, { useState, useEffect } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Toast from '../../components/Toast'
import { useToast } from '../../hooks/useToast'
import { supabase } from '../../lib/supabase'
import { instructorAPI } from '../../lib/api'
import { useAuthStore } from '../../store'
import { colors, spacing } from '../../components/ui'
import HeroHeader from '../../components/HeroHeader'
import BlobCard from '../../components/BlobCard'
import Slider from '@react-native-community/slider'

export default function InstructorRatesScreen({ navigation }: any) {
  const user = useAuthStore(s => s.user)
  const { toast, showToast, hideToast } = useToast()
  const qc = useQueryClient()

  const { data: instructor } = useQuery({
    queryKey: ['my-instructor-profile'],
    queryFn: async () => {
      const { data } = await supabase.from('instructors').select('*, rates:instructor_rates(*)').eq('user_id', user?.id).single()
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
      setRateRegular(instructor.rates.rate_regular ?? 7000)
      setRateReplacement(instructor.rates.rate_replacement ?? 11000)
    }
  }, [instructor])

  const saveMutation = useMutation({
    mutationFn: () => instructorAPI.updateRates(instructor!.id, { rate_regular: rateRegular, rate_replacement: rateReplacement }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-instructor-profile'] })
      showToast('Tarifas guardadas correctamente')
      setTimeout(() => navigation.goBack(), 1200)
    },
    onError: (e: any) => showToast(e.message ?? 'Error al guardar'),
  })

  const fmt     = (n: number) => '$' + n.toLocaleString('es-AR')
  const isValid = rateReplacement >= rateRegular

  const RateSection = ({ title, badge, value, setValue, range, accent, bg }: any) => (
    <BlobCard
      style={s.rateCard}
      blobColor={`rgba(${accent},0.16)`}
      blobColor2={`rgba(${accent},0.09)`}
    >
      <View style={s.rateHeader}>
        <Text style={s.rateTitle}>{title}</Text>
        <View style={[s.badgePill, { backgroundColor: `rgba(${accent},0.12)` }]}>
          <Text style={[s.badgeText, { color: `rgba(${accent},1)` }]}>{badge}</Text>
        </View>
      </View>
      {/* Stepper */}
      <View style={[s.stepper, { backgroundColor: bg }]}>
        <TouchableOpacity style={s.stepBtn} onPress={() => setValue((v: number) => Math.max(range?.min_ars ?? 500, v - 500))} activeOpacity={0.7}>
          <Text style={s.stepIcon}>−</Text>
        </TouchableOpacity>
        <View style={{ alignItems: 'center', flex: 1 }}>
          <Text style={[s.stepVal, { color: `rgba(${accent},1)` }]}>{fmt(value)}</Text>
          <Text style={s.stepUnit}>por hora</Text>
        </View>
        <TouchableOpacity style={s.stepBtn} onPress={() => setValue((v: number) => Math.min(range?.max_ars ?? 50000, v + 500))} activeOpacity={0.7}>
          <Text style={s.stepIcon}>+</Text>
        </TouchableOpacity>
      </View>
      {/* Slider */}
      {range && (
        <View style={s.sliderWrap}>
          <Slider
            minimumValue={range.min_ars} maximumValue={range.max_ars} step={500} value={value}
            onValueChange={(v: number) => setValue(v)}
            minimumTrackTintColor={`rgba(${accent},1)`}
            maximumTrackTintColor={colors.borderLight}
            thumbTintColor={`rgba(${accent},1)`}
          />
          <View style={s.rangeRow}>
            <View><Text style={s.rangeVal}>{fmt(range.min_ars)}</Text><Text style={s.rangeLbl}>Mínimo</Text></View>
            <View style={[s.rangePill, { backgroundColor: `rgba(${accent},0.1)` }]}>
              <Text style={[s.rangePillTxt, { color: `rgba(${accent},1)` }]}>Rango Cámara</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}><Text style={s.rangeVal}>{fmt(range.max_ars)}</Text><Text style={s.rangeLbl}>Máximo</Text></View>
          </View>
        </View>
      )}
    </BlobCard>
  )

  return (
    <View style={{ flex: 1, backgroundColor: colors.cream }}>
      <HeroHeader title="Mis tarifas" subtitle="Solo visibles cuando hay match con un estudio" />
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <Text style={s.intro}>Definí el valor mínimo que aceptás por hora. Tus tarifas son privadas.</Text>

        <RateSection title="Clase regular" badge="Regular" value={rateRegular} setValue={setRateRegular} range={regular} accent="74,93,78" bg={colors.sageLight} />
        <RateSection title="Reemplazo" badge="Reemplazo" value={rateReplacement} setValue={setRateReplacement} range={replacement} accent="184,150,12" bg={colors.goldLight} />

        <View style={[s.diffBox, !isValid && { backgroundColor: colors.redBg }]}>
          <Text style={[s.diffTxt, !isValid && { color: colors.redTx }]}>
            {isValid ? `El reemplazo es ${fmt(rateReplacement - rateRegular)} más que la clase regular` : 'El reemplazo debe ser mayor o igual a la clase regular'}
          </Text>
        </View>

        <View style={s.privacyBox}>
          <Text style={s.privacyTxt}>Tus valores son privados y solo se comparten cuando hay match con el presupuesto del estudio.</Text>
        </View>

        <TouchableOpacity style={[s.saveBtn, (!isValid || !instructor) && { opacity: 0.5 }]} onPress={() => saveMutation.mutate()} disabled={!isValid || !instructor || saveMutation.isPending} activeOpacity={0.85}>
          <Text style={s.saveTxt}>{saveMutation.isPending ? 'Guardando...' : 'Guardar valores'}</Text>
        </TouchableOpacity>
      </ScrollView>
      <Toast visible={toast.visible} message={toast.message} type={toast.type} onHide={hideToast} />
    </View>
  )
}

const s = StyleSheet.create({
  content:     { padding: spacing.md, paddingBottom: 48 },
  intro:       { fontFamily: 'Nunito-SemiBold', fontSize: 13, color: colors.mid, lineHeight: 20, marginBottom: spacing.md },
  rateCard:    { marginBottom: spacing.md, padding: spacing.md },
  rateHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  rateTitle:   { fontFamily: 'Nunito-Bold', fontSize: 15, color: colors.dark },
  badgePill:   { paddingVertical: 3, paddingHorizontal: 10, borderRadius: 999 },
  badgeText:   { fontFamily: 'Nunito-Bold', fontSize: 10 },
  stepper:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopLeftRadius: 14, borderTopRightRadius: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 14, padding: spacing.md, marginBottom: spacing.md },
  stepBtn:     { width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(74,93,78,0.3)', elevation: 1 },
  stepIcon:    { fontSize: 20, fontFamily: 'Nunito-Regular', color: colors.sage },
  stepVal:     { fontFamily: 'Nunito-Bold', fontSize: 28, lineHeight: 32 },
  stepUnit:    { fontFamily: 'Nunito-SemiBold', fontSize: 10, color: colors.light, marginTop: 2 },
  sliderWrap:  { borderTopWidth: 0.5, borderTopColor: colors.borderLight, paddingTop: spacing.md },
  rangeRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.xs },
  rangeVal:    { fontFamily: 'Nunito-Bold', fontSize: 11, color: colors.dark },
  rangeLbl:    { fontFamily: 'Nunito-SemiBold', fontSize: 9, color: colors.light, marginTop: 1 },
  rangePill:   { borderTopLeftRadius: 8, borderTopRightRadius: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 8, paddingVertical: 3, paddingHorizontal: 8 },
  rangePillTxt:{ fontFamily: 'Nunito-Bold', fontSize: 9 },
  diffBox:     { backgroundColor: colors.sageLight, borderTopLeftRadius: 14, borderTopRightRadius: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 14, padding: spacing.md, marginBottom: spacing.md },
  diffTxt:     { fontFamily: 'Nunito-Bold', fontSize: 11, color: colors.sage, textAlign: 'center' },
  privacyBox:  { borderTopLeftRadius: 14, borderTopRightRadius: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 14, backgroundColor: colors.sageLighter, padding: spacing.md, marginBottom: spacing.xl, borderWidth: 0.5, borderColor: colors.borderLight },
  privacyTxt:  { fontFamily: 'Nunito-SemiBold', fontSize: 11, color: colors.mid, lineHeight: 17 },
  saveBtn:     { backgroundColor: colors.sage, borderTopLeftRadius: 14, borderTopRightRadius: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 14, padding: 16, alignItems: 'center' },
  saveTxt:     { fontFamily: 'Nunito-Bold', fontSize: 15, color: '#fff' },
})
