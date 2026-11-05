// src/screens/studio/SearchScreen.tsx
// Motor de match: muestra instructores compatibles con el perfil del estudio
import React, { useState } from 'react'
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Switch, Modal, Alert } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useMyStudio } from '../../hooks'
import { Avatar, EmptyState, ErrorState, LoadingScreen, colors, spacing, radius, typography } from '../../components/ui'
import PickerField from '../../components/PickerField'
import { useSearchNeed, needDays, parseLocal, fromHHMM, DAY_SHORT } from '../../store/searchNeed'
import { toLocalISODate, toHHMM } from '../../lib/dates'
import { Feather } from '@expo/vector-icons'
import BlobCard from '../../components/BlobCard'
import HeroHeader from '../../components/HeroHeader'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { entity } from '../../lib/entity'
import { publishOpenClass, money } from '../../lib/openClasses'
import { errorText } from '../../lib/errors'
import { Button } from '../../components/ui'

type Props = NativeStackScreenProps<any, 'Search'>
type MatchLevel = 'full' | 'partial' | 'none'

interface MatchedInstructor {
  id: string
  full_name: string
  neighborhood: string | null
  avatar_url: string | null
  score: number | null
  total_evaluations: number
  worked_together: boolean
  interested: boolean
  match_level: MatchLevel
  match_score: number  // 0-100
  match_reasons: string[]
  missing_reasons: string[]
}


