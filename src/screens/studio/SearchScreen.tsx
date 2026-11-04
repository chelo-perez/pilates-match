// src/screens/studio/SearchScreen.tsx
// Motor de match: muestra instructores compatibles con el perfil del estudio
import React, { useState } from 'react'
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Switch } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { instructorAPI } from '../../lib/api'
import { useMyStudio } from '../../hooks'
import { Avatar, EmptyState, ErrorState, LoadingScreen, colors, spacing, typography } from '../../components/ui'
import { SPECIALTY_LABELS } from '../../constants/labels'
import { Feather } from '@expo/vector-icons'
import BlobCard from '../../components/BlobCard'
import HeroHeader from '../../components/HeroHeader'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { entity } from '../../lib/entity'

type Props = NativeStackScreenProps<any, 'Search'>
type MatchLevel = 'full' | 'partial' | 'none'

interface MatchedInstructor {
  id: string
  full_name: string
  neighborhood: string | null
  avatar_url: string | null
  rate_regular: number | null
  rate_replacement: number | null
  score: number | null
  match_level: MatchLevel
  match_score: number  // 0-100
  match_reasons: string[]
  missing_reasons: string[]
}

const money = (n: number) => `$${n.toLocaleString('es-AR')}`
const specialtyName = (k: string) => (SPECIALTY_LABELS as Record<string, string>)[k] ?? k

// Puntaje: tarifa regular 20 + tarifa reemplazo 20 + zona 30 + equipamiento 30
function calcMatch(instructor: any, studio: any): Pick<MatchedInstructor, 'match_level' | 'match_score' | 'match_reasons' | 'missing_reasons'> {
  const budgetReg = studio?.budget_regular ?? 0
  const budgetRep = studio?.budget_replacement ?? 0
  // Solo equipamiento que existe como especialidad (descarta valores viejos como "tower")
  const studioEquip: string[] = (studio?.equipment ?? []).filter((e: string) => e in (SPECIALTY_LABELS as Record<string, string>))
  const instrZones: string[] = (instructor.zones ?? []).map((z: any) => z.neighborhood)
  const instrSpecialties: string[] = (instructor.specialties ?? []).map((s: any) => s.specialty)
  const rateReg: number | null = instructor.rates?.rate_regular ?? null
  const rateRep: number | null = instructor.rates?.rate_replacement ?? null

  const reasons: string[] = []
  const missing: string[] = []
  let points = 0

  const checkRate = (label: string, rate: number | null, budget: number) => {
    if (rate == null) { missing.push(`Sin tarifa de ${label} cargada`); return }
    if (budget <= 0) return
    if (rate <= budget) { points += 20; reasons.push(`${label[0].toUpperCase() + label.slice(1)} ${money(rate)}, dentro de tu presupuesto`) }
    else missing.push(`${label[0].toUpperCase() + label.slice(1)} ${money(rate)}, más que tu presupuesto (${money(budget)})`)
  }
  checkRate('regular', rateReg, budgetReg)
  checkRate('reemplazo', rateRep, budgetRep)

  if (instrZones.includes(studio?.neighborhood)) {
    points += 30; reasons.push(`Trabaja en ${studio.neighborhood}`)
  } else if (instrZones.length > 0) {
    missing.push(`No trabaja en ${studio?.neighborhood}`)
  } else {
    missing.push('No cargó zonas de trabajo')
  }

  if (studioEquip.length > 0) {
    const matchingEquip = studioEquip.filter(e => instrSpecialties.includes(e))
    points += (matchingEquip.length / studioEquip.length) * 30
    if (matchingEquip.length > 0) reasons.push(`Sabe usar ${matchingEquip.map(specialtyName).join(', ')}`)
    const missingEquip = studioEquip.filter(e => !instrSpecialties.includes(e))
    if (missingEquip.length > 0) missing.push(`No declaró ${missingEquip.map(specialtyName).join(', ')}`)
  }

  const match_score = Math.round(points)
  const match_level: MatchLevel = match_score >= 90 ? 'full' : match_score >= 50 ? 'partial' : 'none'
  return { match_score, match_level, match_reasons: reasons, missing_reasons: missing }
}

