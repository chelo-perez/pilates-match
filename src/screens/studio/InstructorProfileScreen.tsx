// src/screens/studio/InstructorProfileScreen.tsx
import React, { useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert
} from 'react-native'
import { useInstructor, useMyStudio, useCreateMatch } from '../../hooks'
import { studioAPI } from '../../lib/api'
import {
  Card, Avatar, Badge, ScoreDisplay, TariffMatchPill, Button, LoadingScreen,
  colors, spacing, radius, typography
} from '../../components/ui'
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
  const createMatch = useCreateMatch()
  const [budget, setBudget] = React.useState<any>(null)

  React.useEffect(() => {
    if (studio?.id) studioAPI.getBudget(studio.id).then(setBudget)
  }, [studio?.id])

  if (isLoading || !instructor) return <LoadingScreen />

  const rates = instructor.rates
  const stats = instructor.stats
  const budget_regular = budget?.max_regular ?? 0
  const budget_replacement = budget?.max_replacement ?? 0

  const tariffRegular: 'ok' | 'parcial' | 'sin_match' =
    rates && budget_regular > 0 && rates.rate_regular <= budget_regular ? 'ok' : 'sin_match'
  const tariffReplacement: 'ok' | 'parcial' | 'sin_match' =
    rates && budget_replacement > 0 && rates.rate_replacement <= budget_replacement ? 'ok' : 'sin_match'
  const isFullMatch = tariffRegular === 'ok' && tariffReplacement === 'ok'

  const handleRequestMatch = () => {
    navigation.navigate('RequestMatch', { instructorId, instructorName: instructor.full_name })
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.cream }}>
      <ScrollView>
        {/* Hero header */}
        <View style={[styles.hero, isFullMatch && styles.heroMatch]}>
          <Avatar name={instructor.full_name} size={56} color={isFullMatch ? colors.sageMid : colors.lavender} />
          <View style={{ flex: 1, marginLeft: spacing.md }}>
            <Text style={styles.name}>{instructor.full_name}</Text>
            {instructor.neighborhood && (
              <Text style={styles.zone}>📍 {instructor.neighborhood}</Text>
            )}
            <View style={{ flexDirection: 'row', gap: spacing.xs, marginTop: spacing.xs, flexWrap: 'wrap' }}>
              {instructor.verification_status === 'verificado' && (
                <Badge label="✓ Verificada" color="sage" />
              )}
            </View>
          </View>
          <ScoreDisplay score={stats?.avg_score} size="lg" showLabel />
        </View>

        {/* Stats row */}
        {stats && (
          <View style={styles.statsRow}>
            {[
              { value: stats.total_evaluations, label: 'Evaluaciones' },
              { value: stats.avg_technique?.toFixed(1), label: 'Técnica' },
              { value: stats.avg_punctuality?.toFixed(1), label: 'Puntualidad' },
            ].map((s, i) => (
              <View key={i} style={styles.statItem}>
                <Text style={styles.statValue}>{s.value}</Text>
                <Text style={styles.statLabel}>{s.label}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Match de tarifas */}
        {rates && budget_regular > 0 && (
          <Card style={[styles.tariffCard, isFullMatch && styles.tariffCardMatch]}>
            <Text style={styles.sectionTitle}>Comparativa de tarifas</Text>
            <View style={styles.tariffTable}>
              <View style={styles.tariffHeader}>
                <Text style={[styles.tariffCol, { flex: 1.5 }]}>Tipo</Text>
                <Text style={[styles.tariffCol, { color: colors.lavDark }]}>Instructora</Text>
                <Text style={[styles.tariffCol, { color: colors.sage }]}>Tu oferta</Text>
                <Text style={styles.tariffCol}>Estado</Text>
              </View>
              {[
                { type: 'Regular', ins: rates.rate_regular, studio: budget_regular, status: tariffRegular },
                { type: 'Reemplazo', ins: rates.rate_replacement, studio: budget_replacement, status: tariffReplacement },
              ].map(row => (
                <View key={row.type} style={styles.tariffRow}>
                  <Text style={[styles.tariffCell, { flex: 1.5 }]}>{row.type}</Text>
                  <Text style={[styles.tariffCell, { color: colors.lavDark, fontFamily: 'DM_Sans-SemiBold' }]}>
                    ${row.ins.toLocaleString('es-AR')}
                  </Text>
                  <Text style={[styles.tariffCell, { color: colors.sage, fontFamily: 'DM_Sans-SemiBold' }]}>
                    ${row.studio.toLocaleString('es-AR')}
                  </Text>
                  <View style={styles.tariffCell}>
                    <TariffMatchPill status={row.status}  />
                  </View>
                </View>
              ))}
            </View>
          </Card>
        )}

        {/* Tabs */}
        <View style={styles.tabs}>
          {(['perfil', 'certificaciones', 'disponibilidad'] as Tab[]).map(t => (
            <TouchableOpacity key={t} style={[styles.tab, tab === t && styles.tabActive]} onPress={() => setTab(t)}>
              <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={{ padding: spacing.lg }}>
          {tab === 'perfil' && (
            <>
              {instructor.bio && (
                <Card style={styles.section}>
                  <Text style={styles.sectionTitle}>Sobre mí</Text>
                  <Text style={styles.bioText}>{instructor.bio}</Text>
                </Card>
              )}
              {instructor.specialties.length > 0 && (
                <Card style={styles.section}>
                  <Text style={styles.sectionTitle}>Especialidades</Text>
                  <View style={styles.chipRow}>
                    {instructor.specialties.map((sp: any) => (
                      <Badge key={sp.id} label={SPECIALTY_LABELS[sp.specialty] ?? sp.specialty} color="lavender" />
                    ))}
                  </View>
                </Card>
              )}
              {stats && (
                <Card style={styles.section}>
                  <Text style={styles.sectionTitle}>Puntaje por criterio</Text>
                  {[
                    { label: 'Técnica', val: stats.avg_technique },
                    { label: 'Puntualidad', val: stats.avg_punctuality },
                    { label: 'Trato', val: stats.avg_student_care },
                    { label: 'Presentación', val: stats.avg_presentation },
                  ].map(c => (
                    <View key={c.label} style={styles.scoreRow}>
                      <Text style={styles.scoreName}>{c.label}</Text>
                      <View style={styles.scoreBar}>
                        <View style={[styles.scoreBarFill, { width: `${(c.val / 10) * 100}%` }]} />
                      </View>
                      <Text style={styles.scoreVal}>{c.val?.toFixed(1)}</Text>
                    </View>
                  ))}
                </Card>
              )}
            </>
          )}

          {tab === 'certificaciones' && (
            <Card style={styles.section}>
              <Text style={styles.sectionTitle}>Certificaciones</Text>
              {instructor.certifications.length === 0 ? (
                <Text style={styles.emptyText}>Sin certificaciones cargadas</Text>
              ) : instructor.certifications.map((cert: any) => (
                <View key={cert.id} style={styles.certRow}>
                  <Text style={{ fontSize: 22, marginRight: spacing.sm }}>🎓</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.certName}>{cert.name}</Text>
                    <Text style={styles.certMeta}>{cert.institution} · {cert.year}</Text>
                    {cert.hours && <Text style={styles.certMeta}>{cert.hours} horas</Text>}
                  </View>
                  {cert.verified && <Badge label="✓ Verificada" color="sage" />}
                </View>
              ))}
            </Card>
          )}

          {tab === 'disponibilidad' && (
            <>
              <View style={styles.daysStrip}>
                {Object.entries(DAYS_ES).map(([day, label]) => {
                  const hasSlot = instructor.availability.some((a: any) => a.day_of_week === day && a.is_active)
                  return (
                    <View key={day} style={[styles.dayPill, hasSlot && styles.dayPillActive]}>
                      <Text style={[styles.dayLabel, hasSlot && styles.dayLabelActive]}>{label}</Text>
                      {hasSlot && <View style={styles.dayDot} />}
                    </View>
                  )
                })}
              </View>

              <Card style={styles.section}>
                {Object.entries(DAYS_ES).map(([day, label]) => {
                  const slots = instructor.availability.filter((a: any) => a.day_of_week === day && a.is_active)
                  if (!slots.length) return null
                  return (
                    <View key={day} style={{ marginBottom: spacing.md }}>
                      <Text style={styles.dayTitle}>{label}</Text>
                      {slots.map((slot: any) => (
                        <View key={slot.id} style={styles.slot}>
                          <Text style={styles.slotTime}>{slot.start_time.slice(0, 5)} – {slot.end_time.slice(0, 5)}</Text>
                          <Badge label={slot.class_type === 'regular' ? 'Regular' : 'Reemplazo'}
                            color={slot.class_type === 'regular' ? 'sage' : 'blush'} />
                        </View>
                      ))}
                    </View>
                  )
                })}
              </Card>

              {instructor.zones.length > 0 && (
                <Card style={styles.section}>
                  <Text style={styles.sectionTitle}>Zonas donde trabaja</Text>
                  <View style={styles.chipRow}>
                    {instructor.zones.map((z: any) => (
                      <Badge key={z.id} label={z.neighborhood} color="sand" />
                    ))}
                  </View>
                </Card>
              )}
            </>
          )}
        </View>
      </ScrollView>

      {/* CTA fijo */}
      <View style={styles.cta}>
        <Button
          label={isFullMatch ? 'Solicitar reemplazo →' : 'Ver disponibilidad →'}
          onPress={handleRequestMatch}
          fullWidth size="lg"
          variant={isFullMatch ? 'primary' : 'secondary'}
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  hero: { backgroundColor: colors.sageLight, padding: spacing.lg, flexDirection: 'row', alignItems: 'flex-start' },
  heroMatch: { backgroundColor: '#F0F7F0' },
  name: { fontFamily: 'Playfair_Display-Medium', fontSize: 20, color: colors.dark },
  zone: { ...typography.small, color: colors.mid, marginTop: 2 },
  statsRow: { flexDirection: 'row', backgroundColor: colors.white, borderBottomWidth: 0.5, borderColor: colors.border },
  statItem: { flex: 1, alignItems: 'center', padding: spacing.md },
  statValue: { fontFamily: 'DM_Sans-SemiBold', fontSize: 18, color: colors.dark },
  statLabel: { ...typography.small, color: colors.mid, marginTop: 2 },
  tariffCard: { margin: spacing.lg, padding: spacing.md, backgroundColor: colors.white },
  tariffCardMatch: { borderColor: '#B5D4B7', backgroundColor: '#F4FAF4' },
  tariffTable: {},
  tariffHeader: { flexDirection: 'row', paddingBottom: spacing.xs, borderBottomWidth: 0.5, borderColor: colors.border, marginBottom: spacing.xs },
  tariffRow: { flexDirection: 'row', paddingVertical: spacing.xs },
  tariffCol: { flex: 1, ...typography.label, color: colors.light, fontSize: 10 },
  tariffCell: { flex: 1, ...typography.small, color: colors.dark },
  tabs: { flexDirection: 'row', backgroundColor: colors.white, borderBottomWidth: 0.5, borderColor: colors.border },
  tab: { flex: 1, paddingVertical: spacing.md, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderColor: colors.sage },
  tabText: { ...typography.small, color: colors.mid },
  tabTextActive: { color: colors.sage, fontFamily: 'DM_Sans-SemiBold' },
  section: { padding: spacing.md, marginBottom: spacing.md, backgroundColor: colors.white },
  sectionTitle: { ...typography.label, color: colors.dark, marginBottom: spacing.md },
  bioText: { ...typography.body, color: colors.mid, lineHeight: 22 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  scoreRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  scoreName: { ...typography.small, color: colors.mid, width: 80 },
  scoreBar: { flex: 1, height: 5, backgroundColor: colors.lavLight, borderRadius: 3, marginHorizontal: spacing.sm },
  scoreBarFill: { height: '100%', backgroundColor: colors.lavender, borderRadius: 3 },
  scoreVal: { fontFamily: 'DM_Sans-SemiBold', fontSize: 12, color: colors.dark, width: 28, textAlign: 'right' },
  certRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: spacing.sm, borderBottomWidth: 0.5, borderColor: colors.borderLight },
  certName: { fontFamily: 'DM_Sans-Medium', fontSize: 13, color: colors.dark },
  certMeta: { ...typography.small, color: colors.mid, marginTop: 2 },
  emptyText: { ...typography.body, color: colors.light, textAlign: 'center', padding: spacing.lg },
  daysStrip: { flexDirection: 'row', gap: spacing.xs, padding: spacing.lg, paddingBottom: 0 },
  dayPill: { flex: 1, alignItems: 'center', paddingVertical: spacing.sm, borderRadius: radius.md, backgroundColor: colors.cream, borderWidth: 0.5, borderColor: colors.border },
  dayPillActive: { backgroundColor: colors.sageLight, borderColor: colors.sageMid },
  dayLabel: { fontSize: 10, color: colors.light },
  dayLabelActive: { color: colors.sage, fontFamily: 'DM_Sans-Medium' },
  dayDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.sage, marginTop: 3 },
  dayTitle: { fontFamily: 'DM_Sans-SemiBold', fontSize: 13, color: colors.dark, marginBottom: spacing.xs },
  slot: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.xs },
  slotTime: { ...typography.body, color: colors.dark },
  cta: { padding: spacing.lg, backgroundColor: colors.white, borderTopWidth: 0.5, borderColor: colors.border },
})
