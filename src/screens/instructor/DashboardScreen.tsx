// src/screens/instructor/DashboardScreen.tsx
import React, { useState } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useMyInstructor } from '../../hooks'
import { toLocalISODate } from '../../lib/dates'
import { VERIFICATION_STATUS } from '../../constants/labels'
import { LoadingScreen, ErrorState, Button, colors, spacing, radius, typography } from '../../components/ui'
import { Feather } from '@expo/vector-icons'
import BlobCard from '../../components/BlobCard'
import HeroHeader from '../../components/HeroHeader'
import NotificationBell from '../../components/NotificationBell'
import { entity } from '../../lib/entity'
import LogoutPill from '../../components/LogoutPill'

const fmtMoney = (n?: number | null) => (n ? '$' + n.toLocaleString('es-AR') : 'Sin cargar')

export default function InstructorDashboardScreen({ navigation }: any) {
  const [refreshing, setRefreshing] = useState(false)
  const { data: instructor, isLoading, isError, refetch } = useMyInstructor()
  const instructorId = instructor?.id

  const openQ = useQuery({
    queryKey: ['open-classes', 'count', instructor?.id],
    queryFn: async () => { const { count } = await supabase.from('open_classes').select('id', { count: 'exact', head: true }).eq('status', 'abierta'); return count ?? 0 },
    enabled: !!instructor?.id,
  })
  // Nombre de la Cámara que verifica (no hardcodeado)
  const { data: camaraName } = useQuery({
    queryKey: ['camara-name', instructor?.camara_id ?? 'default'],
    queryFn: async () => {
      let q = supabase.from('camaras').select('name').limit(1)
      if (instructor?.camara_id) q = q.eq('id', instructor.camara_id)
      const { data, error } = await q.maybeSingle()
      if (error) throw error
      return data?.name ?? entity().la
    },
    enabled: !!instructor,
    staleTime: 60 * 60 * 1000,
  })

  const { data: stats, refetch: refetchStats } = useQuery({
    queryKey: ['my-instructor-stats', instructorId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_instructor_stats', { p_instructor_id: instructorId })
      if (error) throw error
      return data?.[0] ?? null
    },
    enabled: !!instructorId,
  })

  // Clases dadas y estudios distintos: matches aceptados con fecha pasada
  const { data: activity, refetch: refetchActivity } = useQuery({
    queryKey: ['instructor-matches', instructorId, 'activity'],
    queryFn: async () => {
      const today = toLocalISODate(new Date())
      const [done, pending] = await Promise.all([
        supabase.from('matches').select('studio_id').eq('instructor_id', instructorId!)
          .eq('status', 'aceptado').lt('class_date', today),
        supabase.from('matches').select('id', { count: 'exact', head: true }).eq('instructor_id', instructorId!)
          .eq('status', 'pendiente'),
      ])
      if (done.error) throw done.error
      if (pending.error) throw pending.error
      const rows = done.data ?? []
      return {
        classes: rows.length,
        studios: new Set(rows.map((r: any) => r.studio_id)).size,
        pending: pending.count ?? 0,
      }
    },
    enabled: !!instructorId,
  })

  const { data: recentEvals = [], refetch: refetchEvals } = useQuery({
    queryKey: ['my-recent-evals', instructorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('evaluations').select('id, average_score, comment, studio:studios(name)')
        .eq('instructor_id', instructorId!)
        .order('created_at', { ascending: false }).limit(3)
      if (error) throw error
      return data ?? []
    },
    enabled: !!instructorId,
  })

  const onRefresh = async () => {
    setRefreshing(true)
    await Promise.all([refetch(), refetchStats(), refetchActivity(), refetchEvals()])
    setRefreshing(false)
  }

  if (isLoading) return <LoadingScreen message="Cargando tu perfil..." />
  if (isError || !instructor) return <ErrorState message="No pudimos cargar tu perfil." onRetry={refetch} />

  const status      = instructor.verification_status ?? 'pendiente'
  const statusInfo  = VERIFICATION_STATUS[status] ?? VERIFICATION_STATUS.pendiente
  const isVerified  = status === 'verificado'
  const firstName   = instructor.full_name?.split(' ')?.[0] ?? 'Hola'
  const camara      = camaraName ?? entity().la
  const openCount   = openQ.data ?? 0
  const avgScore    = stats?.avg_score ? Number(stats.avg_score).toFixed(1) : '—'
  const hasActivity = (activity?.classes ?? 0) > 0 || Number(stats?.total_evaluations ?? 0) > 0
  const rates: any  = Array.isArray(instructor.rates) ? instructor.rates[0] : instructor.rates
  const bannerColors = status === 'rechazado'
    ? { bg: colors.redBg, tx: colors.redTx }
    : status === 'inactivo'
      ? { bg: colors.borderLight, tx: colors.mid }
      : { bg: colors.warnBg, tx: colors.warnTx }

  return (
    <View style={s.container}>
      <ScrollView
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.sage} />}
      >
        <HeroHeader
          title={firstName}
          subtitle={isVerified ? `Verificado por ${camara}` : statusInfo.label}
          centered
          avatarUri={instructor.avatar_url}
          avatarFallback={firstName}
          onAvatarPress={() => navigation.navigate('InstructorPerfil')}
          rightElement={
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <NotificationBell />
              <LogoutPill />
            </View>
          }
        />
        <View style={{ height: spacing.md }} />

        {/* Estado de verificación */}
        {!isVerified && (
          <View style={[s.statusBanner, { backgroundColor: bannerColors.bg }]}>
            <Feather name={status === 'rechazado' ? 'alert-circle' : 'clock'} size={14} color={bannerColors.tx} />
            <View style={{ flex: 1 }}>
              <Text style={[s.statusTitle, { color: bannerColors.tx }]}>{statusInfo.label}</Text>
              <Text style={[s.statusText, { color: bannerColors.tx }]}>
                {statusInfo.message ?? `Tu perfil está siendo revisado por ${camara}.`}
              </Text>
              {instructor.verification_note ? (
                <Text style={[s.statusNote, { color: bannerColors.tx }]}>Motivo: {instructor.verification_note}</Text>
              ) : null}
              {(status === 'rechazado' || instructor.verification_note) && (
                <TouchableOpacity onPress={() => navigation.navigate('InstructorPerfil')}>
                  <Text style={[s.statusLink, { color: bannerColors.tx }]}>Revisar mi perfil y certificados →</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* Acción principal: responder propuestas */}
        <View style={s.ctaWrap}>
          <Button
            label={activity?.pending ? `Ver propuestas (${activity.pending})` : 'Ver propuestas'}
            onPress={() => navigation.navigate('InstructorPropuestas')}
            icon={<Feather name="arrow-right" size={16} color={colors.white} />}
            fullWidth
          />
        </View>

        {/* Clases abiertas de la red */}
        <TouchableOpacity style={[s.studiosCard, { backgroundColor: colors.goldLight }]} onPress={() => navigation.navigate('OpenClasses')} activeOpacity={0.85}>
          <View style={s.studiosIcon}><Feather name="radio" size={16} color={colors.gold} /></View>
          <View style={{ flex: 1 }}>
            <Text style={[s.studiosTitle, { color: colors.gold }]}>{openCount ? `${openCount} clase${openCount > 1 ? 's' : ''} abierta${openCount > 1 ? 's' : ''} en tu red` : 'Clases abiertas'}</Text>
            <Text style={s.studiosSub}>{openCount ? 'Estudios que buscan instructor: anotate' : 'Cuando un estudio publique una clase, la ves acá'}</Text>
          </View>
          <Feather name="chevron-right" size={18} color={colors.gold} />
        </TouchableOpacity>

        {/* Estudios de la red: "me interesa" */}
        <TouchableOpacity style={s.studiosCard} onPress={() => navigation.navigate('InstructorStudios')} activeOpacity={0.85}>
          <View style={s.studiosIcon}><Feather name="heart" size={16} color={colors.sage} /></View>
          <View style={{ flex: 1 }}>
            <Text style={s.studiosTitle}>Estudios de tu red</Text>
            <Text style={s.studiosSub}>Marcá dónde te gustaría trabajar: te ven primero</Text>
          </View>
          <Feather name="chevron-right" size={18} color={colors.sage} />
        </TouchableOpacity>

        {/* Tarifas */}
        <BlobCard style={s.section} delay={1500}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>MIS TARIFAS POR CLASE</Text>
            <TouchableOpacity onPress={() => navigation.navigate('InstructorTarifas')}>
              <Text style={s.editLink}>Editar</Text>
            </TouchableOpacity>
          </View>
          <View style={s.ratesRow}>
            <View style={[s.rateCard, { backgroundColor: colors.sageLight }]}>
              <Text style={s.rateLabel}>Regular</Text>
              <Text style={s.rateVal}>{fmtMoney(rates?.rate_regular)}</Text>
            </View>
            <View style={[s.rateCard, { backgroundColor: colors.goldLight }]}>
              <Text style={[s.rateLabel, { color: colors.gold }]}>Reemplazo</Text>
              <Text style={[s.rateVal, { color: colors.gold }]}>{fmtMoney(rates?.rate_replacement)}</Text>
            </View>
          </View>
        </BlobCard>

        {/* Actividad: solo cuando ya hay clases o evaluaciones */}
        {hasActivity && (
        <View style={s.kpiRow}>
          <BlobCard style={s.kpiCard} delay={0}>
            <Text style={s.kpiNum}>{activity?.classes ?? 0}</Text>
            <Text style={s.kpiLbl}>Clases dadas</Text>
          </BlobCard>
          <BlobCard style={s.kpiCard} blobColor="rgba(42,151,142,0.16)" blobColor2="rgba(42,151,142,0.10)" delay={2500}>
            <Text style={s.kpiNum}>{activity?.studios ?? 0}</Text>
            <Text style={s.kpiLbl}>Estudios</Text>
          </BlobCard>
          <BlobCard style={s.kpiCard} delay={5000}>
            <Text style={s.kpiNum}>{avgScore}</Text>
            <Text style={s.kpiLbl}>Puntaje</Text>
          </BlobCard>
        </View>
        )}

        {/* Feedback */}
        <BlobCard style={s.section} delay={5000}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>ÚLTIMO FEEDBACK DE ESTUDIOS</Text>
          </View>
          {recentEvals.length === 0 ? (
            <Text style={s.emptyText}>Todavía no tenés evaluaciones. Aparecen acá cuando un estudio te evalúa después de una clase.</Text>
          ) : (
            recentEvals.map((item: any) => (
              <View key={item.id} style={s.evalRow}>
                <View style={s.evalAv}>
                  <Text style={s.evalAvTxt}>{item.studio?.name?.[0]?.toUpperCase() ?? '?'}</Text>
                </View>
                <View style={s.evalLeft}>
                  <Text style={s.evalStudio}>{item.studio?.name ?? 'Estudio'}</Text>
                  {item.comment ? <Text style={s.evalComment}>"{item.comment}"</Text> : null}
                </View>
                <View style={s.evalScoreCircle}>
                  <Text style={s.evalScoreNum}>{item.average_score != null ? Number(item.average_score).toFixed(1) : '—'}</Text>
                </View>
              </View>
            ))
          )}
        </BlobCard>

      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  container:       { flex: 1, backgroundColor: colors.cream },
  content:         { paddingBottom: 100 },

  verifiedTag:     { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'center', marginTop: 12, backgroundColor: 'rgba(42,151,142,0.22)', borderWidth: 1, borderColor: 'rgba(42,151,142,0.38)', borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 3 },
  verifiedTxt:     { fontFamily: 'Nunito-Bold', fontSize: 10, color: colors.goldLight, letterSpacing: 0.7 },

  kpiRow:          { flexDirection: 'row', gap: spacing.sm, marginHorizontal: spacing.md, marginBottom: spacing.md },
  ctaWrap:         { paddingHorizontal: spacing.md, marginBottom: spacing.md },
  kpiCard:         { flex: 1, padding: spacing.md },
  kpiNum:          { fontFamily: 'Nunito-Bold', fontSize: 24, color: colors.dark, lineHeight: 28 },
  kpiLbl:          { ...typography.caption, marginTop: 3 },

  statusBanner:    { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginHorizontal: spacing.md, marginBottom: spacing.md, ...radius.leaf, padding: spacing.md },
  statusTitle:     { fontFamily: 'Nunito-Bold', fontSize: 13 },
  statusText:      { fontFamily: 'Nunito-Regular', fontSize: 12, marginTop: 2, lineHeight: 17 },
  statusNote:      { fontFamily: 'Nunito-SemiBold', fontSize: 12, marginTop: 6 },
  statusLink:      { fontFamily: 'Nunito-Bold', fontSize: 12, marginTop: 8 },

  section:         { marginHorizontal: spacing.md, marginBottom: spacing.md, padding: spacing.md },
  studiosCard:     { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginHorizontal: spacing.md, marginBottom: spacing.md, backgroundColor: colors.sageLight, ...radius.leaf, padding: spacing.md },
  studiosIcon:     { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  studiosTitle:    { fontFamily: 'Nunito-Bold', fontSize: 14, color: colors.sage },
  studiosSub:      { fontFamily: 'Nunito-Regular', fontSize: 12, color: colors.mid, marginTop: 1 },
  sectionHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  sectionTitle:    { ...typography.caption },
  editLink:        { fontFamily: 'Nunito-Bold', fontSize: 12, color: colors.sage },

  ratesRow:        { flexDirection: 'row', gap: spacing.sm },
  rateCard:        { flex: 1, ...radius.leaf, padding: spacing.md },
  rateLabel:       { fontFamily: 'Nunito-Bold', fontSize: 10, color: colors.sageMid, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 5 },
  rateVal:         { fontFamily: 'Nunito-Bold', fontSize: 18, color: colors.sage },

  evalRow:         { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm, borderBottomWidth: 0.5, borderColor: colors.borderLight },
  evalAv:          { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.sageLight, alignItems: 'center', justifyContent: 'center' },
  evalAvTxt:       { fontFamily: 'Nunito-Bold', fontSize: 12, color: colors.sage },
  evalLeft:        { flex: 1 },
  evalStudio:      { fontFamily: 'Nunito-Bold', fontSize: 13, color: colors.dark },
  evalComment:     { fontFamily: 'Nunito-Regular', fontSize: 11, color: colors.mid, fontStyle: 'italic', marginTop: 3 },
  evalScoreCircle: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.sageLight, alignItems: 'center', justifyContent: 'center' },
  evalScoreNum:    { fontFamily: 'Nunito-Bold', fontSize: 12, color: colors.sage },
  emptyText:       { fontFamily: 'Nunito-Regular', fontSize: 13, color: colors.light, lineHeight: 19 },
})
