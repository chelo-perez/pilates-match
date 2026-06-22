// src/screens/studio/RequestMatchScreen.tsx
import React, { useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView, Alert, KeyboardAvoidingView, Platform
} from 'react-native'
import DateTimePicker from '@react-native-community/datetimepicker'
import { useCreateMatch, useMyStudio } from '../../hooks'
import {
  Card, Avatar, Badge, Button, Input, colors, spacing, radius, typography
} from '../../components/ui'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'

type Props = NativeStackScreenProps<any, 'RequestMatch'>

export default function RequestMatchScreen({ navigation, route }: Props) {
  const { instructorId, instructorName } = (route.params || {}) as any
  const { data: studio } = useMyStudio()
  const createMatch = useCreateMatch()

  const [classType, setClassType] = useState<'regular' | 'reemplazo'>('reemplazo')
  const [classDate, setClassDate] = useState(new Date())
  const [startTime, setStartTime] = useState(new Date())
  const [note, setNote] = useState('')
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [showTimePicker, setShowTimePicker] = useState(false)

  const formatDate = (d: Date) => d.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })
  const formatTime = (d: Date) => d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })

  const endTime = new Date(startTime.getTime() + 60 * 60 * 1000) // +1 hora

  const handleSubmit = async () => {
    try {
      await createMatch.mutateAsync({
        instructor_id: instructorId,
        class_type: classType,
        class_date: classDate.toISOString().split('T')[0],
        start_time: formatTime(startTime),
        end_time: formatTime(endTime),
        note_studio: note.trim() || undefined,
      })
      Alert.alert(
        '¡Solicitud enviada!',
        `Se notificó a ${instructorName}. Te avisamos cuando responda.`,
        [{ text: 'Ok', onPress: () => navigation.goBack() }]
      )
    } catch (e: any) {
      if (e.message === 'MATCH_LIMIT_REACHED') {
        navigation.navigate('MembershipPaywall')
      } else {
        Alert.alert('Error', e.message)
      }
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>

        {/* Instructor seleccionado */}
        <Card style={styles.instructorCard}>
          <Avatar name={instructorName} size={40} color={colors.sageMid} />
          <View style={{ flex: 1, marginLeft: spacing.md }}>
            <Text style={styles.instructorName}>{instructorName}</Text>
            <Text style={styles.instructorMeta}>Disponible para este horario</Text>
          </View>
          <Badge label="Disponible" color="success" />
        </Card>

        {/* Tipo de cobertura */}
        <Card style={styles.card}>
          <Text style={styles.cardLabel}>TIPO DE COBERTURA</Text>
          <View style={styles.typeRow}>
            {(['regular', 'reemplazo'] as const).map(t => (
              <Button key={t} label={t === 'regular' ? 'Clase regular' : 'Reemplazo'}
                variant={classType === t ? 'primary' : 'ghost'}
                onPress={() => setClassType(t)}
                style={{ flex: 1 }}
              />
            ))}
          </View>
        </Card>

        {/* Fecha */}
        <Card style={styles.card}>
          <Text style={styles.cardLabel}>FECHA DE LA CLASE</Text>
          <Button
            label={formatDate(classDate)}
            variant="secondary"
            onPress={() => setShowDatePicker(true)}
            fullWidth
          />
          {showDatePicker && (
            <DateTimePicker
              value={classDate} mode="date" display="spinner"
              minimumDate={new Date()}
              onChange={(_, date) => { setShowDatePicker(false); if (date) setClassDate(date) }}
            />
          )}
        </Card>

        {/* Horario */}
        <Card style={styles.card}>
          <Text style={styles.cardLabel}>HORARIO</Text>
          <Button
            label={`${formatTime(startTime)} – ${formatTime(endTime)}`}
            variant="secondary"
            onPress={() => setShowTimePicker(true)}
            fullWidth
          />
          {showTimePicker && (
            <DateTimePicker
              value={startTime} mode="time" display="spinner" minuteInterval={30}
              onChange={(_, time) => { setShowTimePicker(false); if (time) setStartTime(time) }}
            />
          )}
        </Card>

        {/* Nota */}
        <Card style={styles.card}>
          <Input
            label="NOTA PARA EL INSTRUCTOR (OPCIONAL)"
            placeholder="Ej: Grupo de nivel intermedio, 8 alumnos, traé música..."
            value={note}
            onChangeText={setNote}
            multiline
          />
        </Card>

        {/* Info privacidad tarifas */}
        <View style={styles.privacyNote}>
          <Text style={{ fontSize: 14, marginRight: spacing.sm }}>🔒</Text>
          <Text style={styles.privacyText}>
            Al confirmar, ambas partes verán las tarifas acordadas. El instructor recibirá una notificación push.
          </Text>
        </View>

        <Button
          label="Enviar solicitud →"
          onPress={handleSubmit}
          isLoading={createMatch.isPending}
          fullWidth size="lg"
          style={{ marginTop: spacing.md }}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  instructorCard: { flexDirection: 'row', alignItems: 'center', padding: spacing.lg, marginBottom: spacing.md, backgroundColor: colors.white },
  instructorName: { fontFamily: 'Nunito-SemiBold', fontSize: 15, color: colors.dark },
  instructorMeta: { ...typography.small, color: colors.mid, marginTop: 2 },
  card: { padding: spacing.lg, marginBottom: spacing.md, backgroundColor: colors.white },
  cardLabel: { ...typography.label, color: colors.mid, marginBottom: spacing.sm },
  typeRow: { flexDirection: 'row', gap: spacing.sm },
  privacyNote: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: colors.sageLight, borderRadius: radius.md,
    padding: spacing.md, marginTop: spacing.md,
  },
  privacyText: { ...typography.small, color: colors.mid, flex: 1, lineHeight: 18 },
})
