import React, { useState } from 'react'
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Feather } from '@expo/vector-icons'
import { Alert } from 'react-native'
import { useEvaluationHistory, useMyStudio } from '../../hooks'
import { matchAPI } from '../../lib/api'
import { formatDate } from '../../lib/dates'
import { MATCH_STATUS } from '../../constants/labels'
import { pendingAction } from '../../lib/matchFlow'
import { Avatar, Badge, Button, ScoreDisplay, EmptyState, ErrorState, LoadingScreen, colors, spacing, radius } from '../../components/ui'
import { errorText } from '../../lib/errors'
import { useSearchNeed } from '../../store/searchNeed'
import HeroHeader, { HeaderPills } from '../../components/HeroHeader'
import BlobCard from '../../components/BlobCard'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'

type Props = NativeStackScreenProps<any, 'HistoryList'>
type View_ = 'propuestas' | 'evaluaciones'
type StatusFilter = 'todas' | 'pendiente' | 'aceptado' | 'rechazado' | 'expirado' | 'cancelado'

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'todas', label: 'Todas' },
  { key: 'pendiente', label: 'Pendientes' },
  { key: 'aceptado', label: 'Aceptadas' },
  { key: 'rechazado', label: 'Rechazadas' },
  { key: 'expirado', label: 'Vencidas' },
  { key: 'cancelado', label: 'Canceladas' },
]

const fmtTime = (t?: string | null) => (t ? String(t).slice(0, 5) : '')

const money = (n: number) => '$' + Math.round(Number(n)).toLocaleString('es-AR')

