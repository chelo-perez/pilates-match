import React, { useState } from 'react'
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native'
import { useEvaluationHistory, useMyStudio } from '../../hooks'
import { Avatar, ScoreDisplay, EmptyState, LoadingScreen, colors, spacing } from '../../components/ui'
import HeroHeader from '../../components/HeroHeader'
import BlobCard from '../../components/BlobCard'
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
      <HeroHeader
        title="Historial"
        subtitle="Evaluaciones de instructores"
        onBack={() => navigation.goBack()}
        backLabel="Inicio"
        bottomElement={
          <View style={s.tabs}>
            {(['todos', 'regular', 'reemplazo'] as const).map(f => (
              <TouchableOpacity
                key={f}
                style={[s.tab, filter === f && s.tabActive]}
                onPress={() => setFilter(f)}
              >
                <Text style={[s.tabTxt, filter === f && s.tabTxtActive]}>
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        }
      />

      <FlatList
        data={filtered}
        keyExtractor={(item: any) => item.id}
        contentContainerStyle={{ padding: spacing.md, paddingBottom: 40 }}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        ListEmptyComponent={
          <EmptyState title="Sin evaluaciones" subtitle="Aún no hay evaluaciones registradas para este filtro." />
        }
        renderItem={({ item, index }: any) => (
          <BlobCard
            style={s.card}
            delay={index * 800}
            onPress={() => navigation.navigate('InstructorProfile', { instructorId: item.instructor_id })}
          >
            <View style={s.cardTop}>
              <Avatar name={item.instructor?.full_name ?? '?'} size={38} />
              <View style={{ flex: 1, marginLeft: spacing.sm }}>
                <Text style={s.name}>{item.instructor?.full_name}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: 3 }}>
                  <View style={[s.typePill, { backgroundColor: item.class_type === 'regular' ? colors.sageLight : colors.goldLight }]}>
                    <Text style={[s.typeTxt, { color: item.class_type === 'regular' ? colors.sage : colors.gold }]}>
                      {item.class_type === 'regular' ? 'Regular' : 'Reemplazo'}
                    </Text>
                  </View>
                  <Text style={s.date}>{item.class_date}</Text>
                </View>
              </View>
              <ScoreDisplay score={item.average_score} size="sm" />
            </View>
            {item.comment && (
              <Text style={s.comment} numberOfLines={2}>"{item.comment}"</Text>
            )}
            <View style={s.breakdown}>
              {[
                { label: 'Técnica', val: item.score_technique },
                { label: 'Puntualidad', val: item.score_punctuality },
                { label: 'Trato', val: item.score_student_care },
                { label: 'Presentación', val: item.score_presentation },
              ].map(c => (
                <View key={c.label} style={s.breakdownItem}>
                  <Text style={s.breakdownLbl}>{c.label}</Text>
                  <Text style={s.breakdownVal}>{c.val}</Text>
                </View>
              ))}
            </View>
          </BlobCard>
        )}
      />
    </View>
  )
}

const s = StyleSheet.create({
  tabs:          { flexDirection: 'row', gap: 6, marginTop: 12 },
  tab:           { paddingVertical: 5, paddingHorizontal: 14, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.15)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.3)' },
  tabActive:     { backgroundColor: '#fff' },
  tabTxt:        { fontFamily: 'Nunito-SemiBold', fontSize: 12, color: 'rgba(255,255,255,0.7)' },
  tabTxtActive:  { color: colors.sage, fontFamily: 'Nunito-Bold' },

  card:          { padding: spacing.md },
  cardTop:       { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  name:          { fontFamily: 'Nunito-Bold', fontSize: 14, color: colors.dark },
  typePill:      { borderTopLeftRadius: 8, borderTopRightRadius: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
  typeTxt:       { fontFamily: 'Nunito-Bold', fontSize: 9 },
  date:          { fontFamily: 'Nunito-Regular', fontSize: 11, color: colors.light },
  comment:       { fontFamily: 'Nunito-Regular', fontSize: 11, color: colors.mid, lineHeight: 17, marginBottom: spacing.sm, fontStyle: 'italic' },
  breakdown:     { flexDirection: 'row', gap: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 0.5, borderColor: colors.borderLight },
  breakdownItem: { flex: 1, alignItems: 'center' },
  breakdownLbl:  { fontFamily: 'Nunito-Regular', fontSize: 9, color: colors.light },
  breakdownVal:  { fontFamily: 'Nunito-Bold', fontSize: 14, color: colors.dark },
})