// Puntaje: tarifa regular 20 + tarifa reemplazo 20 + zona 30 + equipamiento 30
export default function SearchScreen({ navigation }: Props) {
  const { data: studio, isLoading: studioLoading } = useMyStudio()
  const [search, setSearch] = useState('')
  const [showAll, setShowAll] = useState(false)

  const profileComplete = (studio?.equipment?.length ?? 0) > 0 && !!studio?.neighborhood

  // La clase que necesita cubrir: el match se calcula en el servidor para ESA clase
  const need = useSearchNeed(st => st.need)
  const setNeed = useSearchNeed(st => st.set)
  const days = needDays(need)

  const { data: results = [], isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['instructor-match', studio?.id, need.classType, days.join(','), need.from, need.to],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('search_instructors', {
        p_class_type: need.classType, p_days: days, p_from: need.from + ':00', p_to: need.to + ':00',
      })
      if (error) throw error
      return (data ?? []) as any[]
    },
    enabled: !!studio?.id,
  })

  // Instructores que marcaron "me interesa" en este estudio: suben en la lista
  const { data: interested = new Set<string>() } = useQuery({
    queryKey: ['studio-interests', studio?.id],
    queryFn: async () => {
      const { data } = await supabase.from('instructor_interests').select('instructor_id').eq('studio_id', studio!.id)
      return new Set((data ?? []).map((i: any) => i.instructor_id as string))
    },
    enabled: !!studio?.id,
  })

  if (studioLoading) return <LoadingScreen />

  const matched: MatchedInstructor[] = results.map((r: any): MatchedInstructor => {
    const likes = interested.has(r.id)
    const score = Math.min(100, r.match_score + (likes ? 10 : 0))
    return {
    id: r.id, full_name: r.full_name, neighborhood: r.neighborhood, avatar_url: r.avatar_url,
    score: r.avg_score != null ? Number(r.avg_score) : null, total_evaluations: r.total_evaluations ?? 0,
    worked_together: !!r.worked_together, interested: likes,
    match_score: score, match_level: score >= 75 ? 'full' : score >= 40 ? 'partial' : 'none',
    match_reasons: [...(likes ? ['Le interesa tu estudio'] : []), ...(r.match_reasons ?? [])], missing_reasons: r.missing_reasons ?? [],
  }})
  .sort((a, b) => b.match_score - a.match_score || (b.score ?? 0) - (a.score ?? 0))
  .filter((ins) => !profileComplete || showAll || ins.match_level !== 'none')
  .filter((ins) => !search || ins.full_name.toLowerCase().includes(search.trim().toLowerCase()))

  const validRange = need.to > need.from

  // Publicar clase abierta: los instructores compatibles se anotan y el estudio elige
  const [publishing, setPublishing] = useState(false)
  const [offer, setOffer] = useState(0)
  const [pubNote, setPubNote] = useState('')
  const [busy, setBusy] = useState(false)
  const { data: ranges = [] } = useQuery({
    queryKey: ['rate-ranges'],
    queryFn: async () => { const { data } = await supabase.from('rate_ranges').select('class_type, min_ars, max_ars'); return data ?? [] },
  })
  const range: any = ranges.find((r: any) => r.class_type === need.classType)
  const openPublish = () => {
    const budget = need.classType === 'regular' ? studio?.budget_regular : studio?.budget_replacement
    setOffer(Number(budget) || Number(range?.max_ars) || 0); setPubNote(''); setPublishing(true)
  }
  const publish = async () => {
    if (offer < 1000) { Alert.alert('Indicá cuánto pagás por clase'); return }
    try {
      setBusy(true)
      await publishOpenClass({
        classType: need.classType, classDate: need.classType === 'reemplazo' ? need.date : toLocalISODate(new Date()),
        start: need.from, end: need.to, days: need.classType === 'regular' ? need.days : undefined,
        from: need.classType === 'regular' ? need.from : undefined, to: need.classType === 'regular' ? need.to : undefined,
        offered: offer, note: pubNote.trim() || undefined,
      })
      setPublishing(false)
      navigation.navigate('StudioOpenClasses')
    } catch (e: any) {
      setPublishing(false)
      if (e?.message === 'MATCH_LIMIT_REACHED') navigation.navigate('MembershipPaywall')
      else Alert.alert('No pudimos publicar la clase', errorText(e))
    } finally { setBusy(false) }
  }
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
        subtitle={profileComplete ? 'Ordenados por compatibilidad con esta clase' : `Instructores verificados por ${entity().la}`}
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
            <Text style={s.incompleteTxt}>Cargá el equipamiento de tu estudio para ver la compatibilidad</Text>
            <Text style={s.incompleteHint}>Cargá tu equipamiento y cuánto pagás por clase</Text>
          </View>
          <Feather name="chevron-right" size={16} color={colors.warnTx} />
        </TouchableOpacity>
      )}

      {/* Qué clase necesita cubrir */}
      <View style={s.needCard}>
        <View style={s.needTypeRow}>
          {(['reemplazo', 'regular'] as const).map(k => (
            <TouchableOpacity key={k} style={[s.needType, need.classType === k && s.needTypeOn]} onPress={() => setNeed({ classType: k })}>
              <Text style={[s.needTypeTxt, need.classType === k && s.needTypeTxtOn]}>{k === 'reemplazo' ? 'Reemplazo' : 'Clase regular'}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {need.classType === 'reemplazo' ? (
          <PickerField mode="date" value={parseLocal(need.date)} minimumDate={new Date()}
            display={parseLocal(need.date).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
            onChange={d => setNeed({ date: toLocalISODate(d) })} />
        ) : (
          <View style={s.dayRow}>
            {Object.keys(DAY_SHORT).map(d => {
              const on = need.days.includes(d)
              return (
                <TouchableOpacity key={d} style={[s.dayChip, on && s.dayChipOn]}
                  onPress={() => setNeed({ days: on ? need.days.filter(x => x !== d) : [...need.days, d] })}>
                  <Text style={[s.dayTxt, on && s.dayTxtOn]}>{DAY_SHORT[d]}</Text>
                </TouchableOpacity>
              )
            })}
          </View>
        )}
        <View style={s.timeRow}>
          <View style={{ flex: 1 }}><PickerField mode="time" small minuteInterval={15} value={fromHHMM(need.from)} display={need.from} onChange={d => setNeed({ from: toHHMM(d) })} /></View>
          <Feather name="arrow-right" size={16} color={colors.sageMid} />
          <View style={{ flex: 1 }}><PickerField mode="time" small minuteInterval={15} value={fromHHMM(need.to)} display={need.to} onChange={d => setNeed({ to: toHHMM(d) })} /></View>
        </View>
        {!validRange ? <Text style={s.needErr}>La hora de fin tiene que ser posterior a la de inicio</Text>
          : need.classType === 'regular' && need.days.length === 0 ? <Text style={s.needErr}>Elegí al menos un día</Text> : null}
        <TouchableOpacity style={s.publishBtn} onPress={openPublish} disabled={!validRange || (need.classType === 'regular' && need.days.length === 0)} activeOpacity={0.85}>
          <Feather name="radio" size={14} color={colors.gold} />
          <Text style={s.publishTxt}>Publicar clase abierta: que se anoten los compatibles</Text>
          <Feather name="chevron-right" size={14} color={colors.gold} />
        </TouchableOpacity>
      </View>

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

      <Modal visible={publishing} transparent animationType="fade" onRequestClose={() => !busy && setPublishing(false)}>
        <View style={s.overlay}>
          <View style={s.sheet}>
            <Text style={s.sheetTitle}>Publicar clase abierta</Text>
            <Text style={s.sheetSub}>
              Avisamos a los instructores verificados de tu red con zona u horario compatibles. Los que quieran se anotan y vos elegís. Cuenta como una propuesta de tu plan.
            </Text>
            <Text style={s.offerLabel}>CUÁNTO PAGÁS POR CLASE</Text>
            <View style={s.offerRow}>
              <TouchableOpacity style={s.offerBtn} onPress={() => setOffer(o => Math.max(0, o - 500))}><Feather name="minus" size={18} color={colors.sage} /></TouchableOpacity>
              <TextInput style={s.offerInput} value={offer ? String(offer) : ''} keyboardType="number-pad" maxLength={7}
                onChangeText={v => setOffer(parseInt(v.replace(/\D/g, ''), 10) || 0)} placeholder="0" placeholderTextColor={colors.light} />
              <TouchableOpacity style={s.offerBtn} onPress={() => setOffer(o => o + 500)}><Feather name="plus" size={18} color={colors.sage} /></TouchableOpacity>
            </View>
            {range ? <Text style={s.offerHint}>Referencia de la red: {money(range.min_ars)} – {money(range.max_ars)}</Text> : null}
            <TextInput style={s.noteInput} placeholder="Nota (opcional): nivel del grupo, cantidad de alumnos..." placeholderTextColor={colors.light}
              value={pubNote} onChangeText={setPubNote} multiline maxLength={300} />
            <Button label="Publicar" onPress={publish} isLoading={busy} fullWidth size="lg" />
            <TouchableOpacity onPress={() => setPublishing(false)} style={{ alignItems: 'center', paddingVertical: spacing.md }}>
              <Text style={s.cancelTxt}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const s = StyleSheet.create({
  publishBtn:    { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.goldLight, ...radius.leafSm, paddingVertical: 10, paddingHorizontal: spacing.sm },
  publishTxt:    { flex: 1, fontFamily: 'Nunito-Bold', fontSize: 12, color: colors.gold },
  overlay:       { flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', padding: spacing.lg },
  sheet:         { backgroundColor: colors.cream, ...radius.leaf, padding: spacing.lg },
  sheetTitle:    { fontFamily: 'Nunito-Bold', fontSize: 18, color: colors.dark, marginBottom: 6 },
  sheetSub:      { fontFamily: 'Nunito-Regular', fontSize: 13, color: colors.mid, lineHeight: 19, marginBottom: spacing.md },
  offerLabel:    { ...typography.caption, color: colors.light, marginBottom: 6 },
  offerRow:      { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  offerBtn:      { width: 44, height: 48, ...radius.leafSm, backgroundColor: colors.sageLighter, alignItems: 'center', justifyContent: 'center' },
  offerInput:    { flex: 1, minWidth: 0, height: 48, textAlign: 'center', fontFamily: 'Nunito-Bold', fontSize: 22, color: colors.sage, backgroundColor: colors.white, ...radius.leafSm },
  offerHint:     { fontFamily: 'Nunito-SemiBold', fontSize: 12, color: colors.mid, marginTop: spacing.sm },
  noteInput:     { backgroundColor: colors.white, ...radius.leafSm, padding: spacing.sm, minHeight: 64, fontFamily: 'Nunito-Regular', fontSize: 13, color: colors.dark, marginVertical: spacing.md, textAlignVertical: 'top' },
  cancelTxt:     { fontFamily: 'Nunito-Bold', fontSize: 13, color: colors.mid },
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

  rateBox:        { flex: 1, backgroundColor: colors.sageLighter, borderTopLeftRadius: 10, borderTopRightRadius: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 10, padding: spacing.sm },

  reasons:        { gap: 3 },
  reasonRow:      { flexDirection: 'row', alignItems: 'center', gap: 5 },
  reasonTxt:      { fontFamily: 'Nunito-SemiBold', fontSize: 11, color: colors.okTx, flex: 1 },
  missingRow:     { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  missingTxt:     { fontFamily: 'Nunito-SemiBold', fontSize: 11, color: colors.warnTx, flex: 1 },
  needCard:      { marginHorizontal: spacing.md, marginTop: spacing.md, backgroundColor: colors.white, ...radius.leaf, padding: spacing.md, borderWidth: 0.5, borderColor: colors.borderLight, gap: spacing.sm },
  needTypeRow:   { flexDirection: 'row', backgroundColor: colors.cream, borderRadius: 999, padding: 3 },
  needType:      { flex: 1, paddingVertical: 8, borderRadius: 999, alignItems: 'center' },
  needTypeOn:    { backgroundColor: colors.sage },
  needTypeTxt:   { fontFamily: 'Nunito-Bold', fontSize: 13, color: colors.mid },
  needTypeTxtOn: { color: colors.white },
  dayRow:        { flexDirection: 'row', gap: 4 },
  dayChip:       { flex: 1, paddingVertical: 8, borderRadius: 999, alignItems: 'center', backgroundColor: colors.cream, borderWidth: 0.5, borderColor: colors.border },
  dayChipOn:     { backgroundColor: colors.sage, borderColor: colors.sage },
  dayTxt:        { fontFamily: 'Nunito-SemiBold', fontSize: 12, color: colors.mid },
  dayTxtOn:      { color: colors.white },
  timeRow:       { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  needErr:       { fontFamily: 'Nunito-SemiBold', fontSize: 12, color: colors.redTx },
})
