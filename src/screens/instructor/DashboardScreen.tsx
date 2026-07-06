// src/screens/instructor/DashboardScreen.tsx
import React from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store'
import { LoadingScreen, colors, spacing, radius } from '../../components/ui'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Feather } from '@expo/vector-icons'
import BlobCard from '../../components/BlobCard'
import HeroHeader from '../../components/HeroHeader'

export default function InstructorDashboardScreen({ navigation }: any) {
  const user   = useAuthStore(s => s.user)
  const insets = useSafeAreaInsets()

  const { data: instructor, isLoading, refetch } = useQuery({
    queryKey: ['my-instructor-profile'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('instructors')
        .select('*, certifications(*), specialties:instructor_specialties(*), rates:instructor_rates(*)')
        .eq('user_id', user?.id).single()
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
        .from('evaluations').select('*, studio:studios(*)')
        .eq('instructor_id', instructor?.id)
        .order('created_at', { ascending: false }).limit(3)
      if (error) throw error
      return data
    },
    enabled: !!instructor?.id,
  })

  if (isLoading) return <LoadingScreen message="Cargando tu perfil..." />

  const isVerified    = instructor?.verification_status === 'verified'
  const firstName     = instructor?.full_name?.split(' ')?.[0] ?? 'Hola'
  const avgScore      = stats?.avg_score ?? instructor?.score ?? 0
  const totalClasses  = stats?.total_classes ?? 0
  const uniqueStudios = stats?.unique_studios ?? 0

  return (
    <View style={s.container}>
      <ScrollView
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} tintColor="#fff" />}
      >
        {/* Hero */}
        <HeroHeader
          title={firstName}
          subtitle={isVerified ? 'Instructor verificado · CAPIAF' : 'Perfil pendiente de verificación'}
          centered
          avatarUri={instructor?.avatar_url}
          avatarFallback={firstName}
          onAvatarPress={() => navigation.navigate('InstructorPerfil')}
          rightElement={
            <View style={s.scorePill}>
              <View style={s.scoreCircle}>
                <Text style={s.scoreNum}>{avgScore > 0 ? avgScore.toFixed(1) : '—'}</Text>
              </View>
              <Text style={s.scoreLabel}>Puntaje</Text>
            </View>
          }
          bottomElement={
            isVerified ? (
              <View style={s.verifiedTag}>
                <Text style={s.verifiedTxt}>✓ VERIFICADO · CAPIAF</Text>
              </View>
            ) : null
          }
        />

        {/* KPI row — flota sobre el hero */}
        <View style={s.kpiRow}>
          <BlobCard style={s.kpiCard} delay={0}>
            <Text style={s.kpiNum}>{totalClasses}</Text>
            <Text style={s.kpiLbl}>Clases</Text>
          </BlobCard>
          <BlobCard style={s.kpiCard} blobColor="rgba(184,150,12,0.16)" blobColor2="rgba(184,150,12,0.10)" delay={3500}>
            <Text style={s.kpiNum}>{uniqueStudios}</Text>
            <Text style={s.kpiLbl}>Estudios</Text>
          </BlobCard>
        </View>

        {/* Banner pending */}
        {!isVerified && (
          <View style={s.pendingBanner}>
            <View style={s.pendingDot} />
            <Text style={s.pendingText}>Tu perfil está siendo revisado por CAPIAF</Text>
          </View>
        )}

        {/* Tarifas */}
        <BlobCard style={s.section} delay={1500}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>Mis tarifas por hora</Text>
            <TouchableOpacity onPress={() => navigation.navigate('InstructorTarifas')}>
              <Text style={s.editLink}>Editar</Text>
            </TouchableOpacity>
          </View>
          <View style={s.ratesRow}>
            <View style={[s.rateCard, { backgroundColor: colors.sageLight }]}>
              <Text style={s.rateLabel}>Regular</Text>
              <Text style={s.rateVal}>
                {instructor?.rates?.rate_regular ? '$' + instructor.rates.rate_regular.toLocaleString('es-AR') : '$0'}
              </Text>
            </View>
            <View style={[s.rateCard, { backgroundColor: colors.goldLight }]}>
              <Text style={[s.rateLabel, { color: '#7A5000' }]}>Reemplazo</Text>
              <Text style={[s.rateVal, { color: colors.gold }]}>
                {instructor?.rates?.rate_replacement ? '$' + instructor.rates.rate_replacement.toLocaleString('es-AR') : '$0'}
              </Text>
            </View>
          </View>
        </BlobCard>

        {/* Feedback */}
        <BlobCard style={s.section} delay={5000}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>Último feedback</Text>
          </View>
          {recentEvals.length === 0 ? (
            <Text style={s.emptyText}>Aún no tenés evaluaciones registradas.</Text>
          ) : (
            recentEvals.map((item: any) => (
              <View key={item.id} style={s.evalRow}>
                <View style={s.evalAv}>
                  <Text style={s.evalAvTxt}>{item.studio?.name?.[0] ?? '?'}</Text>
                </View>
                <View style={s.evalLeft}>
                  <Text style={s.evalStudio}>{item.studio?.name}</Text>
                  {item.comment && <Text style={s.evalComment}>"{item.comment}"</Text>}
                </View>
                <View style={s.evalScoreCircle}>
                  <Text style={s.evalScoreNum}>{item.score?.toFixed(1) ?? '—'}</Text>
                </View>
              </View>
            ))
          )}
        </BlobCard>

        {/* CTA */}
        <TouchableOpacity style={s.cta} onPress={() => navigation.navigate('InstructorPropuestas')} activeOpacity={0.85}>
          <Text style={s.ctaTxt}>Ver solicitudes</Text>
          <Feather name="arrow-right" size={16} color="#fff" />
        </TouchableOpacity>

      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  container:       { flex: 1, backgroundColor: colors.cream },
  content:         { paddingBottom: 100 },

  scorePill:       { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: 999, paddingVertical: 5, paddingLeft: 5, paddingRight: 12, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.2)' },
  scoreCircle:     { width: 30, height: 30, borderRadius: 15, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  scoreNum:        { fontFamily: 'Nunito-Bold', fontSize: 12, color: colors.sage },
  scoreLabel:      { fontFamily: 'Nunito-Bold', fontSize: 10, color: 'rgba(255,255,255,0.8)' },
  verifiedTag:     { alignSelf: 'flex-start', marginTop: 12, backgroundColor: 'rgba(184,150,12,0.22)', borderWidth: 1, borderColor: 'rgba(184,150,12,0.38)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  verifiedTxt:     { fontFamily: 'Nunito-Bold', fontSize: 9, color: '#FFD060', letterSpacing: 0.7 },

  kpiRow:          { flexDirection: 'row', gap: spacing.sm, marginHorizontal: spacing.md, marginTop: -12, marginBottom: spacing.md, zIndex: 2 },
  kpiCard:         { flex: 1, padding: spacing.md },
  kpiNum:          { fontFamily: 'Nunito-Bold', fontSize: 26, color: colors.dark, lineHeight: 28 },
  kpiLbl:          { fontFamily: 'Nunito-Bold', fontSize: 9, color: colors.light, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 3 },

  pendingBanner:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: spacing.md, marginBottom: spacing.md, backgroundColor: colors.warnBg, borderTopLeftRadius: 14, borderTopRightRadius: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 14, padding: spacing.sm, borderWidth: 0.5, borderColor: 'rgba(122,80,0,0.2)' },
  pendingDot:      { width: 6, height: 6, borderRadius: 3, backgroundColor: '#C4600A' },
  pendingText:     { fontFamily: 'Nunito-Bold', fontSize: 11, color: colors.warnTx, flex: 1 },

  section:         { marginHorizontal: spacing.md, marginBottom: spacing.md, padding: spacing.md },
  sectionHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  sectionTitle:    { fontFamily: 'Nunito-Bold', fontSize: 13, color: colors.dark },
  editLink:        { fontFamily: 'Nunito-Bold', fontSize: 11, color: colors.sage },

  ratesRow:        { flexDirection: 'row', gap: spacing.sm },
  rateCard:        { flex: 1, borderTopLeftRadius: 14, borderTopRightRadius: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 14, padding: spacing.md },
  rateLabel:       { fontFamily: 'Nunito-Bold', fontSize: 9, color: colors.sageMid, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 5 },
  rateVal:         { fontFamily: 'Nunito-Bold', fontSize: 20, color: colors.sage },

  evalRow:         { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm, borderBottomWidth: 0.5, borderColor: colors.borderLight },
  evalAv:          { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.sageLight, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  evalAvTxt:       { fontFamily: 'Nunito-Bold', fontSize: 12, color: colors.sage },
  evalLeft:        { flex: 1 },
  evalStudio:      { fontFamily: 'Nunito-Bold', fontSize: 12, color: colors.dark },
  evalComment:     { fontFamily: 'Nunito-Regular', fontSize: 10, color: colors.mid, fontStyle: 'italic', marginTop: 3 },
  evalScoreCircle: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.sageLight, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  evalScoreNum:    { fontFamily: 'Nunito-Bold', fontSize: 12, color: colors.sage },
  emptyText:       { fontFamily: 'Nunito-Regular', fontSize: 13, color: colors.light, paddingVertical: spacing.sm },

  cta:             { marginHorizontal: spacing.md, backgroundColor: colors.sage, borderTopLeftRadius: 14, borderTopRightRadius: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 14, padding: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  ctaTxt:          { fontFamily: 'Nunito-Bold', fontSize: 14, color: '#fff' },
})