export default function HistoryScreen({ navigation }: Props) {
  const { data: studio } = useMyStudio()
  const qc = useQueryClient()
  const setNeed = useSearchNeed(st => st.set)
  // Vuelve a proponer la misma clase al mismo instructor
  const again = (m: any) => {
    setNeed({ classType: m.class_type, days: m.schedule_days ?? [], from: String(m.schedule_from ?? m.start_time).slice(0, 5), to: String(m.schedule_to ?? m.end_time).slice(0, 5) })
    navigation.navigate('RequestMatch', { instructorId: m.instructor_id, instructorName: m.instructor?.full_name })
  }
  const [view, setView] = useState<View_>('propuestas')
  const [status, setStatus] = useState<StatusFilter>('todas')
  const [classFilter, setClassFilter] = useState<'todos' | 'regular' | 'reemplazo'>('todos')

  const matchesQ = useQuery({
    queryKey: ['studio-matches', studio?.id, status],
    queryFn: () => matchAPI.getByStudio(studio!.id, status === 'todas' ? undefined : status),
    enabled: !!studio?.id && view === 'propuestas',
  })
  const evalsQ = useEvaluationHistory(view === 'evaluaciones' ? studio?.id : undefined)
  const respond = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'aceptado' | 'rechazado' | 'cancelado' }) => matchAPI.studioRespond(id, status),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['studio-matches'] }); qc.invalidateQueries({ queryKey: ['studio-membership'] }); qc.invalidateQueries({ queryKey: ['studio-quota'] }) },
    onError: (e: any) => Alert.alert('No se pudo', errorText(e)),
  })
  const confirmCancel = (id: string) => Alert.alert('Cancelar propuesta', 'El instructor deja de verla. La propuesta ya contó para tu plan.', [
    { text: 'Volver', style: 'cancel' }, { text: 'Cancelar propuesta', style: 'destructive', onPress: () => respond.mutate({ id, status: 'cancelado' }) },
  ])

  const evals = (evalsQ.data ?? []) as any[]
  const filteredEvals = classFilter === 'todos' ? evals : evals.filter(e => e.class_type === classFilter)
  const q = view === 'propuestas' ? matchesQ : evalsQ

  const Chip = ({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) => (
    <TouchableOpacity style={[s.chip, active && s.chipActive]} onPress={onPress}>
      <Text style={[s.chipTxt, active && s.chipTxtActive]}>{label}</Text>
    </TouchableOpacity>
  )

  return (
    <View style={{ flex: 1, backgroundColor: colors.cream }}>
      <HeroHeader
        title="Historial"
        subtitle={view === 'propuestas' ? 'Propuestas que enviaste' : 'Evaluaciones que hiciste'}
        bottomElement={
          <HeaderPills value={view} onChange={setView}
            items={[{ key: 'propuestas', label: 'Propuestas' }, { key: 'evaluaciones', label: 'Evaluaciones' }]} />
        }
      />

      <View>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.filters}
          data={(view === 'propuestas'
            ? STATUS_FILTERS.map(f => ({ key: f.key, label: f.label, active: status === f.key, onPress: () => setStatus(f.key) }))
            : (['todos', 'regular', 'reemplazo'] as const).map(f => ({
                key: f, label: f === 'todos' ? 'Todas' : f === 'regular' ? 'Regular' : 'Reemplazo',
                active: classFilter === f, onPress: () => setClassFilter(f),
              }))) as { key: string; label: string; active: boolean; onPress: () => void }[]}
          keyExtractor={i => i.key}
          renderItem={({ item }) => <Chip active={item.active} label={item.label} onPress={item.onPress} />}
        />
      </View>

      {q.isLoading ? <LoadingScreen /> : q.isError ? (
        <ErrorState message="No pudimos cargar el historial." onRetry={q.refetch} />
      ) : view === 'propuestas' ? (
        <FlatList
          data={(matchesQ.data ?? []) as any[]}
          keyExtractor={(item: any) => item.id}
          contentContainerStyle={s.list}
          refreshing={matchesQ.isRefetching}
          onRefresh={matchesQ.refetch}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          ListEmptyComponent={
            <EmptyState
              icon="send"
              title={status === 'todas' ? 'Todavía no enviaste propuestas' : 'No hay propuestas con este estado'}
              message={status === 'todas' ? 'Buscá un instructor y enviale una solicitud de reemplazo o una propuesta regular.' : undefined}
              action={status === 'todas' ? 'Buscar instructor' : undefined}
              onAction={status === 'todas' ? () => navigation.navigate('Search') : undefined}
            />
          }
          renderItem={({ item, index }: any) => {
            const st = MATCH_STATUS[item.status as keyof typeof MATCH_STATUS]
            const days: string[] = item.schedule_days ?? []
            return (
              <BlobCard
                style={s.card}
                delay={index * 600}
                onPress={() => navigation.navigate('InstructorProfile', { instructorId: item.instructor_id })}
              >
                <View style={s.cardTop}>
                  <Avatar name={item.instructor?.full_name ?? '?'} source={item.instructor?.avatar_url} size={38} />
                  <View style={{ flex: 1, marginLeft: spacing.sm }}>
                    <Text style={s.name}>{item.instructor?.full_name ?? 'Instructor'}</Text>
                    <View style={s.metaRow}>
                      <View style={[s.typePill, { backgroundColor: item.class_type === 'regular' ? colors.sageLight : colors.goldLight }]}>
                        <Text style={[s.typeTxt, { color: item.class_type === 'regular' ? colors.sage : colors.gold }]}>
                          {item.class_type === 'regular' ? 'Regular' : 'Reemplazo'}
                        </Text>
                      </View>
                      <Text style={s.date}>
                        {item.class_type === 'regular' && days.length > 0
                          ? `${days.map(d => d.slice(0, 3)).join(', ')} · ${fmtTime(item.schedule_from ?? item.start_time)}–${fmtTime(item.schedule_to ?? item.end_time)}`
                          : `${formatDate(item.class_date)} · ${fmtTime(item.start_time)}–${fmtTime(item.end_time)}`}
                      </Text>
                    </View>
                  </View>
                  <Badge label={st?.label ?? item.status} variant={st?.variant ?? 'neutral'} />
                </View>
                {item.status === 'aceptado' && item.agreed_rate ? (
                  <Text style={s.offer}>Acordado: {money(item.agreed_rate)} por clase</Text>
                ) : item.offered_rate ? (
                  <Text style={s.offer}>Ofreciste {money(item.offered_rate)} por clase</Text>
                ) : null}
                {item.note_instructor ? (
                  <Text style={s.comment} numberOfLines={2}>Respuesta: "{item.note_instructor}"</Text>
                ) : null}
                {item.status === 'pendiente' && item.counter_rate ? (
                  <View style={s.counterBox}>
                    <Text style={s.counterTitle}>{item.instructor?.full_name?.split(' ')[0] ?? 'El instructor'} pide {money(item.counter_rate)} por clase</Text>
                    <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
                      <Button label="Rechazar" variant="danger" size="sm" style={{ flex: 1 }} isLoading={respond.isPending}
                        onPress={() => respond.mutate({ id: item.id, status: 'rechazado' })} />
                      <Button label={`Aceptar ${money(item.counter_rate)}`} size="sm" style={{ flex: 2 }} isLoading={respond.isPending}
                        onPress={() => respond.mutate({ id: item.id, status: 'aceptado' })} />
                    </View>
                  </View>
                ) : null}
                {item.status === 'aceptado' || item.cancelled_at ? (
                  <>
                    {pendingAction(item, 'estudio') ? (
                      <TouchableOpacity style={s.todo} onPress={() => navigation.navigate('ClassDetail', { matchId: item.id })}>
                        <Feather name="alert-circle" size={14} color={colors.warnTx} />
                        <Text style={s.todoTxt}>{pendingAction(item, 'estudio')}</Text>
                        <Feather name="chevron-right" size={14} color={colors.warnTx} />
                      </TouchableOpacity>
                    ) : null}
                    {item.cancelled_at ? (
                      <Text style={s.comment}>{item.cancelled_by === 'instructor' ? 'La canceló el instructor' : 'La cancelaste'}{item.late_cancel ? ' con menos de 24 h' : ''}{item.cancel_reason ? `: "${item.cancel_reason}"` : ''}</Text>
                    ) : null}
                    <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm, flexWrap: 'wrap' }}>
                      <Button label={item.cancelled_at ? 'Ver detalle' : item.class_type === 'regular' ? 'Ver entrevista' : 'Ver clase'} size="sm"
                        onPress={() => navigation.navigate('ClassDetail', { matchId: item.id })}
                        icon={<Feather name="calendar" size={13} color={colors.white} />} />
                      {item.status === 'aceptado' ? (
                        <Button label="Volver a proponer" variant="secondary" size="sm" onPress={() => again(item)}
                          icon={<Feather name="repeat" size={13} color={colors.sage} />} />
                      ) : null}
                    </View>
                  </>
                ) : null}
                <View style={s.footerRow}>
                  <Text style={s.sentAt}>Enviada el {formatDate(new Date(item.created_at))}</Text>
                  {item.status === 'pendiente' && !item.counter_rate ? (
                    <TouchableOpacity onPress={() => confirmCancel(item.id)} hitSlop={8}><Text style={s.cancelTxt}>Cancelar</Text></TouchableOpacity>
                  ) : null}
                </View>
              </BlobCard>
            )
          }}
        />
      ) : (
        <FlatList
          data={filteredEvals}
          keyExtractor={(item: any) => item.id}
          contentContainerStyle={s.list}
          refreshing={evalsQ.isRefetching}
          onRefresh={evalsQ.refetch}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          ListEmptyComponent={
            <EmptyState icon="star" title="Sin evaluaciones" message="Cuando evalúes a un instructor después de una clase, lo vas a ver acá." />
          }
          renderItem={({ item, index }: any) => (
            <BlobCard
              style={s.card}
              delay={index * 600}
              onPress={() => navigation.navigate('InstructorProfile', { instructorId: item.instructor_id })}
            >
              <View style={s.cardTop}>
                <Avatar name={item.instructor?.full_name ?? '?'} source={item.instructor?.avatar_url} size={38} />
                <View style={{ flex: 1, marginLeft: spacing.sm }}>
                  <Text style={s.name}>{item.instructor?.full_name ?? 'Instructor'}</Text>
                  <View style={s.metaRow}>
                    <View style={[s.typePill, { backgroundColor: item.class_type === 'regular' ? colors.sageLight : colors.goldLight }]}>
                      <Text style={[s.typeTxt, { color: item.class_type === 'regular' ? colors.sage : colors.gold }]}>
                        {item.class_type === 'regular' ? 'Regular' : 'Reemplazo'}
                      </Text>
                    </View>
                    <Text style={s.date}>{formatDate(item.class_date)}</Text>
                  </View>
                </View>
                <ScoreDisplay score={item.average_score} size="sm" />
              </View>
              {item.comment ? (
                <Text style={s.comment} numberOfLines={2}>"{item.comment}"</Text>
              ) : null}
              <View style={s.breakdown}>
                {[
                  { label: 'Técnica', val: item.score_technique },
                  { label: 'Puntualidad', val: item.score_punctuality },
                  { label: 'Trato', val: item.score_student_care },
                  { label: 'Presentación', val: item.score_presentation },
                ].map(c => (
                  <View key={c.label} style={s.breakdownItem}>
                    <Text style={s.breakdownLbl}>{c.label}</Text>
                    <Text style={s.breakdownVal}>{c.val}</Text>
                  </View>
                ))}
              </View>
            </BlobCard>
          )}
        />
      )}
    </View>
  )
}

