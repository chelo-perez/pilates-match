// src/screens/instructor/DashboardScreen.tsx
import React from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store'
import { Card, Badge, LoadingScreen, colors, spacing, radius, typography } from '../../components/ui'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Feather } from '@expo/vector-icons'

export default function InstructorDashboardScreen({ navigation }: any) {
  const user = useAuthStore(s => s.user)

  const { data: instructor, isLoading } = useQuery({
    queryKey: ['my-instructor-profile'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('instructors')
        .select('*, certifications(*), specialties:instructor_specialties(*), rates:instructor_rates(*)')
        .eq('user_id', user?.id)
        .single()
      if (error) throw error
      return data
    },
    enabled: !!user?.id,
  })

  const { data: stats } = useQuery({
    queryKey: ['my-instructor-stats'],
    queryFn: async () => {
      const { data } = await supabase.rpc('get_instructor_stats', { p_instructor_id: instructor?.id })
      return data?.[0] ?? null
    },
    enabled: !!instructor?.id,
  })

  const { data: recentEvals = [] } = useQuery({
    queryKey: ['my-recent-evals'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('evaluations')
        .select('*, studio:studios(*)')
        .eq('instructor_id', instructor?.id)
        .order('created_at', { ascending: false })
        .limit(3)
      if (error) throw error
      return data
    },
    enabled: !!instructor?.id,
  })

  if (isLoading) return <LoadingScreen message="Cargando tu perfil..." />

  const isVerified = instructor?.verification_status === 'verified'
  const firstName = instructor?.full_name?.split(' ')?.[0] ?? 'Hola'
  const avgScore = stats?.avg_score ?? instructor?.score ?? 0
  const totalClasses = stats?.total_classes ?? 0
  const uniqueStudios = stats?.unique_studios ?? 0

  return (
    <View style={s.container}>
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

        <View style={s.header}>
          <View>
            <Text style={s.greeting}>Hola, {firstName} 👋</Text>
            <Text style={s.sub}>
              {isVerified ? 'Perfil verificado · CAPIAF' : 'Perfil pendiente de verificación'}
            </Text>
          </View>
          <View style={[s.scoreBadge, { backgroundColor: isVerified ? colors.sage : colors.warnBg }]}>
            <Text style={[s.scoreNum, { color: isVerified ? '#fff' : colors.warnTx }]}>
              {avgScore > 0 ? avgScore.toFixed(1) : '—'}
            </Text>
          </View>
        </View>

        {!isVerified && (
          <View style={s.pendingBanner}>
            <Feather name="clock" size={14} color={colors.warnTx} />
            <Text style={s.pendingText}>Tu perfil está siendo revisado por CAPIAF</Text>
          </View>
        )}

        <View style={s.kpiRow}>
          <View style={s.kpiCard}>
            <Text style={s.kpiNum}>{totalClasses}</Text>
            <Text style={s.kpiLbl}>Clases hechas</Text>
          </View>
          <View style={s.kpiCard}>
            <Text style={s.kpiNum}>{uniqueStudios}</Text>
            <Text style={s.kpiLbl}>Estudios</Text>
          </View>
        </View>

        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>Mis tarifas por hora</Text>
            <TouchableOpacity onPress={() => navigation.navigate('InstructorTarifas')}>
              <Text style={s.editLink}>Editar</Text>
            </TouchableOpacity>
          </View>
          <View style={s.ratesRow}>
            <View style={s.rateCard}>
              <Text style={s.rateLabel}>Estudio Socio</Text>
              <Text style={s.rateVal}>
                {instructor?.rates?.rate_regular
                  ? '$' + instructor.rates.rate_regular.toLocaleString('es-AR')
                  : '$0'}
              </Text>
            </View>
            <View style={s.rateCard}>
              <Text style={s.rateLabel}>Estudio No Socio</Text>
              <Text style={s.rateVal}>
                {instructor?.rates?.rate_replacement
                  ? '$' + instructor.rates.rate_replacement.toLocaleString('es-AR')
                  : '$0'}
              </Text>
            </View>
          </View>
        </View>

        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>Último feedback recibido</Text>
          </View>
          {recentEvals.length === 0 ? (
            <Text style={s.emptyText}>Aún no tenés evaluaciones registradas.</Text>
          ) : (
            recentEvals.map((item: any) => (
              <View key={item.id} style={s.evalRow}>
                <View style={s.evalLeft}>
                  <Text style={s.evalStudio}>{item.studio?.name}</Text>
                  <Text style={s.evalDate}>
                    {new Date(item.class_date).toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })}
                  </Text>
                  {item.comment && <Text style={s.evalComment}>"{item.comment}"</Text>}
                </View>
                <View style={s.evalScore}>
                  <Text style={s.evalScoreNum}>{item.score?.toFixed(1) ?? '—'}</Text>
                </View>
              </View>
            ))
          )}
        </View>

      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  container:    { flex: 1, backgroundColor: colors.cream },
  content:      { padding: spacing.md, paddingBottom: 100, paddingTop: 56 },
  header:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.md },
  greeting:     { fontFamily: 'Nunito-Bold', fontSize: 24, color: colors.dark },
  sub:          { fontFamily: 'Nunito-Regular', fontSize: 12, color: colors.mid, marginTop: 3 },
  scoreBadge:   { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  scoreNum:     { fontFamily: 'Nunito-Bold', fontSize: 18 },
  pendingBanner:{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.warnBg, borderRadius: radius.md, padding: spacing.sm, marginBottom: spacing.md, borderWidth: 0.5, borderColor: colors.warnTx + '40' },
  pendingText:  { fontFamily: 'Nunito-SemiBold', fontSize: 12, color: colors.warnTx },
  kpiRow:       { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  kpiCard:      { flex: 1, backgroundColor: colors.white, borderRadius: radius.md, padding: spacing.md, alignItems: 'center', borderWidth: 0.5, borderColor: colors.borderLight },
  kpiNum:       { fontFamily: 'Nunito-Bold', fontSize: 28, color: colors.dark },
  kpiLbl:       { fontFamily: 'Nunito-Regular', fontSize: 11, color: colors.mid, marginTop: 3 },
  section:      { backgroundColor: colors.white, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md, borderWidth: 0.5, borderColor: colors.borderLight },
  sectionHeader:{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  sectionTitle: { fontFamily: 'Nunito-Bold', fontSize: 14, color: colors.dark },
  editLink:     { fontFamily: 'Nunito-SemiBold', fontSize: 12, color: colors.sage },
  ratesRow:     { flexDirection: 'row', gap: spacing.sm },
  rateCard:     { flex: 1, backgroundColor: colors.sageLighter, borderRadius: radius.sm, padding: spacing.md },
  rateLabel:    { fontFamily: 'Nunito-Regular', fontSize: 11, color: colors.mid },
  rateVal:      { fontFamily: 'Nunito-Bold', fontSize: 20, color: colors.sage, marginTop: 4 },
  evalRow:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: spacing.sm, borderBottomWidth: 0.5, borderColor: colors.borderLight },
  evalLeft:     { flex: 1, marginRight: spacing.sm },
  evalStudio:   { fontFamily: 'Nunito-SemiBold', fontSize: 13, color: colors.dark },
  evalDate:     { fontFamily: 'Nunito-Regular', fontSize: 11, color: colors.mid, marginTop: 2 },
  evalComment:  { fontFamily: 'Nunito-Regular', fontSize: 11, color: colors.mid, fontStyle: 'italic', marginTop: 4 },
  evalScore:    { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.sageLight, alignItems: 'center', justifyContent: 'center' },
  evalScoreNum: { fontFamily: 'Nunito-Bold', fontSize: 14, color: colors.sage },
  emptyText:    { fontFamily: 'Nunito-Regular', fontSize: 13, color: colors.light, paddingVertical: spacing.sm },
})
