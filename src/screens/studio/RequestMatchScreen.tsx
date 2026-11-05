// src/screens/studio/RequestMatchScreen.tsx
import React, { useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  KeyboardAvoidingView, Platform, TextInput
} from 'react-native'
import PickerField from '../../components/PickerField'
import { useSearchNeed, parseLocal, fromHHMM } from '../../store/searchNeed'
import { useQuery } from '@tanstack/react-query'
import { useCanMatch, useCreateMatch, useInstructor, useMyStudio } from '../../hooks'
import { supabase } from '../../lib/supabase'
import { Avatar, Button, colors, spacing, radius, typography } from '../../components/ui'
import { toLocalISODate, toHHMM } from '../../lib/dates'
import { humanizeError } from '../../lib/errors'
import { Feather } from '@expo/vector-icons'
import BlobCard from '../../components/BlobCard'
import HeroHeader from '../../components/HeroHeader'
import Toast from '../../components/Toast'
import { useToast } from '../../hooks/useToast'
import { availabilityCovers, DAY_BY_JS_INDEX, nextDateForDays } from './studioQueries'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'

type Props = NativeStackScreenProps<any, 'RequestMatch'>

const DAYS = [
  { key: 'lunes', label: 'Lun' },
  { key: 'martes', label: 'Mar' },
  { key: 'miercoles', label: 'Mié' },
  { key: 'jueves', label: 'Jue' },
  { key: 'viernes', label: 'Vie' },
  { key: 'sabado', label: 'Sáb' },
  { key: 'domingo', label: 'Dom' },
]

const money = (n: number) => '$' + Math.round(n).toLocaleString('es-AR')
const fmtDate = (d: Date) => d.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })

