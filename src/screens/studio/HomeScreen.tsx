// src/screens/studio/HomeScreen.tsx — con bloqueo de propuestas por evaluaciones pendientes

import React, { useCallback } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity,
  RefreshControl, StyleSheet, Alert
} from 'react-native'
import { supabase } from '../../lib/supabase'
import { useFocusEffect } from '@react-navigation/native'
import { useQueryClient, useQuery } from '@tanstack/react-query'
import { Feather } from '@expo/vector-icons'
import {
  Card, Badge, Avatar, ScoreDisplay, Button,
  EmptyState, LoadingScreen, colors, spacing, radius, typography
} from '../../components/ui'
import { useMyStudio, useStudioStats, usePendingEvaluations, useEvaluationHistory } from '../../hooks'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'

type Props = NativeStackScreenProps<any, 'EstudioHome'>

export default function HomeScreen({ navigation }: Props) {
  const qc = useQueryClient()
  const { data: studio, isLoading } = useMyStudio()
  const studioId = studio?.id
  const { data: stats } = useStudioStats(studioId)
  const { data: pending = [] } = usePendingEvaluations(studioId)
  const { data: history = [] } = useEvaluationHistory(studioId)
  const [refreshing, setRefreshing] = React.useState(false)

  // Verificar si el estudio puede enviar propuestas
  const { data: canPropose = true } = useQuery({
    queryKey: ['can-propose', studioId],
    queryFn: async () => {
      const { data } = await supabase.rpc('can_studio_send_proposal', {
        p_studio_id: studioId
      })
      return data ?? true
    },
    enabled: !!studioId,
    refetchInterval: 60_000,
  })

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['my-studio'] }),
      qc.invalidateQueries({ queryKey: ['studio-stats', studioId] }),
      qc.invalidateQueries({ queryKey: ['pending-evaluations', studioId] }),
      qc.invalidateQueries({ queryKey: ['can-propose', studioId] }),
    ])
    setRefreshing(false)
  }, [qc, studioId])

  useFocusEffect(useCallback(() => {
    if (studioId) {
      qc.invalidateQueries({ queryKey: ['studio-stats', studioId] })
      qc.invalidateQueries({ queryKey: ['pending-evaluations', studioId] })
      qc.invalidateQueries({ queryKey: ['can-propose', studioId] })
    }
  }, [studioId]))

  const handleSearchPress = () => {
    if (!canPropose) {
      Alert.alert(
        'Propuestas bloqueadas',
        `Tenés ${pending.length} evaluación${pending.length > 1 ? 'es' : ''} pendiente${pending.length > 1 ? 's' : ''}. Evaluá a los instructores para desbloquear el envío de nuevas propuestas.`,
        [
          { text: 'Ir a evaluar', onPress: () => navigation.navigate('PendingEvaluations') },
          { text: 'Cancelar', style: 'cancel' },
        ]
      )
      return
    }
    navigation.navigate('Search')
  }

  if (isLoading) return <LoadingScreen message="Cargando tu estudio..." />

  const membership = studio?.membership

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.sage} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.studioName}>{studio?.name ?? 'Mi estudio'}</Text>
          <Text style={styles.studioMeta}>
            {studio?.neighborhood}
            {membership?.status === 'activa' ? ' · Socia Cámara' : ''}
          </Text>
        </View>

        {/* Banner de bloqueo */}
        {!canPropose && pending.length > 0 && (
          <TouchableOpacity
            style={styles.blockBanner}
            onPress={() => navigation.navigate('PendingEvaluations')}
            activeOpacity={0.85}
          >
            <View style={styles.blockIconWrap}>
              <Feather name="lock" size={20} color="#B8960C" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.blockTitle}>Propuestas bloqueadas</Text>
              <Text style={styles.blockSub}>
                Tenés {pending.length} evaluación{pending.length > 1 ? 'es' : ''} pendiente{pending.length > 1 ? 's' : ''}. Tocá para evaluar y desbloquear.
              </Text>
            </View>
            <Feather name="chevron-right" size={16} color="#B8960C" />
          </TouchableOpacity>
        )}

        {/* KPIs */}
        <View style={styles.kpiGrid}>
          <View style={styles.kpiCard}>
            <Text style={[styles.kpiNum, { color: colors.sage }]}>
              {stats?.avg_score ? stats.avg_score.toFixed(1) : '—'}
            </Text>
            <Text style={styles.kpiLbl}>Puntaje promedio</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiNum}>{stats?.unique_instructors ?? 0}</Text>
            <Text style={styles.kpiLbl}>Instructores</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiNum}>{stats?.total_evaluations ?? 0}</Text>
            <Text style={styles.kpiLbl}>Evaluaciones</Text>
          </View>
          <View style={[styles.kpiCard, !canPropose && { borderColor: '#EF9F27', borderWidth: 1 }]}>
            <Text style={[styles.kpiNum, !canPropose && { color: '#854F0B' }]}>
              {pending.length}
            </Text>
            <Text style={styles.kpiLbl}>Por evaluar</Text>
          </View>
        </View>

        {/* Botón buscar */}
        <TouchableOpacity style={styles.searchBtn} onPress={handleSearchPress} activeOpacity={0.85}>
          <View style={styles.searchBtnInner}>
            <Feather name={canPropose ? 'search' : 'lock'} size={18} color={canPropose ? colors.white : '#B8960C'} />
            <Text style={[styles.searchBtnText, !canPropose && { color: '#633806' }]}>
              {canPropose ? 'Buscar instructor' : 'Buscar instructor (bloqueado)'}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Evaluaciones pendientes */}
        {pending.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Pendientes de evaluar</Text>
            <Card style={styles.listCard}>
              {pending.slice(0, 3).map((item: any, idx: number) => (
                <View
                  key={item.id}
                  style={[styles.pendingRow, idx === Math.min(pending.length, 3) - 1 && { borderBottomWidth: 0 }]}
                >
                  <Avatar name={item.instructor?.full_name} size={34} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.instrName}>{item.instructor?.full_name}</Text>
                    <Text style={styles.instrMeta}>
                      {item.class_type === 'reemplazo' ? 'Reemplazo' : 'Regular'} · {
                        new Date(item.class_date + 'T00:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
                      }
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.evalBtn}
                    onPress={() => navigation.navigate('EvaluateInstructor', {
                      instructorId: item.instructor_id,
                      classDate: item.class_date,
                      classType: item.class_type,
                    })}
                  >
                    <Text style={styles.evalBtnText}>Evaluar</Text>
                  </TouchableOpacity>
                </View>
              ))}
              {pending.length > 3 && (
                <TouchableOpacity
                  style={styles.seeAll}
                  onPress={() => navigation.navigate('PendingEvaluations')}
                >
                  <Text style={styles.seeAllText}>Ver todas ({pending.length})</Text>
                </TouchableOpacity>
              )}
            </Card>
          </>
        )}

        {/* Historial reciente */}
        <Text style={styles.sectionTitle}>Historial reciente</Text>
        {history.length === 0 ? (
          <EmptyState
            icon="clock"
            title="Sin historial aún"
            subtitle="Tus propuestas enviadas aparecerán acá."
          />
        ) : (
          <Card style={styles.listCard}>
            {history.slice(0, 4).map((item: any, idx: number) => (
              <View
                key={item.id}
                style={[styles.histRow, idx === Math.min(history.length, 4) - 1 && { borderBottomWidth: 0 }]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.instrName}>{item.instructor?.full_name}</Text>
                  <Text style={styles.instrMeta}>
                    {new Date(item.class_date + 'T00:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}
                    {' · '}{item.class_type === 'reemplazo' ? 'Reemplazo' : 'Regular'}
                  </Text>
                </View>
                <Badge
                  label={item.status === 'aceptado' ? 'Aceptada' : item.status === 'rechazado' ? 'Rechazada' : 'Pendiente'}
                  variant={item.status === 'aceptado' ? 'success' : item.status === 'rechazado' ? 'danger' : 'warning'}
                />
              </View>
            ))}
          </Card>
        )}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: colors.cream },
  scroll:         { flex: 1 },
  content:        { padding: spacing.md, paddingBottom: spacing.xxxl },
  header:         { marginBottom: spacing.md },
  studioName:     { fontFamily: 'Nunito-Bold', fontSize: 24, color: colors.dark },
  studioMeta:     { ...typography.small, color: colors.mid, marginTop: 3 },
  blockBanner:    { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: '#FFF6E0', borderRadius: radius.lg, borderWidth: 1, borderColor: '#EF9F27', padding: spacing.md, marginBottom: spacing.md },
  blockIconWrap:  { width: 36, height: 36, borderRadius: 18, backgroundColor: '#FAEEDA', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  blockTitle:     { fontFamily: 'Nunito-SemiBold', fontSize: 13, color: '#633806' },
  blockSub:       { ...typography.small, color: '#854F0B', marginTop: 2, lineHeight: 16 },
  kpiGrid:        { display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md } as any,
  kpiCard:        { flex: 1, minWidth: '45%', backgroundColor: colors.white, borderRadius: radius.md, padding: spacing.md, borderWidth: 0.5, borderColor: colors.borderLight },
  kpiNum:         { fontFamily: 'Nunito-SemiBold', fontSize: 26, color: colors.dark },
  kpiLbl:         { ...typography.small, color: colors.mid, marginTop: 2 },
  searchBtn:      { backgroundColor: colors.sage, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md },
  searchBtnInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  searchBtnText:  { fontFamily: 'Nunito-SemiBold', fontSize: 15, color: colors.white },
  sectionTitle:   { fontFamily: 'Nunito-SemiBold', fontSize: 11, color: colors.mid, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing.sm },
  listCard:       { padding: 0, paddingHorizontal: spacing.md, marginBottom: spacing.md, overflow: 'hidden' },
  pendingRow:     { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm + 2, borderBottomWidth: 0.5, borderColor: colors.borderLight },
  histRow:        { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm + 2, borderBottomWidth: 0.5, borderColor: colors.borderLight },
  instrName:      { fontFamily: 'Nunito-SemiBold', fontSize: 13, color: colors.dark },
  instrMeta:      { ...typography.small, color: colors.mid, marginTop: 2 },
  evalBtn:        { backgroundColor: colors.sageLight, borderRadius: radius.sm, paddingHorizontal: spacing.sm + 2, paddingVertical: spacing.xs + 2 },
  evalBtnText:    { fontFamily: 'Nunito-SemiBold', fontSize: 11, color: colors.sage },
  seeAll:         { paddingVertical: spacing.sm, alignItems: 'center' },
  seeAllText:     { fontFamily: 'Nunito-SemiBold', fontSize: 12, color: colors.sage },
})
