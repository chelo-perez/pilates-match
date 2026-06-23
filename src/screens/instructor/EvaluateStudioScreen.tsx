// src/screens/instructor/EvaluateStudioScreen.tsx
// El instructor evalúa al estudio después de cada clase aceptada

import React, { useState, useCallback } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, Switch, KeyboardAvoidingView, Platform
} from 'react-native'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase, db } from '../../lib/supabase'
import { useAuthStore } from '../../store'
import {
  Card, Button, Input, LoadingScreen,
  colors, spacing, radius, typography
} from '../../components/ui'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Feather } from '@expo/vector-icons'

type Props = {
  navigation: any
  route: any
}

const CATEGORIES = [
  { key: 'score_payment',      label: 'Puntualidad en el pago' },
  { key: 'score_organization', label: 'Organización y comunicación' },
  { key: 'score_treatment',    label: 'Trato al instructor' },
  { key: 'score_facilities',   label: 'Instalaciones y equipamiento' },
] as const

const ISSUES = [
  { key: 'issue_late_payment',  label: 'Pago tardío o incompleto' },
  { key: 'issue_last_minute',   label: 'Cambio de condiciones de último momento' },
  { key: 'issue_bad_treatment', label: 'Trato inadecuado' },
  { key: 'issue_bad_facilities',label: 'Equipamiento en mal estado' },
] as const