export default function RequestMatchScreen({ navigation, route }: Props) {
  const { instructorId, instructorName } = (route.params || {}) as any
  const { data: studio } = useMyStudio()
  const { data: instructor } = useInstructor(instructorId)
  const { data: canMatch } = useCanMatch(studio?.id)
  const createMatch = useCreateMatch()
  const { toast, showToast, hideToast } = useToast()

  // Arranca con la clase que el estudio buscó (store searchNeed)
  const need = useSearchNeed(st => st.need)
  const [classType, setClassType] = useState<'regular' | 'reemplazo'>(need.classType)

  // ── Reemplazo ──
  const [classDate, setClassDate] = useState(() => { const d = parseLocal(need.date); d.setHours(0, 0, 0, 0); return d < new Date(new Date().setHours(0, 0, 0, 0)) ? new Date(new Date().setHours(0, 0, 0, 0)) : d })
  const [startTime, setStartTime] = useState(() => fromHHMM(need.from))
  const [endTime, setEndTime]     = useState(() => fromHHMM(need.to))

  // ── Regular ──
  const [selectedDays, setSelectedDays] = useState<string[]>(need.days)
  const [scheduleFrom, setScheduleFrom] = useState(() => fromHHMM(need.from))
  const [scheduleTo,   setScheduleTo]   = useState(() => fromHHMM(need.to))

  const [note, setNote] = useState('')

  // Oferta por clase: es lo que el estudio paga si el instructor acepta. La tarifa del instructor
  // es privada; él compara la oferta con su tarifa y acepta, rechaza o contraoferta.
  const [offer, setOffer] = useState(0)
  const { data: ranges = [] } = useQuery({
    queryKey: ['rate-ranges'],
    queryFn: async () => { const { data } = await supabase.from('rate_ranges').select('class_type, min_ars, max_ars'); return data ?? [] },
  })
  const range: any = ranges.find((r: any) => r.class_type === classType)
  useEffect(() => {
    const budget = classType === 'regular' ? studio?.budget_regular : studio?.budget_replacement
    setOffer(Number(budget) || Number(range?.max_ars) || Number(range?.min_ars) || 0)
  }, [classType, studio?.id, range?.max_ars])

  const toggleDay = (key: string) =>
    setSelectedDays(prev => prev.includes(key) ? prev.filter(d => d !== key) : [...prev, key])

  const from = classType === 'reemplazo' ? startTime : scheduleFrom
  const to   = classType === 'reemplazo' ? endTime   : scheduleTo
  const minutesOf = (d: Date) => d.getHours() * 60 + d.getMinutes()
  const validRange = minutesOf(to) > minutesOf(from)
  const hours = validRange ? Math.floor((minutesOf(to) - minutesOf(from)) / 60) : 0

  // Disponibilidad cargada por el instructor (solo informativa, no bloquea)
  const availability = (instructor?.availability ?? []) as any[]
  const hasAvailability = availability.some(a => a.is_active !== false)
  const daysToCheck = classType === 'reemplazo' ? [DAY_BY_JS_INDEX[classDate.getDay()]] : selectedDays
  const fits = daysToCheck.length > 0 && daysToCheck.every(day =>
    availabilityCovers(availability, day, classType, toHHMM(from), toHHMM(to)))

  const limitReached = canMatch === false
  const problem =
    classType === 'regular' && selectedDays.length === 0 ? 'Elegí al menos un día de la semana' :
    !validRange ? 'La hora de fin tiene que ser posterior a la de inicio' :
    offer < 1000 ? 'Indicá cuánto pagás por clase' : null

  const handleSubmit = async () => {
    if (limitReached) { navigation.navigate('MembershipPaywall'); return }
    if (problem) { showToast(problem, 'warning'); return }
    try {
      const isRegular = classType === 'regular'
      await createMatch.mutateAsync({
        instructor_id: instructorId,
        class_type: classType,
        class_date: toLocalISODate(isRegular ? nextDateForDays(selectedDays) : classDate),
        start_time: toHHMM(from),
        end_time: toHHMM(to),
        note_studio: note.trim() || undefined,
        offered_rate: offer,
        ...(isRegular && {
          schedule_days: DAYS.map(d => d.key).filter(k => selectedDays.includes(k)),
          schedule_from: toHHMM(scheduleFrom),
          schedule_to:   toHHMM(scheduleTo),
        }),
      } as any)
      showToast(
        classType === 'reemplazo'
          ? `Solicitud enviada a ${instructorName}. Vas a ver su respuesta en Historial.`
          : `Propuesta enviada a ${instructorName}. Vas a ver su respuesta en Historial.`
      )
      setTimeout(() => navigation.goBack(), 1800)
    } catch (e: any) {
      if (String(e?.message ?? '').includes('MATCH_LIMIT_REACHED')) navigation.navigate('MembershipPaywall')
      else showToast(humanizeError(e), 'error')
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.cream }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <HeroHeader
        title={classType === 'reemplazo' ? 'Solicitar reemplazo' : 'Proponer clase regular'}
        subtitle={instructorName}
        onBack={() => navigation.goBack()}
        backLabel="Perfil"
      />

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {limitReached && (
          <TouchableOpacity style={s.limitBanner} onPress={() => navigation.navigate('MembershipPaywall')} activeOpacity={0.85}>
            <Feather name="alert-circle" size={16} color={colors.warnTx} />
            <Text style={s.limitTxt}>Ya usaste las propuestas de tu plan este mes. Tocá para ver opciones.</Text>
            <Feather name="chevron-right" size={16} color={colors.warnTx} />
          </TouchableOpacity>
        )}

        {/* Instructor */}
        <BlobCard style={s.card} delay={0}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <Avatar name={instructorName} source={instructor?.avatar_url} size={42} />
            <View style={{ flex: 1 }}>
              <Text style={s.instructorName}>{instructorName}</Text>
              <Text style={s.instructorMeta}>
                {!hasAvailability
                  ? 'No cargó sus horarios'
                  : daysToCheck.length === 0
                    ? 'Elegí días y horario para ver si coincide'
                    : fits ? 'Coincide con los horarios que cargó' : 'Fuera de los horarios que cargó'}
              </Text>
            </View>
            {hasAvailability && daysToCheck.length > 0 && (
              <View style={[s.availBadge, { backgroundColor: fits ? colors.okBg : colors.warnBg }]}>
                <Text style={[s.availTxt, { color: fits ? colors.okTx : colors.warnTx }]}>
                  {fits ? 'Disponible' : 'Consultar'}
                </Text>
              </View>
            )}
          </View>
        </BlobCard>

        {/* Tipo */}
        <BlobCard style={s.card} delay={600}>
          <Text style={s.cardLabel}>TIPO DE SOLICITUD</Text>
          <View style={s.typeRow}>
            {([
              { key: 'reemplazo', icon: 'clock', label: 'Reemplazo', sub: 'Un día puntual' },
              { key: 'regular', icon: 'repeat', label: 'Regular', sub: 'Clases fijas todas las semanas' },
            ] as const).map(t => {
              const active = classType === t.key
              return (
                <TouchableOpacity key={t.key} style={[s.typeBtn, active && s.typeBtnActive]} onPress={() => setClassType(t.key)}>
                  <Feather name={t.icon} size={14} color={active ? colors.white : colors.mid} />
                  <Text style={[s.typeBtnTxt, active && s.typeBtnTxtActive]}>{t.label}</Text>
                  <Text style={[s.typeBtnSub, active && s.typeBtnSubActive]}>{t.sub}</Text>
                </TouchableOpacity>
              )
            })}
          </View>
        </BlobCard>

        {classType === 'reemplazo' ? (
          <>
            <BlobCard style={s.card} delay={1200}>
              <Text style={s.cardLabel}>FECHA DEL REEMPLAZO</Text>
              <PickerField
                value={classDate} mode="date" display={fmtDate(classDate)}
                minimumDate={(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d })()}
                onChange={d => { d.setHours(0, 0, 0, 0); setClassDate(d) }}
              />
            </BlobCard>

            <BlobCard style={s.card} delay={1800}>
              <Text style={s.cardLabel}>HORARIO</Text>
              <View style={s.franjaRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.franjaLbl}>Desde</Text>
                  <PickerField small value={startTime} mode="time" display={toHHMM(startTime)} minuteInterval={30} onChange={setStartTime} />
                </View>
                <View style={s.franjaArrow}><Feather name="arrow-right" size={18} color={colors.sage} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={s.franjaLbl}>Hasta</Text>
                  <PickerField small value={endTime} mode="time" display={toHHMM(endTime)} minuteInterval={30} onChange={setEndTime} />
                </View>
              </View>
              {validRange ? (hours > 0 && (
                <View style={s.clasesInfo}>
                  <Feather name="info" size={13} color={colors.gold} />
                  <Text style={s.clasesInfoTxt}>
                    {hours} clase{hours > 1 ? 's' : ''} de 1 h · de {toHHMM(startTime)} a {toHHMM(endTime)}
                  </Text>
                </View>
              )) : (
                <Text style={s.errorTxt}>La hora de fin tiene que ser posterior a la de inicio</Text>
              )}
            </BlobCard>
          </>
        ) : (
          <>
            <BlobCard style={s.card} delay={1200}>
              <Text style={s.cardLabel}>DÍAS DE LA SEMANA</Text>
              <View style={s.daysRow}>
                {DAYS.map(d => {
                  const active = selectedDays.includes(d.key)
                  return (
                    <TouchableOpacity key={d.key} style={[s.dayBtn, active && s.dayBtnActive]} onPress={() => toggleDay(d.key)}>
                      <Text style={[s.dayTxt, active && s.dayTxtActive]}>{d.label}</Text>
                    </TouchableOpacity>
                  )
                })}
              </View>
            </BlobCard>

            <BlobCard style={s.card} delay={1800}>
              <Text style={s.cardLabel}>FRANJA HORARIA</Text>
              <View style={s.franjaRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.franjaLbl}>De</Text>
                  <PickerField small value={scheduleFrom} mode="time" display={toHHMM(scheduleFrom)} minuteInterval={30} onChange={setScheduleFrom} />
                </View>
                <View style={s.franjaArrow}><Feather name="arrow-right" size={18} color={colors.sage} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={s.franjaLbl}>Hasta</Text>
                  <PickerField small value={scheduleTo} mode="time" display={toHHMM(scheduleTo)} minuteInterval={30} onChange={setScheduleTo} />
                </View>
              </View>
              {validRange ? (hours > 0 && (
                <View style={s.clasesInfo}>
                  <Feather name="info" size={13} color={colors.gold} />
                  <Text style={s.clasesInfoTxt}>
                    {hours} clase{hours > 1 ? 's' : ''} de 1 h por día
                    {selectedDays.length > 0 ? ` · ${hours * selectedDays.length} por semana` : ''}
                  </Text>
                </View>
              )) : (
                <Text style={s.errorTxt}>La hora de fin tiene que ser posterior a la de inicio</Text>
              )}
            </BlobCard>

            <View style={s.trialInfo}>
              <View style={s.trialIcon}>
                <Feather name="user-check" size={18} color={colors.sage} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.trialTitle}>Próximo paso: clase de prueba</Text>
                <Text style={s.trialDesc}>
                  Si {instructorName} acepta, coordinan entre ustedes una clase de prueba antes de confirmar la incorporación.
                </Text>
              </View>
            </View>
          </>
        )}

        {/* Oferta */}
        <BlobCard style={s.card} delay={2000}>
          <Text style={s.cardLabel}>CUÁNTO PAGÁS POR CLASE</Text>
          <View style={s.offerRow}>
            <TouchableOpacity style={s.offerBtn} onPress={() => setOffer(o => Math.max(0, o - 500))} accessibilityLabel="Bajar $500">
              <Feather name="minus" size={18} color={colors.sage} />
            </TouchableOpacity>
            <TextInput
              style={s.offerInput}
              value={offer ? String(offer) : ''}
              onChangeText={v => setOffer(parseInt(v.replace(/\D/g, ''), 10) || 0)}
              keyboardType="number-pad" placeholder="0" placeholderTextColor={colors.light} maxLength={7}
            />
            <TouchableOpacity style={s.offerBtn} onPress={() => setOffer(o => o + 500)} accessibilityLabel="Subir $500">
              <Feather name="plus" size={18} color={colors.sage} />
            </TouchableOpacity>
          </View>
          {range ? (
            <Text style={s.offerHint}>
              Referencia de la red para {classType === 'regular' ? 'clase regular' : 'reemplazo'}: {money(range.min_ars)} – {money(range.max_ars)}
            </Text>
          ) : null}
          <Text style={s.offerNote}>
            Es lo que pagás si {instructorName} acepta. Su tarifa es privada: la compara con tu oferta y puede aceptar, rechazar o proponerte otro monto.
          </Text>
        </BlobCard>

        {/* Nota */}
        <BlobCard style={s.card} delay={2400}>
          <Text style={s.cardLabel}>NOTA PARA EL INSTRUCTOR (OPCIONAL)</Text>
          <TextInput
            style={s.textarea}
            placeholder={classType === 'reemplazo'
              ? 'Ej: Grupo de nivel intermedio, 8 alumnos...'
              : 'Ej: Buscamos a alguien con experiencia en adultos mayores...'}
            placeholderTextColor={colors.light}
            value={note}
            onChangeText={setNote}
            multiline
            numberOfLines={3}
            maxLength={500}
          />
        </BlobCard>

        <View style={s.privacy}>
          <Feather name="info" size={13} color={colors.sageMid} />
          <Text style={s.privacyTxt}>
            {classType === 'reemplazo'
              ? 'El instructor va a ver la fecha, el horario, tu oferta y tu nota. Cada propuesta enviada cuenta para el límite mensual de tu plan.'
              : 'El instructor va a ver los días, el horario, tu oferta por clase y tu nota. Cada propuesta enviada cuenta para el límite mensual de tu plan.'}
          </Text>
        </View>

        <Button
          label={limitReached ? 'Ver mi plan' : classType === 'reemplazo' ? 'Enviar solicitud →' : 'Enviar propuesta →'}
          onPress={handleSubmit}
          isLoading={createMatch.isPending}
          disabled={!limitReached && !!problem}
          fullWidth
          size="lg"
        />
      </ScrollView>
      <Toast visible={toast.visible} message={toast.message} type={toast.type} onHide={hideToast} />
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  content:          { padding: spacing.md, paddingBottom: 48 },

  limitBanner:      { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.warnBg, borderTopLeftRadius: 14, borderTopRightRadius: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 14, padding: spacing.md, marginBottom: spacing.md, borderWidth: 0.5, borderColor: colors.border },
  limitTxt:         { fontFamily: 'Nunito-Bold', fontSize: 12, color: colors.warnTx, flex: 1 },

  instructorName:   { fontFamily: 'Nunito-Bold', fontSize: 15, color: colors.dark },
  instructorMeta:   { fontFamily: 'Nunito-Regular', fontSize: 12, color: colors.mid, marginTop: 2 },
  availBadge:       { borderTopLeftRadius: 8, borderTopRightRadius: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  availTxt:         { fontFamily: 'Nunito-Bold', fontSize: 10 },

  card:             { padding: spacing.md, marginBottom: spacing.md },
  cardLabel:        { ...typography.caption, marginBottom: spacing.md },

  typeRow:          { flexDirection: 'row', gap: spacing.sm },
  typeBtn:          { flex: 1, borderTopLeftRadius: 14, borderTopRightRadius: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 14, padding: spacing.md, alignItems: 'center', gap: 4, backgroundColor: colors.sageLighter, borderWidth: 0.5, borderColor: colors.border },
  typeBtnActive:    { backgroundColor: colors.sage, borderColor: colors.sage },
  typeBtnTxt:       { fontFamily: 'Nunito-Bold', fontSize: 13, color: colors.mid },
  typeBtnTxtActive: { color: colors.white },
  typeBtnSub:       { fontFamily: 'Nunito-Regular', fontSize: 10, color: colors.light, textAlign: 'center' },
  typeBtnSubActive: { color: colors.sageLight },


  daysRow:          { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  dayBtn:           { width: 40, height: 40, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.sageLighter, borderWidth: 0.5, borderColor: colors.border },
  dayBtnActive:     { backgroundColor: colors.sage, borderColor: colors.sage },
  dayTxt:           { fontFamily: 'Nunito-Bold', fontSize: 11, color: colors.mid },
  dayTxtActive:     { color: colors.white },

  franjaRow:        { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  franjaLbl:        { ...typography.caption, marginBottom: 4 },
  franjaArrow:      { marginTop: 28 },
  clasesInfo:       { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.md, backgroundColor: colors.goldLight, borderTopLeftRadius: 8, borderTopRightRadius: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 8, padding: spacing.sm },
  clasesInfoTxt:    { fontFamily: 'Nunito-SemiBold', fontSize: 11, color: colors.gold, flex: 1 },
  errorTxt:         { fontFamily: 'Nunito-SemiBold', fontSize: 12, color: colors.redTx, marginTop: spacing.sm },

  trialInfo:        { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, backgroundColor: colors.sageLight, borderTopLeftRadius: 14, borderTopRightRadius: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 14, padding: spacing.md, marginBottom: spacing.md, borderWidth: 0.5, borderColor: colors.border },
  trialIcon:        { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  trialTitle:       { fontFamily: 'Nunito-Bold', fontSize: 13, color: colors.dark, marginBottom: 4 },
  trialDesc:        { fontFamily: 'Nunito-Regular', fontSize: 12, color: colors.mid, lineHeight: 18 },

  textarea:         { backgroundColor: colors.sageLighter, borderTopLeftRadius: 10, borderTopRightRadius: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 10, padding: spacing.md, fontFamily: 'Nunito-Regular', fontSize: 13, color: colors.dark, minHeight: 72, textAlignVertical: 'top' },

  privacy:          { flexDirection: 'row', alignItems: 'flex-start', gap: 6, backgroundColor: colors.sageLighter, borderTopLeftRadius: 10, borderTopRightRadius: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 10, padding: spacing.md, marginBottom: spacing.md, borderWidth: 0.5, borderColor: colors.border },
  privacyTxt:       { fontFamily: 'Nunito-SemiBold', fontSize: 11, color: colors.mid, flex: 1, lineHeight: 17 },
  offerRow:    { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 4 },
  offerBtn:    { width: 44, height: 48, ...radius.leafSm, backgroundColor: colors.sageLighter, alignItems: 'center', justifyContent: 'center' },
  offerInput:  { flex: 1, minWidth: 0, height: 48, textAlign: 'center', fontFamily: 'Nunito-Bold', fontSize: 22, color: colors.sage, backgroundColor: colors.cream, ...radius.leafSm },
  offerHint:   { fontFamily: 'Nunito-SemiBold', fontSize: 12, color: colors.mid, marginTop: spacing.sm },
  offerNote:   { fontFamily: 'Nunito-Regular', fontSize: 12, color: colors.light, lineHeight: 17, marginTop: 6 },
})
