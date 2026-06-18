// src/screens/instructor/DashboardScreen.tsx
import React from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store'
import { Card, Avatar, Badge, ScoreDisplay, Button, LoadingScreen, colors, spacing, typography, radius } from '../../components/ui'

export default function InstructorDashboardScreen({ navigation }: any) {
  const user = useAuthStore(s => s.user)

  const insets = useSafeAreaInsets()

  const { data: instructor, isLoading } = useQuery({
    queryKey: ['my-instructor-profile'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('instructors')
        .select(`*, certifications(*), specialties:instructor_specialties(*), rates:instructor_rates(*)`)
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
      const { data } = await supabase
        .from('evaluations')
        .select(`*, studio:studios(name, neighborhood)`)
        .eq('instructor_id', instructor?.id)
        .order('class_date', { ascending: false })
        .limit(5)
      return data ?? []
    },
    enabled: !!instructor?.id,
  })

  const handleSignOut = () => {
    Alert.alert('Cerrar sesión', '¿Seguro que querés salir?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Salir', style: 'destructive', onPress: async () => {
        await supabase.auth.signOut()
      }},
    ])
  }

  if (isLoading) return <LoadingScreen />
  if (!instructor) return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl }}>
      <Text style={{ fontFamily: 'Playfair_Display-Medium', fontSize: 20, color: colors.dark, textAlign: 'center', marginBottom: spacing.md }}>
        Tu perfil está siendo procesado
      </Text>
      <Text style={{ ...typography.body, color: colors.mid, textAlign: 'center', marginBottom: spacing.xl }}>
        La Cámara cargará tu perfil al directorio. Te notificaremos cuando esté listo.
      </Text>
      <TouchableOpacity onPress={handleSignOut}>
        <Text style={{ ...typography.small, color: colors.light }}>Cerrar sesión</Text>
      </TouchableOpacity>
    </View>
  )

  return (
    <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}>
      {/* Header */}
      <View style={styles.header}>
        <Avatar name={instructor.full_name} size={56} color={colors.lavender} />
        <View style={{ flex: 1, marginLeft: spacing.md }}>
          <Text style={styles.name}>{instructor.full_name}</Text>
          <Text style={styles.neighborhood}>{instructor.neighborhood}</Text>
          <View style={{ marginTop: spacing.xs }}>
            <Badge
              label={instructor.verification_status === 'verificado' ? '✓ Verificada por la Cámara' : '⏳ Verificación pendiente'}
              color={instructor.verification_status === 'verificado' ? 'success' : 'warning'}
            />
          </View>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 6 }}>
          <ScoreDisplay score={stats?.avg_score} size="lg" showLabel />
          <TouchableOpacity onPress={handleSignOut}>
            <Text style={{ fontSize: 12, color: colors.light }}>Cerrar sesión</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Stats */}
      {stats && (
        <View style={styles.statsRow}>
          {[
            { val: stats.total_evaluations, label: 'Evaluaciones' },
            { val: stats.avg_technique?.toFixed(1), label: 'Técnica' },
            { val: stats.avg_punctuality?.toFixed(1), label: 'Puntualidad' },
          ].map((s, i) => (
            <Card key={i} style={styles.statCard}>
              <Text style={styles.statVal}>{s.val}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </Card>
          ))}
        </View>
      )}

      {/* Mis tarifas */}
      <Card style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Valores por hora</Text>
          <TouchableOpacity onPress={() => navigation.navigate('InstructorRates')}>
            <Text style={styles.editLink}>Editar →</Text>
          </TouchableOpacity>
        </View>
        {instructor.rates ? (
          <View style={styles.ratesRow}>
            <View style={styles.rateItem}>
              <Text style={styles.rateLabel}>Clase regular</Text>
              <Text style={styles.rateVal}>${instructor.rates.rate_regular?.toLocaleString('es-AR')}</Text>
            </View>
            <View style={styles.rateItem}>
              <Text style={styles.rateLabel}>Reemplazo</Text>
              <Text style={[styles.rateVal, { color: colors.blushDark }]}>${instructor.rates.rate_replacement?.toLocaleString('es-AR')}</Text>
            </View>
          </View>
        ) : (
          <Button label="Configurar mis tarifas" variant="secondary" size="sm"
            onPress={() => navigation.navigate('InstructorRates')} />
        )}
      </Card>

      {/* Mis evaluaciones recientes */}
      {recentEvals.length > 0 && (
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Mis últimas evaluaciones</Text>
          {recentEvals.map((ev: any) => (
            <View key={ev.id} style={styles.evalRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.evalStudio}>{ev.studio?.name}</Text>
                <View style={{ flexDirection: 'row', gap: spacing.xs, marginTop: 3 }}>
                  <Badge label={ev.class_type === 'regular' ? 'Regular' : 'Reemplazo'}
                    color={ev.class_type === 'regular' ? 'sage' : 'blush'} />
                  <Text style={styles.evalDate}>{ev.class_date}</Text>
                </View>
                {ev.comment && <Text style={styles.evalComment} numberOfLines={2}>{ev.comment}</Text>}
              </View>
              <ScoreDisplay score={ev.average_score} size="sm" />
            </View>
          ))}
        </Card>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  header: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: colors.lavLight, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md },
  name: { fontFamily: 'Playfair_Display-Medium', fontSize: 18, color: colors.dark },
  neighborhood: { ...typography.small, color: colors.mid, marginTop: 2 },
  statsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  statCard: { flex: 1, padding: spacing.md, alignItems: 'center', backgroundColor: colors.white },
  statVal: { fontFamily: 'DM_Sans-SemiBold', fontSize: 20, color: colors.dark },
  statLabel: { ...typography.small, color: colors.mid, marginTop: 2 },
  section: { padding: spacing.md, marginBottom: spacing.md, backgroundColor: colors.white },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  sectionTitle: { fontFamily: 'DM_Sans-SemiBold', fontSize: 14, color: colors.dark },
  editLink: { ...typography.small, color: colors.lavDark, fontFamily: 'DM_Sans-Medium' },
  ratesRow: { flexDirection: 'row', gap: spacing.sm },
  rateItem: { flex: 1, backgroundColor: colors.lavLight, borderRadius: radius.sm, padding: spacing.md },
  rateLabel: { ...typography.small, color: colors.mid },
  rateVal: { fontFamily: 'DM_Sans-SemiBold', fontSize: 18, color: colors.lavDark, marginTop: 4 },
  evalRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: spacing.sm, borderBottomWidth: 0.5, borderColor: colors.borderLight },
  evalStudio: { fontFamily: 'DM_Sans-Medium', fontSize: 13, color: colors.dark },
  evalDate: { ...typography.small, color: colors.light },
  evalComment: { ...typography.small, color: colors.mid, marginTop: 4, fontStyle: 'italic', lineHeight: 17 },
})
