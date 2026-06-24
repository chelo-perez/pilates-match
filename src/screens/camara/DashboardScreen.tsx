// src/screens/camara/DashboardScreen.tsx
import React from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Alert } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { supabase } from '../../lib/supabase'
import { useQueryClient } from '@tanstack/react-query'
import { useCamaraDashboard, usePendingInstructors } from '../../hooks'
import { Card, Badge, LoadingScreen, colors, spacing, radius, typography } from '../../components/ui'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'

// IMPORTACIÓN DE ICONOS VECTORIALES PREMIUM
import { Feather } from '@expo/vector-icons'

type Props = NativeStackScreenProps<any, 'CamaraTabs'>

export default function CamaraDashboardScreen({ navigation }: Props) {
  const qc = useQueryClient()
  const { data: stats, isLoading } = useCamaraDashboard()
  const { data: pending = [] } = usePendingInstructors()
  const [refreshing, setRefreshing] = React.useState(false)
  const insets = useSafeAreaInsets()

  const handleSignOut = () => {
    Alert.alert('Cerrar sesión', '¿Seguro que querés salir?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Salir', style: 'destructive', onPress: async () => {
        await supabase.auth.signOut()
      }},
    ])
  }

  const onRefresh = async () => {
    setRefreshing(true)
    await qc.invalidateQueries()
    setRefreshing(false)
  }

  if (isLoading) return <LoadingScreen message="Cargando panel..." />

  const KPIS = [
    { value: stats?.member_studios ?? 0, label: 'Estudios miembros', color: colors.gold, bg: colors.goldLight },
    { value: stats?.verified_instructors ?? 0, label: 'Instructores verificados', color: colors.sage, bg: colors.sageLight },
    { value: stats?.pending_verifications ?? 0, label: 'Verificaciones pendientes', color: '#C4600A', bg: '#FFF0E0' },
    { value: stats?.non_member_studios ?? 0, label: 'Estudios no socios', color: colors.sage, bg: colors.sageLighter },
  ]

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.gold} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          {/* Reemplazado el emoji del Badge por un ícono fino de templo/institución */}
          <Badge label="Cámara de Pilates" variant="gold" />
          <TouchableOpacity onPress={handleSignOut} style={styles.logoutButton}>
            <Feather name="log-out" size={13} color={colors.mid} style={{ marginRight: 4 }} />
            <Text style={{ fontSize: 12, color: colors.mid }}>Cerrar sesión</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.title}>Panel de gestión</Text>
        {/* Corrección global: se quitó la localización fija "Buenos Aires" */}
        <Text style={styles.sub}>{new Date().toLocaleDateString('es-AR', { month: 'long', year: 'numeric' }).toLowerCase().replace(/\b\w/g, (l: string) => l.toLowerCase())}</Text>
      </View>

      {/* KPIs */}
      <View style={styles.kpiGrid}>
        {KPIS.map((kpi, i) => (
          <View key={i} style={[styles.kpiCard, { backgroundColor: kpi.bg }]}>
            <Text style={[styles.kpiValue, { color: kpi.color }]}>{kpi.value}</Text>
            <Text style={styles.kpiLabel}>{kpi.label}</Text>
          </View>
        ))}
      </View>

      {/* Alertas */}
      {pending.length > 0 && (
        <TouchableOpacity onPress={() => navigation.navigate('Directorio')}>
          <Card style={styles.alertCard}>
            <Feather name="clock" size={20} color={colors.gold} style={{ marginRight: spacing.md }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.alertTitle}>{pending.length} instructores pendientes</Text>
              <Text style={styles.alertSub}>Esperando validación de documentación</Text>
            </View>
            <Feather name="chevron-right" size={16} color={colors.gold} />
          </Card>
        </TouchableOpacity>
      )}

      {/* Potenciales socios */}
      {(stats?.non_member_studios ?? 0) > 0 && (
        <TouchableOpacity onPress={() => navigation.navigate('Estudios')}>
          <Card style={[styles.alertCard, { borderColor: colors.sage, backgroundColor: colors.sageLighter }]}>
            <Feather name="help-circle" size={20} color={colors.sage} style={{ marginRight: spacing.md }} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.alertTitle, { color: colors.sage }]}>
                {stats?.non_member_studios} estudios potenciales socios
              </Text>
              <Text style={styles.alertSub}>Con actividad en la app este mes</Text>
            </View>
            <Feather name="chevron-right" size={16} color={colors.sage} />
          </Card>
        </TouchableOpacity>
      )}

      {/* Acciones rápidas */}
      <Text style={styles.sectionTitle}>Acciones rápidas</Text>
      <View style={styles.actionsGrid}>
        {[
          { icon: <Feather name="user-plus" size={24} color={colors.dark} />, label: 'Agregar instructor', screen: 'Directorio' },
          { icon: <Feather name="check-circle" size={24} color={colors.dark} />, label: 'Verificar pendientes', screen: 'Directorio' },
          { icon: <Feather name="briefcase" size={24} color={colors.dark} />, label: 'Ver estudios', screen: 'Estudios' },
          { icon: <Feather name="dollar-sign" size={24} color={colors.dark} />, label: 'Valores por Hora', screen: 'Tarifas' },
        ].map((a, i) => (
          <TouchableOpacity key={i} style={styles.actionCard} onPress={() => navigation.navigate(a.screen)}>
            <View style={styles.actionIconContainer}>{a.icon}</View>
            <Text style={styles.actionLabel}>{a.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  header: { marginBottom: spacing.lg },
  badgeWrapper: { flexDirection: 'row', alignItems: 'center' },
  logoutButton: { flexDirection: 'row', alignItems: 'center' },
  title: { fontFamily: 'Nunito-Bold', fontSize: 24, color: colors.dark, marginTop: spacing.xs },
  sub: { ...typography.small, color: colors.mid, marginTop: 2, textTransform: 'capitalize' },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg },
  kpiCard: { width: '47%', borderRadius: radius.md, padding: spacing.md },
  kpiValue: { fontFamily: 'Nunito-SemiBold', fontSize: 28, lineHeight: 32 },
  kpiLabel: { ...typography.small, color: colors.mid, marginTop: 4 },
  alertCard: {
    flexDirection: 'row', alignItems: 'center', padding: spacing.md,
    marginBottom: spacing.sm, backgroundColor: colors.goldLight,
    borderColor: colors.gold, borderWidth: 0.5,
  },
  alertTitle: { fontFamily: 'Nunito-SemiBold', fontSize: 13, color: colors.gold },
  alertSub: { ...typography.small, color: colors.mid, marginTop: 2 },
  sectionTitle: { ...typography.label, color: colors.dark, marginBottom: spacing.md, marginTop: spacing.md },
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  actionCard: {
    width: '47%', backgroundColor: colors.white, borderRadius: radius.md,
    padding: spacing.lg, alignItems: 'center', borderWidth: 0.5, borderColor: colors.border,
  },
  actionIconContainer: { marginBottom: spacing.xs, height: 32, justifyContent: 'center', alignItems: 'center' },
  actionLabel: { ...typography.small, color: colors.dark, textAlign: 'center', fontFamily: 'Nunito-Medium' },
})