export default function SearchScreen({ navigation }: Props) {
  const { data: studio, isLoading: studioLoading } = useMyStudio()
  const [search, setSearch] = useState('')
  const [showAll, setShowAll] = useState(false)

  const profileComplete = !!(studio?.budget_regular || studio?.budget_replacement) && (studio?.equipment?.length ?? 0) > 0

  const { data: instructors = [], isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['instructor-match', studio?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('instructors')
        .select(`
          id, full_name, neighborhood, avatar_url,
          rates:instructor_rates(rate_regular, rate_replacement),
          specialties:instructor_specialties(specialty),
          zones:instructor_zones(neighborhood)
        `)
        .eq('verification_status', 'verificado')
        .eq('is_active', true)
      if (error) throw error
      // El puntaje no es una columna: se calcula con get_instructor_stats (igual que en el perfil)
      return Promise.all((data ?? []).map(async (ins: any) => {
        const stats = await instructorAPI.getStats(ins.id)
        return { ...ins, score: stats && stats.total_evaluations > 0 ? Number(stats.avg_score) : null }
      }))
    },
    enabled: !!studio?.id,
  })

  if (studioLoading) return <LoadingScreen />

  const matched: MatchedInstructor[] = instructors.map((ins: any): MatchedInstructor => ({
    id:               ins.id,
    full_name:        ins.full_name,
    neighborhood:     ins.neighborhood,
    avatar_url:       ins.avatar_url,
    score:            ins.score,
    rate_regular:     ins.rates?.rate_regular ?? null,
    rate_replacement: ins.rates?.rate_replacement ?? null,
    ...calcMatch(ins, studio),
  }))
  .filter((ins) => !profileComplete || showAll || ins.match_level !== 'none')
  .filter((ins) => !search || ins.full_name.toLowerCase().includes(search.trim().toLowerCase()))
  .sort((a, b) => b.match_score - a.match_score)

  const fullMatches    = matched.filter(i => i.match_level === 'full').length
  const partialMatches = matched.filter(i => i.match_level === 'partial').length

  const MatchBadge = ({ level, score }: { level: MatchLevel; score: number }) => {
    const config = {
      full:    { bg: colors.okBg,   tx: colors.okTx,   label: `Match ${score}%` },
      partial: { bg: colors.warnBg, tx: colors.warnTx, label: `Parcial ${score}%` },
      none:    { bg: colors.redBg,  tx: colors.redTx,  label: 'Poco compatible' },
    }[level]
    return (
      <View style={[s.badge, { backgroundColor: config.bg }]}>
        <Text style={[s.badgeTxt, { color: config.tx }]}>{config.label}</Text>
      </View>
    )
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.cream }}>
      <HeroHeader
        title="Instructores"
        subtitle={profileComplete ? 'Ordenados por compatibilidad con tu estudio' : `Instructores verificados por ${entity().la}`}
        bottomElement={
          profileComplete ? (
            <View style={s.statsRow}>
              <View style={[s.statPill, { backgroundColor: colors.okBg }]}>
                <Text style={[s.statNum, { color: colors.okTx }]}>{fullMatches}</Text>
                <Text style={[s.statLbl, { color: colors.okTx }]}>match completo</Text>
              </View>
              {partialMatches > 0 && (
                <View style={[s.statPill, { backgroundColor: colors.warnBg }]}>
                  <Text style={[s.statNum, { color: colors.warnTx }]}>{partialMatches}</Text>
                  <Text style={[s.statLbl, { color: colors.warnTx }]}>match parcial</Text>
                </View>
              )}
            </View>
          ) : null
        }
      />

      {!profileComplete && (
        <TouchableOpacity
          style={s.incompleteBanner}
          onPress={() => navigation.navigate('StudioProfileEdit')}
          activeOpacity={0.85}
        >
          <Feather name="alert-circle" size={16} color={colors.warnTx} />
          <View style={{ flex: 1 }}>
            <Text style={s.incompleteTxt}>Completá tu perfil para ver la compatibilidad</Text>
            <Text style={s.incompleteHint}>Cargá tu equipamiento y cuánto pagás por clase</Text>
          </View>
          <Feather name="chevron-right" size={16} color={colors.warnTx} />
        </TouchableOpacity>
      )}

      <View style={s.searchBar}>
        <Feather name="search" size={15} color={colors.light} />
        <TextInput
          style={s.searchInput}
          placeholder="Buscar por nombre..."
          placeholderTextColor={colors.light}
          value={search}
          onChangeText={setSearch}
        />
        {search ? (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Feather name="x" size={15} color={colors.light} />
          </TouchableOpacity>
        ) : null}
      </View>

      {profileComplete && (
        <View style={s.toggleRow}>
          <Text style={s.toggleTxt}>Mostrar también los poco compatibles</Text>
          <Switch
            value={showAll}
            onValueChange={setShowAll}
            trackColor={{ false: colors.border, true: colors.sageMid }}
            thumbColor={showAll ? colors.sage : colors.white}
          />
        </View>
      )}

      {isLoading ? <LoadingScreen /> : isError ? (
        <ErrorState message="No pudimos cargar los instructores." onRetry={refetch} />
      ) : (
        <FlatList
          data={matched}
          keyExtractor={(item) => item.id}
          contentContainerStyle={s.list}
          refreshing={isRefetching}
          onRefresh={refetch}
          ListEmptyComponent={
            <EmptyState
              icon="users"
              title={search ? 'Nadie coincide con ese nombre' : 'Sin instructores compatibles'}
              message={search
                ? 'Revisá cómo lo escribiste o borrá la búsqueda.'
                : profileComplete
                  ? 'Activá "Mostrar también los poco compatibles" para ver más opciones.'
                  : 'Todavía no hay instructores verificados.'}
            />
          }
          renderItem={({ item, index }) => (
            <BlobCard
              style={s.card}
              delay={index * 400}
              onPress={() => navigation.navigate('InstructorProfile', { instructorId: item.id })}
            >
              <View style={s.cardHeader}>
                <Avatar name={item.full_name} source={item.avatar_url} size={44} />
                <View style={{ flex: 1, marginLeft: spacing.sm }}>
                  <Text style={s.name}>{item.full_name}</Text>
                  {item.neighborhood ? <Text style={s.meta}>{item.neighborhood}</Text> : null}
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  {profileComplete && <MatchBadge level={item.match_level} score={item.match_score} />}
                  {item.score != null && item.score > 0 && (
                    <View style={s.scoreCircle}>
                      <Text style={s.scoreNum}>{item.score.toFixed(1)}</Text>
                    </View>
                  )}
                </View>
              </View>

              <View style={s.ratesRow}>
                <View style={s.rateBox}>
                  <Text style={s.rateLabel}>REGULAR</Text>
                  <Text style={s.rateVal}>{item.rate_regular ? money(item.rate_regular) : '—'}</Text>
                </View>
                <View style={s.rateBox}>
                  <Text style={s.rateLabel}>REEMPLAZO</Text>
                  <Text style={s.rateVal}>{item.rate_replacement ? money(item.rate_replacement) : '—'}</Text>
                </View>
              </View>

              {profileComplete && item.match_reasons.length > 0 && (
                <View style={s.reasons}>
                  {item.match_reasons.map((r, i) => (
                    <View key={i} style={s.reasonRow}>
                      <Feather name="check" size={11} color={colors.okTx} />
                      <Text style={s.reasonTxt}>{r}</Text>
                    </View>
                  ))}
                </View>
              )}
              {profileComplete && item.missing_reasons.length > 0 && (
                <View style={s.missingRow}>
                  <Feather name="alert-circle" size={11} color={colors.warnTx} />
                  <Text style={s.missingTxt}>{item.missing_reasons[0]}</Text>
                </View>
              )}
            </BlobCard>
          )}
        />
      )}
    </View>
  )
}

