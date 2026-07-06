// src/screens/studio/SearchScreen.tsx
// Motor de match: muestra instructores compatibles con el perfil del estudio
import React, { useState } from 'react'
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useMyStudio } from '../../hooks'
import { Avatar, EmptyState, LoadingScreen, colors, spacing } from '../../components/ui'
import { Feather } from '@expo/vector-icons'
import BlobCard from '../../components/BlobCard'
import HeroHeader from '../../components/HeroHeader'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'

type Props = NativeStackScreenProps<any, 'Search'>
type MatchLevel = 'full' | 'partial' | 'none'

interface MatchedInstructor {
  id: string
  full_name: string
  neighborhood: string
  years_experience: number
  avatar_url: string | null
  rate_regular: number | null
  rate_replacement: number | null
  specialties: string[]
  score: number | null
  match_level: MatchLevel
  match_score: number  // 0-100
  match_reasons: string[]
  missing_reasons: string[]
}

function calcMatch(instructor: any, studio: any): Omit<MatchedInstructor, keyof any> {
  const budgetReg = studio.budget_regular ?? 0
  const budgetRep = studio.budget_replacement ?? 0
  const studioEquip = studio.equipment ?? []
  const instrZones  = (instructor.zones ?? []).map((z: any) => z.neighborhood)
  const instrSpecialties = (instructor.specialties ?? []).map((s: any) => s.specialty)
  const rateReg = instructor.rates?.rate_regular ?? null
  const rateRep = instructor.rates?.rate_replacement ?? null

  const reasons: string[] = []
  const missing: string[] = []
  let points = 0

  // 1. Tarifa regular
  if (rateReg !== null && budgetReg > 0) {
    if (rateReg <= budgetReg) { points += 40; reasons.push(`Regular $${rateReg.toLocaleString('es-AR')} ✓`) }
    else missing.push(`Regular $${rateReg.toLocaleString('es-AR')} > tu presupuesto`)
  } else if (!rateReg) {
    missing.push('Sin tarifa regular cargada')
  }

  // 2. Zona
  if (instrZones.includes(studio.neighborhood)) {
    points += 30; reasons.push(`Trabaja en ${studio.neighborhood}`)
  } else if (instrZones.length > 0) {
    missing.push(`No trabaja en ${studio.neighborhood}`)
  }

  // 3. Equipamiento
  const matchingEquip = studioEquip.filter((e: string) => instrSpecialties.includes(e))
  if (studioEquip.length > 0) {
    const equipScore = (matchingEquip.length / studioEquip.length) * 30
    points += equipScore
    if (matchingEquip.length > 0) reasons.push(`Sabe usar ${matchingEquip.join(', ')}`)
    const missingEquip = studioEquip.filter((e: string) => !instrSpecialties.includes(e))
    if (missingEquip.length > 0) missing.push(`No declaró: ${missingEquip.join(', ')}`)
  }

  const match_score = Math.round(points)
  const match_level: MatchLevel = match_score >= 90 ? 'full' : match_score >= 50 ? 'partial' : 'none'

  return { match_score, match_level, match_reasons: reasons, missing_reasons: missing }
}

