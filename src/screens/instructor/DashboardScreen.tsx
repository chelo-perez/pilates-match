import React from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store'

import { Card, Avatar, Badge, ScoreDisplay, LoadingScreen, colors, spacing, radius, typography } from '../../components/ui'
import { Feather } from '@expo/vector-icons'

export default function InstructorDashboardScreen({ navigation }: any) {
  const user = useAuthStore(s => s.user)
  const { data: instructor, isLoading } = useQuery({
    queryKey: ['my-instructor-profile'],
    queryFn: async () => {
      const { data, error } = await supabase.from('instructors').select('*, certifications(*), specialties:instructor_specialties(*), rates:instructor_rates(*)').eq('user_id', user?.id).single()
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
      const { data, error } = await supabase.from('evaluations').select('*, studio:studios(*)').eq('instructor_id', instructor?.id).order('created_at', { ascending: false }).limit(3)
      if (error) throw error
      return data
    },
    enabled: !!instructor?.id,
  })

  if (isLoading) return <LoadingScreen message="Cargando tu perfil..." />

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <Card style={styles.profileCard}>
          <Avatar source={instructor?.avatar_url} name={instructor?.first_name} size={70} />
          <Text style={styles.name}>{instructor?.first_name} {instructor?.last_name}</Text>
          <View style={styles.badgeRow}><Badge label={instructor?.verification_status === 'verified' ? 'Verificado' : 'Pendiente de Validaci�n'} color={instructor?.verification_status === 'verified' ? 'sage' : 'gold'} /></View>
          <ScoreDisplay score={instructor?.score ?? 0} size="large" style={{ marginTop: spacing.sm }} />
        </Card>
        <View style={styles.statsRow}>
          <Card style={styles.statCard}><Text style={styles.statVal}>{stats?.total_classes ?? 0}</Text><Text style={styles.statLabel}>Clases hechas</Text></Card>
          <Card style={styles.statCard}><Text style={styles.statVal}>{stats?.unique_studios ?? 0}</Text><Text style={styles.statLabel}>Estudios</Text></Card>
        </View>
        <View style={styles.section}>
          <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Tus valores de referencia por hora</Text><TouchableOpacity onPress={() => navigation.navigate('EditarTarifas')}><Text style={styles.editLink}>Editar</Text></TouchableOpacity></View>
          <View style={styles.ratesRow}>
            <View style={styles.rateItem}><Text style={styles.rateLabel}>Estudio Socio</Text><Text style={styles.rateVal}>${instructor?.rates?.member_rate_hour ?? '0'}</Text></View>
            <View style={styles.rateItem}><Text style={styles.rateLabel}>Estudio No Socio</Text><Text style={styles.rateVal}>${instructor?.rates?.non_member_rate_hour ?? '0'}</Text></View>
          </View>
        </View>
        <View style={styles.section}>
          <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>�ltimo feedback recibido</Text></View>
          {recentEvals.length === 0 ? <Text style={styles.emptyText}>A�n no ten�s evaluaciones registradas.</Text> : (
            recentEvals.map((item: any) => (
              <View key={item.id} style={styles.evalRow}>
                <View style={{ flex: 1, marginRight: spacing.sm }}><Text style={styles.evalStudio}>{item.studio?.name}</Text><Text style={styles.evalDate}>{new Date(item.class_date).toLocaleDateString('es-AR')}</Text>{item.comments && <Text style={styles.evalComment}>"{item.comments}"</Text>}</View>
                <ScoreDisplay score={item.score} size="small" />
              </View>
            ))
          )}
        </View>
      </ScrollView>
      <View style={styles.adBannerSpace}>
        <View style={{ height: 52, backgroundColor: colors.sageLighter, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontFamily: 'Nunito-Regular', fontSize: 10, color: colors.light }}>Publicidad</Text></View>
      </View>
    </View>
  )
}
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  scrollView: { flex: 1 },
  scrollContent: { padding: spacing.md, paddingBottom: 100 },
  profileCard: { padding: spacing.xl, alignItems: 'center', backgroundColor: colors.white, marginBottom: spacing.md },
  name: { fontFamily: 'Playfair_Display-Medium', fontSize: 22, color: colors.dark, marginTop: spacing.sm },
  badgeRow: { marginTop: spacing.xs, flexDirection: 'row' },
  statsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  statCard: { flex: 1, padding: spacing.md, alignItems: 'center', backgroundColor: colors.white },
  statVal: { fontFamily: 'DM_Sans-SemiBold', fontSize: 20, color: colors.dark },
  statLabel: { ...typography.small, color: colors.mid, marginTop: 2 },
  section: { padding: spacing.md, marginBottom: spacing.md, backgroundColor: colors.white, borderRadius: radius.md, borderWidth: 0.5, borderColor: colors.borderLight },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  sectionTitle: { fontFamily: 'DM_Sans-SemiBold', fontSize: 14, color: colors.dark },
  editLink: { ...typography.small, color: colors.lavDark, fontFamily: 'DM_Sans-Medium' },
  ratesRow: { flexDirection: 'row', gap: spacing.sm },
  rateItem: { flex: 1, backgroundColor: colors.lavLight, borderRadius: radius.sm, padding: spacing.md },
  rateLabel: { ...typography.small, color: colors.mid },
  rateVal: { fontFamily: 'DM_Sans-SemiBold', fontSize: 18, color: colors.lavDark, marginTop: 4 },
  evalRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: spacing.sm, borderBottomWidth: 0.5, borderColor: colors.borderLight },
  evalStudio: { fontFamily: 'DM_Sans-Medium', fontSize: 13, color: colors.dark },
  evalDate: { ...typography.small, color: colors.mid, fontSize: 11, marginTop: 1 },
  evalComment: { ...typography.small, color: colors.dark, fontStyle: 'italic', marginTop: 4 },
  emptyText: { ...typography.small, color: colors.mid, paddingVertical: spacing.sm },
  adBannerSpace: { position: 'absolute', bottom: 0, width: '100%', height: 60, backgroundColor: colors.white, borderTopWidth: 0.5, borderColor: colors.border, justifyContent: 'center', alignItems: 'center' }
})
