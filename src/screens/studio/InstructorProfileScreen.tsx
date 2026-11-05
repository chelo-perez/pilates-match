import React, { useState } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native'
import { useCanMatch, useInstructor, useMyStudio } from '../../hooks'
import { Button, EmptyState, ErrorState, LoadingScreen, colors, spacing, typography } from '../../components/ui'
import { SPECIALTY_LABELS } from '../../constants/labels'
import { Feather } from '@expo/vector-icons'
import BlobCard from '../../components/BlobCard'
import HeroHeader from '../../components/HeroHeader'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { entity } from '../../lib/entity'

type Props = NativeStackScreenProps<any, 'InstructorProfile'>
type Tab = 'perfil' | 'certificaciones' | 'disponibilidad'

const TAB_LABELS: Record<Tab, string> = {
  perfil: 'Perfil', certificaciones: 'Certificaciones', disponibilidad: 'Disponibilidad',
}
const DAYS_ES: Record<string, string> = {
  lunes: 'Lun', martes: 'Mar', miercoles: 'Mié',
  jueves: 'Jue', viernes: 'Vie', sabado: 'Sáb', domingo: 'Dom',
}
const num = (v: any): number | null => (v == null || v === '' ? null : Number(v))
const fmt1 = (v: any) => { const n = num(v); return n == null ? '—' : n.toFixed(1) }