export default function SearchScreen({ navigation, route }: Props) {
  const { data: studio, isLoading: studioLoading } = useMyStudio()
  const [search, setSearch] = useState('')
  const [showAll, setShowAll] = useState(false)

  const profileComplete = studio?.budget_regular && studio?.equipment?.length > 0

  const { data: instructors = [], isLoading } = useQuery({
    queryKey: ['instructor-match', studio?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('instructors')
        .select(`
          id, full_name, neighborhood, years_experience, avatar_url, score,
          rates:instructor_rates(rate_regular, rate_replacement),
          specialties:instructor_specialties(specialty),
          zones:instructor_zones(neighborhood)
        `)
        .eq('verification_status', 'verified')
        .eq('is_active', true)
      if (error) throw error
      return data ?? []
    },
    enabled: !!studio?.id,
  })

  if (studioLoading) return <LoadingScreen />

  // Calcular match para cada instructor
  const matched: MatchedInstructor[] = instructors.map((ins: any) => ({
    id:               ins.id,
    full_name:        ins.full_name,
    neighborhood:     ins.neighborhood,
    years_experience: ins.years_experience ?? 0,
    avatar_url:       ins.avatar_url,
    score:            ins.score,
    rate_regular:     ins.rates?.rate_regular ?? null,
    rate_replacement: ins.rates?.rate_replacement ?? null,
    specialties:      (ins.specialties ?? []).map((s: any) => s.specialty),
    ...calcMatch(ins, studio),
  }))
  .filter((ins: MatchedInstructor) => showAll || ins.match_level !== 'none')
  .filter((ins: MatchedInstructor) =>
    !search || ins.full_name.toLowerCase().includes(search.toLowerCase())
  )
  .sort((a: MatchedInstructor, b: MatchedInstructor) => b.match_score - a.match_score)

  const fullMatches    = matched.filter(i => i.match_level === 'full').length
  const partialMatches = matched.filter(i => i.match_level === 'partial').length

  const MatchBadge = ({ level, score }: { level: MatchLevel; score: number }) => {
    const config = {
      full:    { bg: colors.okBg,   tx: colors.okTx,   label: `Match ${score}%` },
      partial: { bg: colors.warnBg, tx: colors.warnTx, label: `Parcial ${score}%` },
      none:    { bg: colors.redBg,  tx: colors.redTx,  label: 'Sin match' },
    }[level]
    return (
      <View style={[mb.badge, { backgroundColor: config.bg }]}>
        <Text style={[mb.badgeTxt, { color: config.tx }]}>{config.label}</Text>
      </View>
    )
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.cream }}>
      <HeroHeader
        title="Instructores disponibles"
        subtitle={studio?.name ?? ''}
        onBack={() => navigation.goBack()}
        backLabel="Inicio"
        bottomElement={
          profileComplete ? (
            <View style={s.statsRow}>
              <View style={s.statPill}>
                <Text style={s.statNum}>{fullMatches}</Text>
                <Text style={s.statLbl}>match completo</Text>
              </View>
              {partialMatches > 0 && (
                <View style={[s.statPill, { backgroundColor: 'rgba(184,150,12,0.2)' }]}>
                  <Text style={[s.statNum, { color: '#FFD060' }]}>{partialMatches}</Text>
                  <Text style={s.statLbl}>match parcial</Text>
                </View>
              )}
            </View>
          ) : null
        }
      />

      {/* Sin perfil completo */}
      {!profileComplete && (
        <TouchableOpacity
          style={s.incompleteBanner}
          onPress={() => navigation.navigate('StudioProfileEdit')}
          activeOpacity={0.85}
        >
          <Feather name="alert-circle" size={16} color={colors.warnTx} />
          <View style={{ flex: 1 }}>
            <Text style={s.incompleteTxt}>Completá tu perfil para ver matches reales</Text>
            <Text style={s.incompleteHint}>Necesitamos tu equipamiento y presupuesto por hora →</Text>
          </View>
          <Feather name="chevron-right" size={16} color={colors.warnTx} />
        </TouchableOpacity>
      )}

      {/* Barra de búsqueda */}
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

      {/* Toggle mostrar todos */}
      {profileComplete && (
        <TouchableOpacity
          style={s.toggleRow}
          onPress={() => setShowAll(v => !v)}
        >
          <View style={[s.toggleDot, { backgroundColor: showAll ? colors.sage : colors.border }]} />
          <Text style={s.toggleTxt}>{showAll ? 'Mostrando todos' : 'Solo con match'}</Text>
        </TouchableOpacity>
      )}

      {isLoading ? <LoadingScreen /> : (
        <FlatList
          data={matched}
          keyExtractor={(item: MatchedInstructor) => item.id}
          contentContainerStyle={s.list}
          ListEmptyComponent={
            <EmptyState
              icon="users"
              title={profileComplete ? 'Sin instructores compatibles' : 'Completá tu perfil'}
              subtitle={profileComplete
                ? 'Probá activando "Mostrar todos" para ver más opciones.'
                : 'Tu equipamiento y presupuesto son necesarios para calcular el match.'}
            />
          }
          renderItem={({ item, index }: { item: MatchedInstructor; index: number }) => (
            <BlobCard
              style={s.card}
              delay={index * 400}
              blobColor={
                item.match_level === 'full'    ? 'rgba(46,107,26,0.10)' :
                item.match_level === 'partial' ? 'rgba(184,150,12,0.10)' :
                'rgba(74,93,78,0.07)'
              }
              blobColor2={
                item.match_level === 'full'    ? 'rgba(46,107,26,0.06)' :
                item.match_level === 'partial' ? 'rgba(184,150,12,0.06)' :
                'rgba(74,93,78,0.04)'
              }
              onPress={() => navigation.navigate('InstructorProfile', {
                instructorId: item.id,
              })}
            >
              {/* Header */}
              <View style={s.cardHeader}>
                <Avatar name={item.full_name} size={44} />
                <View style={{ flex: 1, marginLeft: spacing.sm }}>
                  <Text style={s.name}>{item.full_name}</Text>
                  <Text style={s.meta}>
                    {item.neighborhood}{item.years_experience > 0 ? ` · ${item.years_experience} años exp.` : ''}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <MatchBadge level={item.match_level} score={item.match_score} />
                  {item.score && (
                    <View style={s.scoreCircle}>
                      <Text style={s.scoreNum}>{item.score.toFixed(1)}</Text>
                    </View>
                  )}
                </View>
              </View>

              {/* Tarifas */}
              <View style={s.ratesRow}>
                <View style={s.rateBox}>
                  <Text style={s.rateLabel}>REGULAR</Text>
                  <Text style={s.rateVal}>
                    {item.rate_regular ? `$${item.rate_regular.toLocaleString('es-AR')}` : '—'}
                  </Text>
                </View>
                <View style={s.rateBox}>
                  <Text style={s.rateLabel}>REEMPLAZO</Text>
                  <Text style={s.rateVal}>
                    {item.rate_replacement ? `$${item.rate_replacement.toLocaleString('es-AR')}` : '—'}
                  </Text>
                </View>
              </View>

              {/* Razones del match */}
              {item.match_reasons.length > 0 && (
                <View style={s.reasons}>
                  {item.match_reasons.map((r, i) => (
                    <View key={i} style={s.reasonRow}>
                      <Feather name="check" size={11} color={colors.okTx} />
                      <Text style={s.reasonTxt}>{r}</Text>
                    </View>
                  ))}
                </View>
              )}
              {item.missing_reasons.length > 0 && item.match_level !== 'none' && (
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
  statPill:       { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  statNum:        { fontFamily: 'Nunito-Bold', fontSize: 14, color: '#fff' },
  statLbl:        { fontFamily: 'Nunito-SemiBold', fontSize: 10, color: 'rgba(255,255,255,0.7)' },

  incompleteBanner:{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, margin: spacing.md, marginBottom: 0, backgroundColor: colors.warnBg, borderTopLeftRadius: 14, borderTopRightRadius: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 14, padding: spacing.md, borderWidth: 0.5, borderColor: 'rgba(122,80,0,0.2)' },
  incompleteTxt:  { fontFamily: 'Nunito-Bold', fontSize: 13, color: colors.warnTx },
  incompleteHint: { fontFamily: 'Nunito-Regular', fontSize: 11, color: '#9A6A00', marginTop: 2 },

  searchBar:      { flexDirection: 'row', alignItems: 'center', gap: 8, margin: spacing.md, marginBottom: 0, backgroundColor: '#fff', borderTopLeftRadius: 14, borderTopRightRadius: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 14, borderWidth: 0.5, borderColor: colors.border, paddingHorizontal: 12, height: 44 },
  searchInput:    { flex: 1, fontFamily: 'Nunito-Regular', fontSize: 14, color: colors.dark },

  toggleRow:      { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.md, paddingVertical: 8 },
  toggleDot:      { width: 10, height: 10, borderRadius: 5 },
  toggleTxt:      { fontFamily: 'Nunito-SemiBold', fontSize: 12, color: colors.mid },

  list:           { padding: spacing.md, paddingTop: spacing.sm, paddingBottom: 48 },
  card:           { padding: spacing.md, marginBottom: spacing.sm },
  cardHeader:     { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.sm },
  name:           { fontFamily: 'Nunito-Bold', fontSize: 15, color: colors.dark },
  meta:           { fontFamily: 'Nunito-Regular', fontSize: 11, color: colors.mid, marginTop: 2 },
  scoreCircle:    { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.sageLight, alignItems: 'center', justifyContent: 'center' },
  scoreNum:       { fontFamily: 'Nunito-Bold', fontSize: 11, color: colors.sage },

  ratesRow:       { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  rateBox:        { flex: 1, backgroundColor: colors.sageLighter, borderTopLeftRadius: 10, borderTopRightRadius: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 10, padding: spacing.sm },
  rateLabel:      { fontFamily: 'Nunito-Bold', fontSize: 8, color: colors.light, letterSpacing: 0.5, marginBottom: 2 },
  rateVal:        { fontFamily: 'Nunito-Bold', fontSize: 14, color: colors.sage },

  reasons:        { gap: 3 },
  reasonRow:      { flexDirection: 'row', alignItems: 'center', gap: 5 },
  reasonTxt:      { fontFamily: 'Nunito-SemiBold', fontSize: 11, color: colors.okTx },
  missingRow:     { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  missingTxt:     { fontFamily: 'Nunito-SemiBold', fontSize: 11, color: colors.warnTx },
})

const mb = StyleSheet.create({
  badge:    { borderTopLeftRadius: 8, borderTopRightRadius: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  badgeTxt: { fontFamily: 'Nunito-Bold', fontSize: 10 },
})
