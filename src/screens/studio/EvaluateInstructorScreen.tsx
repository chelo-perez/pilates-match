// src/screens/studio/EvaluateInstructorScreen.tsx
// El estudio evalúa al instructor después de una clase. Mismo formato que la evaluación del estudio:
// puntajes con − / +, promedio en vivo y reportes de problemas que van solo a la entidad.
import React, { useState, useCallback } from 'react'
import { View, Text, ScrollView, StyleSheet, Alert, KeyboardAvoidingView, Platform, TouchableOpacity } from 'react-native'
import { useInstructor, useCreateEvaluation, useMyStudio } from '../../hooks'
import { useEvaluated } from '../../lib/matchFlow'
import { supabase } from '../../lib/supabase'
import { Avatar, Button, Card, Input, LoadingScreen, colors, spacing, radius, typography } from '../../components/ui'
import { formatDate } from '../../lib/dates'
import { humanizeError } from '../../lib/errors'
import { entity } from '../../lib/entity'
import HeroHeader from '../../components/HeroHeader'
import Toast from '../../components/Toast'
import { useToast } from '../../hooks/useToast'
import { Feather } from '@expo/vector-icons'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'

type Props = NativeStackScreenProps<any, 'EvaluateInstructor'>

const CATEGORIES = [
  { key: 'technique',    label: 'Técnica' },
  { key: 'punctuality',  label: 'Puntualidad' },
  { key: 'studentCare',  label: 'Trato con los alumnos' },
  { key: 'presentation', label: 'Presentación' },
] as const

const ISSUES = [
  { key: 'issue_no_show',       label: 'No se presentó' },
  { key: 'issue_late',          label: 'Llegó tarde' },
  { key: 'issue_bad_treatment', label: 'Trato inadecuado con alumnos' },
  { key: 'issue_last_minute',   label: 'Canceló a último momento' },
] as const

type ScoreKey = typeof CATEGORIES[number]['key']
type IssueKey = typeof ISSUES[number]['key']

