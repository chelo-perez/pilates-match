// src/screens/instructor/RatesScreen.tsx
import React, { useState, useEffect } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Toast from '../../components/Toast'
import { useToast } from '../../hooks/useToast'
import { supabase } from '../../lib/supabase'
import { instructorAPI } from '../../lib/api'
import { useMyInstructor } from '../../hooks'
import { errorText, UserError } from '../../lib/errors'
import { LoadingScreen, ErrorState, colors, spacing, radius, typography } from '../../components/ui'
import HeroHeader from '../../components/HeroHeader'
import BlobCard from '../../components/BlobCard'
import SaveButton from '../../components/SaveButton'
import Slider from '@react-native-community/slider'

const STEP = 500
const fmt = (n: number) => '$' + n.toLocaleString('es-AR')
const clamp = (v: number, r?: any) => r ? Math.min(r.max_ars, Math.max(r.min_ars, v)) : v

interface RateSectionProps {
  title: string
  badge: string
  value: number
  setValue: (fn: (v: number) => number) => void
  range: any
  accent: string   // r,g,b
  textColor: string
  bg: string
}

// Definido fuera del componente: si se define adentro, el Slider se remonta en cada cambio y el arrastre se corta
function RateSection({ title, badge, value, setValue, range, accent, textColor, bg }: RateSectionProps) {
  const min = range?.min_ars ?? STEP
  const max = range?.max_ars ?? 100000
  return (
    <BlobCard style={s.rateCard} blobColor={`rgba(${accent},0.16)`} blobColor2={`rgba(${accent},0.09)`}>
      <View style={s.rateHeader}>
        <Text style={s.rateTitle}>{title}</Text>
        <View style={[s.badgePill, { backgroundColor: bg }]}>
          <Text style={[s.badgeText, { color: textColor }]}>{badge}</Text>
        </View>
      </View>
      <View style={[s.stepper, { backgroundColor: bg }]}>
        <TouchableOpacity style={s.stepBtn} onPress={() => setValue(v => Math.max(min, v - STEP))} activeOpacity={0.7}>
          <Text style={s.stepIcon}>−</Text>
        </TouchableOpacity>
        <View style={{ alignItems: 'center', flex: 1 }}>
          <Text style={[s.stepVal, { color: textColor }]}>{fmt(value)}</Text>
          <Text style={s.stepUnit}>por hora</Text>
        </View>
        <TouchableOpacity style={s.stepBtn} onPress={() => setValue(v => Math.min(max, v + STEP))} activeOpacity={0.7}>
          <Text style={s.stepIcon}>+</Text>
        </TouchableOpacity>
      </View>
      {range ? (
        <View style={s.sliderWrap}>
          <Slider
            minimumValue={range.min_ars} maximumValue={range.max_ars} step={STEP} value={value}
            onValueChange={(v: number) => setValue(() => v)}
            minimumTrackTintColor={textColor}
            maximumTrackTintColor={colors.borderLight}
            thumbTintColor={textColor}
          />
          <View style={s.rangeRow}>
            <View><Text style={s.rangeVal}>{fmt(range.min_ars)}</Text><Text style={s.rangeLbl}>Mínimo</Text></View>
            <View style={[s.rangePill, { backgroundColor: bg }]}>
              <Text style={[s.rangePillTxt, { color: textColor }]}>Rango sugerido por la Cámara</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}><Text style={s.rangeVal}>{fmt(range.max_ars)}</Text><Text style={s.rangeLbl}>Máximo</Text></View>
          </View>
        </View>
      ) : null}
    </BlobCard>
  )
}

