// src/screens/studio/HistoryScreen.tsx
import React, { useState } from 'react'
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native'
import { useEvaluationHistory, useMyStudio } from '../../hooks'
import { Card, Avatar, Badge, ScoreDisplay, EmptyState, LoadingScreen, colors, spacing, typography } from '../../components/ui'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'

type Props = NativeStackScreenProps<any, 'HistoryList'>

export default function HistoryScreen({ navigation }: Props) {
  const { data: studio } = useMyStudio()
  const { data: history = [], isLoading } = useEvaluationHistory(studio?.id)
  const [filter, setFilter] = useState<'todos' | 'regular' | 'reemplazo'>('todos')

  const filtered = filter === 'todos' ? history : history.filter((e: any) => e.class_type === filter)

  if (isLoading) return <LoadingScreen />

  return (
    <View style={{ flex: 1, backgroundColor: colors.cream }}>
      {/* Filter tabs */}
      <View style={styles.filterRow}>
        {(['todos', 'regular', 'reemplazo'] as const).map(f => (
          <TouchableOpacity key={f} style={[styles.filterChip, filter === f && styles.filterChipActive]}
            onPress={() => setFilter(f)}>
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item: any) => item.id}
        contentContainerStyle={{ padding: spacing.lg }}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        ListEmptyComponent={
          <EmptyState
            title="Sin evaluaciones"
            subtitle="Aún no hay evaluaciones registradas para este filtro."
          />
        }
        renderItem={({ item }: any) => (
          <Card style={styles.card}
            onPress={() => navigation.navigate('InstructorProfile', { instructorId: item.instructor_id })}>
            <View style={styles.cardTop}>
              <Avatar name={item.instructor?.full_name ?? '?'} size={36} color={colors.sageMid} />
              <View style={{ flex: 1, marginLeft: spacing.sm }}>
                <Text style={styles.name}>{item.instructor?.full_name}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: 3 }}>
                  <Badge label={item.class_type === 'regular' ? 'Regular' : 'Reemplazo'}
                    color={item.class_type === 'regular' ? 'sage' : 'blush'} />
                  <Text style={styles.date}>{item.class_date}</Text>
                </View>
              </View>
              <ScoreDisplay score={item.average_score} size="sm" />
            </View>
            {item.comment && (
              <Text style={styles.comment} numberOfLines={2}>{item.comment}</Text>
            )}
            {/* Mini breakdown */}
            <View style={styles.breakdown}>
              {[
                { label: 'Téc', val: item.score_technique },
                { label: 'Pun', val: item.score_punctuality },
                { label: 'Tra', val: item.score_student_care },
                { label: 'Pre', val: item.score_presentation },
              ].map(c => (
                <View key={c.label} style={styles.breakdownItem}>
                  <Text style={styles.breakdownLabel}>{c.label}</Text>
                  <Text style={styles.breakdownVal}>{c.val}</Text>
                </View>
              ))}
            </View>
          </Card>
        )}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  filterRow: { flexDirection: 'row', gap: spacing.sm, padding: spacing.lg, paddingTop: 52, paddingBottom: spacing.sm },
  filterChip: { paddingVertical: 6, paddingHorizontal: 14, borderRadius: 999, backgroundColor: colors.white, borderWidth: 0.5, borderColor: colors.border },
  filterChipActive: { backgroundColor: colors.sage, borderColor: colors.sage },
  filterText: { ...typography.small, color: colors.mid },
  filterTextActive: { color: colors.white, fontFamily: 'Nunito-SemiBold' },
  card: { padding: spacing.md, backgroundColor: colors.white },
  cardTop: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  name: { fontFamily: 'Nunito-SemiBold', fontSize: 14, color: colors.dark },
  date: { ...typography.small, color: colors.light },
  comment: { ...typography.small, color: colors.mid, lineHeight: 18, marginBottom: spacing.sm, fontStyle: 'italic' },
  breakdown: { flexDirection: 'row', gap: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 0.5, borderColor: colors.borderLight },
  breakdownItem: { flex: 1, alignItems: 'center' },
  breakdownLabel: { ...typography.small, color: colors.light, fontSize: 10 },
  breakdownVal: { fontFamily: 'Nunito-SemiBold', fontSize: 14, color: colors.dark },
})
