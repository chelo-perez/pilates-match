// Dueño de la plataforma: las Cámaras (una por sector), cuántos estudios tienen y su % de reparto.
import React from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { Feather } from '@expo/vector-icons'
import { supabase } from '../../lib/supabase'
import { confirmSignOut } from '../../lib/auth'
import { useCamaras } from '../../lib/platform'
import HeroHeader from '../../components/HeroHeader'
import NotificationBell from '../../components/NotificationBell'
import { Button, ErrorState, LoadingScreen, colors, spacing, radius, typography } from '../../components/ui'

export default function PlatformCamarasScreen({ navigation }: any) {
  const { data: camaras = [], isLoading, isError, refetch } = useCamaras()
  const { data: counts } = useQuery({
    queryKey: ['platform-counts'],
    queryFn: async () => {
      const [st, ins, subs] = await Promise.all([
        supabase.from('studios').select('camara_id'),
        supabase.from('instructors').select('camara_id').eq('verification_status', 'verificado'),
        supabase.from('subscriptions').select('camara_id').eq('status', 'authorized'),
      ])
      const tally = (rows: any[] | null) => (rows ?? []).reduce((m: Record<string, number>, r: any) => { m[r.camara_id] = (m[r.camara_id] ?? 0) + 1; return m }, {})
      return { studios: tally(st.data), instructors: tally(ins.data), subs: tally(subs.data) }
    },
  })

  return (
    <View style={{ flex: 1, backgroundColor: colors.cream }}>
      <HeroHeader
        title="Cámaras"
        subtitle="Cada Cámara coordina un sector"
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
      {isLoading ? <LoadingScreen /> : isError ? <ErrorState message="No pudimos cargar las Cámaras." onRetry={refetch} /> : (
        <ScrollView contentContainerStyle={s.content}>
          {camaras.map(c => (
            <TouchableOpacity key={c.id} style={s.card} activeOpacity={0.85} onPress={() => navigation.navigate('PlatformCamaraEdit', { camaraId: c.id })}>
              <View style={s.head}>
                <View style={{ flex: 1 }}>
                  <Text style={s.name} numberOfLines={2}>{c.name}</Text>
                  <Text style={s.sector}>{c.business_label ?? c.sector}{c.is_active ? '' : ' · inactiva'}</Text>
                </View>
                <View style={s.pct}><Text style={s.pctTxt}>{Number(c.revenue_share_pct ?? 0).toLocaleString('es-AR')}%</Text></View>
              </View>
              <View style={s.stats}>
                <Stat n={counts?.studios[c.id] ?? 0} l="estudios" />
                <Stat n={counts?.instructors[c.id] ?? 0} l="instructores verificados" />
                <Stat n={counts?.subs[c.id] ?? 0} l="suscripciones" />
              </View>
            </TouchableOpacity>
          ))}
          <Button label="Nueva Cámara" icon={<Feather name="plus" size={16} color={colors.white} />} onPress={() => navigation.navigate('PlatformCamaraEdit', {})} fullWidth size="lg" />
        </ScrollView>
      )}
    </View>
  )
}

const Stat = ({ n, l }: { n: number; l: string }) => (
  <View style={{ flex: 1 }}><Text style={s.statN}>{n}</Text><Text style={s.statL}>{l}</Text></View>
)

const s = StyleSheet.create({
  content:   { padding: spacing.md, paddingBottom: 100 },
  card:      { backgroundColor: colors.white, ...radius.leaf, padding: spacing.md, borderWidth: 0.5, borderColor: colors.borderLight, marginBottom: spacing.sm },
  head:      { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  name:      { fontFamily: 'Nunito-Bold', fontSize: 15, color: colors.dark },
  sector:    { fontFamily: 'Nunito-SemiBold', fontSize: 12, color: colors.sage, marginTop: 2 },
  pct:       { backgroundColor: colors.goldLight, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  pctTxt:    { fontFamily: 'Nunito-Bold', fontSize: 12, color: colors.gold },
  stats:     { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md, paddingTop: spacing.sm, borderTopWidth: 0.5, borderTopColor: colors.borderLight },
  statN:     { fontFamily: 'Nunito-Bold', fontSize: 18, color: colors.sage },
  statL:     { fontFamily: 'Nunito-Regular', fontSize: 11, color: colors.mid },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  logoutTxt: { fontFamily: 'Nunito-SemiBold', fontSize: 11, color: colors.white },
})
