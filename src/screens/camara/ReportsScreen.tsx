// src/screens/camara/ReportsScreen.tsx — Estadísticas y reportes de la red

import React, { useState } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { supabase, db } from '../../lib/supabase'
import { Card, LoadingScreen, colors, spacing, radius, typography } from '../../components/ui'
import { Feather } from '@expo/vector-icons'

type Period = 'month' | 'quarter' | 'year'

export default function ReportsScreen({ navigation }: any) {
  const [period, setPeriod] = useState<Period>('month')

  const { data: stats, isLoading } = useQuery({
    queryKey: ['camara-reports', period],
    queryFn: async () => {
      const now   = new Date()
      const start = new Date(now)
      if (period === 'month')   start.setDate(1)
      if (period === 'quarter') start.setMonth(now.getMonth() - 3)
      if (period === 'year')    start.setFullYear(now.getFullYear() - 1)
      const startStr = start.toISOString().split('T')[0]

      const [matchesRes, evalsRes, studioEvalsRes, topInst, topStudios, reports] = await Promise.all([
        // Propuestas
        supabase.from('matches')
          .select('status', { count: 'exact' })
          .gte('created_at', startStr),
        // Evaluaciones de instructores
        supabase.from('evaluations')
          .select('average_score', { count: 'exact' })
          .gte('created_at', startStr),
        // Reportes de estudios
        supabase.from('studio_evaluations')
          .select('*', { count: 'exact' })
          .gte('created_at', startStr)
          .or('issue_late_payment.eq.true,issue_last_minute.eq.true,issue_bad_treatment.eq.true,issue_bad_facilities.eq.true'),
        // Top instructores
        supabase.from('instructors')
          .select('id, full_name, avatar_url')
          .eq('verification_status', 'verificado')
          .limit(5),
        // Top estudios
        db.studios()
          .select('id, name, neighborhood, is_member')
          .eq('is_member', true)
          .limit(5),
        // Todos los reportes de estudios
        supabase.from('studio_evaluations')
          .select('studio_id, studio:studios(name), issue_late_payment, issue_last_minute, issue_bad_treatment, issue_bad_facilities')
          .gte('created_at', startStr)
          .or('issue_late_payment.eq.true,issue_last_minute.eq.true,issue_bad_treatment.eq.true,issue_bad_facilities.eq.true'),
      ])

      const matches  = matchesRes.data ?? []
      const accepted = matches.filter((m: any) => m.status === 'aceptado').length
      const total    = matchesRes.count ?? 0
      const scores   = (evalsRes.data ?? []).map((e: any) => e.average_score)
      const avgScore = scores.length > 0 ? scores.reduce((a: number, b: number) => a + b, 0) / scores.length : 0

      // Agrupar reportes por estudio
      const reportMap: Record<string, { name: string; count: number; issues: string[] }> = {}
      ;(reports.data ?? []).forEach((r: any) => {
        if (!reportMap[r.studio_id]) {
          reportMap[r.studio_id] = { name: r.studio?.name ?? '?', count: 0, issues: [] }
        }
        reportMap[r.studio_id].count++
        if (r.issue_late_payment)   reportMap[r.studio_id].issues.push('Pago tardío')
        if (r.issue_last_minute)    reportMap[r.studio_id].issues.push('Cambio de último momento')
        if (r.issue_bad_treatment)  reportMap[r.studio_id].issues.push('Trato inadecuado')
        if (r.issue_bad_facilities) reportMap[r.studio_id].issues.push('Equipamiento')
      })

      return {
        totalMatches:    total,
        acceptedMatches: accepted,
        acceptRate:      total > 0 ? Math.round((accepted / total) * 100) : 0,
        totalEvals:      evalsRes.count ?? 0,
        avgScore:        Math.round(avgScore * 10) / 10,
        studioReports:   Object.values(reportMap).sort((a, b) => b.count - a.count).slice(0, 5),
        topInstructors:  topInst.data ?? [],
        topStudios:      topStudios.data ?? [],
      }
    },
    staleTime: 5 * 60_000,
  })

  const PERIODS: { key: Period; label: string }[] = [
    { key: 'month',   label: 'Este mes' },
    { key: 'quarter', label: 'Últimos 3 meses' },
    { key: 'year',    label: 'Este año' },
  ]

  if (isLoading) return <LoadingScreen message="Cargando reportes..." />

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      {/* Selector de período */}
      <View style={styles.periodRow}>
        {PERIODS.map(p => (
          <TouchableOpacity
            key={p.key}
            style={[styles.periodBtn, period === p.key && styles.periodActive]}
            onPress={() => setPeriod(p.key)}
          >
            <Text style={[styles.periodText, period === p.key && styles.periodTextActive]}>
              {p.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* KPIs actividad */}
      <Text style={styles.sectionTitle}>Actividad de la red</Text>
      <View style={styles.kpiGrid}>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiNum}>{stats?.totalMatches ?? 0}</Text>
          <Text style={styles.kpiLbl}>Propuestas</Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={[styles.kpiNum, { color: colors.sage }]}>{stats?.acceptRate ?? 0}%</Text>
          <Text style={styles.kpiLbl}>Aceptación</Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiNum}>{stats?.totalEvals ?? 0}</Text>
          <Text style={styles.kpiLbl}>Evaluaciones</Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={[styles.kpiNum, { color: colors.sage }]}>{stats?.avgScore ?? '—'}</Text>
          <Text style={styles.kpiLbl}>Puntaje red</Text>
        </View>
      </View>

      {/* Estudios con reportes */}
      {(stats?.studioReports?.length ?? 0) > 0 && (
        <>
          <Text style={styles.sectionTitle}>Estudios con reportes de instructores</Text>
          <Card style={[styles.listCard, { marginBottom: spacing.md }]}>
            {stats!.studioReports.map((r, idx) => (
              <View key={idx} style={[styles.reportRow, idx === stats!.studioReports.length - 1 && { borderBottomWidth: 0 }]}>
                <View style={[styles.rAvatar, { borderRadius: 6 }]}>
                  <Text style={styles.rLetter}>{r.name?.[0]?.toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rName}>{r.name}</Text>
                  <Text style={styles.rMeta}>{[...new Set(r.issues)].slice(0, 2).join(' · ')}</Text>
                </View>
                <View style={[
                  styles.reportBadge,
                  r.count >= 3 && { backgroundColor: '#FCEBEB' }
                ]}>
                  <Text style={[
                    styles.reportBadgeText,
                    r.count >= 3 && { color: '#791F1F' }
                  ]}>{r.count} reporte{r.count !== 1 ? 's' : ''}</Text>
                </View>
              </View>
            ))}
          </Card>
        </>
      )}

      {/* Top instructores */}
      <Text style={styles.sectionTitle}>Instructores activos</Text>
      <Card style={[styles.listCard, { marginBottom: spacing.md }]}>
        {(stats?.topInstructors ?? []).map((inst: any, idx: number) => (
          <View key={inst.id} style={[styles.reportRow, idx === (stats?.topInstructors?.length ?? 1) - 1 && { borderBottomWidth: 0 }]}>
            <View style={styles.rAvatar}>
              <Text style={styles.rLetter}>{inst.full_name?.[0]?.toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rName}>{inst.full_name}</Text>
            </View>
            <View style={styles.rankBadge}>
              <Text style={styles.rankNum}>#{idx + 1}</Text>
            </View>
          </View>
        ))}
        {(stats?.topInstructors?.length ?? 0) === 0 && (
          <View style={styles.reportRow}>
            <Text style={{ ...typography.small, color: colors.light }}>Sin datos aún</Text>
          </View>
        )}
      </Card>

      {/* Top estudios */}
      <Text style={styles.sectionTitle}>Estudios más activos</Text>
      <Card style={[styles.listCard, { marginBottom: spacing.xl }]}>
        {(stats?.topStudios ?? []).map((studio: any, idx: number) => (
          <View key={studio.id} style={[styles.reportRow, idx === (stats?.topStudios?.length ?? 1) - 1 && { borderBottomWidth: 0 }]}>
            <View style={[styles.rAvatar, { borderRadius: 6 }]}>
              <Text style={styles.rLetter}>{studio.name?.[0]?.toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rName}>{studio.name}</Text>
              <Text style={styles.rMeta}>{studio.neighborhood}</Text>
            </View>
            <View style={styles.rankBadge}>
              <Text style={styles.rankNum}>#{idx + 1}</Text>
            </View>
          </View>
        ))}
      </Card>

    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container:         { flex: 1, backgroundColor: colors.cream },
  content:           { padding: spacing.md, paddingBottom: spacing.xxxl },
  periodRow:         { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.md },
  periodBtn:         { flex: 1, paddingVertical: spacing.sm, borderRadius: radius.full, backgroundColor: colors.white, borderWidth: 0.5, borderColor: colors.border, alignItems: 'center' },
  periodActive:      { backgroundColor: colors.sage, borderColor: colors.sage },
  periodText:        { fontFamily: 'Nunito-SemiBold', fontSize: 11, color: colors.mid },
  periodTextActive:  { color: colors.white },
  sectionTitle:      { fontFamily: 'Nunito-SemiBold', fontSize: 11, color: colors.mid, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing.sm },
  kpiGrid:           { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  kpiCard:           { flex: 1, minWidth: '45%', backgroundColor: colors.white, borderRadius: radius.md, padding: spacing.md, borderWidth: 0.5, borderColor: colors.borderLight },
  kpiNum:            { fontFamily: 'Nunito-SemiBold', fontSize: 26, color: colors.dark },
  kpiLbl:            { ...typography.small, color: colors.mid, marginTop: 2 },
  listCard:          { paddingHorizontal: spacing.md, paddingVertical: 0 },
  reportRow:         { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm + 2, borderBottomWidth: 0.5, borderColor: colors.borderLight },
  rAvatar:           { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.sageLight, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  rLetter:           { fontFamily: 'Nunito-SemiBold', fontSize: 14, color: colors.sage },
  rName:             { fontFamily: 'Nunito-SemiBold', fontSize: 13, color: colors.dark },
  rMeta:             { ...typography.small, color: colors.mid, marginTop: 2 },
  reportBadge:       { backgroundColor: '#FAEEDA', borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 3 },
  reportBadgeText:   { fontFamily: 'Nunito-SemiBold', fontSize: 10, color: '#633806' },
  rankBadge:         { backgroundColor: colors.sageLight, borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 3 },
  rankNum:           { fontFamily: 'Nunito-SemiBold', fontSize: 11, color: colors.sage },
})