const s = StyleSheet.create({
  todo:    { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.warnBg, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 10, marginBottom: spacing.sm },
  todoTxt: { flex: 1, fontFamily: 'Nunito-Bold', fontSize: 12, color: colors.warnTx },

  filters:       { paddingHorizontal: spacing.md, paddingTop: spacing.sm, gap: 6 },
  chip:          { paddingVertical: 5, paddingHorizontal: 12, borderTopLeftRadius: 10, borderTopRightRadius: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 10, backgroundColor: colors.white, borderWidth: 0.5, borderColor: colors.border },
  chipActive:    { backgroundColor: colors.sage, borderColor: colors.sage },
  chipTxt:       { fontFamily: 'Nunito-SemiBold', fontSize: 12, color: colors.mid },
  chipTxtActive: { color: colors.white, fontFamily: 'Nunito-Bold' },

  list:          { padding: spacing.md, paddingBottom: 40 },
  card:          { padding: spacing.md },
  cardTop:       { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  name:          { fontFamily: 'Nunito-Bold', fontSize: 14, color: colors.dark },
  metaRow:       { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: 3, flexWrap: 'wrap' },
  typePill:      { borderTopLeftRadius: 8, borderTopRightRadius: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
  typeTxt:       { fontFamily: 'Nunito-Bold', fontSize: 10 },
  date:          { fontFamily: 'Nunito-Regular', fontSize: 11, color: colors.light },
  comment:       { fontFamily: 'Nunito-Regular', fontSize: 12, color: colors.mid, lineHeight: 17, marginBottom: spacing.sm, fontStyle: 'italic' },
  sentAt:        { fontFamily: 'Nunito-Regular', fontSize: 11, color: colors.light },
  footerRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cancelTxt:     { fontFamily: 'Nunito-Bold', fontSize: 12, color: colors.mid },
  offer:         { fontFamily: 'Nunito-SemiBold', fontSize: 12, color: colors.sage, marginBottom: 4 },
  counterBox:    { backgroundColor: colors.warnBg, ...radius.leaf, padding: spacing.sm, marginBottom: spacing.sm },
  counterTitle:  { fontFamily: 'Nunito-Bold', fontSize: 13, color: colors.warnTx },
  breakdown:     { flexDirection: 'row', gap: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 0.5, borderColor: colors.borderLight },
  breakdownItem: { flex: 1, alignItems: 'center' },
  breakdownLbl:  { fontFamily: 'Nunito-Regular', fontSize: 10, color: colors.light },
  breakdownVal:  { fontFamily: 'Nunito-Bold', fontSize: 14, color: colors.dark },
})
