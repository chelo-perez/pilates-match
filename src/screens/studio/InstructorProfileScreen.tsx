import React, { useState } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native'
import { useInstructor, useMyStudio } from '../../hooks'
import { studioAPI } from '../../lib/api'
import { Badge, ScoreDisplay, TariffMatchPill, LoadingScreen, colors, spacing } from '../../components/ui'
import { Feather } from '@expo/vector-icons'
import BlobCard from '../../components/BlobCard'
import HeroHeader from '../../components/HeroHeader'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'

type Props = NativeStackScreenProps<any, 'InstructorProfile'>
type Tab = 'perfil' | 'certificaciones' | 'disponibilidad'

const SPECIALTY_LABELS: Record<string, string> = {
  mat: 'Mat Pilates', reformer: 'Reformer', cadillac: 'Cadillac',
  chair: 'Chair', barrel: 'Barrel', prenatal: 'Pre/post parto',
  terapeutico: 'Terapéutico', adultos_mayores: 'Adultos mayores',
}
const DAYS_ES: Record<string, string> = {
  lunes: 'Lun', martes: 'Mar', miercoles: 'Mié',
  jueves: 'Jue', viernes: 'Vie', sabado: 'Sáb', domingo: 'Dom',
}

export default function InstructorProfileScreen({ navigation, route }: Props) {
  const { instructorId } = (route.params || {}) as any
  const [tab, setTab] = useState<Tab>('perfil')
  const { data: instructor, isLoading } = useInstructor(instructorId)
  const { data: studio } = useMyStudio()
  const [budget, setBudget] = React.useState<any>(null)

  React.useEffect(() => {
    if (studio?.id) studioAPI.getBudget(studio.id).then(setBudget)
  }, [studio?.id])

  if (isLoading || !instructor) return <LoadingScreen />

  const rates = instructor.rates
  const stats = instructor.stats
  const budget_regular     = budget?.max_regular ?? 0
  const budget_replacement = budget?.max_replacement ?? 0
  const tariffRegular: 'ok' | 'parcial' | 'sin_match'     = rates && budget_regular > 0 && rates.rate_regular <= budget_regular ? 'ok' : 'sin_match'
  const tariffReplacement: 'ok' | 'parcial' | 'sin_match' = rates && budget_replacement > 0 && rates.rate_replacement <= budget_replacement ? 'ok' : 'sin_match'
  const isFullMatch = tariffRegular === 'ok' && tariffReplacement === 'ok'

  return (
    <View style={{ flex: 1, backgroundColor: colors.cream }}>
      <HeroHeader
        title={instructor.full_name}
        subtitle={[instructor.neighborhood, instructor.years_experience > 0 && `${instructor.years_experience} años exp.`].filter(Boolean).join(' · ')}
        onBack={() => navigation.goBack()}
        backLabel="Resultados"
        rightElement={
          <View style={s.scoreWrap}>
            <Text style={s.scoreNum}>{stats?.avg_score > 0 ? stats.avg_score.toFixed(1) : '—'}</Text>
            <Text style={s.scoreLbl}>Puntaje</Text>
          </View>
        }
        bottomElement={
          <View style={s.heroBottom}>
            {instructor.verification_status === 'verificado' && (
              <View style={s.veriBadge}>
                <Text style={s.veriTxt}>✓ Verificado · CAPIAF</Text>
              </View>
            )}
            {isFullMatch && (
              <View style={s.matchBadge}>
                <Feather name="check-circle" size={11} color={colors.okTx} />
                <Text style={s.matchBadgeTxt}>Match de tarifas</Text>
              </View>
            )}
          </View>
        }
      />

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* KPI stats */}
        {stats && (
          <View style={s.kpiRow}>
            <BlobCard style={s.kpiCard} delay={0}>
              <Text style={s.kpiNum}>{stats.total_evaluations ?? 0}</Text>
              <Text style={s.kpiLbl}>Evaluaciones</Text>
            </BlobCard>
            <BlobCard style={s.kpiCard} delay={1500}>
              <Text style={s.kpiNum}>{stats.avg_technique?.toFixed(1) ?? '—'}</Text>
              <Text style={s.kpiLbl}>Técnica</Text>
            </BlobCard>
            <BlobCard style={s.kpiCard} delay={3000}>
              <Text style={s.kpiNum}>{stats.avg_punctuality?.toFixed(1) ?? '—'}</Text>
              <Text style={s.kpiLbl}>Puntualidad</Text>
            </BlobCard>
          </View>
        )}

        {/* Comparativa de tarifas */}
        {rates && budget_regular > 0 && (
          <BlobCard
            style={s.tariffCard}
            delay={500}
            blobColor={isFullMatch ? 'rgba(46,107,26,0.14)' : 'rgba(74,93,78,0.12)'}
            blobColor2={isFullMatch ? 'rgba(46,107,26,0.08)' : 'rgba(74,93,78,0.07)'}
          >
            <Text style={s.sectionTitle}>Comparativa de tarifas</Text>
            {[
              { type: 'Regular', ins: rates.rate_regular, studio: budget_regular, status: tariffRegular },
              { type: 'Reemplazo', ins: rates.rate_replacement, studio: budget_replacement, status: tariffReplacement },
            ].map(row => (
              <View key={row.type} style={s.tariffRow}>
                <Text style={s.tariffType}>{row.type}</Text>
                <Text style={s.tariffVal}>${row.ins.toLocaleString('es-AR')}</Text>
                <TariffMatchPill status={row.status} />
              </View>
            ))}
          </BlobCard>
        )}

        {/* Tabs */}
        <View style={s.tabs}>
          {(['perfil', 'certificaciones', 'disponibilidad'] as Tab[]).map(t => (
            <TouchableOpacity key={t} style={[s.tab, tab === t && s.tabActive]} onPress={() => setTab(t)}>
              <Text style={[s.tabTxt, tab === t && s.tabTxtActive]}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={s.tabContent}>
          {/* ── PERFIL ── */}
          {tab === 'perfil' && (
            <>
              <BlobCard style={s.section} delay={200}>
                <Text style={s.sectionTitle}>Sobre mí</Text>
                <Text style={s.bioText}>
                  {instructor.bio || 'Este instructor aún no agregó una descripción.'}
                </Text>
              </BlobCard>
              {instructor.specialties.length > 0 && (
                <BlobCard style={s.section} delay={800}>
                  <Text style={s.sectionTitle}>Especialidades</Text>
                  <View style={s.chipRow}>
                    {instructor.specialties.map((sp: any) => (
                      <View key={sp.id} style={s.chip}>
                        <Text style={s.chipTxt}>{SPECIALTY_LABELS[sp.specialty] ?? sp.specialty}</Text>
                      </View>
                    ))}
                  </View>
                </BlobCard>
              )}
              {stats && (
                <BlobCard style={s.section} delay={1400}>
                  <Text style={s.sectionTitle}>Puntaje por criterio</Text>
                  {[
                    { label: 'Técnica',      val: stats.avg_technique },
                    { label: 'Puntualidad',  val: stats.avg_punctuality },
                    { label: 'Trato',        val: stats.avg_student_care },
                    { label: 'Presentación', val: stats.avg_presentation },
                  ].map(c => (
                    <View key={c.label} style={s.scoreRow}>
                      <Text style={s.scoreName}>{c.label}</Text>
                      <View style={s.scoreBar}>
                        <View style={[s.scoreBarFill, { width: `${((c.val ?? 0) / 10) * 100}%` }]} />
                      </View>
                      <Text style={s.scoreVal}>{c.val?.toFixed(1) ?? '—'}</Text>
                    </View>
                  ))}
                </BlobCard>
              )}
            </>
          )}

          {/* ── CERTIFICACIONES ── */}
          {tab === 'certificaciones' && (
            <BlobCard style={s.section} delay={200}>
              <Text style={s.sectionTitle}>Certificaciones</Text>
              {instructor.certifications.length === 0 ? (
                <Text style={s.emptyText}>Sin certificaciones cargadas</Text>
              ) : instructor.certifications.map((cert: any) => (
                <View key={cert.id} style={s.certRow}>
                  <View style={[s.certIcon, { backgroundColor: cert.verified ? colors.sageLight : colors.warnBg }]}>
                    <Feather name="award" size={16} color={cert.verified ? colors.sage : colors.warnTx} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.certName}>{cert.name}</Text>
                    {cert.institution && <Text style={s.certMeta}>{cert.institution}{cert.year ? ` · ${cert.year}` : ''}</Text>}
                    <View style={[s.miniTag, { backgroundColor: cert.verified ? colors.okBg : colors.warnBg, marginTop: 4 }]}>
                      <Text style={[s.miniTagTxt, { color: cert.verified ? colors.okTx : colors.warnTx }]}>
                        {cert.verified ? '✓ Verificado' : 'En revisión'}
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
            </BlobCard>
          )}

          {/* ── DISPONIBILIDAD ── */}
          {tab === 'disponibilidad' && (
            <>
              <View style={s.daysStrip}>
                {Object.entries(DAYS_ES).map(([day, label]) => {
                  const hasSlot = instructor.availability.some((a: any) => a.day_of_week === day && a.is_active)
                  return (
                    <View key={day} style={[s.dayPill, hasSlot && s.dayPillActive]}>
                      <Text style={[s.dayLbl, hasSlot && s.dayLblActive]}>{label}</Text>
                      {hasSlot && <View style={s.dayDot} />}
                    </View>
                  )
                })}
              </View>
              <BlobCard style={s.section} delay={400}>
                {Object.entries(DAYS_ES).map(([day, label]) => {
                  const slots = instructor.availability.filter((a: any) => a.day_of_week === day && a.is_active)
                  if (!slots.length) return null
                  return (
                    <View key={day} style={s.daySection}>
                      <Text style={s.dayTitle}>{label}</Text>
                      {slots.map((slot: any) => (
                        <View key={slot.id} style={s.slot}>
                          <Text style={s.slotTime}>{slot.start_time.slice(0, 5)} – {slot.end_time.slice(0, 5)}</Text>
                          <View style={[s.chip, { backgroundColor: slot.class_type === 'regular' ? colors.sageLight : colors.goldLight }]}>
                            <Text style={[s.chipTxt, { color: slot.class_type === 'regular' ? colors.sage : colors.gold }]}>
                              {slot.class_type === 'regular' ? 'Regular' : 'Reemplazo'}
                            </Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  )
                })}
              </BlobCard>
              {instructor.zones.length > 0 && (
                <BlobCard style={s.section} delay={1000}>
                  <Text style={s.sectionTitle}>Zonas donde trabaja</Text>
                  <View style={s.chipRow}>
                    {instructor.zones.map((z: any) => (
                      <View key={z.id} style={s.chip}>
                        <Text style={s.chipTxt}>{z.neighborhood}</Text>
                      </View>
                    ))}
                  </View>
                </BlobCard>
              )}
            </>
          )}
        </View>

        {/* CTA dentro del scroll */}
        <View style={s.ctaInner}>
          <TouchableOpacity
            style={[s.ctaBtn, isFullMatch && s.ctaBtnMatch]}
            onPress={() => navigation.navigate('RequestMatch', { instructorId, instructorName: instructor.full_name })}
            activeOpacity={0.85}
          >
            <Text style={s.ctaTxt}>{isFullMatch ? 'Enviar solicitud →' : 'Ver disponibilidad →'}</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>


    </View>
  )
}

const s = StyleSheet.create({
  // Hero extras
  scoreWrap:      { alignItems: 'center', gap: 2 },
  scoreNum:       { fontFamily: 'Nunito-Bold', fontSize: 22, color: '#fff' },
  scoreLbl:       { fontFamily: 'Nunito-SemiBold', fontSize: 9, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase' as const, letterSpacing: 0.5 },
  heroBottom:     { flexDirection: 'row', gap: 8, marginTop: 12 },
  veriBadge:      { alignSelf: 'flex-start', backgroundColor: 'rgba(184,150,12,0.22)', borderWidth: 1, borderColor: 'rgba(184,150,12,0.38)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  veriTxt:        { fontFamily: 'Nunito-Bold', fontSize: 9, color: '#FFD060', letterSpacing: 0.5 },
  matchBadge:     { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(46,107,26,0.25)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  matchBadgeTxt:  { fontFamily: 'Nunito-Bold', fontSize: 9, color: '#A8FFAA' },

  // KPI
  kpiRow:         { flexDirection: 'row', gap: spacing.sm, marginHorizontal: spacing.md, marginTop: -12, marginBottom: spacing.md, zIndex: 2 },
  kpiCard:        { flex: 1, padding: spacing.md, alignItems: 'center' },
  kpiNum:         { fontFamily: 'Nunito-Bold', fontSize: 22, color: colors.dark },
  kpiLbl:         { fontFamily: 'Nunito-Bold', fontSize: 8, color: colors.light, textTransform: 'uppercase' as const, letterSpacing: 0.5, marginTop: 2 },

  // Tariffs
  tariffCard:     { marginHorizontal: spacing.md, marginBottom: spacing.md, padding: spacing.md },
  tariffRow:      { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 0.5, borderColor: colors.borderLight },
  tariffType:     { fontFamily: 'Nunito-SemiBold', fontSize: 13, color: colors.dark, flex: 1 },
  tariffVal:      { fontFamily: 'Nunito-Bold', fontSize: 13, color: colors.sage, marginRight: spacing.sm },

  // Tabs
  tabs:           { flexDirection: 'row', backgroundColor: colors.white, borderBottomWidth: 0.5, borderColor: colors.border, marginBottom: spacing.md },
  tab:            { flex: 1, paddingVertical: spacing.md, alignItems: 'center' },
  tabActive:      { borderBottomWidth: 2, borderColor: colors.sage },
  tabTxt:         { fontFamily: 'Nunito-SemiBold', fontSize: 12, color: colors.light },
  tabTxtActive:   { color: colors.sage, fontFamily: 'Nunito-Bold' },
  tabContent:     { paddingHorizontal: spacing.md, paddingBottom: 16 },

  // Sections
  section:        { padding: spacing.md, marginBottom: spacing.md },
  sectionTitle:   { fontFamily: 'Nunito-Bold', fontSize: 11, color: colors.light, textTransform: 'uppercase' as const, letterSpacing: 0.7, marginBottom: spacing.md },
  bioText:        { fontFamily: 'Nunito-Regular', fontSize: 14, color: colors.mid, lineHeight: 22 },

  // Chips
  chipRow:        { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip:           { backgroundColor: colors.sageLight, borderTopLeftRadius: 10, borderTopRightRadius: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  chipTxt:        { fontFamily: 'Nunito-SemiBold', fontSize: 11, color: colors.sage },

  // Score bars
  scoreRow:       { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  scoreName:      { fontFamily: 'Nunito-SemiBold', fontSize: 12, color: colors.mid, width: 90 },
  scoreBar:       { flex: 1, height: 5, backgroundColor: colors.sageLighter, borderRadius: 3, marginHorizontal: spacing.sm, overflow: 'hidden' },
  scoreBarFill:   { height: '100%' as any, backgroundColor: colors.sage, borderRadius: 3 },
  scoreVal:       { fontFamily: 'Nunito-Bold', fontSize: 12, color: colors.dark, width: 28, textAlign: 'right' },

  // Certs
  certRow:        { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, paddingVertical: spacing.sm, borderBottomWidth: 0.5, borderColor: colors.borderLight },
  certIcon:       { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  certName:       { fontFamily: 'Nunito-Bold', fontSize: 13, color: colors.dark },
  certMeta:       { fontFamily: 'Nunito-Regular', fontSize: 11, color: colors.light, marginTop: 2 },
  miniTag:        { alignSelf: 'flex-start', borderTopLeftRadius: 6, borderTopRightRadius: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  miniTagTxt:     { fontFamily: 'Nunito-Bold', fontSize: 9 },
  emptyText:      { fontFamily: 'Nunito-Regular', fontSize: 13, color: colors.light, textAlign: 'center', paddingVertical: spacing.xl },

  // Availability
  daysStrip:      { flexDirection: 'row', gap: 4, marginHorizontal: spacing.md, marginBottom: spacing.md },
  dayPill:        { flex: 1, alignItems: 'center', paddingVertical: 8, borderTopLeftRadius: 10, borderTopRightRadius: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 10, backgroundColor: colors.cream, borderWidth: 0.5, borderColor: colors.border },
  dayPillActive:  { backgroundColor: colors.sageLight, borderColor: colors.sage },
  dayLbl:         { fontSize: 9, fontFamily: 'Nunito-Bold', color: colors.light },
  dayLblActive:   { color: colors.sage },
  dayDot:         { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.sage, marginTop: 3 },
  daySection:     { marginBottom: spacing.md },
  dayTitle:       { fontFamily: 'Nunito-Bold', fontSize: 13, color: colors.dark, marginBottom: spacing.xs },
  slot:           { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  slotTime:       { fontFamily: 'Nunito-SemiBold', fontSize: 13, color: colors.dark },

  // CTA
  ctaInner:       { paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: 32 },
  ctaBtn:         { backgroundColor: colors.sage, borderTopLeftRadius: 14, borderTopRightRadius: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 14, padding: 15, alignItems: 'center' },
  ctaBtnMatch:    { backgroundColor: '#2E6B1A' },
  ctaTxt:         { fontFamily: 'Nunito-Bold', fontSize: 15, color: '#fff' },
})
