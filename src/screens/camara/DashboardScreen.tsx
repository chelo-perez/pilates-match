// src/screens/camara/DashboardScreen.tsx
import React from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store'
import { LoadingScreen, colors, spacing, radius } from '../../components/ui'
import { Feather } from '@expo/vector-icons'

export default function CamaraDashboardScreen({ navigation }: any) {
  const user = useAuthStore(s => s.user)
  const { reset } = useAuthStore()
  const insets = useSafeAreaInsets()

  const { data: stats, isLoading } = useQuery({
    queryKey: ['camara-stats', user?.camara_id],
    queryFn: async () => {
      const [instructors, studios, pending] = await Promise.all([
        supabase.from('instructors').select('id, verification_status').eq('camara_id', user?.camara_id),
        supabase.from('studios').select('id, membership:studio_memberships(status)').eq('camara_id', user?.camara_id),
        supabase.from('instructors').select('id').eq('camara_id', user?.camara_id).eq('verification_status', 'pending'),
      ])
      const verified = (instructors.data ?? []).filter((i: any) => i.verification_status === 'verified').length
      const members = (studios.data ?? []).filter((s: any) => s.membership?.status === 'activa').length
      const nonMembers = (studios.data?.length ?? 0) - members
      return {
        verified_instructors: verified,
        total_instructors: instructors.data?.length ?? 0,
        member_studios: members,
        non_member_studios: nonMembers,
        pending_verifications: pending.data?.length ?? 0,
      }
    },
    enabled: !!user?.camara_id,
  })

  const { data: potentialMembers = [] } = useQuery({
    queryKey: ['potential-members', user?.camara_id],
    queryFn: async () => {
      const { data } = await supabase
        .from('studios').select('id, name')
        .eq('camara_id', user?.camara_id)
        .is('membership', null).limit(5)
      return data ?? []
    },
    enabled: !!user?.camara_id,
  })

  const handleSignOut = () => {
    Alert.alert('Cerrar sesión', '¿Seguro que querés salir?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Salir', style: 'destructive', onPress: async () => {
        await supabase.auth.signOut(); reset()
      }},
    ])
  }

  if (isLoading) return <LoadingScreen message="Cargando panel..." />

  const fecha = new Date().toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
    .replace(/\bDe\b/g, 'de')

  const pendingCount = stats?.pending_verifications ?? 0

  return (
    <View style={{ flex: 1, backgroundColor: colors.cream }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>

        <View style={[s.hero, { paddingTop: insets.top + 16 }]}>
          <View style={s.heroBadge}>
            <Text style={s.heroBadgeText}>Cámara de Pilates</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View>
              <Text style={s.heroTitle}>Panel de gestión</Text>
              <Text style={s.heroDate}>{fecha}</Text>
            </View>
            <TouchableOpacity style={s.logoutBtn} onPress={handleSignOut}>
              <Feather name="log-out" size={14} color="rgba(255,255,255,0.65)" />
              <Text style={s.logoutText}>Salir</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={s.kpiGrid}>
          <View style={[s.kpiCard, s.kpiGold]}>
            <Text style={[s.kpiNum, { color: colors.gold }]}>{stats?.member_studios ?? 0}</Text>
            <Text style={[s.kpiLbl, { color: '#7A5000' }]}>Estudios miembros</Text>
          </View>
          <View style={[s.kpiCard, s.kpiSage]}>
            <Text style={[s.kpiNum, { color: colors.sage }]}>{stats?.verified_instructors ?? 0}</Text>
            <Text style={[s.kpiLbl, { color: colors.sageMid }]}>Instructores verificados</Text>
          </View>
          <View style={[s.kpiCard, pendingCount > 0 ? s.kpiWarn : s.kpiLight]}>
            <Text style={[s.kpiNum, { color: pendingCount > 0 ? '#C4600A' : colors.sageMid }]}>{pendingCount}</Text>
            <Text style={[s.kpiLbl, { color: pendingCount > 0 ? '#8B4000' : colors.mid }]}>Verificaciones pendientes</Text>
          </View>
          <View style={[s.kpiCard, s.kpiLight]}>
            <Text style={[s.kpiNum, { color: colors.sageMid }]}>{stats?.non_member_studios ?? 0}</Text>
            <Text style={[s.kpiLbl, { color: colors.mid }]}>Estudios no socios</Text>
          </View>
        </View>

        {potentialMembers.length > 0 && (
          <TouchableOpacity style={s.alertCard} onPress={() => navigation.navigate('Estudios')}>
            <View style={s.alertIcon}>
              <Feather name="users" size={16} color={colors.sage} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.alertTitle}>{potentialMembers.length} estudio{potentialMembers.length > 1 ? 's' : ''} potencial{potentialMembers.length > 1 ? 'es' : ''} socio</Text>
              <Text style={s.alertSub}>Con actividad en la app este mes</Text>
            </View>
            <Feather name="chevron-right" size={16} color={colors.sage} />
          </TouchableOpacity>
        )}

        <View style={s.actionsSection}>
          <Text style={s.actionsLabel}>ACCIONES RÁPIDAS</Text>
          <View style={s.actionsGrid}>
            {[
              { label: 'Directorio de instructores', screen: 'Directorio' },
              { label: 'Verificar pendientes', screen: 'Directorio' },
              { label: 'Estudios registrados', screen: 'Estudios' },
              { label: 'Rangos de tarifas', screen: 'Tarifas' },
            ].map((a, i) => (
              <TouchableOpacity key={i} style={s.actionCard} onPress={() => navigation.navigate(a.screen)}>
                <Text style={s.actionLbl}>{a.label}</Text>
                <Text style={s.actionArrow}>→</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  hero:           { backgroundColor: '#2D3F31', paddingHorizontal: spacing.md, paddingBottom: 28 },
  heroBadge:      { alignSelf: 'flex-start', backgroundColor: 'rgba(184,150,12,0.2)', borderWidth: 1, borderColor: 'rgba(184,150,12,0.35)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, marginBottom: 10 },
  heroBadgeText:  { fontFamily: 'Nunito-Bold', fontSize: 10, color: '#FFD060' },
  heroTitle:      { fontFamily: 'Nunito-Bold', fontSize: 22, color: colors.white, marginBottom: 2 },
  heroDate:       { fontFamily: 'Nunito-Regular', fontSize: 11, color: 'rgba(255,255,255,0.5)' },
  logoutBtn:      { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  logoutText:     { fontFamily: 'Nunito-SemiBold', fontSize: 11, color: 'rgba(255,255,255,0.65)' },
  kpiGrid:        { flexDirection: 'row', flexWrap: 'wrap', padding: spacing.md, gap: spacing.sm, marginTop: -16, zIndex: 2 },
  kpiCard:        { flex: 1, minWidth: '45%', borderTopLeftRadius: 14, borderTopRightRadius: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 14, padding: 14, elevation: 3 },
  kpiGold:        { backgroundColor: colors.goldLight },
  kpiSage:        { backgroundColor: colors.sageLight },
  kpiWarn:        { backgroundColor: '#FFF0E0' },
  kpiLight:       { backgroundColor: colors.sageLighter },
  kpiNum:         { fontFamily: 'Nunito-Bold', fontSize: 30, lineHeight: 34, marginBottom: 3 },
  kpiLbl:         { fontFamily: 'Nunito-SemiBold', fontSize: 10 },
  alertCard:      { marginHorizontal: spacing.md, marginBottom: spacing.md, backgroundColor: colors.sageLighter, borderTopLeftRadius: 14, borderTopRightRadius: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 14, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 0.5, borderColor: colors.sageLight },
  alertIcon:      { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.sageLight, alignItems: 'center', justifyContent: 'center' },
  alertTitle:     { fontFamily: 'Nunito-Bold', fontSize: 13, color: colors.sage },
  alertSub:       { fontFamily: 'Nunito-Regular', fontSize: 11, color: colors.light, marginTop: 1 },
  actionsSection: { paddingHorizontal: spacing.md, marginBottom: spacing.md },
  actionsLabel:   { fontFamily: 'Nunito-Bold', fontSize: 10, color: colors.light, letterSpacing: 0.8, marginBottom: 10 },
  actionsGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  actionCard:     { width: '47%', backgroundColor: colors.white, borderTopLeftRadius: 14, borderTopRightRadius: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 14, padding: spacing.md, borderWidth: 0.5, borderColor: colors.borderLight, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', elevation: 1 },
  actionLbl:      { fontFamily: 'Nunito-Medium', fontSize: 12, color: colors.dark, flex: 1 },
  actionArrow:    { fontFamily: 'Nunito-Regular', fontSize: 14, color: colors.border, marginLeft: 4 },
})
