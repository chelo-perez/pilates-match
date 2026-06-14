// src/screens/studio/EvaluateInstructorScreen.tsx
import React, { useState, useCallback } from 'react'
import {
  View, Text, ScrollView, StyleSheet, Alert, KeyboardAvoidingView, Platform
} from 'react-native'
import { useInstructor, useCreateEvaluation } from '../../hooks'
import {
  Card, Avatar, Badge, ScoreSlider, Button, Input,
  colors, spacing, radius, typography
} from '../../components/ui'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { Feather } from '@expo/vector-icons'

type Props = NativeStackScreenProps<any, 'EvaluateInstructor'>

export default function EvaluateInstructorScreen({ navigation, route }: Props) {
  const { instructorId, classDate, classType } = route.params
  const { data: instructor, isLoading } = useInstructor(instructorId)
  const createEval = useCreateEvaluation()

  const [scores, setScores] = useState({
    technique: 8,
    punctuality: 8,
    studentCare: 8,
    presentation: 8,
  })
  const [comment, setComment] = useState('')
  const average = Object.values(scores).reduce((a, b) => a + b, 0) / 4

  const setScore = useCallback((key: keyof typeof scores) => (value: number) => {
    setScores(prev => ({ ...prev, [key]: value }))
  }, [])

  const handleSubmit = async () => {
    try {
      await createEval.mutateAsync({
        instructor_id: instructorId,
        class_type: classType,
        class_date: classDate,
        scores,
        comment
      })
      Alert.alert('Calificación guardada', 'Muchas gracias por evaluar al instructor. Ayuda a mantener transparente la comunidad.', [
        { text: 'Aceptar', onPress: () => navigation.popToTop() }
      ])
    } catch (e: any) {
      Alert.alert('Error', 'No pudimos registrar tu evaluación en este momento. Volvé a intentarlo.')
    }
  }

  if (isLoading) return <View style={styles.loadingCenter}><ActivityIndicator color="#4A5D4E" /></View>

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        
        {/* Cabecera Estilo Estudio */}
        <Text style={styles.mainTitle}>Evaluar Instructor</Text>

        <Card style={styles.instructorCard}>
          <Avatar src={instructor?.avatar_url} fallback={instructor?.full_name?.[0] || 'I'} size="md" />
          <View style={{ flex: 1, marginLeft: spacing.md }}>
            <Text style={styles.instructorName}>{instructor?.full_name}</Text>
            <Text style={styles.instructorMeta}>
              {classType === 'regular' ? 'Clase Regular' : 'Reemplazo'} • {new Date(classDate).toLocaleDateString('es-AR')}
            </Text>
          </View>
          <Badge label="Pendiente" variant="warning" />
        </Card>

        {/* Sliders de Criterios Corporativos */}
        <Card style={styles.criteriaCard}>
          <Text style={styles.sectionTitle}>Criterios de Excelencia</Text>
          
          <ScoreSlider label="Técnica y pedagogía de Pilates" value={scores.technique} onValueChange={setScore('technique')} min={1} max={10} step={1} />
          <ScoreSlider label="Puntualidad y manejo del tiempo" value={scores.punctuality} onValueChange={setScore('punctuality')} min={1} max={10} step={1} />
          <ScoreSlider label="Trato y cuidado del alumno" value={scores.studentCare} onValueChange={setScore('studentCare')} min={1} max={10} step={1} />
          <ScoreSlider label="Presencia y cumplimiento de normas" value={scores.presentation} onValueChange={setScore('presentation')} min={1} max={10} step={1} />
        </Card>

        {/* Promedio General */}
        <Card style={styles.averageCard}>
          <Text style={styles.averageLabel}>PUNTUACIÓN PROMEDIO</Text>
          <Text style={styles.averageScore}>{average.toFixed(1)}</Text>
        </Card>

        {/* Comentarios */}
        <Card style={styles.criteriaCard}>
          <Text style={[styles.sectionTitle, { marginBottom: spacing.xs }]}>Comentarios adicionales</Text>
          <Input
            placeholder="Dejá una nota constructiva sobre el desempeño del instructor en la clase..."
            value={comment}
            onChangeText={setComment}
            multiline
            numberOfLines={4}
          />
        </Card>

        <Button
          label="Guardar evaluación"
          onPress={handleSubmit}
          isLoading={createEval.isPending}
          fullWidth
          size="lg"
          style={{ marginTop: spacing.md, backgroundColor: '#4A5D4E' }}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream || '#F9F9F6' },
  content: { padding: spacing.lg, paddingTop: 50, paddingBottom: spacing.xxxl },
  mainTitle: { fontFamily: 'Playfair_Display-Medium', fontSize: 26, color: colors.dark || '#333', marginBottom: spacing.lg },
  instructorCard: { flexDirection: 'row', alignItems: 'center', padding: spacing.lg, marginBottom: spacing.md, backgroundColor: colors.white || '#FFF' },
  instructorName: { fontFamily: 'DM_Sans-SemiBold', fontSize: 16, color: colors.dark || '#333' },
  instructorMeta: { ...typography.small, color: colors.mid || '#666', marginTop: 2 },
  criteriaCard: { padding: spacing.lg, marginBottom: spacing.md, backgroundColor: colors.white || '#FFF' },
  sectionTitle: { ...typography.label, color: colors.dark || '#333', marginBottom: spacing.lg },
  averageCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.lg, marginBottom: spacing.md, backgroundColor: '#EAEFEA' },
  averageLabel: { fontFamily: 'DM_Sans-Medium', fontSize: 13, color: '#4A5D4E', letterSpacing: 0.5 },
  averageScore: { fontFamily: 'DM_Sans-SemiBold', fontSize: 30, color: '#4A5D4E' },
  loadingCenter: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.cream || '#F9F9F6' }
})