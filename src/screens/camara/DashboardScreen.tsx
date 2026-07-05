import React from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store'
import { LoadingScreen, colors, spacing } from '../../components/ui'
import { Feather } from '@expo/vector-icons'
import BlobCard from '../../components/BlobCard'
import HeroHeader from '../../components/HeroHeader'

export default function CamaraDashboardScreen({ navigation }: any) {
  const user = useAuthStore(s => s.user)
  const { reset } = useAuthStore()

  const { data: stats, isLoading } = useQuery({
    queryKey: ['camara-stats', user?.camara_id],
    queryFn: async () => {
      const [instructors, studios, pending] = await Promise.all([
        supabase.from('instructors').select('id, verification_status').eq('camara_id', user?.camara_id),
        supabase.from('studios').select('id, membership:studio_memberships(status)').eq('camara_id', user?.camara_id),
        supabase.from('instructors').select('id').eq('camara_id', user?.camara_id).eq('verification_status', 'pending'),
      ])
      const verified  = (instructors.data ?? []).filter((i: any) => i.verification_status === 'verified').length
      const members   = (studios.data ?? []).filter((s: any) => s.membership?.status === 'activa').length
      return {
        verified_instructors:  verified,
        member_studios:        members,
        non_member_studios:    (studios.data?.length ?? 0) - members,
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

  const handleSignOut = async () => { await supabase.auth.signOut(); reset() }

  if (isLoading) return <LoadingScreen message="Cargando panel..." />

  const fecha = new Date().toLocaleDateString('es-AR', { month: 'long', year: 'numeric' }).replace(/\bDe\b/g, 'de')
  const pendingCount = stats?.pending_verifications ?? 0

  return (
    <View style={{ flex: 1, backgroundColor: colors.cream }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>

        <HeroHeader
          title="Panel de gestión"
          subtitle={fecha}
          rightElement={
            <TouchableOpacity style={s.logoutBtn} onPress={handleSignOut}>
              <Feather name="log-out" size={13} color="rgba(255,255,255,0.65)" />
              <Text style={s.logoutTxt}>Salir</Text>
            </TouchableOpacity>
          }
          bottomElement={
            <View style={s.camaraBadge}>
              <Text style={s.camaraBadgeTxt}>Cámara de Pilates</Text>
            </View>
          }
        />

        {/* KPI grid flotante */}
        <View style={s.kpiGrid}>
          <BlobCard style={s.kpiCard} delay={0}
            blobColor="rgba(184,150,12,0.18)" blobColor2="rgba(184,150,12,0.10)">
            <Text style={[s.kpiNum, { color: colors.gold }]}>{stats?.member_studios ?? 0}</Text>
            <Text style={[s.kpiLbl, { color: '#7A5000' }]}>Estudios miembros</Text>
          </BlobCard>
          <BlobCard style={s.kpiCard} delay={2500}>
            <Text style={[s.kpiNum, { color: colors.sage }]}>{stats?.verified_instructors ?? 0}</Text>
            <Text style={[s.kpiLbl, { color: colors.sageMid }]}>Instructores verificados</Text>
          </BlobCard>
          <BlobCard style={s.kpiCard} delay={5000}
            blobColor={pendingCount > 0 ? 'rgba(196,96,10,0.16)' : undefined}
            blobColor2={pendingCount > 0 ? 'rgba(196,96,10,0.09)' : undefined}>
            <Text style={[s.kpiNum, { color: pendingCount > 0 ? '#C4600A' : colors.sageMid }]}>{pendingCount}</Text>
            <Text style={[s.kpiLbl, { color: pendingCount > 0 ? '#8B4000' : colors.mid }]}>Verificaciones pendientes</Text>
          </BlobCard>
          <BlobCard style={s.kpiCard} delay={7500}>
            <Text style={[s.kpiNum, { color: colors.sageMid }]}>{stats?.non_member_studios ?? 0}</Text>
            <Text style={[s.kpiLbl, { color: colors.mid }]}>Estudios no socios</Text>
          </BlobCard>
        </View>

        {/* Alerta potenciales socios */}
        {potentialMembers.length > 0 && (
          <TouchableOpacity style={s.alertCard} onPress={() => navigation.navigate('Estudios')} activeOpacity={0.85}>
            <View style={s.alertIcon}><Feather name="users" size={16} color={colors.sage} /></View>
            <View style={{ flex: 1 }}>
              <Text style={s.alertTitle}>{potentialMembers.length} estudio{potentialMembers.length > 1 ? 's' : ''} potencial{potentialMembers.length > 1 ? 'es' : ''} socio</Text>
              <Text style={s.alertSub}>Con actividad en la app este mes</Text>
            </View>
            <Feather name="chevron-right" size={16} color={colors.sage} />
          </TouchableOpacity>
        )}

        {/* Acciones rápidas */}
        <Text style={s.actionsLabel}>ACCIONES RÁPIDAS</Text>
        <View style={s.actionsGrid}>
          {[
            { label: 'Directorio de instructores', icon: 'users',      screen: 'Directorio' },
            { label: 'Verificar pendientes',       icon: 'user-check', screen: 'Directorio' },
            { label: 'Estudios registrados',       icon: 'home',       screen: 'Estudios'   },
            { label: 'Rangos de tarifas',          icon: 'sliders',    screen: 'Tarifas'    },
          ].map((a, i) => (
            <TouchableOpacity key={i} style={s.actionCard} onPress={() => navigation.navigate(a.screen)} activeOpacity={0.85}>
              <View style={s.actionIcon}>
                <Feather name={a.icon as any} size={16} color={colors.sage} />
              </View>
              <Text style={s.actionLbl}>{a.label}</Text>
              <Feather name="arrow-right" size={14} color={colors.border} />
            </TouchableOpacity>
          ))}
        </View>

      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  logoutBtn:     { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  logoutTxt:     { fontFamily: 'Nunito-SemiBold', fontSize: 11, color: 'rgba(255,255,255,0.65)' },
  camaraBadge:   { alignSelf: 'flex-start', marginTop: 12, backgroundColor: 'rgba(184,150,12,0.22)', borderWidth: 1, borderColor: 'rgba(184,150,12,0.38)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  camaraBadgeTxt:{ fontFamily: 'Nunito-Bold', fontSize: 10, color: '#FFD060' },

  kpiGrid:       { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: spacing.md, paddingTop: spacing.xs, gap: spacing.sm, marginTop: -12, zIndex: 2, marginBottom: spacing.md },
  kpiCard:       { flexBasis: '47%', padding: spacing.md },
  kpiNum:        { fontFamily: 'Nunito-Bold', fontSize: 28, lineHeight: 32, marginBottom: 3 },
  kpiLbl:        { fontFamily: 'Nunito-Bold', fontSize: 9, textTransform: 'uppercase' as const, letterSpacing: 0.5 },

  alertCard:     { marginHorizontal: spacing.md, marginBottom: spacing.md, backgroundColor: colors.sageLighter, borderTopLeftRadius: 14, borderTopRightRadius: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 14, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 0.5, borderColor: colors.border },
  alertIcon:     { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.sageLight, alignItems: 'center', justifyContent: 'center' },
  alertTitle:    { fontFamily: 'Nunito-Bold', fontSize: 13, color: colors.sage },
  alertSub:      { fontFamily: 'Nunito-Regular', fontSize: 11, color: colors.light, marginTop: 1 },

  actionsLabel:  { fontFamily: 'Nunito-Bold', fontSize: 9, color: colors.light, letterSpacing: 0.8, marginHorizontal: spacing.md, marginBottom: 8 },
  actionsGrid:   { paddingHorizontal: spacing.md, gap: 8 },
  actionCard:    { backgroundColor: colors.white, borderTopLeftRadius: 14, borderTopRightRadius: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 14, padding: spacing.md, borderWidth: 0.5, borderColor: colors.borderLight, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, elevation: 1 },
  actionIcon:    { width: 32, height: 32, borderRadius: 999, backgroundColor: colors.sageLight, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  actionLbl:     { fontFamily: 'Nunito-SemiBold', fontSize: 13, color: colors.dark, flex: 1 },
})