export default function InstructorRatesScreen() {
  const { toast, showToast, hideToast } = useToast()
  const qc = useQueryClient()

  const { data: instructor, isLoading, isError, refetch } = useMyInstructor()

  const { data: ranges, isLoading: loadingRanges } = useQuery({
    queryKey: ['rate-ranges'],
    queryFn: async () => {
      const { data, error } = await supabase.from('rate_ranges').select('*')
      if (error) throw error
      return data ?? []
    },
  })

  const regular     = ranges?.find((r: any) => r.class_type === 'regular')
  const replacement = ranges?.find((r: any) => r.class_type === 'reemplazo')
  const savedRates: any = Array.isArray(instructor?.rates) ? instructor?.rates[0] : instructor?.rates

  const [rateRegular,     setRateRegular]     = useState(0)
  const [rateReplacement, setRateReplacement] = useState(0)

  // Valores iniciales: lo guardado, o el mínimo del rango de la Cámara
  useEffect(() => {
    if (!instructor || loadingRanges) return
    setRateRegular(savedRates?.rate_regular ?? regular?.min_ars ?? 7000)
    setRateReplacement(savedRates?.rate_replacement ?? replacement?.min_ars ?? 10000)
  }, [instructor, loadingRanges])

  const saveMutation = useMutation({
    mutationFn: () => instructorAPI.updateRates(instructor!.id, {
      rate_regular: Math.round(rateRegular),
      rate_replacement: Math.round(rateReplacement),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-instructor'] })
      showToast('Tarifas guardadas')
    },
    onError: (e: any) => showToast(errorText(e), 'error'),
  })

  if (isLoading || loadingRanges) return <LoadingScreen message="Cargando tus tarifas..." />
  if (isError || !instructor) return <ErrorState message="No pudimos cargar tus tarifas." onRetry={refetch} />

  const isValid = rateReplacement >= rateRegular && rateRegular > 0
  const outOfRange =
    (regular && (rateRegular < regular.min_ars || rateRegular > regular.max_ars)) ||
    (replacement && (rateReplacement < replacement.min_ars || rateReplacement > replacement.max_ars))

  return (
    <View style={{ flex: 1, backgroundColor: colors.cream }}>
      <HeroHeader title="Mis tarifas" subtitle="Lo que cobrás por hora de clase" />
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <Text style={s.intro}>Definí el valor mínimo que aceptás por hora. Los estudios no ven el número: solo si entra en su presupuesto.</Text>

        <RateSection title="Clase regular" badge="Regular" value={rateRegular} setValue={fn => setRateRegular(v => clamp(fn(v), regular))}
          range={regular} accent="74,93,78" textColor={colors.sage} bg={colors.sageLight} />
        <RateSection title="Reemplazo" badge="Reemplazo" value={rateReplacement} setValue={fn => setRateReplacement(v => clamp(fn(v), replacement))}
          range={replacement} accent="184,150,12" textColor={colors.gold} bg={colors.goldLight} />

        <View style={[s.diffBox, !isValid && { backgroundColor: colors.redBg }]}>
          <Text style={[s.diffTxt, !isValid && { color: colors.redTx }]}>
            {!isValid
              ? 'El reemplazo tiene que ser igual o mayor que la clase regular'
              : rateReplacement === rateRegular
                ? 'El reemplazo cuesta lo mismo que la clase regular'
                : `El reemplazo es ${fmt(rateReplacement - rateRegular)} más que la clase regular`}
          </Text>
        </View>

        {outOfRange ? (
          <View style={[s.diffBox, { backgroundColor: colors.warnBg }]}>
            <Text style={[s.diffTxt, { color: colors.warnTx }]}>Tu tarifa guardada está fuera del rango sugerido por la Cámara. Ajustala y guardá.</Text>
          </View>
        ) : null}

        <SaveButton
          label="Guardar tarifas"
          onPress={() => saveMutation.mutate()}
          isPending={saveMutation.isPending}
          isSuccess={saveMutation.isSuccess}
          disabled={!isValid}
        />
      </ScrollView>
      <Toast visible={toast.visible} message={toast.message} type={toast.type} onHide={hideToast} />
    </View>
  )
}

const s = StyleSheet.create({
  content:     { padding: spacing.md, paddingBottom: 100 },
  intro:       { fontFamily: 'Nunito-SemiBold', fontSize: 13, color: colors.mid, lineHeight: 20, marginBottom: spacing.md },
  rateCard:    { marginBottom: spacing.md, padding: spacing.md },
  rateHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  rateTitle:   { fontFamily: 'Nunito-Bold', fontSize: 15, color: colors.dark },
  badgePill:   { paddingVertical: 3, paddingHorizontal: 10, borderRadius: radius.full },
  badgeText:   { fontFamily: 'Nunito-Bold', fontSize: 10 },
  stepper:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', ...radius.leaf, padding: spacing.md, marginBottom: spacing.md },
  stepBtn:     { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border, elevation: 1 },
  stepIcon:    { fontSize: 20, fontFamily: 'Nunito-Regular', color: colors.sage },
  stepVal:     { fontFamily: 'Nunito-Bold', fontSize: 28, lineHeight: 32 },
  stepUnit:    { fontFamily: 'Nunito-SemiBold', fontSize: 10, color: colors.light, marginTop: 2 },
  sliderWrap:  { borderTopWidth: 0.5, borderTopColor: colors.borderLight, paddingTop: spacing.md },
  rangeRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.xs },
  rangeVal:    { fontFamily: 'Nunito-Bold', fontSize: 11, color: colors.dark },
  rangeLbl:    { fontFamily: 'Nunito-SemiBold', fontSize: 10, color: colors.light, marginTop: 1 },
  rangePill:   { ...radius.leaf, paddingVertical: 3, paddingHorizontal: 8 },
  rangePillTxt:{ fontFamily: 'Nunito-Bold', fontSize: 10 },
  diffBox:     { backgroundColor: colors.sageLight, ...radius.leaf, padding: spacing.md, marginBottom: spacing.md },
  diffTxt:     { fontFamily: 'Nunito-Bold', fontSize: 12, color: colors.sage, textAlign: 'center' },
})
