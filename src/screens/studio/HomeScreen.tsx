import React from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store'
import { useMyStudio } from '../../hooks'
import { EmptyState, LoadingScreen, colors, spacing } from '../../components/ui'
import { Feather } from '@expo/vector-icons'
import BlobCard from '../../components/BlobCard'
import HeroHeader from '../../components/HeroHeader'

export default function StudioHomeScreen({ navigation }: any) {
  const { reset } = useAuthStore()
  const { data: studio, isLoading, refetch } = useMyStudio()

  const { data: stats } = useQuery({
    queryKey: ['studio-stats', studio?.id],
    queryFn: async () => {
      const { data } = await supabase.rpc('get_studio_stats', { p_studio_id: studio?.id })
      return data?.[0] ?? null
    },
    enabled: !!studio?.id,
  })

  const { data: recentHistory = [] } = useQuery({
    queryKey: ['studio-history-recent', studio?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('matches')
        .select('*, instructor:instructors(full_name, neighborhood)')
        .eq('studio_id', studio!.id)
        .order('created_at', { ascending: false })
        .limit(3)
      return data ?? []
    },
    enabled: !!studio?.id,
  })

  const handleSignOut = async () => { await supabase.auth.signOut(); reset() }

  if (isLoading) return <LoadingScreen message="Cargando..." />

  const isMember    = studio?.membership?.status === 'activa'
  const pendingEvals = stats?.pending_evaluations ?? 0

  return (
    <View style={{ flex: 1, backgroundColor: colors.cream }}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} tintColor="#fff" />}
        showsVerticalScrollIndicator={false}
      >
        <HeroHeader
          title={studio?.name ?? 'Mi estudio'}
          subtitle={studio?.neighborhood ?? 'Buenos Aires'}
          centered
          avatarUri={studio?.logo_url}
          avatarFallback={studio?.name ?? 'E'}
          onAvatarPress={() => navigation.navigate('StudioProfileEdit')}
          rightElement={
            <TouchableOpacity style={s.logoutPill} onPress={handleSignOut}>
              <Feather name="log-out" size={13} color="rgba(255,255,255,0.65)" />
              <Text style={s.logoutTxt}>Salir</Text>
            </TouchableOpacity>
          }
          bottomElement={isMember ? (
            <View style={s.memberBadge}>
              <Text style={s.memberBadgeTxt}>★ Socia Cámara</Text>
            </View>
          ) : null}
        />

        {/* KPI grid flotante */}
        <View style={s.kpiGrid}>
          <BlobCard style={s.kpiCard} delay={0}>
            <Text style={[s.kpiNum, { color: colors.sage }]}>
              {stats?.avg_score > 0 ? stats.avg_score.toFixed(1) : '—'}
            </Text>
            <Text style={s.kpiLbl}>Puntaje promedio</Text>
          </BlobCard>
          <BlobCard style={s.kpiCard} delay={2000}>
            <Text style={s.kpiNum}>{stats?.unique_instructors ?? 0}</Text>
            <Text style={s.kpiLbl}>Instructores</Text>
          </BlobCard>
          <BlobCard style={s.kpiCard} delay={4000}>
            <Text style={s.kpiNum}>{stats?.total_evaluations ?? 0}</Text>
            <Text style={s.kpiLbl}>Evaluaciones</Text>
          </BlobCard>
          <BlobCard style={[s.kpiCard, pendingEvals > 0 && s.kpiWarn]} delay={6000}
            blobColor={pendingEvals > 0 ? 'rgba(184,150,12,0.16)' : undefined}
            blobColor2={pendingEvals > 0 ? 'rgba(184,150,12,0.10)' : undefined}>
            <Text style={[s.kpiNum, pendingEvals > 0 && { color: colors.warnTx }]}>{pendingEvals}</Text>
            <Text style={s.kpiLbl}>Por evaluar</Text>
          </BlobCard>
        </View>

        {/* Perfil incompleto banner */}
        {(!studio?.budget_regular || !studio?.equipment?.length) && (
          <TouchableOpacity
            style={s.profileBanner}
            onPress={() => navigation.navigate('StudioProfileEdit')}
            activeOpacity={0.85}
          >
            <Feather name="edit-3" size={14} color={colors.warnTx} />
            <Text style={s.profileBannerTxt}>Completá tu perfil para activar el match automático</Text>
            <Feather name="chevron-right" size={14} color={colors.warnTx} />
          </TouchableOpacity>
        )}

        {/* Buscar */}
        <TouchableOpacity style={s.searchBtn} onPress={() => navigation.navigate('Search')} activeOpacity={0.85}>
          <Feather name="search" size={18} color="#fff" />
          <Text style={s.searchBtnTxt}>Buscar instructor</Text>
        </TouchableOpacity>

        {/* Alerta evaluaciones pendientes */}
        {pendingEvals > 0 && (
          <TouchableOpacity style={s.alertCard} onPress={() => navigation.navigate('PendingEvaluations')} activeOpacity={0.85}>
            <View style={s.alertIcon}><Feather name="star" size={16} color={colors.warnTx} /></View>
            <View style={{ flex: 1 }}>
              <Text style={s.alertTitle}>{pendingEvals} evaluación{pendingEvals > 1 ? 'es' : ''} pendiente{pendingEvals > 1 ? 's' : ''}</Text>
              <Text style={s.alertSub}>Evaluá para seguir enviando propuestas</Text>
            </View>
            <Feather name="chevron-right" size={16} color={colors.warnTx} />
          </TouchableOpacity>
        )}

        {/* Banner publicitario */}
        <View style={s.sponsorBanner}>
          <View style={s.sponsorLeft}>
            <Text style={s.sponsorTag}>PUBLICIDAD</Text>
            <Text style={s.sponsorTitle}>Tu espacio aquí</Text>
            <Text style={s.sponsorSub}>contacto@trabajomasfacil.com</Text>
          </View>
          <View style={s.sponsorLogo}>
            <Text style={s.sponsorLogoTxt}>★</Text>
          </View>
        </View>

        {/* Historial reciente */}
        <BlobCard style={s.section} delay={3000}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>Historial reciente</Text>
            {recentHistory.length > 0 && (
              <TouchableOpacity onPress={() => navigation.navigate('HistoryList')}>
                <Text style={s.sectionLink}>Ver todo</Text>
              </TouchableOpacity>
            )}
          </View>
          {recentHistory.length === 0 ? (
            <EmptyState
              title="Sin historial aún"
              subtitle="Cuando envíes una propuesta a un instructor, aparecerá acá."
            />
          ) : (
            recentHistory.map((item: any) => (
              <View key={item.id} style={s.histRow}>
                <View style={s.histAv}>
                  <Text style={s.histAvTxt}>{item.instructor?.full_name?.[0] ?? '?'}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.histName}>{item.instructor?.full_name}</Text>
                  <Text style={s.histMeta}>{item.instructor?.neighborhood} · {item.class_type === 'regular' ? 'Regular' : 'Reemplazo'}</Text>
                </View>
                <View style={[s.statusTag, {
                  backgroundColor: item.status === 'aceptado' ? colors.okBg : item.status === 'rechazado' ? colors.redBg : colors.warnBg
                }]}>
                  <Text style={[s.statusTxt, {
                    color: item.status === 'aceptado' ? colors.okTx : item.status === 'rechazado' ? colors.redTx : colors.warnTx
                  }]}>
                    {item.status === 'aceptado' ? 'Aceptado' : item.status === 'rechazado' ? 'Rechazado' : 'Pendiente'}
                  </Text>
                </View>
              </View>
            ))
          )}
        </BlobCard>
      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  logoutPill:     { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  logoutTxt:      { fontFamily: 'Nunito-SemiBold', fontSize: 11, color: 'rgba(255,255,255,0.65)' },
  memberBadge:    { marginTop: 10, alignSelf: 'flex-start', backgroundColor: 'rgba(184,150,12,0.25)', borderWidth: 1, borderColor: 'rgba(184,150,12,0.4)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  memberBadgeTxt: { fontFamily: 'Nunito-Bold', fontSize: 10, color: '#FFD060' },

  kpiGrid:        { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: spacing.md, paddingTop: spacing.sm, gap: spacing.sm, marginTop: -12, zIndex: 2, marginBottom: spacing.md },
  kpiCard:        { flexBasis: '47%', padding: spacing.md },
  kpiWarn:        { borderLeftWidth: 3, borderLeftColor: colors.warnTx },
  kpiNum:         { fontFamily: 'Nunito-Bold', fontSize: 28, color: colors.dark, marginBottom: 2 },
  kpiLbl:         { fontFamily: 'Nunito-Bold', fontSize: 9, color: colors.light, textTransform: 'uppercase', letterSpacing: 0.6 },

  profileBanner:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: spacing.md, marginBottom: spacing.sm, backgroundColor: colors.warnBg, borderTopLeftRadius: 14, borderTopRightRadius: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 14, padding: spacing.md, borderWidth: 0.5, borderColor: 'rgba(122,80,0,0.2)' },
  profileBannerTxt: { fontFamily: 'Nunito-Bold', fontSize: 12, color: colors.warnTx, flex: 1 },
  sponsorBanner:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: spacing.md, marginBottom: spacing.md, backgroundColor: '#F0F4F0', borderTopLeftRadius: 10, borderTopRightRadius: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 10, paddingHorizontal: spacing.md, paddingVertical: 10, borderWidth: 0.5, borderColor: colors.border, height: 60 },
  sponsorLeft:      { flex: 1 },
  sponsorTag:       { fontFamily: 'Nunito-Bold', fontSize: 7, color: colors.light, letterSpacing: 1, marginBottom: 2 },
  sponsorTitle:     { fontFamily: 'Nunito-Bold', fontSize: 13, color: colors.dark },
  sponsorSub:       { fontFamily: 'Nunito-Regular', fontSize: 10, color: colors.light },
  sponsorLogo:      { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.sageLight, alignItems: 'center', justifyContent: 'center' },
  sponsorLogoTxt:   { fontSize: 18, color: colors.sage },
  searchBtn:      { marginHorizontal: spacing.md, marginBottom: spacing.md, backgroundColor: colors.sage, borderTopLeftRadius: 14, borderTopRightRadius: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, elevation: 3 },
  searchBtnTxt:   { fontFamily: 'Nunito-Bold', fontSize: 15, color: '#fff', letterSpacing: 0.2 },

  alertCard:      { marginHorizontal: spacing.md, marginBottom: spacing.md, backgroundColor: colors.warnBg, borderTopLeftRadius: 14, borderTopRightRadius: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 14, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 0.5, borderColor: 'rgba(122,80,0,0.2)' },
  alertIcon:      { width: 36, height: 36, borderRadius: 18, backgroundColor: '#FEE8BC', alignItems: 'center', justifyContent: 'center' },
  alertTitle:     { fontFamily: 'Nunito-Bold', fontSize: 13, color: colors.warnTx },
  alertSub:       { fontFamily: 'Nunito-Regular', fontSize: 11, color: '#9A6A00', marginTop: 1 },

  section:        { marginHorizontal: spacing.md, marginBottom: spacing.md, padding: spacing.md },
  sectionHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  sectionTitle:   { fontFamily: 'Nunito-Bold', fontSize: 13, color: colors.dark },
  sectionLink:    { fontFamily: 'Nunito-Bold', fontSize: 11, color: colors.sage },

  histRow:        { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm, borderBottomWidth: 0.5, borderColor: colors.borderLight },
  histAv:         { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.sageLight, alignItems: 'center', justifyContent: 'center' },
  histAvTxt:      { fontFamily: 'Nunito-Bold', fontSize: 15, color: colors.sage },
  histName:       { fontFamily: 'Nunito-Bold', fontSize: 13, color: colors.dark },
  histMeta:       { fontFamily: 'Nunito-Regular', fontSize: 11, color: colors.light, marginTop: 1 },
  statusTag:      { borderTopLeftRadius: 8, borderTopRightRadius: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  statusTxt:      { fontFamily: 'Nunito-Bold', fontSize: 9 },
})
