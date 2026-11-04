import React, { useState } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { parseLocalDate } from '../../lib/dates'
import { LoadingScreen, ErrorState, colors, spacing, radius, typography } from '../../components/ui'
import BlobCard from '../../components/BlobCard'
import HeroHeader from '../../components/HeroHeader'
import { Feather } from '@expo/vector-icons'

type Period = 'month' | 'quarter' | 'year'
const PERIODS: { key: Period; label: string }[] = [
  { key: 'month',   label: 'Este mes' },
  { key: 'quarter', label: 'Últimos 3 meses' },
  { key: 'year',    label: 'Este año' },
]

const KPI = ({ num, label, color, sub, delay = 0 }: any) => (
  <BlobCard style={s.kpi} delay={delay}>
    <Text style={[s.kpiNum, color && { color }]}>{num}</Text>
    <Text style={s.kpiLabel}>{label}</Text>
    {sub ? <Text style={s.kpiSub}>{sub}</Text> : null}
  </BlobCard>
)

const SectionTitle = ({ icon, title }: any) => (
  <View style={s.sectionRow}>
    <Feather name={icon} size={14} color={colors.sage} />
    <Text style={s.sectionTitle}>{title}</Text>
  </View>
)

export default function ReportsScreen() {
  const [period, setPeriod] = useState<Period>('month')

  const { data: stats, isLoading, isError, refetch } = useQuery({
    queryKey: ['camara-reports', period],
    queryFn: async () => {
      const now   = new Date()
      let start: Date
      if (period === 'month')        start = new Date(now.getFullYear(), now.getMonth(), 1)
      else if (period === 'quarter') start = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate())
      else                           start = new Date(now.getFullYear(), 0, 1)
      const startIso = start.toISOString()

      // Sin filtrar por camara_id: los registros nuevos llegan con camara_id null
      const results = await Promise.all([
        supabase.from('matches').select('status, class_type, created_at').gte('created_at', startIso),
        supabase.from('evaluations').select('instructor_id, average_score, score_technique, created_at').gte('created_at', startIso),
        supabase.from('instructors').select('id, full_name, verification_status, is_active, created_at'),
        supabase.from('studios').select('id, is_member, created_at'),
        supabase.from('memberships').select('studio_id, plan_type, status, end_date, price_ars, monthly_price_ars'),
        supabase.from('evaluations').select('instructor_id, average_score'),
      ])
      const failed = results.find(r => r.error)
      if (failed?.error) throw failed.error
      const [matchesRes, evalsRes, instructorsRes, studiosRes, membershipsRes, allEvalsRes] = results

      const matches     = matchesRes.data ?? []
      const evals       = evalsRes.data ?? []
      const instructors = instructorsRes.data ?? []
      const studios     = studiosRes.data ?? []
      const memberships = membershipsRes.data ?? []
      const inPeriod = (d: string) => new Date(d) >= start

      // ── Actividad ──
      const total      = matches.length
      const answered   = matches.filter((m: any) => m.status === 'aceptado' || m.status === 'rechazado').length
      const accepted   = matches.filter((m: any) => m.status === 'aceptado').length
      const acceptRate = answered > 0 ? Math.round((accepted / answered) * 100) : null
      const regular    = matches.filter((m: any) => m.class_type === 'regular').length
      const reemplazo  = matches.filter((m: any) => m.class_type === 'reemplazo').length

      // ── Evaluaciones ──
      const avg = (xs: number[]) => xs.length ? (xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(1) : '—'
      const avgScore = avg(evals.map((e: any) => Number(e.average_score)).filter(n => !isNaN(n) && n > 0))
      const avgTech  = avg(evals.map((e: any) => Number(e.score_technique)).filter(n => !isNaN(n) && n > 0))

      // ── Instructores ──
      const verified = instructors.filter((i: any) => i.verification_status === 'verificado')
      const pending  = instructors.filter((i: any) => i.verification_status === 'pendiente')
      // Ranking: promedio histórico de evaluaciones de cada instructor verificado (mínimo 1)
      const byInstructor: Record<string, number[]> = {}
      ;(allEvalsRes.data ?? []).forEach((e: any) => {
        if (e.average_score == null) return
        ;(byInstructor[e.instructor_id] ??= []).push(Number(e.average_score))
      })
      const topInst = verified
        .filter((i: any) => byInstructor[i.id]?.length)
        .map((i: any) => {
          const xs = byInstructor[i.id]
          return { id: i.id, full_name: i.full_name, score: xs.reduce((a, b) => a + b, 0) / xs.length, count: xs.length }
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, 5)

      // ── Estudios ──
      const members = studios.filter((s: any) => s.is_member).length

      // ── Membresías ──
      const activeMemberships = memberships.filter((m: any) => m.status === 'activa')
      const paid = activeMemberships.filter((m: any) => m.plan_type && m.plan_type !== 'freemium')
      const priced = paid.filter((m: any) => m.price_ars != null)
      const monthlyRevenue = priced.reduce((sum: number, m: any) => sum + (m.price_ars ?? 0), 0)
      const planCounts: Record<string, number> = {}
      activeMemberships.forEach((m: any) => {
        const k = m.plan_type ?? 'freemium'
        planCounts[k] = (planCounts[k] ?? 0) + 1
      })
      const in30 = new Date(); in30.setDate(in30.getDate() + 30)
      const expiringSoon = paid.filter((m: any) => m.end_date && parseLocalDate(m.end_date) <= in30).length

      return {
        total, accepted, acceptRate, regular, reemplazo,
        totalEvals: evals.length, avgScore, avgTech,
        totalInstructors: instructors.length, verified: verified.length,
        pending: pending.length, topInst,
        newInstructors: instructors.filter((i: any) => inPeriod(i.created_at)).length,
        totalStudios: studios.length, members, nonMembers: studios.length - members,
        newStudios: studios.filter((s: any) => inPeriod(s.created_at)).length,
        monthlyRevenue, revenueKnown: priced.length > 0, missingPrices: paid.length - priced.length,
        planCounts, expiringSoon, activeMemberships: activeMemberships.length, paidMemberships: paid.length,
      }
    },
  })

  const fmt = (n: number) => n > 0 ? '$' + n.toLocaleString('es-AR') : '—'

  return (
    <View style={{ flex: 1, backgroundColor: colors.cream }}>
      <HeroHeader
        title="Reportes"
        subtitle="Panel de control de la red"
        bottomElement={
          <View style={s.tabs}>
            {PERIODS.map(p => (
              <TouchableOpacity key={p.key} style={[s.tab, period === p.key && s.tabActive]} onPress={() => setPeriod(p.key)}>
                <Text style={[s.tabTxt, period === p.key && s.tabTxtActive]}>{p.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        }
      />

      {isLoading ? <LoadingScreen message="Armando reportes..." /> : isError || !stats ? (
        <ErrorState message="No pudimos cargar los reportes." onRetry={refetch} />
      ) : (
        <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

          {/* ── 1. ACTIVIDAD ── */}
          <SectionTitle icon="activity" title="ACTIVIDAD DE LA RED" />
          <View style={s.kpiGrid}>
            <KPI num={stats.total}      label="Propuestas"  delay={0} />
            <KPI num={stats.acceptRate === null ? '—' : `${stats.acceptRate}%`} label="Aceptación" sub="de las respondidas"
              color={stats.acceptRate === null ? colors.mid : stats.acceptRate >= 60 ? colors.okTx : colors.warnTx} delay={800} />
            <KPI num={stats.regular}    label="Regulares"   color={colors.sage} delay={1600} />
            <KPI num={stats.reemplazo}  label="Reemplazos"  color={colors.gold} delay={2400} />
          </View>

          {/* ── 2. CALIDAD ── */}
          <SectionTitle icon="star" title="CALIDAD Y EVALUACIONES" />
          <View style={s.kpiGrid}>
            <KPI num={stats.totalEvals} label="Evaluaciones"   delay={0} />
            <KPI num={stats.avgScore}   label="Puntaje promedio" color={colors.gold} delay={700} />
            <KPI num={stats.avgTech}    label="Técnica prom."   color={colors.sage} delay={1400} />
          </View>

          {/* ── 3. INSTRUCTORES ── */}
          <SectionTitle icon="users" title="INSTRUCTORES" />
          <View style={s.kpiGrid}>
            <KPI num={stats.totalInstructors} label="Total"        delay={0} />
            <KPI num={stats.verified}         label="Verificados"  color={colors.okTx} delay={600} />
            <KPI num={stats.pending}          label="Pendientes"   color={stats.pending > 0 ? colors.warnTx : colors.mid} delay={1200} />
            <KPI num={stats.newInstructors}   label="Nuevos"       color={colors.sage} sub={PERIODS.find(p => p.key === period)?.label} delay={1800} />
          </View>

          {stats.topInst.length > 0 && (
            <BlobCard style={s.rankCard} delay={500}>
              <Text style={s.rankTitle}>Mejores instructores por puntaje (histórico)</Text>
              {stats.topInst.map((i: any, idx: number) => (
                <View key={i.id} style={s.rankRow}>
                  <View style={s.rankNum}><Text style={s.rankNumTxt}>#{idx + 1}</Text></View>
                  <View style={s.rankAv}><Text style={s.rankAvTxt}>{i.full_name[0]}</Text></View>
                  <Text style={s.rankName}>{i.full_name}</Text>
                  <Text style={s.rankScore}>{i.score.toFixed(1)}</Text>
                </View>
              ))}
            </BlobCard>
          )}

          {/* ── 4. ESTUDIOS ── */}
          <SectionTitle icon="home" title="ESTUDIOS" />
          <View style={s.kpiGrid}>
            <KPI num={stats.totalStudios} label="Total"     delay={0} />
            <KPI num={stats.members}      label="Socios"    color={colors.okTx} delay={600} />
            <KPI num={stats.nonMembers}   label="No socios" color={colors.warnTx} delay={1200} />
            <KPI num={stats.newStudios}   label="Nuevos"    color={colors.sage} sub={PERIODS.find(p => p.key === period)?.label} delay={1800} />
          </View>

          {/* Conversión */}
          {stats.totalStudios > 0 && (
            <BlobCard style={[s.rankCard, { marginBottom: spacing.md }]} delay={300}
              blobColor="rgba(42,151,142,0.10)" blobColor2="rgba(42,151,142,0.06)">
              <Text style={s.rankTitle}>Estudios socios de la Cámara</Text>
              <View style={s.convRow}>
                <Text style={s.convPct}>{Math.round((stats.members / stats.totalStudios) * 100)}%</Text>
                <Text style={s.convDesc}>de los estudios registrados son socios</Text>
              </View>
              <View style={s.progressBar}>
                <View style={[s.progressFill, { width: `${Math.round((stats.members / stats.totalStudios) * 100)}%` }]} />
              </View>
            </BlobCard>
          )}

          {/* ── 5. FINANCIERO ── */}
          <SectionTitle icon="dollar-sign" title="MEMBRESÍAS Y FACTURACIÓN" />
          <View style={s.kpiGrid}>
            <KPI num={stats.revenueKnown ? fmt(stats.monthlyRevenue) : '—'} label="Ingresos mensuales" color={colors.gold}
              sub={stats.missingPrices > 0 ? `${stats.missingPrices} plan${stats.missingPrices > 1 ? 'es' : ''} sin precio cargado` : undefined} delay={0} />
            <KPI num={stats.paidMemberships}   label="Planes pagos activos" color={colors.okTx} sub={`${stats.activeMemberships} activas en total`} delay={700} />
            <KPI num={stats.expiringSoon}       label="Pagos que vencen en 30 días" color={stats.expiringSoon > 0 ? colors.redTx : colors.mid} delay={1400} />
          </View>

          {/* Distribución de planes */}
          {Object.keys(stats.planCounts).length > 0 && (
            <BlobCard style={s.rankCard} delay={400}
              blobColor="rgba(42,151,142,0.10)" blobColor2="rgba(42,151,142,0.06)">
              <Text style={s.rankTitle}>Distribución de planes</Text>
              {[
                { key: 'premium',  label: 'Premium',      color: colors.gold },
                { key: 'socio',    label: 'Socio Cámara', color: colors.blueTx },
                { key: 'starter',  label: 'Starter',      color: colors.sage },
                { key: 'freemium', label: 'Freemium',     color: colors.mid  },
              ].map(plan => {
                const count = stats.planCounts[plan.key] ?? 0
                const total = stats.activeMemberships || 1
                return (
                  <View key={plan.key} style={s.planRow}>
                    <Text style={[s.planLabel, { color: plan.color }]}>{plan.label}</Text>
                    <View style={s.planBar}>
                      <View style={[s.planBarFill, { width: `${(count / total) * 100}%`, backgroundColor: plan.color }]} />
                    </View>
                    <Text style={s.planCount}>{count}</Text>
                  </View>
                )
              })}
            </BlobCard>
          )}

        </ScrollView>
      )}
    </View>
  )
}

const s = StyleSheet.create({
  tabs:         { flexDirection: 'row', gap: 6, marginTop: 12 },
  tab:          { paddingVertical: 5, paddingHorizontal: 12, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.15)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.3)' },
  tabActive:    { backgroundColor: colors.white },
  tabTxt:       { fontFamily: 'Nunito-SemiBold', fontSize: 11, color: 'rgba(255,255,255,0.7)' },
  tabTxtActive: { color: colors.sage, fontFamily: 'Nunito-Bold' },
  content:      { padding: spacing.md, paddingBottom: 48 },
  sectionRow:   { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8, marginTop: 4 },
  sectionTitle: { ...typography.caption, color: colors.sage },
  kpiGrid:      { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  kpi:          { flexBasis: '47%', padding: spacing.md },
  kpiNum:       { fontFamily: 'Nunito-Bold', fontSize: 26, color: colors.dark, marginBottom: 2 },
  kpiLabel:     { ...typography.caption },
  kpiSub:       { fontFamily: 'Nunito-Regular', fontSize: 10, color: colors.light, marginTop: 2 },
  rankCard:     { padding: spacing.md, marginBottom: spacing.md },
  rankTitle:    { fontFamily: 'Nunito-Bold', fontSize: 11, color: colors.dark, marginBottom: spacing.sm },
  rankRow:      { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 6, borderBottomWidth: 0.5, borderColor: colors.borderLight },
  rankNum:      { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.sageLight, alignItems: 'center', justifyContent: 'center' },
  rankNumTxt:   { fontFamily: 'Nunito-Bold', fontSize: 10, color: colors.sage },
  rankAv:       { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.sageLighter, alignItems: 'center', justifyContent: 'center' },
  rankAvTxt:    { fontFamily: 'Nunito-Bold', fontSize: 13, color: colors.sage },
  rankName:     { fontFamily: 'Nunito-SemiBold', fontSize: 13, color: colors.dark, flex: 1 },
  rankScore:    { fontFamily: 'Nunito-Bold', fontSize: 14, color: colors.gold },
  convRow:      { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 8 },
  convPct:      { fontFamily: 'Nunito-Bold', fontSize: 32, color: colors.gold },
  convDesc:     { fontFamily: 'Nunito-Regular', fontSize: 13, color: colors.mid },
  progressBar:  { height: 8, backgroundColor: colors.sageLighter, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%' as any, backgroundColor: colors.gold, borderRadius: 4 },
  planRow:      { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 6 },
  planLabel:    { fontFamily: 'Nunito-Bold', fontSize: 12, width: 90 },
  planBar:      { flex: 1, height: 6, backgroundColor: colors.sageLighter, borderRadius: 3, overflow: 'hidden' },
  planBarFill:  { height: '100%' as any, borderRadius: 3 },
  planCount:    { fontFamily: 'Nunito-Bold', fontSize: 12, color: colors.dark, width: 24, textAlign: 'right' },
})