const s = StyleSheet.create({
  statsRow:       { flexDirection: 'row', gap: 8, marginTop: 12 },
  statPill:       { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  statNum:        { fontFamily: 'Nunito-Bold', fontSize: 14 },
  statLbl:        { fontFamily: 'Nunito-SemiBold', fontSize: 11 },

  incompleteBanner:{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, margin: spacing.md, marginBottom: 0, backgroundColor: colors.warnBg, borderTopLeftRadius: 14, borderTopRightRadius: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 14, padding: spacing.md, borderWidth: 0.5, borderColor: colors.border },
  incompleteTxt:  { fontFamily: 'Nunito-Bold', fontSize: 13, color: colors.warnTx },
  incompleteHint: { fontFamily: 'Nunito-Regular', fontSize: 11, color: colors.warnTx, marginTop: 2 },

  searchBar:      { flexDirection: 'row', alignItems: 'center', gap: 8, margin: spacing.md, marginBottom: 0, backgroundColor: colors.white, borderTopLeftRadius: 14, borderTopRightRadius: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 14, borderWidth: 0.5, borderColor: colors.border, paddingHorizontal: 12, height: 44 },
  searchInput:    { flex: 1, fontFamily: 'Nunito-Regular', fontSize: 14, color: colors.dark },

  toggleRow:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  toggleTxt:      { fontFamily: 'Nunito-SemiBold', fontSize: 12, color: colors.mid, flex: 1 },

  list:           { padding: spacing.md, paddingTop: spacing.sm, paddingBottom: 48 },
  card:           { padding: spacing.md, marginBottom: spacing.sm },
  cardHeader:     { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.sm },
  name:           { fontFamily: 'Nunito-Bold', fontSize: 15, color: colors.dark },
  meta:           { fontFamily: 'Nunito-Regular', fontSize: 11, color: colors.mid, marginTop: 2 },
  scoreCircle:    { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.sageLight, alignItems: 'center', justifyContent: 'center' },
  scoreNum:       { fontFamily: 'Nunito-Bold', fontSize: 11, color: colors.sage },
  badge:          { borderTopLeftRadius: 8, borderTopRightRadius: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  badgeTxt:       { fontFamily: 'Nunito-Bold', fontSize: 10 },

  ratesRow:       { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  rateBox:        { flex: 1, backgroundColor: colors.sageLighter, borderTopLeftRadius: 10, borderTopRightRadius: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 10, padding: spacing.sm },
  rateLabel:      { ...typography.caption, marginBottom: 2 },
  rateVal:        { fontFamily: 'Nunito-Bold', fontSize: 14, color: colors.sage },

  reasons:        { gap: 3 },
  reasonRow:      { flexDirection: 'row', alignItems: 'center', gap: 5 },
  reasonTxt:      { fontFamily: 'Nunito-SemiBold', fontSize: 11, color: colors.okTx, flex: 1 },
  missingRow:     { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  missingTxt:     { fontFamily: 'Nunito-SemiBold', fontSize: 11, color: colors.warnTx, flex: 1 },
})