export default function EvaluateStudioScreen({ navigation, route }: Props) {
  const { matchId, studioId, studioName, classDate, classType } = route.params
  const user = useAuthStore(s => s.user)
  const qc   = useQueryClient()

  const [scores, setScores] = useState({
    score_payment:      8,
    score_organization: 8,
    score_treatment:    8,
    score_facilities:   8,
  })
  const [issues, setIssues] = useState({
    issue_late_payment:   false,
    issue_last_minute:    false,
    issue_bad_treatment:  false,
    issue_bad_facilities: false,
  })
  const [comment, setComment] = useState('')

  const average = Object.values(scores).reduce((a, b) => a + b, 0) / 4

  const setScore = useCallback(
    (key: keyof typeof scores, val: number) =>
      setScores(prev => ({ ...prev, [key]: val })),
    []
  )

  const toggleIssue = useCallback(
    (key: keyof typeof issues) =>
      setIssues(prev => ({ ...prev, [key]: !prev[key] })),
    []
  )

  const createMutation = useMutation({
    mutationFn: async () => {
      // Obtener instructor_id del usuario
      const { data: instructor } = await db.instructors()
        .select('id')
        .eq('user_id', user!.id)
        .single()
      if (!instructor) throw new Error('Perfil de instructor no encontrado')

      const { error } = await supabase
        .from('studio_evaluations')
        .insert({
          instructor_id:    instructor.id,
          studio_id:        studioId,
          match_id:         matchId,
          class_type:       classType,
          class_date:       classDate,
          comment:          comment.trim() || null,
          ...scores,
          ...issues,
        })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['instructor-matches-history'] })
      qc.invalidateQueries({ queryKey: ['instructor-matches-pending'] })
      Alert.alert(
        'Evaluación enviada',
        'Gracias por tu feedback. Es anónimo para el estudio pero ayuda a mantener la calidad de la red.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      )
    },
    onError: (e: any) => Alert.alert('Error', e.message),
  })

  const handleSubmit = () => {
    const hasIssue = Object.values(issues).some(Boolean)
    if (hasIssue) {
      Alert.alert(
        'Reportás un problema',
        'Tu reporte quedará visible para la Cámara. ¿Confirmás?',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Confirmar y enviar', onPress: () => createMutation.mutate() },
        ]
      )
    } else {
      createMutation.mutate()
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header del estudio */}
        <Card style={styles.studioCard}>
          <View style={styles.studioRow}>
            <View style={styles.studioAvatar}>
              <Text style={styles.studioLetter}>{studioName?.[0]?.toUpperCase() ?? '?'}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.studioName}>{studioName}</Text>
              <Text style={styles.studioMeta}>
                {classType === 'reemplazo' ? 'Reemplazo' : 'Clase regular'} · {
                  new Date(classDate + 'T00:00:00').toLocaleDateString('es-AR', {
                    day: 'numeric', month: 'long'
                  })
                }
              </Text>
            </View>
          </View>
          <View style={styles.anonBadge}>
            <Feather name="eye-off" size={12} color={colors.sage} />
            <Text style={styles.anonText}>Tu evaluación es anónima para el estudio</Text>
          </View>
        </Card>

        {/* Categorías de puntuación */}
        <Text style={styles.sectionTitle}>Puntaje (1 al 10)</Text>
        <Card style={{ marginBottom: spacing.md }}>
          {CATEGORIES.map(({ key, label }) => (
            <View key={key} style={styles.scoreRow}>
              <Text style={styles.scoreLabel}>{label}</Text>
              <View style={styles.scoreControls}>
                <TouchableOpacity
                  style={styles.scoreBtn}
                  onPress={() => setScore(key, Math.max(1, scores[key] - 1))}
                >
                  <Feather name="minus" size={16} color={colors.sage} />
                </TouchableOpacity>
                <View style={styles.scoreDisplay}>
                  <Text style={styles.scoreNum}>{scores[key]}</Text>
                </View>
                <TouchableOpacity
                  style={styles.scoreBtn}
                  onPress={() => setScore(key, Math.min(10, scores[key] + 1))}
                >
                  <Feather name="plus" size={16} color={colors.sage} />
                </TouchableOpacity>
              </View>
            </View>
          ))}

          <View style={styles.avgRow}>
            <Text style={styles.avgLabel}>Promedio</Text>
            <View style={styles.avgCircle}>
              <Text style={styles.avgNum}>{average.toFixed(1)}</Text>
            </View>
          </View>
        </Card>

        {/* Reportar problema */}
        <Text style={styles.sectionTitle}>¿Hubo algún problema?</Text>
        <Card style={{ marginBottom: spacing.md }}>
          <Text style={styles.issueNote}>
            Los reportes van directo a la Cámara. Usalos solo si corresponde.
          </Text>
          {ISSUES.map(({ key, label }) => (
            <TouchableOpacity
              key={key}
              style={styles.issueRow}
              onPress={() => toggleIssue(key)}
              activeOpacity={0.7}
            >
              <View style={[
                styles.checkbox,
                issues[key] && { backgroundColor: colors.sage, borderColor: colors.sage }
              ]}>
                {issues[key] && <Feather name="check" size={12} color="#fff" />}
              </View>
              <Text style={styles.issueLabel}>{label}</Text>
            </TouchableOpacity>
          ))}
        </Card>

        {/* Comentario */}
        <Text style={styles.sectionTitle}>Comentario (opcional)</Text>
        <Card style={{ marginBottom: spacing.xl }}>
          <Input
            placeholder="Ej: Muy buena organización, el pago fue inmediato."
            value={comment}
            onChangeText={setComment}
            multiline
            numberOfLines={3}
          />
        </Card>

        <Button
          label="Enviar evaluación"
          onPress={handleSubmit}
          isLoading={createMutation.isPending}
          fullWidth
        />
        <TouchableOpacity
          style={styles.skipBtn}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.skipText}>Omitir por ahora</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: colors.cream },
  content:      { padding: spacing.md, paddingBottom: spacing.xxl },
  studioCard:   { marginBottom: spacing.md, padding: spacing.md },
  studioRow:    { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  studioAvatar: { width: 44, height: 44, borderRadius: 8, backgroundColor: colors.sageLight, alignItems: 'center', justifyContent: 'center' },
  studioLetter: { fontFamily: 'Nunito-SemiBold', fontSize: 18, color: colors.sage },
  studioName:   { fontFamily: 'Nunito-SemiBold', fontSize: 15, color: colors.dark },
  studioMeta:   { ...typography.small, color: colors.mid, marginTop: 2 },
  anonBadge:    { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, backgroundColor: colors.sageLight, borderRadius: radius.sm, padding: spacing.sm },
  anonText:     { ...typography.small, color: colors.sage, fontFamily: 'Nunito-SemiBold' },
  sectionTitle: { fontFamily: 'Nunito-SemiBold', fontSize: 11, color: colors.mid, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing.sm },
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
  skipBtn:      { alignItems: 'center', paddingVertical: spacing.lg },
  skipText:     { ...typography.body, color: colors.light },
})
