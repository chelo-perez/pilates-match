// src/screens/studio/RequestMatchScreen.tsx
import React, { useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  KeyboardAvoidingView, Platform, TextInput
} from 'react-native'
import DateTimePicker from '@react-native-community/datetimepicker'
import { useCreateMatch, useMyStudio } from '../../hooks'
import { Avatar, Button, colors, spacing } from '../../components/ui'
import { Feather } from '@expo/vector-icons'
import BlobCard from '../../components/BlobCard'
import HeroHeader from '../../components/HeroHeader'
import Toast from '../../components/Toast'
import { useToast } from '../../hooks/useToast'
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

export default function RequestMatchScreen({ navigation, route }: Props) {
  const { instructorId, instructorName } = (route.params || {}) as any
  const { data: studio } = useMyStudio()
  const createMatch = useCreateMatch()
  const { toast, showToast, hideToast } = useToast()

  const [classType, setClassType] = useState<'regular' | 'reemplazo'>('reemplazo')

  // ── Reemplazo ──
  const [classDate, setClassDate]   = useState(new Date())
  const [startTime, setStartTime]   = useState(new Date())
  const [endTime, setEndTime]       = useState(() => { const d = new Date(); d.setHours(d.getHours() + 3); return d })
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [showTimePicker, setShowTimePicker] = useState(false)
  const [showEndTimePicker, setShowEndTimePicker] = useState(false)

  // ── Regular ──
  const [selectedDays, setSelectedDays] = useState<string[]>([])
  const [scheduleFrom, setScheduleFrom] = useState(new Date())
  const [scheduleTo,   setScheduleTo]   = useState(() => {
    const d = new Date(); d.setHours(d.getHours() + 4); return d
  })
  const [showFromPicker, setShowFromPicker] = useState(false)
  const [showToPicker,   setShowToPicker]   = useState(false)

  const [note, setNote] = useState('')

  const fmtDate = (d: Date) => d.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })
  const fmtTime = (d: Date) => d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
  const toggleDay = (key: string) =>
    setSelectedDays(prev => prev.includes(key) ? prev.filter(d => d !== key) : [...prev, key])

  const canSubmit = classType === 'reemplazo'
    ? true
    : selectedDays.length > 0

  const handleSubmit = async () => {
    if (!canSubmit) { showToast('Seleccioná al menos un día'); return }
    try {
      await createMatch.mutateAsync({
        instructor_id: instructorId,
        class_type: classType,
        class_date: classDate.toISOString().split('T')[0],
        start_time: fmtTime(startTime),
        end_time: classType === 'reemplazo' ? fmtTime(endTime) : fmtTime(endTime),
        note_studio: note.trim() || undefined,
        ...(classType === 'regular' && {
          schedule_days: selectedDays,
          schedule_from: fmtTime(scheduleFrom),
          schedule_to:   fmtTime(scheduleTo),
        }),
      })
      showToast(
        classType === 'reemplazo'
          ? `Solicitud enviada a ${instructorName}. Te avisamos cuando responda.`
          : `Propuesta enviada a ${instructorName}. Coordinará una clase de prueba con vos.`
      )
      setTimeout(() => navigation.goBack(), 1800)
    } catch (e: any) {
      if (e.message === 'MATCH_LIMIT_REACHED') navigation.navigate('MembershipPaywall')
      else showToast('Error: ' + e.message)
    }
  }

  const clasesReemplazo = () => {
    const diff = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60)
    return diff > 0 ? Math.floor(diff) : 0
  }

  const clasesEnFranja = () => {
    const diff = (scheduleTo.getTime() - scheduleFrom.getTime()) / (1000 * 60 * 60)
    return diff > 0 ? Math.floor(diff) : 0
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <HeroHeader
        title={classType === 'reemplazo' ? 'Solicitar reemplazo' : 'Proponer clase regular'}
        subtitle={instructorName}
        onBack={() => navigation.goBack()}
        backLabel="Resultados"
      />

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

        {/* Instructor */}
        <BlobCard style={s.instructorCard} delay={0}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <Avatar name={instructorName} size={42} />
            <View style={{ flex: 1 }}>
              <Text style={s.instructorName}>{instructorName}</Text>
              <Text style={s.instructorMeta}>Disponible para este horario</Text>
            </View>
            <View style={s.availBadge}><Text style={s.availTxt}>Disponible</Text></View>
          </View>
        </BlobCard>

        {/* Tipo */}
        <BlobCard style={s.card} delay={600}>
          <Text style={s.cardLabel}>TIPO DE SOLICITUD</Text>
          <View style={s.typeRow}>
            <TouchableOpacity
              style={[s.typeBtn, classType === 'reemplazo' && s.typeBtnActive]}
              onPress={() => setClassType('reemplazo')}
            >
              <Feather name="clock" size={14} color={classType === 'reemplazo' ? '#fff' : colors.mid} />
              <Text style={[s.typeBtnTxt, classType === 'reemplazo' && s.typeBtnTxtActive]}>Reemplazo</Text>
              <Text style={[s.typeBtnSub, classType === 'reemplazo' && { color: 'rgba(255,255,255,0.65)' }]}>
                1–2 días puntuales
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.typeBtn, classType === 'regular' && s.typeBtnActive]}
              onPress={() => setClassType('regular')}
            >
              <Feather name="repeat" size={14} color={classType === 'regular' ? '#fff' : colors.mid} />
              <Text style={[s.typeBtnTxt, classType === 'regular' && s.typeBtnTxtActive]}>Regular</Text>
              <Text style={[s.typeBtnSub, classType === 'regular' && { color: 'rgba(255,255,255,0.65)' }]}>
                Incorporación fija
              </Text>
            </TouchableOpacity>
          </View>
        </BlobCard>

        {/* ── REEMPLAZO ── */}
        {classType === 'reemplazo' && (
          <>
            <BlobCard style={s.card} delay={1200}>
              <Text style={s.cardLabel}>FECHA DEL REEMPLAZO</Text>
              <TouchableOpacity style={s.pickerBtn} onPress={() => setShowDatePicker(true)}>
                <Feather name="calendar" size={15} color={colors.sage} />
                <Text style={s.pickerTxt}>{fmtDate(classDate)}</Text>
              </TouchableOpacity>
              {showDatePicker && (
                <DateTimePicker
                  value={classDate} mode="date" display="spinner" minimumDate={new Date()}
                  onChange={(_, d) => { setShowDatePicker(false); if (d) setClassDate(d) }}
                />
              )}
            </BlobCard>

            <BlobCard style={s.card} delay={1800} blobColor="rgba(184,150,12,0.10)" blobColor2="rgba(184,150,12,0.06)">
              <Text style={s.cardLabel}>BLOQUE HORARIO</Text>
              <View style={s.franjaRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.franjaLbl}>Desde</Text>
                  <TouchableOpacity style={s.pickerBtnSm} onPress={() => setShowTimePicker(true)}>
                    <Text style={s.pickerTxtSm}>{fmtTime(startTime)}</Text>
                  </TouchableOpacity>
                  {showTimePicker && (
                    <DateTimePicker
                      value={startTime} mode="time" display="spinner" minuteInterval={30}
                      onChange={(_, t) => { setShowTimePicker(false); if (t) setStartTime(t) }}
                    />
                  )}
                </View>
                <View style={s.franjaArrow}>
                  <Feather name="arrow-right" size={18} color={colors.sage} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.franjaLbl}>Hasta</Text>
                  <TouchableOpacity style={s.pickerBtnSm} onPress={() => setShowEndTimePicker(true)}>
                    <Text style={s.pickerTxtSm}>{fmtTime(endTime)}</Text>
                  </TouchableOpacity>
                  {showEndTimePicker && (
                    <DateTimePicker
                      value={endTime} mode="time" display="spinner" minuteInterval={30}
                      onChange={(_, t) => { setShowEndTimePicker(false); if (t) setEndTime(t) }}
                    />
                  )}
                </View>
              </View>
              {clasesReemplazo() > 0 && (
                <View style={s.clasesInfo}>
                  <Feather name="info" size={13} color={colors.gold} />
                  <Text style={s.clasesInfoTxt}>
                    {clasesReemplazo()} clase{clasesReemplazo() > 1 ? 's' : ''} de 1h · {fmtTime(startTime)} a {fmtTime(endTime)}
                  </Text>
                </View>
              )}
            </BlobCard>
          </>
        )}

        {/* ── REGULAR ── */}
        {classType === 'regular' && (
          <>
            <BlobCard style={s.card} delay={1200}>
              <Text style={s.cardLabel}>DÍAS DE LA SEMANA</Text>
              <View style={s.daysRow}>
                {DAYS.map(d => (
                  <TouchableOpacity
                    key={d.key}
                    style={[s.dayBtn, selectedDays.includes(d.key) && s.dayBtnActive]}
                    onPress={() => toggleDay(d.key)}
                  >
                    <Text style={[s.dayTxt, selectedDays.includes(d.key) && s.dayTxtActive]}>
                      {d.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </BlobCard>

            <BlobCard style={s.card} delay={1800} blobColor="rgba(184,150,12,0.14)" blobColor2="rgba(184,150,12,0.08)">
              <Text style={s.cardLabel}>FRANJA HORARIA</Text>
              <View style={s.franjaRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.franjaLbl}>De</Text>
                  <TouchableOpacity style={s.pickerBtnSm} onPress={() => setShowFromPicker(true)}>
                    <Text style={s.pickerTxtSm}>{fmtTime(scheduleFrom)}</Text>
                  </TouchableOpacity>
                  {showFromPicker && (
                    <DateTimePicker
                      value={scheduleFrom} mode="time" display="spinner" minuteInterval={60}
                      onChange={(_, t) => { setShowFromPicker(false); if (t) setScheduleFrom(t) }}
                    />
                  )}
                </View>
                <View style={s.franjaArrow}>
                  <Feather name="arrow-right" size={18} color={colors.sage} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.franjaLbl}>Hasta</Text>
                  <TouchableOpacity style={s.pickerBtnSm} onPress={() => setShowToPicker(true)}>
                    <Text style={s.pickerTxtSm}>{fmtTime(scheduleTo)}</Text>
                  </TouchableOpacity>
                  {showToPicker && (
                    <DateTimePicker
                      value={scheduleTo} mode="time" display="spinner" minuteInterval={60}
                      onChange={(_, t) => { setShowToPicker(false); if (t) setScheduleTo(t) }}
                    />
                  )}
                </View>
              </View>
              {clasesEnFranja() > 0 && (
                <View style={s.clasesInfo}>
                  <Feather name="info" size={13} color={colors.gold} />
                  <Text style={s.clasesInfoTxt}>
                    {clasesEnFranja()} clase{clasesEnFranja() > 1 ? 's' : ''} de 1h por día
                    {selectedDays.length > 0 ? ` · ${clasesEnFranja() * selectedDays.length} clases semanales` : ''}
                  </Text>
                </View>
              )}
            </BlobCard>

            {/* Info clase de prueba */}
            <View style={s.trialInfo}>
              <View style={s.trialIcon}>
                <Feather name="user-check" size={18} color={colors.sage} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.trialTitle}>Próximo paso: clase de prueba</Text>
                <Text style={s.trialDesc}>
                  Si {instructorName} acepta la propuesta, coordinarán juntos la fecha y hora de una clase de prueba presencial antes de confirmar la incorporación.
                </Text>
              </View>
            </View>
          </>
        )}

        {/* Nota */}
        <BlobCard style={s.card} delay={2400}>
          <Text style={s.cardLabel}>NOTA PARA EL INSTRUCTOR (OPCIONAL)</Text>
          <TextInput
            style={s.textarea}
            placeholder={classType === 'reemplazo'
              ? 'Ej: Grupo de nivel intermedio, 8 alumnos, traé música...'
              : 'Ej: Buscamos instructor con experiencia en adultos mayores...'}
            placeholderTextColor={colors.light}
            value={note}
            onChangeText={setNote}
            multiline
            numberOfLines={3}
          />
        </BlobCard>

        {/* Privacidad */}
        <View style={s.privacy}>
          <Feather name="lock" size={13} color={colors.sageMid} />
          <Text style={s.privacyTxt}>
            {classType === 'reemplazo'
              ? 'Al confirmar, ambas partes verán las tarifas acordadas.'
              : 'La propuesta no compromete ningún pago hasta que se confirme la incorporación.'
            }
          </Text>
        </View>

        <TouchableOpacity
          style={[s.submitBtn, !canSubmit && { opacity: 0.5 }]}
          onPress={handleSubmit}
          disabled={!canSubmit || createMatch.isPending}
          activeOpacity={0.85}
        >
          <Text style={s.submitTxt}>
            {createMatch.isPending
              ? 'Enviando...'
              : classType === 'reemplazo'
                ? 'Enviar solicitud →'
                : 'Enviar propuesta →'
            }
          </Text>
        </TouchableOpacity>

      </ScrollView>
      <Toast visible={toast.visible} message={toast.message} type={toast.type} onHide={hideToast} />
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  content:          { padding: spacing.md, paddingBottom: 48 },

  instructorCard:   { padding: spacing.md, marginBottom: spacing.md },
  instructorName:   { fontFamily: 'Nunito-Bold', fontSize: 15, color: colors.dark },
  instructorMeta:   { fontFamily: 'Nunito-Regular', fontSize: 12, color: colors.mid, marginTop: 2 },
  availBadge:       { backgroundColor: colors.okBg, borderTopLeftRadius: 8, borderTopRightRadius: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  availTxt:         { fontFamily: 'Nunito-Bold', fontSize: 10, color: colors.okTx },

  card:             { padding: spacing.md, marginBottom: spacing.md },
  cardLabel:        { fontFamily: 'Nunito-Bold', fontSize: 9, color: colors.light, letterSpacing: 0.8, marginBottom: spacing.md },

  typeRow:          { flexDirection: 'row', gap: spacing.sm },
  typeBtn:          { flex: 1, borderTopLeftRadius: 14, borderTopRightRadius: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 14, padding: spacing.md, alignItems: 'center', gap: 4, backgroundColor: colors.sageLighter, borderWidth: 0.5, borderColor: colors.border },
  typeBtnActive:    { backgroundColor: colors.sage, borderColor: colors.sage },
  typeBtnTxt:       { fontFamily: 'Nunito-Bold', fontSize: 13, color: colors.mid },
  typeBtnTxtActive: { color: '#fff' },
  typeBtnSub:       { fontFamily: 'Nunito-Regular', fontSize: 10, color: colors.light, textAlign: 'center' },

  pickerBtn:        { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.sageLighter, borderTopLeftRadius: 14, borderTopRightRadius: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 14, padding: spacing.md },
  pickerTxt:        { fontFamily: 'Nunito-SemiBold', fontSize: 14, color: colors.dark, flex: 1 },

  daysRow:          { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  dayBtn:           { width: 40, height: 40, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.sageLighter, borderWidth: 0.5, borderColor: colors.border },
  dayBtnActive:     { backgroundColor: colors.sage, borderColor: colors.sage },
  dayTxt:           { fontFamily: 'Nunito-Bold', fontSize: 11, color: colors.mid },
  dayTxtActive:     { color: '#fff' },

  franjaRow:        { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  franjaLbl:        { fontFamily: 'Nunito-Bold', fontSize: 9, color: colors.light, letterSpacing: 0.6, marginBottom: 4 },
  franjaArrow:      { marginTop: 20 },
  pickerBtnSm:      { backgroundColor: colors.goldLight, borderTopLeftRadius: 10, borderTopRightRadius: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 10, padding: 10, alignItems: 'center' },
  pickerTxtSm:      { fontFamily: 'Nunito-Bold', fontSize: 16, color: colors.gold },
  clasesInfo:       { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.md, backgroundColor: colors.goldLight, borderTopLeftRadius: 8, borderTopRightRadius: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 8, padding: spacing.sm },
  clasesInfoTxt:    { fontFamily: 'Nunito-SemiBold', fontSize: 11, color: colors.gold, flex: 1 },

  trialInfo:        { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, backgroundColor: colors.sageLight, borderTopLeftRadius: 14, borderTopRightRadius: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 14, padding: spacing.md, marginBottom: spacing.md, borderWidth: 0.5, borderColor: colors.border },
  trialIcon:        { width: 36, height: 36, borderRadius: 18, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  trialTitle:       { fontFamily: 'Nunito-Bold', fontSize: 13, color: colors.dark, marginBottom: 4 },
  trialDesc:        { fontFamily: 'Nunito-Regular', fontSize: 12, color: colors.mid, lineHeight: 18 },

  textarea:         { backgroundColor: colors.sageLighter, borderTopLeftRadius: 10, borderTopRightRadius: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 10, padding: spacing.md, fontFamily: 'Nunito-Regular', fontSize: 13, color: colors.dark, minHeight: 72, textAlignVertical: 'top' },

  privacy:          { flexDirection: 'row', alignItems: 'flex-start', gap: 6, backgroundColor: colors.sageLighter, borderTopLeftRadius: 10, borderTopRightRadius: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 10, padding: spacing.md, marginBottom: spacing.md, borderWidth: 0.5, borderColor: colors.border },
  privacyTxt:       { fontFamily: 'Nunito-SemiBold', fontSize: 11, color: colors.mid, flex: 1, lineHeight: 17 },

  submitBtn:        { backgroundColor: colors.sage, borderTopLeftRadius: 14, borderTopRightRadius: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 14, padding: 16, alignItems: 'center' },
  submitTxt:        { fontFamily: 'Nunito-Bold', fontSize: 15, color: '#fff' },
})