export default function EvaluateInstructorScreen({ navigation, route }: Props) {
  const { toast, showToast, hideToast } = useToast()
  const { instructorId, classDate, classType } = (route.params || {}) as any
  const { data: instructor, isLoading } = useInstructor(instructorId)
  const createEval = useCreateEvaluation()
  const { data: studio } = useMyStudio()
  // Si esta clase ya se evaluó, no se vuelve a mostrar el formulario
  const alreadyQ = useEvaluated(
    studio?.id && instructorId && classDate
      ? { id: `${instructorId}_${classDate}`, studio_id: studio.id, instructor_id: instructorId, class_date: classDate }
      : null,
    'estudio',
  )

  const [scores, setScores] = useState<Record<ScoreKey, number>>({ technique: 8, punctuality: 8, studentCare: 8, presentation: 8 })
  const [issues, setIssues] = useState<Record<IssueKey, boolean>>({
    issue_no_show: false, issue_late: false, issue_bad_treatment: false, issue_last_minute: false,
  })
  const [comment, setComment] = useState('')
  const [saving, setSaving] = useState(false)
  const average = (scores.technique + scores.punctuality + scores.studentCare + scores.presentation) / 4

  const setScore = useCallback((key: ScoreKey, val: number) => setScores(prev => ({ ...prev, [key]: val })), [])
  const toggleIssue = useCallback((key: IssueKey) => setIssues(prev => ({ ...prev, [key]: !prev[key] })), [])

  const save = async () => {
    setSaving(true)
    try {
      const evaluation = await createEval.mutateAsync({
        instructor_id: instructorId,
        class_type: classType,
        class_date: classDate,
        score_technique: scores.technique,
        score_punctuality: scores.punctuality,
        score_student_care: scores.studentCare,
        score_presentation: scores.presentation,
        comment: comment.trim() || null,
      } as any)
      if (Object.values(issues).some(Boolean)) {
        const { error } = await supabase.from('evaluation_issues').insert({
          evaluation_id: (evaluation as any).id,
          studio_id: (evaluation as any).studio_id,
          instructor_id: instructorId,
          class_date: classDate,
          ...issues,
        })
        if (error) {
          Alert.alert('Guardamos la evaluación', `Pero no pudimos enviar el reporte ${entity().a}. Avisales por otro medio.`, [
            { text: 'Listo', onPress: () => navigation.goBack() },
          ])
          return
        }
      }
      Alert.alert('¡Gracias!', 'Guardamos tu evaluación. Ayuda a que otros estudios elijan mejor.', [
        { text: 'Listo', onPress: () => navigation.goBack() },
      ])
    } catch (e: any) {
      if (e?.code === '23505') {
        Alert.alert('Ya evaluaste esta clase', 'Cada clase se evalúa una sola vez.', [
          { text: 'Volver', onPress: () => navigation.goBack() },
        ])
        return
      }
      showToast(humanizeError(e), 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleSubmit = () => {
    if (Object.values(issues).some(Boolean)) {
      Alert.alert('Reportás un problema', `Tu reporte va ${entity().a}. El instructor no lo ve. ¿Confirmás?`, [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Confirmar y enviar', onPress: save },
      ])
    } else {
      save()
    }
  }

  if (isLoading || (alreadyQ.isFetching && alreadyQ.data === undefined)) return <LoadingScreen />

  if (alreadyQ.data != null) {
    return (
      <View style={styles.container}>
        <HeroHeader title="Ya evaluaste esta clase" onBack={() => navigation.goBack()} />
        <View style={{ padding: spacing.lg, alignItems: 'center' }}>
          <Text style={styles.doneTitle}>
            Puntaje que le diste: {alreadyQ.data.toLocaleString('es-AR', { maximumFractionDigits: 1 })}/10
          </Text>
          <Text style={styles.doneSub}>Cada clase se evalúa una sola vez.</Text>
          <Button label="Volver" onPress={() => navigation.goBack()} style={{ marginTop: spacing.lg }} />
        </View>
      </View>
    )
  }

  const name = instructor?.full_name ?? 'Instructor'

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <HeroHeader title="Evaluar instructor" subtitle={name} onBack={() => navigation.goBack()} backLabel="Volver" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        {/* Quién y qué clase */}
        <Card style={styles.headCard}>
          <View style={styles.headRow}>
            <Avatar name={name} source={instructor?.avatar_url} size={44} />
            <View style={{ flex: 1 }}>
              <Text style={styles.headName}>{name}</Text>
              <Text style={styles.headMeta}>
                {classType === 'regular' ? 'Clase regular' : 'Reemplazo'}
                {classDate ? ` · ${formatDate(classDate, { day: 'numeric', month: 'long' })}` : ''}
              </Text>
            </View>
          </View>
          <View style={styles.infoBadge}>
            <Feather name="eye-off" size={12} color={colors.sage} />
            <Text style={styles.infoText}>El instructor la ve cuando te evalúe o a los 7 días</Text>
          </View>
        </Card>

        {/* Puntajes */}
        <Text style={styles.sectionTitle}>PUNTAJE (1 AL 10)</Text>
        <Card style={{ marginBottom: spacing.md }}>
          {CATEGORIES.map(({ key, label }) => (
            <View key={key} style={styles.scoreRow}>
              <Text style={styles.scoreLabel}>{label}</Text>
              <View style={styles.scoreControls}>
                <TouchableOpacity style={styles.scoreBtn} onPress={() => setScore(key, Math.max(1, scores[key] - 1))} accessibilityLabel={`Bajar ${label}`}>
                  <Feather name="minus" size={16} color={colors.sage} />
                </TouchableOpacity>
                <View style={styles.scoreDisplay}><Text style={styles.scoreNum}>{scores[key]}</Text></View>
                <TouchableOpacity style={styles.scoreBtn} onPress={() => setScore(key, Math.min(10, scores[key] + 1))} accessibilityLabel={`Subir ${label}`}>
                  <Feather name="plus" size={16} color={colors.sage} />
                </TouchableOpacity>
              </View>
            </View>
          ))}
          <View style={styles.avgRow}>
            <Text style={styles.avgLabel}>Promedio</Text>
            <View style={styles.avgCircle}><Text style={styles.avgNum}>{average.toFixed(1)}</Text></View>
          </View>
        </Card>

        {/* Problemas: van solo a la entidad */}
        <Text style={styles.sectionTitle}>¿HUBO ALGÚN PROBLEMA?</Text>
        <Card style={{ marginBottom: spacing.md }}>
          <Text style={styles.issueNote}>Los reportes van directo {entity().a} y el instructor no los ve. Usalos solo si corresponde.</Text>
          {ISSUES.map(({ key, label }) => (
            <TouchableOpacity key={key} style={styles.issueRow} onPress={() => toggleIssue(key)} activeOpacity={0.7}>
              <View style={[styles.checkbox, issues[key] && { backgroundColor: colors.sage, borderColor: colors.sage }]}>
                {issues[key] && <Feather name="check" size={12} color={colors.white} />}
              </View>
              <Text style={styles.issueLabel}>{label}</Text>
            </TouchableOpacity>
          ))}
        </Card>

        {/* Comentario */}
        <Text style={styles.sectionTitle}>COMENTARIO (OPCIONAL)</Text>
        <Card style={{ marginBottom: spacing.xl }}>
          <Input
            placeholder="Ej: Muy buena con los alumnos, llegó antes para preparar los reformers."
            value={comment}
            onChangeText={setComment}
            multiline
            numberOfLines={3}
          />
        </Card>

        <Button label="Enviar evaluación" onPress={handleSubmit} isLoading={saving} fullWidth />
        <Button label="Evaluar más tarde" variant="ghost" onPress={() => navigation.goBack()} fullWidth style={{ marginTop: spacing.sm }} />
      </ScrollView>
      <Toast visible={toast.visible} message={toast.message} type={toast.type} onHide={hideToast} />
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: colors.cream },
  content:      { padding: spacing.md, paddingBottom: spacing.xxl },
  headCard:     { marginBottom: spacing.md, padding: spacing.md },
  headRow:      { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  headName:     { fontFamily: 'Nunito-SemiBold', fontSize: 15, color: colors.dark },
  headMeta:     { ...typography.small, color: colors.mid, marginTop: 2 },
  infoBadge:    { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, backgroundColor: colors.sageLight, borderRadius: radius.sm, padding: spacing.sm },
  infoText:     { ...typography.small, color: colors.sage, fontFamily: 'Nunito-SemiBold' },
  sectionTitle: { ...typography.caption, marginBottom: spacing.sm },
  scoreRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.sm, borderBottomWidth: 0.5, borderColor: colors.borderLight },
  scoreLabel:   { ...typography.body, color: colors.dark, flex: 1, fontSize: 13 },
  scoreControls:{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  scoreBtn:     { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.sageLight, alignItems: 'center', justifyContent: 'center' },
  scoreDisplay: { width: 36, alignItems: 'center' },
  scoreNum:     { fontFamily: 'Nunito-SemiBold', fontSize: 18, color: colors.sage },
  avgRow:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: spacing.md, marginTop: spacing.xs },
  avgLabel:     { fontFamily: 'Nunito-SemiBold', fontSize: 13, color: colors.mid },
  avgCircle:    { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.sageLight, alignItems: 'center', justifyContent: 'center' },
  avgNum:       { fontFamily: 'Nunito-SemiBold', fontSize: 18, color: colors.sage },
  issueNote:    { ...typography.small, color: colors.mid, marginBottom: spacing.sm, lineHeight: 18 },
  issueRow:     { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm, borderBottomWidth: 0.5, borderColor: colors.borderLight },
  checkbox:     { width: 20, height: 20, borderRadius: 4, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  issueLabel:   { ...typography.body, color: colors.dark, flex: 1, fontSize: 13 },
  doneTitle:    { fontFamily: 'Nunito-Bold', fontSize: 15, color: colors.dark },
  doneSub:      { ...typography.small, color: colors.mid, textAlign: 'center', marginTop: spacing.sm },
})
