// src/screens/studio/PendingEvaluationsScreen.tsx
// Lista de evaluaciones pendientes con countdown — bloquea propuestas hasta completar

import React from 'react'
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useFocusEffect } from '@react-navigation/native'
import { supabase } from '../../lib/supabase'
import { useMyStudio } from '../../hooks'
import { Card, LoadingScreen, EmptyState, colors, spacing, radius, typography } from '../../components/ui'
import { Feather } from '@expo/vector-icons'

function getHoursLeft(classDate: string): number {
  const deadline = new Date(classDate + 'T00:00:00')
  deadline.setHours(deadline.getHours() + 48)
  return Math.max(0, Math.round((deadline.getTime() - Date.now()) / 3_600_000))
}

export default function PendingEvaluationsScreen({ navigation }: any) {
  const qc = useQueryClient()
  const { data: studio } = useMyStudio()
  const studioId = studio?.id

  const { data: pending = [], isLoading, refetch } = useQuery({
    queryKey: ['pending-evaluations-full', studioId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('matches')
        .select('*, instructor:instructors(id, full_name, avatar_url, neighborhood)')
        .eq('studio_id', studioId!)
        .eq('status', 'aceptado')
        .lt('class_date', new Date().toISOString().split('T')[0])
        .order('class_date', { ascending: true })

      if (error) throw error

      // Filtrar los que ya tienen evaluación
      const { data: evaluated } = await supabase
        .from('evaluations')
        .select('instructor_id, class_date')
        .eq('studio_id', studioId!)

      const evalSet = new Set(
        (evaluated ?? []).map((e: any) => `${e.instructor_id}_${e.class_date}`)
      )

      return (data ?? []).filter(
        (m: any) => !evalSet.has(`${m.instructor_id}_${m.class_date}`)
      )
    },
    enabled: !!studioId,
  })

  useFocusEffect(React.useCallback(() => {
    refetch()
    qc.invalidateQueries({ queryKey: ['can-propose'] })
  }, [studioId]))

  if (isLoading) return <LoadingScreen message="Cargando evaluaciones..." />

  return (
    <View style={styles.container}>
      {/* Banner de estado */}
      <View style={styles.banner}>
        <Feather name="lock" size={18} color="#B8960C" />
        <Text style={styles.bannerText}>
          {pending.length > 0
            ? `Evaluá para desbloquear el envío de propuestas`
            : 'Todas las evaluaciones completadas'}
        </Text>
      </View>

      <FlatList
        data={pending}
        keyExtractor={(item: any) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <EmptyState
            icon="check-circle"
            title="Todo al día"
            subtitle="No tenés evaluaciones pendientes. Podés enviar nuevas propuestas."
            action="Buscar instructor"
            onAction={() => navigation.navigate('Search')}
          />
        }
        renderItem={({ item: match }: any) => {
          const hoursLeft = getHoursLeft(match.class_date)
          const isUrgent  = hoursLeft < 6
          const instructor = match.instructor

          return (
            <Card style={styles.card}>
              {/* Info match */}
              <View style={styles.row}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarLetter}>
                    {instructor?.full_name?.[0]?.toUpperCase() ?? '?'}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.instrName}>{instructor?.full_name}</Text>
                  <Text style={styles.instrMeta}>
                    {match.class_type === 'reemplazo' ? 'Reemplazo' : 'Regular'} · {
                      new Date(match.class_date + 'T00:00:00').toLocaleDateString('es-AR', {
                        weekday: 'short', day: 'numeric', month: 'short'
                      })
                    }
                  </Text>
                </View>
                {/* Countdown */}
                <View style={[styles.countdown, isUrgent && styles.countdownUrgent]}>
                  <Feather
                    name={isUrgent ? 'alert-triangle' : 'clock'}
                    size={11}
                    color={isUrgent ? '#854F0B' : colors.mid}
                  />
                  <Text style={[styles.countdownText, isUrgent && styles.countdownTextUrgent]}>
                    {hoursLeft}hs
                  </Text>
                </View>
              </View>

              <View style={styles.divider} />

              {/* Horario */}
              <View style={styles.timeRow}>
                <Feather name="clock" size={12} color={colors.sage} />
                <Text style={styles.timeText}>
                  {match.start_time?.slice(0, 5)} – {match.end_time?.slice(0, 5)} hs
                </Text>
              </View>

              {/* CTA */}
              <TouchableOpacity
                style={styles.evalBtn}
                onPress={() => navigation.navigate('EvaluateInstructor', {
                  instructorId: match.instructor_id,
                  classDate:    match.class_date,
                  classType:    match.class_type,
                })}
                activeOpacity={0.85}
              >
                <Text style={styles.evalBtnText}>Evaluar a {instructor?.full_name?.split(' ')[0]}</Text>
                <Feather name="arrow-right" size={14} color={colors.white} />
              </TouchableOpacity>
            </Card>
          )
        }}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container:            { flex: 1, backgroundColor: colors.cream },
  banner:               { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: '#FFF6E0', padding: spacing.md, borderBottomWidth: 0.5, borderColor: '#EF9F27' },
  bannerText:           { fontFamily: 'Nunito-SemiBold', fontSize: 13, color: '#633806', flex: 1 },
  list:                 { padding: spacing.md, paddingBottom: spacing.xxl },
  card:                 { marginBottom: spacing.sm, padding: spacing.md },
  row:                  { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  avatar:               { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.sageLight, alignItems: 'center', justifyContent: 'center', borderWidth: 0.5, borderColor: colors.border },
  avatarLetter:         { fontFamily: 'Nunito-SemiBold', fontSize: 17, color: colors.sage },
  instrName:            { fontFamily: 'Nunito-SemiBold', fontSize: 14, color: colors.dark },
  instrMeta:            { ...typography.small, color: colors.mid, marginTop: 2 },
  countdown:            { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: colors.sageLight, borderTopLeftRadius: 8, borderTopRightRadius: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 8, paddingHorizontal: spacing.sm, paddingVertical: 4 },
  countdownUrgent:      { backgroundColor: '#FAEEDA' },
  countdownText:        { fontFamily: 'Nunito-SemiBold', fontSize: 11, color: colors.mid },
  countdownTextUrgent:  { color: '#854F0B' },
  divider:              { height: 0.5, backgroundColor: colors.borderLight, marginBottom: spacing.sm },
  timeRow:              { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.md },
  timeText:             { ...typography.small, color: colors.dark, fontSize: 13 },
  evalBtn:              { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, backgroundColor: colors.sage, borderTopLeftRadius: 14, borderTopRightRadius: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 14, paddingVertical: spacing.sm + 2 },
  evalBtnText:          { fontFamily: 'Nunito-SemiBold', fontSize: 14, color: colors.white },
})