export default function InstructorProfileScreen({ navigation, route }: Props) {
  const { instructorId } = (route.params || {}) as any
  const [tab, setTab] = useState<Tab>('perfil')
  const { data: instructor, isLoading, isError, refetch } = useInstructor(instructorId)
  const { data: studio } = useMyStudio()
  const { data: canMatch } = useCanMatch(studio?.id)

  if (isLoading) return <LoadingScreen />
  if (isError) return <ErrorState message="No pudimos cargar el perfil del instructor." onRetry={refetch} />
  if (!instructor) {
    return <EmptyState icon="user-x" title="Perfil no disponible" message="Este instructor ya no está en el directorio." action="Volver" onAction={() => navigation.goBack()} />
  }

  const stats: any = instructor.stats
  const hasEvaluations = (stats?.total_evaluations ?? 0) > 0

  const certifications = (instructor.certifications ?? []).filter((c: any) => c.review_status !== 'rejected')
  const availability = (instructor.availability ?? []).filter((a: any) => a.is_active !== false)
  const limitReached = canMatch === false

  return (
    <View style={{ flex: 1, backgroundColor: colors.cream }}>
      <HeroHeader
        title={instructor.full_name}
        subtitle={instructor.neighborhood ?? undefined}
        onBack={() => navigation.goBack()}
        backLabel="Volver"
        rightElement={hasEvaluations ? (
          <View style={s.scoreWrap}>
            <Text style={s.scoreNum}>{fmt1(stats.avg_score)}</Text>
            <Text style={s.scoreLbl}>Puntaje</Text>
          </View>
        ) : undefined}
        bottomElement={
          <View style={s.heroBottom}>
            {instructor.verification_status === 'verificado' && (
              <View style={s.veriBadge}>
                <Text style={s.veriTxt}>✓ Verificado por {entity().la}</Text>
              </View>
            )}
          </View>
        }
      />

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* KPI stats */}
        <View style={s.kpiRow}>
          <BlobCard style={s.kpiCard} delay={0}>
            <Text style={s.kpiNum}>{stats?.total_evaluations ?? 0}</Text>
            <Text style={s.kpiLbl}>Evaluaciones</Text>
          </BlobCard>
          <BlobCard style={s.kpiCard} delay={1500}>
            <Text style={s.kpiNum}>{hasEvaluations ? fmt1(stats.avg_technique) : '—'}</Text>
            <Text style={s.kpiLbl}>Técnica</Text>
          </BlobCard>
          <BlobCard style={s.kpiCard} delay={3000}>
            <Text style={s.kpiNum}>{hasEvaluations ? fmt1(stats.avg_punctuality) : '—'}</Text>
            <Text style={s.kpiLbl}>Puntualidad</Text>
          </BlobCard>
        </View>

        {/* Tabs */}
        <View style={s.tabs}>
          {(['perfil', 'certificaciones', 'disponibilidad'] as Tab[]).map(t => (
            <TouchableOpacity key={t} style={[s.tab, tab === t && s.tabActive]} onPress={() => setTab(t)}>
              <Text style={[s.tabTxt, tab === t && s.tabTxtActive]}>{TAB_LABELS[t]}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={s.tabContent}>
          {tab === 'perfil' && (
            <>
              <BlobCard style={s.section} delay={200}>
                <Text style={s.sectionTitle}>SOBRE MÍ</Text>
                <Text style={s.bioText}>
                  {instructor.bio || 'Este instructor todavía no agregó una descripción.'}
                </Text>
              </BlobCard>
              {(instructor.specialties ?? []).length > 0 && (
                <BlobCard style={s.section} delay={800}>
                  <Text style={s.sectionTitle}>ESPECIALIDADES</Text>
                  <View style={s.chipRow}>
                    {instructor.specialties.map((sp: any) => (
                      <View key={sp.id ?? sp.specialty} style={s.chip}>
                        <Text style={s.chipTxt}>{(SPECIALTY_LABELS as Record<string, string>)[sp.specialty] ?? sp.specialty}</Text>
                      </View>
                    ))}
                  </View>
                </BlobCard>
              )}
              <BlobCard style={s.section} delay={1400}>
                <Text style={s.sectionTitle}>PUNTAJE POR CRITERIO</Text>
                {!hasEvaluations ? (
                  <Text style={s.emptyText}>Todavía no tiene evaluaciones de estudios.</Text>
                ) : [
                  { label: 'Técnica',      val: num(stats.avg_technique) },
                  { label: 'Puntualidad',  val: num(stats.avg_punctuality) },
                  { label: 'Trato',        val: num(stats.avg_student_care) },
                  { label: 'Presentación', val: num(stats.avg_presentation) },
                ].map(c => (
                  <View key={c.label} style={s.scoreRow}>
                    <Text style={s.scoreName}>{c.label}</Text>
                    <View style={s.scoreBar}>
                      <View style={[s.scoreBarFill, { width: `${((c.val ?? 0) / 10) * 100}%` }]} />
                    </View>
                    <Text style={s.scoreVal}>{c.val != null ? c.val.toFixed(1) : '—'}</Text>
                  </View>
                ))}
              </BlobCard>
            </>
          )}

          {tab === 'certificaciones' && (
            <BlobCard style={s.section} delay={200}>
              <Text style={s.sectionTitle}>CERTIFICACIONES</Text>
              {certifications.length === 0 ? (
                <Text style={s.emptyText}>Sin certificaciones cargadas</Text>
              ) : certifications.map((cert: any) => {
                const approved = cert.review_status === 'approved'
                return (
                  <View key={cert.id} style={s.certRow}>
                    <View style={[s.certIcon, { backgroundColor: approved ? colors.sageLight : colors.warnBg }]}>
                      <Feather name="award" size={16} color={approved ? colors.sage : colors.warnTx} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.certName}>{cert.name}</Text>
                      {cert.institution ? <Text style={s.certMeta}>{cert.institution}{cert.year ? ` · ${cert.year}` : ''}</Text> : null}
                      <View style={[s.miniTag, { backgroundColor: approved ? colors.okBg : colors.warnBg, marginTop: 4 }]}>
                        <Text style={[s.miniTagTxt, { color: approved ? colors.okTx : colors.warnTx }]}>
                          {approved ? `✓ Revisado por ${entity().la}` : 'En revisión'}
                        </Text>
                      </View>
                    </View>
                  </View>
                )
              })}
            </BlobCard>
          )}

          {tab === 'disponibilidad' && (
            <>
              <View style={s.daysStrip}>
                {Object.entries(DAYS_ES).map(([day, label]) => {
                  const hasSlot = availability.some((a: any) => a.day_of_week === day)
                  return (
                    <View key={day} style={[s.dayPill, hasSlot && s.dayPillActive]}>
                      <Text style={[s.dayLbl, hasSlot && s.dayLblActive]}>{label}</Text>
                      {hasSlot && <View style={s.dayDot} />}
                    </View>
                  )
                })}
              </View>
              <BlobCard style={s.section} delay={400}>
                {availability.length === 0 ? (
                  <Text style={s.emptyText}>Todavía no cargó sus horarios. Igual podés enviarle una propuesta.</Text>
                ) : Object.entries(DAYS_ES).map(([day, label]) => {
                  const slots = availability.filter((a: any) => a.day_of_week === day)
                  if (!slots.length) return null
                  return (
                    <View key={day} style={s.daySection}>
                      <Text style={s.dayTitle}>{label}</Text>
                      {slots.map((slot: any) => (
                        <View key={slot.id} style={s.slot}>
                          <Text style={s.slotTime}>{String(slot.start_time).slice(0, 5)} – {String(slot.end_time).slice(0, 5)}</Text>
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
              {(instructor.zones ?? []).length > 0 && (
                <BlobCard style={s.section} delay={1000}>
                  <Text style={s.sectionTitle}>ZONAS DONDE TRABAJA</Text>
                  <View style={s.chipRow}>
                    {instructor.zones.map((z: any) => (
                      <View key={z.id ?? z.neighborhood} style={s.chip}>
                        <Text style={s.chipTxt}>{z.neighborhood}</Text>
                      </View>
                    ))}
                  </View>
                </BlobCard>
              )}
            </>
          )}
        </View>

        {/* CTA */}
        <View style={s.ctaInner}>
          {limitReached && (
            <View style={[s.noteBox, { marginHorizontal: 0, backgroundColor: colors.warnBg }]}>
              <Feather name="alert-circle" size={13} color={colors.warnTx} />
              <Text style={[s.noteTxt, { color: colors.warnTx }]}>
                Ya usaste las propuestas que incluye tu plan este mes.
              </Text>
            </View>
          )}
          <Button
            label={limitReached ? 'Ver mi plan' : 'Pedir match →'}
            variant={limitReached ? 'secondary' : 'primary'}
            onPress={() => limitReached
              ? navigation.navigate('MembershipPaywall')
              : navigation.navigate('RequestMatch', { instructorId, instructorName: instructor.full_name })}
            fullWidth
            size="lg"
          />
        </View>
      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  scoreWrap:      { alignItems: 'center', gap: 2 },
  scoreNum:       { fontFamily: 'Nunito-Bold', fontSize: 22, color: colors.white },
  scoreLbl:       { fontFamily: 'Nunito-SemiBold', fontSize: 10, color: colors.sageLight, textTransform: 'uppercase' as const, letterSpacing: 0.5 },
  heroBottom:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  veriBadge:      { alignSelf: 'flex-start', backgroundColor: colors.goldLight, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  veriTxt:        { fontFamily: 'Nunito-Bold', fontSize: 10, color: colors.gold, letterSpacing: 0.3 },
  matchBadge:     { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.okBg, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  matchBadgeTxt:  { fontFamily: 'Nunito-Bold', fontSize: 10, color: colors.okTx },

  kpiRow:         { flexDirection: 'row', gap: spacing.sm, marginHorizontal: spacing.md, marginTop: spacing.md, marginBottom: spacing.md },
  kpiCard:        { flex: 1, padding: spacing.md, alignItems: 'center' },
  kpiNum:         { fontFamily: 'Nunito-Bold', fontSize: 22, color: colors.dark },
  kpiLbl:         { ...typography.caption, marginTop: 2 },

  tariffCard:     { marginHorizontal: spacing.md, marginBottom: spacing.md, padding: spacing.md },
  tariffRow:      { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 0.5, borderColor: colors.borderLight },
  tariffType:     { fontFamily: 'Nunito-SemiBold', fontSize: 13, color: colors.dark },
  tariffBudget:   { fontFamily: 'Nunito-Regular', fontSize: 11, color: colors.light, marginTop: 1 },
  tariffVal:      { fontFamily: 'Nunito-Bold', fontSize: 13, color: colors.sage, marginRight: spacing.sm },

  noteBox:        { flexDirection: 'row', alignItems: 'center', gap: 6, marginHorizontal: spacing.md, marginBottom: spacing.md, backgroundColor: colors.sageLighter, borderTopLeftRadius: 10, borderTopRightRadius: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 10, padding: spacing.sm },
  noteTxt:        { fontFamily: 'Nunito-SemiBold', fontSize: 12, color: colors.mid, flex: 1 },

  tabs:           { flexDirection: 'row', backgroundColor: colors.white, borderBottomWidth: 0.5, borderColor: colors.border, marginBottom: spacing.md },
  tab:            { flex: 1, paddingVertical: spacing.md, alignItems: 'center' },
  tabActive:      { borderBottomWidth: 2, borderColor: colors.sage },
  tabTxt:         { fontFamily: 'Nunito-SemiBold', fontSize: 12, color: colors.light },
  tabTxtActive:   { color: colors.sage, fontFamily: 'Nunito-Bold' },
  tabContent:     { paddingHorizontal: spacing.md, paddingBottom: 16 },

  section:        { padding: spacing.md, marginBottom: spacing.md },
  sectionTitle:   { ...typography.caption, marginBottom: spacing.md },
  bioText:        { fontFamily: 'Nunito-Regular', fontSize: 14, color: colors.mid, lineHeight: 22 },

  chipRow:        { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip:           { backgroundColor: colors.sageLight, borderTopLeftRadius: 10, borderTopRightRadius: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  chipTxt:        { fontFamily: 'Nunito-SemiBold', fontSize: 11, color: colors.sage },

  scoreRow:       { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  scoreName:      { fontFamily: 'Nunito-SemiBold', fontSize: 12, color: colors.mid, width: 90 },
  scoreBar:       { flex: 1, height: 5, backgroundColor: colors.sageLighter, borderRadius: 3, marginHorizontal: spacing.sm, overflow: 'hidden' },
  scoreBarFill:   { height: '100%' as any, backgroundColor: colors.sage, borderRadius: 3 },
  scoreVal:       { fontFamily: 'Nunito-Bold', fontSize: 12, color: colors.dark, width: 28, textAlign: 'right' },

  certRow:        { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, paddingVertical: spacing.sm, borderBottomWidth: 0.5, borderColor: colors.borderLight },
  certIcon:       { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  certName:       { fontFamily: 'Nunito-Bold', fontSize: 13, color: colors.dark },
  certMeta:       { fontFamily: 'Nunito-Regular', fontSize: 11, color: colors.light, marginTop: 2 },
  miniTag:        { alignSelf: 'flex-start', borderTopLeftRadius: 6, borderTopRightRadius: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  miniTagTxt:     { fontFamily: 'Nunito-Bold', fontSize: 10 },
  emptyText:      { fontFamily: 'Nunito-Regular', fontSize: 13, color: colors.light, textAlign: 'center', paddingVertical: spacing.lg },

  daysStrip:      { flexDirection: 'row', gap: 4, marginBottom: spacing.md },
  dayPill:        { flex: 1, alignItems: 'center', paddingVertical: 8, borderTopLeftRadius: 10, borderTopRightRadius: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 10, backgroundColor: colors.cream, borderWidth: 0.5, borderColor: colors.border },
  dayPillActive:  { backgroundColor: colors.sageLight, borderColor: colors.sage },
  dayLbl:         { fontSize: 10, fontFamily: 'Nunito-Bold', color: colors.light },
  dayLblActive:   { color: colors.sage },
  dayDot:         { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.sage, marginTop: 3 },
  daySection:     { marginBottom: spacing.md },
  dayTitle:       { fontFamily: 'Nunito-Bold', fontSize: 13, color: colors.dark, marginBottom: spacing.xs },
  slot:           { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  slotTime:       { fontFamily: 'Nunito-SemiBold', fontSize: 13, color: colors.dark },

  ctaInner:       { paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: 32 },
})
