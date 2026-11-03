// src/screens/studio/EvaluateInstructorScreen.tsx
import React, { useState, useCallback } from 'react'
import { View, Text, ScrollView, StyleSheet, Alert, KeyboardAvoidingView, Platform, TouchableOpacity } from 'react-native'
import { useInstructor, useCreateEvaluation } from '../../hooks'
import { Avatar, Button, Input, LoadingScreen, colors, spacing, typography } from '../../components/ui'
import { formatDate } from '../../lib/dates'
import { humanizeError } from '../../lib/errors'
import BlobCard from '../../components/BlobCard'
import HeroHeader from '../../components/HeroHeader'
import Toast from '../../components/Toast'
import { useToast } from '../../hooks/useToast'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'

function ScoreRow({ label, hint, value, onValueChange }: {
  label: string; hint: string; value: number; onValueChange: (n: number) => void
}) {
  const steps = Array.from({ length: 10 }, (_, i) => i + 1)
  return (
    <View style={styles.scoreBlock}>
      <View style={styles.scoreHeader}>
        <Text style={styles.scoreLabel}>{label}</Text>
        <Text style={styles.scoreValue}>{value}/10</Text>
      </View>
      <Text style={styles.scoreHint}>{hint}</Text>
      <View style={styles.stepsRow}>
        {steps.map(n => (
          <TouchableOpacity
            key={n}
            onPress={() => onValueChange(n)}
            style={[styles.step, n <= value && styles.stepActive]}
            accessibilityLabel={`${label}: ${n}`}
          >
            <Text style={[styles.stepTxt, n <= value && styles.stepTxtActive]}>{n}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  )
}

type Props = NativeStackScreenProps<any, 'EvaluateInstructor'>

const CRITERIA = [
  { key: 'technique',    label: 'Técnica',      hint: 'Dominio del método y de los aparatos' },
  { key: 'punctuality',  label: 'Puntualidad',  hint: 'Llegó a horario y respetó los tiempos de la clase' },
  { key: 'studentCare',  label: 'Trato con los alumnos', hint: 'Atención, correcciones y cuidado' },
  { key: 'presentation', label: 'Presentación', hint: 'Imagen y cumplimiento de las normas del estudio' },
] as const

export default function EvaluateInstructorScreen({ navigation, route }: Props) {
  const { toast, showToast, hideToast } = useToast()
  const { instructorId, classDate, classType } = (route.params || {}) as any
  const { data: instructor, isLoading } = useInstructor(instructorId)
  const createEval = useCreateEvaluation()

  const [scores, setScores] = useState({ technique: 8, punctuality: 8, studentCare: 8, presentation: 8 })
  const [comment, setComment] = useState('')
  const average = (scores.technique + scores.punctuality + scores.studentCare + scores.presentation) / 4

  const setScore = useCallback((key: keyof typeof scores) => (value: number) => {
    setScores(prev => ({ ...prev, [key]: value }))
  }, [])

  const handleSubmit = async () => {
    try {
      await createEval.mutateAsync({
        instructor_id: instructorId,
        class_type: classType,
        class_date: classDate,
        score_technique: scores.technique,
        score_punctuality: scores.punctuality,
        score_student_care: scores.studentCare,
        score_presentation: scores.presentation,
        comment: comment.trim() || null,
      } as any)
      Alert.alert('¡Gracias!', 'Guardamos tu evaluación. Ayuda a que otros estudios elijan mejor.', [
        { text: 'Listo', onPress: () => navigation.goBack() },
      ])
    } catch (e: any) {
      showToast(humanizeError(e), 'error')
    }
  }

  if (isLoading) return <LoadingScreen />

  const name = instructor?.full_name ?? 'Instructor'

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <HeroHeader
        title="Evaluar instructor"
        subtitle={name}
        onBack={() => navigation.goBack()}
        backLabel="Pendientes"
      />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        <BlobCard style={styles.card} delay={0}>
          <View style={styles.instructorRow}>
            <Avatar name={name} source={instructor?.avatar_url} size={44} />
            <View style={{ flex: 1, marginLeft: spacing.md }}>
              <Text style={styles.instructorName}>{name}</Text>
              <Text style={styles.instructorMeta}>
                {classType === 'regular' ? 'Clase regular' : 'Reemplazo'}{classDate ? ` · ${formatDate(classDate)}` : ''}
              </Text>
            </View>
          </View>
        </BlobCard>

        <BlobCard style={styles.card} delay={600}>
          <Text style={styles.sectionTitle}>¿CÓMO FUE LA CLASE?</Text>
          {CRITERIA.map(c => (
            <ScoreRow key={c.key} label={c.label} hint={c.hint} value={scores[c.key]} onValueChange={setScore(c.key)} />
          ))}
        </BlobCard>

        <View style={styles.averageCard}>
          <Text style={styles.averageLabel}>PROMEDIO</Text>
          <Text style={styles.averageScore}>{average.toFixed(1)}</Text>
        </View>

        <BlobCard style={styles.card} delay={1200}>
          <Text style={styles.sectionTitle}>COMENTARIO (OPCIONAL)</Text>
          <Input
            placeholder="Contá algo que le sirva a otros estudios o al instructor..."
            value={comment}
            onChangeText={setComment}
            multiline
            numberOfLines={4}
          />
        </BlobCard>

        <Button
          label="Guardar evaluación"
          onPress={handleSubmit}
          isLoading={createEval.isPending}
          fullWidth
          size="lg"
        />
      </ScrollView>
      <Toast visible={toast.visible} message={toast.message} type={toast.type} onHide={hideToast} />
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: colors.cream },
  content:        { padding: spacing.md, paddingBottom: spacing.xxl },
  card:           { padding: spacing.md, marginBottom: spacing.md },
  instructorRow:  { flexDirection: 'row', alignItems: 'center' },
  instructorName: { fontFamily: 'Nunito-Bold', fontSize: 15, color: colors.dark },
  instructorMeta: { fontFamily: 'Nunito-Regular', fontSize: 12, color: colors.mid, marginTop: 2 },
  sectionTitle:   { ...typography.caption, marginBottom: spacing.md },

  scoreBlock:     { marginBottom: spacing.md },
  scoreHeader:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  scoreLabel:     { fontFamily: 'Nunito-Bold', fontSize: 13, color: colors.dark },
  scoreValue:     { fontFamily: 'Nunito-Bold', fontSize: 13, color: colors.sage },
  scoreHint:      { fontFamily: 'Nunito-Regular', fontSize: 11, color: colors.light, marginTop: 1 },
  stepsRow:       { flexDirection: 'row', gap: 4, marginTop: spacing.sm },
  step:           { flex: 1, height: 32, borderRadius: 6, backgroundColor: colors.borderLight, alignItems: 'center', justifyContent: 'center' },
  stepActive:     { backgroundColor: colors.sage },
  stepTxt:        { fontFamily: 'Nunito-Bold', fontSize: 11, color: colors.light },
  stepTxtActive:  { color: colors.white },

  averageCard:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.md, marginBottom: spacing.md, backgroundColor: colors.sageLight, borderTopLeftRadius: 14, borderTopRightRadius: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 14 },
  averageLabel:   { ...typography.caption, color: colors.sage },
  averageScore:   { fontFamily: 'Nunito-Bold', fontSize: 30, color: colors.sage },
})
