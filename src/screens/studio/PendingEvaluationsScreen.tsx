// src/screens/studio/PendingEvaluationsScreen.tsx
// Clases ya dictadas que el estudio todavía no evaluó
import React from 'react'
import { View, Text, StyleSheet, FlatList } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { useMyStudio } from '../../hooks'
import { formatDate } from '../../lib/dates'
import { Avatar, Button, EmptyState, ErrorState, LoadingScreen, colors, spacing, typography } from '../../components/ui'
import BlobCard from '../../components/BlobCard'
import HeroHeader from '../../components/HeroHeader'
import { Feather } from '@expo/vector-icons'
import { usePendingEvaluationMatches } from './studioQueries'

export default function PendingEvaluationsScreen({ navigation }: any) {
  const { data: studio } = useMyStudio()
  const { data: pending = [], isLoading, isError, refetch, isRefetching } = usePendingEvaluationMatches(studio?.id)

  useFocusEffect(React.useCallback(() => { if (studio?.id) refetch() }, [studio?.id, refetch]))

  if (isLoading) return <LoadingScreen message="Cargando evaluaciones..." />

  return (
    <View style={styles.container}>
      <HeroHeader
        title="Evaluaciones pendientes"
        subtitle={pending.length > 0
          ? 'Contá cómo te fue: ayuda a otros estudios a elegir'
          : 'Todo al día'}
        bottomElement={pending.length > 0 ? (
          <View style={styles.pendingBadge}>
            <Text style={styles.pendingBadgeTxt}>{pending.length} pendiente{pending.length > 1 ? 's' : ''}</Text>
          </View>
        ) : null}
      />

      {isError ? (
        <ErrorState message="No pudimos cargar tus clases para evaluar." onRetry={refetch} />
      ) : (
        <FlatList
          data={pending}
          keyExtractor={(item: any) => item.id}
          contentContainerStyle={styles.list}
          refreshing={isRefetching}
          onRefresh={refetch}
          ListEmptyComponent={
            <EmptyState
              icon="check-circle"
              title="Todo al día"
              message="No tenés clases para evaluar. Cuando un instructor dé una clase en tu estudio, la vas a poder evaluar acá."
              action="Buscar instructor"
              onAction={() => navigation.navigate('Search')}
            />
          }
          renderItem={({ item: match, index }: any) => {
            const instructor = match.instructor
            return (
              <BlobCard style={styles.card} delay={index * 600}>
                <View style={styles.row}>
                  <Avatar name={instructor?.full_name ?? '?'} source={instructor?.avatar_url} size={44} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.instrName}>{instructor?.full_name ?? 'Instructor'}</Text>
                    <Text style={styles.instrMeta}>
                      {match.class_type === 'reemplazo' ? 'Reemplazo' : 'Regular'} · {formatDate(match.class_date)}
                    </Text>
                  </View>
                </View>

                <View style={styles.divider} />

                <View style={styles.timeRow}>
                  <Feather name="clock" size={12} color={colors.sage} />
                  <Text style={styles.timeText}>
                    {String(match.start_time ?? '').slice(0, 5)} – {String(match.end_time ?? '').slice(0, 5)} h
                  </Text>
                </View>

                <Button
                  label={`Evaluar a ${instructor?.full_name?.split(' ')[0] ?? 'instructor'} →`}
                  onPress={() => navigation.navigate('EvaluateInstructor', {
                    matchId:      match.id,
                    instructorId: match.instructor_id,
                    classDate:    match.class_date,
                    classType:    match.class_type,
                  })}
                  fullWidth
                />
              </BlobCard>
            )
          }}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: colors.cream },
  pendingBadge:     { marginTop: 10, alignSelf: 'flex-start', backgroundColor: colors.warnBg, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  pendingBadgeTxt:  { fontFamily: 'Nunito-Bold', fontSize: 11, color: colors.warnTx },
  list:             { padding: spacing.md, paddingBottom: spacing.xxl },
  card:             { marginBottom: spacing.sm, padding: spacing.md },
  row:              { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  instrName:        { fontFamily: 'Nunito-Bold', fontSize: 14, color: colors.dark },
  instrMeta:        { ...typography.small, color: colors.mid, marginTop: 2 },
  divider:          { height: 0.5, backgroundColor: colors.borderLight, marginBottom: spacing.sm },
  timeRow:          { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.md },
  timeText:         { fontFamily: 'Nunito-SemiBold', fontSize: 13, color: colors.dark },
})
