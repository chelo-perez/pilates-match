// src/screens/studio/HomeScreen.tsx
import React from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store'
import { useMyStudio } from '../../hooks'
import { EmptyState, LoadingScreen, colors, spacing, radius } from '../../components/ui'
import { Feather } from '@expo/vector-icons'

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

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    reset()
  }

  if (isLoading) return <LoadingScreen message="Cargando..." />

  const isMember = studio?.membership?.status === 'activa'
  const pendingEvals = stats?.pending_evaluations ?? 0

  return (
    <View style={{ flex: 1, backgroundColor: colors.cream }}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} tintColor={colors.white} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={s.hero}>
          <TouchableOpacity style={s.logoutBtn} onPress={handleSignOut}>
            <Feather name="log-out" size={13} color="rgba(255,255,255,0.65)" />
            <Text style={s.logoutText}>Salir</Text>
          </TouchableOpacity>
          <Text style={s.heroName}>{studio?.name ?? 'Mi estudio'}</Text>
          <Text style={s.heroMeta}>{studio?.neighborhood ?? 'Buenos Aires'}</Text>
          {isMember && (
            <View style={s.memberBadge}>
              <Text style={s.memberBadgeText}>★ Socia Cámara</Text>
            </View>
          )}
        </View>

        <View style={s.kpiGrid}>
          <View style={s.kpiCard}>
            <Text style={[s.kpiNum, { color: colors.sage }]}>
              {stats?.avg_score > 0 ? stats.avg_score.toFixed(1) : '—'}
            </Text>
            <Text style={s.kpiLbl}>Puntaje promedio</Text>
          </View>
          <View style={s.kpiCard}>
            <Text style={s.kpiNum}>{stats?.unique_instructors ?? 0}</Text>
            <Text style={s.kpiLbl}>Instructores</Text>
          </View>
          <View style={s.kpiCard}>
            <Text style={s.kpiNum}>{stats?.total_evaluations ?? 0}</Text>
            <Text style={s.kpiLbl}>Evaluaciones</Text>
          </View>
          <View style={[s.kpiCard, pendingEvals > 0 && s.kpiWarn]}>
            <Text style={[s.kpiNum, pendingEvals > 0 && { color: colors.warnTx }]}>{pendingEvals}</Text>
            <Text style={s.kpiLbl}>Por evaluar</Text>
          </View>
        </View>

        <TouchableOpacity style={s.searchBtn} onPress={() => navigation.navigate('Search')}>
          <Feather name="search" size={18} color={colors.white} />
          <Text style={s.searchBtnText}>Buscar instructor</Text>
        </TouchableOpacity>

        {pendingEvals > 0 && (
          <TouchableOpacity style={s.alertCard} onPress={() => navigation.navigate('PendingEvaluations')}>
            <View style={s.alertIcon}><Feather name="star" size={16} color={colors.warnTx} /></View>
            <View style={{ flex: 1 }}>
              <Text style={s.alertTitle}>{pendingEvals} evaluación{pendingEvals > 1 ? 'es' : ''} pendiente{pendingEvals > 1 ? 's' : ''}</Text>
              <Text style={s.alertSub}>Evaluá para seguir enviando propuestas</Text>
            </View>
            <Feather name="chevron-right" size={16} color={colors.warnTx} />
          </TouchableOpacity>
        )}

        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionLabel}>HISTORIAL RECIENTE</Text>
            {recentHistory.length > 0 && (
              <TouchableOpacity onPress={() => navigation.navigate('HistoryList')}>
                <Text style={s.sectionLink}>Ver todo</Text>
              </TouchableOpacity>
            )}
          </View>
          {recentHistory.length === 0 ? (
            <EmptyState title="Sin historial aún" subtitle="Tus propuestas enviadas aparecerán acá." />
          ) : (
            recentHistory.map((item: any) => (
              <View key={item.id} style={s.histRow}>
                <View style={s.histAvatar}>
                  <Text style={s.histAvatarText}>{item.instructor?.full_name?.[0] ?? '?'}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.histName}>{item.instructor?.full_name}</Text>
                  <Text style={s.histMeta}>{item.instructor?.neighborhood} · {item.class_type === 'regular' ? 'Regular' : 'Reemplazo'}</Text>
                </View>
                <View style={[s.statusTag, {
                  backgroundColor: item.status === 'aceptado' ? colors.sageLight : item.status === 'rechazado' ? colors.redBg : colors.warnBg
                }]}>
                  <Text style={[s.statusText, {
                    color: item.status === 'aceptado' ? colors.sage : item.status === 'rechazado' ? colors.redTx : colors.warnTx
                  }]}>
                    {item.status === 'aceptado' ? 'Aceptado' : item.status === 'rechazado' ? 'Rechazado' : 'Pendiente'}
                  </Text>
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
  hero:            { backgroundColor: colors.sage, paddingTop: 52, paddingBottom: 28, paddingHorizontal: spacing.md },
  logoutBtn:       { position: 'absolute', top: 52, right: spacing.md, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  logoutText:      { fontFamily: 'Nunito-SemiBold', fontSize: 11, color: 'rgba(255,255,255,0.65)' },
  heroName:        { fontFamily: 'Nunito-Bold', fontSize: 22, color: colors.white, marginBottom: 3 },
  heroMeta:        { fontFamily: 'Nunito-Regular', fontSize: 12, color: 'rgba(255,255,255,0.65)' },
  memberBadge:     { marginTop: 8, alignSelf: 'flex-start', backgroundColor: 'rgba(184,150,12,0.25)', borderWidth: 1, borderColor: 'rgba(184,150,12,0.4)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  memberBadgeText: { fontFamily: 'Nunito-Bold', fontSize: 10, color: '#FFD060' },
  kpiGrid:         { flexDirection: 'row', flexWrap: 'wrap', padding: spacing.md, gap: spacing.sm, marginTop: -16, zIndex: 2 },
  kpiCard:         { flex: 1, minWidth: '45%', backgroundColor: colors.white, borderTopLeftRadius: 14, borderTopRightRadius: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 14, padding: spacing.md, borderWidth: 0.5, borderColor: colors.borderLight, elevation: 3 },
  kpiWarn:         { borderLeftWidth: 3, borderLeftColor: colors.warnTx },
  kpiNum:          { fontFamily: 'Nunito-Bold', fontSize: 28, color: colors.dark, marginBottom: 2 },
  kpiLbl:          { fontFamily: 'Nunito-Regular', fontSize: 10, color: colors.light },
  searchBtn:       { marginHorizontal: spacing.md, marginBottom: spacing.md, backgroundColor: colors.sage, borderTopLeftRadius: 14, borderTopRightRadius: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, elevation: 4 },
  searchBtnText:   { fontFamily: 'Nunito-Bold', fontSize: 15, color: colors.white },
  alertCard:       { marginHorizontal: spacing.md, marginBottom: spacing.md, backgroundColor: colors.warnBg, borderTopLeftRadius: 14, borderTopRightRadius: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 14, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 0.5, borderColor: colors.warnTx + '40' },
  alertIcon:       { width: 36, height: 36, borderRadius: 18, backgroundColor: '#FEE8BC', alignItems: 'center', justifyContent: 'center' },
  alertTitle:      { fontFamily: 'Nunito-Bold', fontSize: 13, color: colors.warnTx },
  alertSub:        { fontFamily: 'Nunito-Regular', fontSize: 11, color: '#9A6A00', marginTop: 1 },
  section:         { backgroundColor: colors.white, marginBottom: 8, paddingHorizontal: spacing.md, paddingVertical: spacing.md, borderTopWidth: 0.5, borderBottomWidth: 0.5, borderColor: colors.borderLight },
  sectionHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  sectionLabel:    { fontFamily: 'Nunito-Bold', fontSize: 10, color: colors.light, letterSpacing: 0.8 },
  sectionLink:     { fontFamily: 'Nunito-SemiBold', fontSize: 12, color: colors.sage },
  histRow:         { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm, borderBottomWidth: 0.5, borderColor: colors.borderLight },
  histAvatar:      { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.sageLight, alignItems: 'center', justifyContent: 'center' },
  histAvatarText:  { fontFamily: 'Nunito-Bold', fontSize: 15, color: colors.sage },
  histName:        { fontFamily: 'Nunito-SemiBold', fontSize: 13, color: colors.dark },
  histMeta:        { fontFamily: 'Nunito-Regular', fontSize: 11, color: colors.light, marginTop: 1 },
  statusTag:       { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusText:      { fontFamily: 'Nunito-SemiBold', fontSize: 9 },
})
