import React from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store'
import { confirmSignOut } from '../../lib/auth'
import { LoadingScreen, ErrorState, colors, spacing, radius, typography } from '../../components/ui'
import { Feather } from '@expo/vector-icons'
import HeroHeader from '../../components/HeroHeader'
import NotificationBell from '../../components/NotificationBell'
import { entity } from '../../lib/entity'

export default function CamaraDashboardScreen({ navigation }: any) {
  const user = useAuthStore(s => s.user)

  // Sin filtrar por camara_id: los registros nuevos llegan con camara_id null
  const { data: stats, isLoading, isError, refetch } = useQuery({
    queryKey: ['camara-stats'],
    queryFn: async () => {
      const [instructors, studios] = await Promise.all([
        supabase.from('instructors').select('id, verification_status'),
        supabase.from('studios').select('id, is_member'),
      ])
      if (instructors.error) throw instructors.error
      if (studios.error) throw studios.error
      const ins = instructors.data ?? []
      const sts = studios.data ?? []
      const members = sts.filter((s: any) => s.is_member).length
      return {
        verified_instructors:  ins.filter((i: any) => i.verification_status === 'verificado').length,
        pending_verifications: ins.filter((i: any) => i.verification_status === 'pendiente').length,
        member_studios:        members,
        non_member_studios:    sts.length - members,
      }
    },
  })

  // Mismo queryKey que CamaraProfileEdit: al editar el perfil se refresca acá también
  const { data: camara } = useQuery({
    queryKey: ['camara-profile', user?.camara_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('camaras').select('*').eq('id', user?.camara_id).single()
      if (error) throw error
      return data
    },
    enabled: !!user?.camara_id,
  })

  // Instructores esperando verificación: primero los que esperan hace más tiempo
  const { data: pending = [] } = useQuery({
    queryKey: ['camara-instructors', 'pending-dashboard'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('instructors').select('id, full_name, created_at, certifications(review_status)')
        .eq('verification_status', 'pendiente')
        .order('created_at', { ascending: true }).limit(4)
      if (error) throw error
      return data ?? []
    },
  })

  if (isLoading) return <LoadingScreen message="Cargando panel..." />
  if (isError) return <ErrorState message="No pudimos cargar el panel." onRetry={refetch} />

  const pendingCount = stats?.pending_verifications ?? 0

  return (
    <View style={{ flex: 1, backgroundColor: colors.cream }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>

        <HeroHeader
          title={camara?.name ?? entity().La}
          centered
          avatarUri={camara?.logo_url ?? undefined}
          avatarFallback={camara?.name ?? 'C'}
          onAvatarPress={() => navigation.navigate('CamaraProfileEdit')}
          rightElement={
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <NotificationBell />
              <TouchableOpacity style={s.logoutBtn} onPress={() => confirmSignOut()}>
                <Feather name="log-out" size={13} color={colors.white} />
                <Text style={s.logoutTxt}>Salir</Text>
              </TouchableOpacity>
            </View>
          }

        />

        {/* 1. Lo que necesita atención: instructores esperando verificación */}
        <View style={s.section}>
          <View style={s.sectionHead}>
            <Text style={s.sectionTitle}>PARA REVISAR{pendingCount ? ` (${pendingCount})` : ''}</Text>
            {pendingCount > pending.length ? (
              <TouchableOpacity onPress={() => navigation.navigate('Directorio', { filter: 'pendiente' })}>
                <Text style={s.link}>Ver todos</Text>
              </TouchableOpacity>
            ) : null}
          </View>
          {pending.length === 0 ? (
            <View style={[s.card, s.allDone]}>
              <View style={[s.icon, { backgroundColor: colors.okBg }]}><Feather name="check" size={16} color={colors.okTx} /></View>
              <View style={{ flex: 1 }}>
                <Text style={s.cardTitle}>Nada pendiente</Text>
                <Text style={s.cardSub}>No hay instructores esperando la verificación.</Text>
              </View>
            </View>
          ) : pending.map((p: any) => {
            const certs = (p.certifications ?? []).filter((c: any) => (c.review_status ?? 'pending') === 'pending').length
            const days = Math.max(0, Math.floor((Date.now() - new Date(p.created_at).getTime()) / 86400000))
            return (
              <TouchableOpacity key={p.id} style={s.card} activeOpacity={0.85}
                onPress={() => navigation.navigate('VerifyInstructor', { instructorId: p.id })}>
                <View style={[s.icon, { backgroundColor: colors.warnBg }]}>
                  <Text style={[s.initial, { color: colors.warnTx }]}>{p.full_name?.[0]?.toUpperCase() ?? '?'}</Text>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={s.cardTitle} numberOfLines={1}>{p.full_name}</Text>
                  <Text style={s.cardSub}>
                    {days === 0 ? 'Se registró hoy' : days === 1 ? 'Espera desde ayer' : `Espera hace ${days} días`}
                    {certs ? ` · ${certs} certificado${certs > 1 ? 's' : ''} para revisar` : ' · sin certificados'}
                  </Text>
                </View>
                <Feather name="chevron-right" size={18} color={colors.sageMid} />
              </TouchableOpacity>
            )
          })}
        </View>

        {/* 2. La red, de un vistazo (cada número lleva a la lista filtrada) */}
        <View style={s.section}>
          <Text style={[s.sectionTitle, { marginBottom: spacing.sm }]}>LA RED</Text>
          <View style={s.kpiRow}>
            {[
              { n: stats?.verified_instructors ?? 0, l: 'Instructores\nverificados', go: () => navigation.navigate('Directorio', { filter: 'verificado' }) },
              { n: stats?.member_studios ?? 0,       l: 'Estudios\nsocios',          go: () => navigation.navigate('Estudios', { filter: 'miembro' }) },
              { n: stats?.non_member_studios ?? 0,   l: 'Estudios\nno socios',       go: () => navigation.navigate('Estudios', { filter: 'no_miembro' }) },
            ].map(k => (
              <TouchableOpacity key={k.l} style={s.kpi} onPress={k.go} activeOpacity={0.85}>
                <Text style={s.kpiNum}>{k.n}</Text>
                <Text style={s.kpiLbl}>{k.l}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* 3. Oportunidad: estudios que todavía no son socios */}
        {(stats?.non_member_studios ?? 0) > 0 && (
          <TouchableOpacity style={s.invite} onPress={() => navigation.navigate('Estudios', { filter: 'no_miembro' })} activeOpacity={0.85}>
            <View style={[s.icon, { backgroundColor: colors.white }]}><Feather name="user-plus" size={16} color={colors.sage} /></View>
            <View style={{ flex: 1 }}>
              <Text style={s.inviteTitle}>
                {stats!.non_member_studios === 1 ? '1 estudio todavía no es socio' : `${stats!.non_member_studios} estudios todavía no son socios`}
              </Text>
              <Text style={s.cardSub}>Invitalos a sumarse {entity().a}</Text>
            </View>
            <Feather name="chevron-right" size={18} color={colors.sage} />
          </TouchableOpacity>
        )}

      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  logoutBtn:     { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  logoutTxt:     { fontFamily: 'Nunito-SemiBold', fontSize: 11, color: colors.white },

  section:       { paddingHorizontal: spacing.md, marginBottom: spacing.lg },
  sectionHead:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  sectionTitle:  { ...typography.caption },
  link:          { fontFamily: 'Nunito-Bold', fontSize: 13, color: colors.sage },
  card:          { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.white, ...radius.leaf, padding: spacing.md, borderWidth: 0.5, borderColor: colors.borderLight, marginBottom: spacing.sm },
  allDone:       { backgroundColor: colors.white },
  icon:          { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  initial:       { fontFamily: 'Nunito-Bold', fontSize: 15 },
  cardTitle:     { fontFamily: 'Nunito-Bold', fontSize: 14, color: colors.dark },
  cardSub:       { fontFamily: 'Nunito-Regular', fontSize: 12, color: colors.mid, marginTop: 2, lineHeight: 17 },
  kpiRow:        { flexDirection: 'row', gap: spacing.sm },
  kpi:           { flex: 1, backgroundColor: colors.white, ...radius.leaf, paddingVertical: spacing.md, paddingHorizontal: spacing.sm + 2, borderWidth: 0.5, borderColor: colors.borderLight },
  kpiNum:        { fontFamily: 'Nunito-Bold', fontSize: 26, lineHeight: 30, color: colors.sage },
  kpiLbl:        { fontFamily: 'Nunito-SemiBold', fontSize: 11, lineHeight: 14, color: colors.mid, marginTop: 4 },
  invite:        { marginHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.sageLight, ...radius.leaf, padding: spacing.md },
  inviteTitle:   { fontFamily: 'Nunito-Bold', fontSize: 14, color: colors.sage },
})
