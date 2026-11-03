import React from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { confirmSignOut } from '../../lib/auth'
import { useMyStudio, useStudioStats } from '../../hooks'
import { Badge, Button, EmptyState, ErrorState, LoadingScreen, colors, spacing, typography } from '../../components/ui'
import { planLabel } from '../../constants/plans'
import { MATCH_STATUS } from '../../constants/labels'
import { Feather } from '@expo/vector-icons'
import BlobCard from '../../components/BlobCard'
import HeroHeader from '../../components/HeroHeader'
import { usePendingEvaluationMatches } from './studioQueries'

export default function StudioHomeScreen({ navigation }: any) {
  const { data: studio, isLoading, isError, refetch } = useMyStudio()
  const { data: stats, refetch: refetchStats } = useStudioStats(studio?.id)
  const { data: pending = [], refetch: refetchPending } = usePendingEvaluationMatches(studio?.id)

  const { data: recentHistory = [], refetch: refetchHistory, isRefetching } = useQuery({
    queryKey: ['studio-history-recent', studio?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('matches')
        .select('*, instructor:instructors(full_name, neighborhood, avatar_url)')
        .eq('studio_id', studio!.id)
        .order('created_at', { ascending: false })
        .limit(3)
      if (error) throw error
      return data ?? []
    },
    enabled: !!studio?.id,
  })

  const onRefresh = () => { refetch(); refetchStats(); refetchPending(); refetchHistory() }

  if (isLoading) return <LoadingScreen message="Cargando..." />
  if (isError) return <ErrorState message="No pudimos cargar tu estudio." onRetry={refetch} />
  if (!studio) {
    return (
      <EmptyState
        icon="home"
        title="Todavía no tenés un estudio cargado"
        message="Cerrá sesión y volvé a entrar para terminar el registro."
        action="Cerrar sesión"
        onAction={confirmSignOut}
      />
    )
  }

  const membership: any = Array.isArray(studio.membership) ? studio.membership[0] : studio.membership
  const isMember     = studio.is_member === true
  const planName     = planLabel(membership?.plan_type ?? 'freemium')
  const pendingEvals = pending.length
  const avgScore     = Number(stats?.avg_score ?? 0)

  return (
    <View style={{ flex: 1, backgroundColor: colors.cream }}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor={colors.sage} colors={[colors.sage]} />}
        showsVerticalScrollIndicator={false}
      >
        <HeroHeader
          title={studio.name ?? 'Mi estudio'}
          subtitle={studio.neighborhood ?? 'Buenos Aires'}
          centered
          avatarUri={studio.logo_url}
          avatarFallback={studio.name ?? 'E'}
          onAvatarPress={() => navigation.navigate('StudioProfileEdit')}
          rightElement={
            <TouchableOpacity style={s.logoutPill} onPress={confirmSignOut}>
              <Feather name="log-out" size={13} color={colors.white} />
              <Text style={s.logoutTxt}>Salir</Text>
            </TouchableOpacity>
          }
          bottomElement={isMember ? (
            <View style={s.memberBadge}>
              <Text style={s.memberBadgeTxt}>★ Socio de la Cámara</Text>
            </View>
          ) : null}
        />

        {/* KPI grid flotante */}
        <View style={s.kpiGrid}>
          <BlobCard style={s.kpiCard} delay={0}>
            <Text style={[s.kpiNum, { color: colors.sage }]}>
              {avgScore > 0 ? avgScore.toFixed(1) : '—'}
            </Text>
            <Text style={s.kpiLbl}>Puntaje que diste</Text>
          </BlobCard>
          <BlobCard style={s.kpiCard} delay={2000}>
            <Text style={s.kpiNum}>{stats?.unique_instructors ?? 0}</Text>
            <Text style={s.kpiLbl}>Instructores evaluados</Text>
          </BlobCard>
          <BlobCard style={s.kpiCard} delay={4000}>
            <Text style={s.kpiNum}>{stats?.total_evaluations ?? 0}</Text>
            <Text style={s.kpiLbl}>Evaluaciones</Text>
          </BlobCard>
          <BlobCard style={[s.kpiCard, pendingEvals > 0 && s.kpiWarn]} delay={6000}
            onPress={pendingEvals > 0 ? () => navigation.navigate('PendingEvaluations') : undefined}>
            <Text style={[s.kpiNum, pendingEvals > 0 && { color: colors.warnTx }]}>{pendingEvals}</Text>
            <Text style={s.kpiLbl}>Por evaluar</Text>
          </BlobCard>
        </View>

        {/* Perfil incompleto */}
        {(!(studio.budget_regular || studio.budget_replacement) || !studio.equipment?.length) && (
          <TouchableOpacity
            style={s.profileBanner}
            onPress={() => navigation.navigate('StudioProfileEdit')}
            activeOpacity={0.85}
          >
            <Feather name="edit-3" size={14} color={colors.warnTx} />
            <Text style={s.profileBannerTxt}>Cargá tu equipamiento y presupuesto para ver qué instructores te convienen</Text>
            <Feather name="chevron-right" size={14} color={colors.warnTx} />
          </TouchableOpacity>
        )}

        {/* Membresía */}
        <TouchableOpacity
          style={s.membershipBtn}
          onPress={() => navigation.navigate('Membership')}
          activeOpacity={0.85}
        >
          <Feather name="star" size={14} color={colors.gold} />
          <Text style={s.membershipBtnTxt}>Plan {planName} · Ver mi plan</Text>
          <Feather name="chevron-right" size={14} color={colors.gold} />
        </TouchableOpacity>

        {/* Buscar */}
        <View style={s.searchWrap}>
          <Button
            label="Buscar instructor"
            icon={<Feather name="search" size={18} color={colors.white} />}
            onPress={() => navigation.navigate('Search')}
            fullWidth
            size="lg"
          />
        </View>

        {/* Evaluaciones pendientes */}
        {pendingEvals > 0 && (
          <TouchableOpacity style={s.alertCard} onPress={() => navigation.navigate('PendingEvaluations')} activeOpacity={0.85}>
            <View style={s.alertIcon}><Feather name="star" size={16} color={colors.warnTx} /></View>
            <View style={{ flex: 1 }}>
              <Text style={s.alertTitle}>{pendingEvals} evaluación{pendingEvals > 1 ? 'es' : ''} pendiente{pendingEvals > 1 ? 's' : ''}</Text>
              <Text style={s.alertSub}>Tu evaluación ayuda a otros estudios a elegir</Text>
            </View>
            <Feather name="chevron-right" size={16} color={colors.warnTx} />
          </TouchableOpacity>
        )}

        {/* Banner publicitario */}
        <View style={s.sponsorBanner}>
          <View style={s.sponsorLeft}>
            <Text style={s.sponsorTag}>PUBLICIDAD</Text>
            <Text style={s.sponsorTitle}>Tu espacio acá</Text>
            <Text style={s.sponsorSub}>contacto@trabajomasfacil.com</Text>
          </View>
          <View style={s.sponsorLogo}>
            <Feather name="star" size={18} color={colors.sage} />
          </View>
        </View>

        {/* Propuestas recientes */}
        <BlobCard style={s.section} delay={3000}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>PROPUESTAS RECIENTES</Text>
            {recentHistory.length > 0 && (
              <TouchableOpacity onPress={() => navigation.navigate('HistoryList')}>
                <Text style={s.sectionLink}>Ver todas</Text>
              </TouchableOpacity>
            )}
          </View>
          {recentHistory.length === 0 ? (
            <EmptyState
              title="Todavía no enviaste propuestas"
              message="Cuando le envíes una propuesta a un instructor, la vas a ver acá con su estado."
            />
          ) : (
            recentHistory.map((item: any) => {
              const st = MATCH_STATUS[item.status as keyof typeof MATCH_STATUS]
              return (
                <View key={item.id} style={s.histRow}>
                  <View style={s.histAv}>
                    <Text style={s.histAvTxt}>{item.instructor?.full_name?.[0]?.toUpperCase() ?? '?'}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.histName}>{item.instructor?.full_name ?? 'Instructor'}</Text>
                    <Text style={s.histMeta}>
                      {item.instructor?.neighborhood ? `${item.instructor.neighborhood} · ` : ''}
                      {item.class_type === 'regular' ? 'Regular' : 'Reemplazo'}
                    </Text>
                  </View>
                  <Badge label={st?.label ?? item.status} variant={st?.variant ?? 'neutral'} />
                </View>
              )
            })
          )}
        </BlobCard>
      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  logoutPill:     { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 0.5, borderColor: colors.sageMid },
  logoutTxt:      { fontFamily: 'Nunito-SemiBold', fontSize: 11, color: colors.white },
  memberBadge:    { marginTop: 10, alignSelf: 'center', backgroundColor: colors.goldLight, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  memberBadgeTxt: { fontFamily: 'Nunito-Bold', fontSize: 10, color: colors.gold },

  kpiGrid:        { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: spacing.md, paddingTop: spacing.sm, gap: spacing.sm, marginTop: -12, zIndex: 2, marginBottom: spacing.md },
  kpiCard:        { flexBasis: '47%', padding: spacing.md },
  kpiWarn:        { borderLeftWidth: 3, borderLeftColor: colors.warnTx },
  kpiNum:         { fontFamily: 'Nunito-Bold', fontSize: 28, color: colors.dark, marginBottom: 2 },
  kpiLbl:         { ...typography.caption },

  profileBanner:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: spacing.md, marginBottom: spacing.sm, backgroundColor: colors.warnBg, borderTopLeftRadius: 14, borderTopRightRadius: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 14, padding: spacing.md, borderWidth: 0.5, borderColor: colors.border },
  profileBannerTxt: { fontFamily: 'Nunito-Bold', fontSize: 12, color: colors.warnTx, flex: 1 },
  sponsorBanner:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: spacing.md, marginBottom: spacing.md, backgroundColor: colors.sageLighter, borderTopLeftRadius: 14, borderTopRightRadius: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 14, paddingHorizontal: spacing.md, paddingVertical: 10, borderWidth: 0.5, borderColor: colors.border },
  sponsorLeft:      { flex: 1 },
  sponsorTag:       { ...typography.caption, marginBottom: 2 },
  sponsorTitle:     { fontFamily: 'Nunito-Bold', fontSize: 13, color: colors.dark },
  sponsorSub:       { fontFamily: 'Nunito-Regular', fontSize: 11, color: colors.light },
  sponsorLogo:      { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.sageLight, alignItems: 'center', justifyContent: 'center' },
  membershipBtn:    { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: spacing.md, marginBottom: spacing.sm, backgroundColor: colors.goldLight, borderTopLeftRadius: 14, borderTopRightRadius: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 14, padding: 12, borderWidth: 0.5, borderColor: colors.border },
  membershipBtnTxt: { fontFamily: 'Nunito-Bold', fontSize: 12, color: colors.gold, flex: 1 },
  searchWrap:       { paddingHorizontal: spacing.md, marginBottom: spacing.md },

  alertCard:      { marginHorizontal: spacing.md, marginBottom: spacing.md, backgroundColor: colors.warnBg, borderTopLeftRadius: 14, borderTopRightRadius: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 14, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 0.5, borderColor: colors.border },
  alertIcon:      { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  alertTitle:     { fontFamily: 'Nunito-Bold', fontSize: 13, color: colors.warnTx },
  alertSub:       { fontFamily: 'Nunito-Regular', fontSize: 11, color: colors.warnTx, marginTop: 1 },

  section:        { marginHorizontal: spacing.md, marginBottom: spacing.md, padding: spacing.md },
  sectionHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  sectionTitle:   { ...typography.caption },
  sectionLink:    { fontFamily: 'Nunito-Bold', fontSize: 12, color: colors.sage },

  histRow:        { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm, borderBottomWidth: 0.5, borderColor: colors.borderLight },
  histAv:         { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.sageLight, alignItems: 'center', justifyContent: 'center' },
  histAvTxt:      { fontFamily: 'Nunito-Bold', fontSize: 15, color: colors.sage },
  histName:       { fontFamily: 'Nunito-Bold', fontSize: 13, color: colors.dark },
  histMeta:       { fontFamily: 'Nunito-Regular', fontSize: 11, color: colors.light, marginTop: 1 },
})
