// src/screens/instructor/MatchesScreen.tsx
// Propuestas de los estudios: el instructor acepta/rechaza, ve el historial y evalúa al estudio

import React, { useState, useCallback } from 'react'
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, Modal, RefreshControl, Linking, Image,
} from 'react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useFocusEffect } from '@react-navigation/native'
import { supabase } from '../../lib/supabase'
import { useMyInstructor } from '../../hooks'
import { errorText, UserError } from '../../lib/errors'
import { formatDate } from '../../lib/dates'
import { MATCH_STATUS } from '../../constants/labels'
import { connectMp, useMpConnection } from '../../lib/matchFlow'
import { Badge, EmptyState, ErrorState, LoadingScreen, Button, colors, spacing, radius, typography } from '../../components/ui'
import BlobCard from '../../components/BlobCard'
import HeroHeader, { HeaderPills } from '../../components/HeroHeader'
import Toast from '../../components/Toast'
import { useToast } from '../../hooks/useToast'
import { matchEnd, pendingAction } from '../../lib/matchFlow'
import StudioRep from '../../components/StudioRep'
import { Feather } from '@expo/vector-icons'

type Tab = 'pendientes' | 'historial'

const DAYS_SHORT: Record<string, string> = {
  lunes: 'Lun', martes: 'Mar', miercoles: 'Mié',
  jueves: 'Jue', viernes: 'Vie', sabado: 'Sáb', domingo: 'Dom',
}
const money = (n: number) => '$' + Math.round(Number(n)).toLocaleString('es-AR')
const DAY_ORDER = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo']

const longDate = (d: string) => formatDate(d, { weekday: 'long', day: 'numeric', month: 'long' })
const hhmm = (t?: string | null) => t?.slice(0, 5) ?? ''
const isExpired = (m: any) => m.status === 'pendiente' && !!m.expires_at && new Date(m.expires_at).getTime() <= Date.now()

const STUDIO_FIELDS = 'studio:studios(id, name, neighborhood, address, phone, instagram, logo_url)'

const toMin = (t: string) => { const [h, m] = String(t ?? '0:0').split(':').map(Number); return h * 60 + (m || 0) }
/** La propuesta trae dos opciones de entrevista (y el instructor todavía no eligió) */
const hasAlt = (m: any) => m?.class_type === 'regular' && !!m?.alt_date && !m?.alt_chosen
const slotsOf = (m: any) => [
  { n: 1 as const, date: m.class_date, start: m.start_time, end: m.end_time },
  { n: 2 as const, date: m.alt_date, start: m.alt_start_time, end: m.alt_end_time },
]

export default function InstructorMatchesScreen({ navigation }: any) {
  const qc = useQueryClient()
  const { toast, showToast, hideToast } = useToast()
  const [tab, setTab]               = useState<Tab>('pendientes')
  const [selected, setSelected]     = useState<any>(null)
  const [noteText, setNoteText]     = useState('')
  const [actionType, setActionType] = useState<'accept' | 'reject' | 'counter' | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const { data: instructor, isLoading: loadingInstructor } = useMyInstructor()
  const instructorId = instructor?.id

  // Pendientes vigentes
  const pendingQ = useQuery({
    queryKey: ['instructor-matches', instructorId, 'pending'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('matches')
        .select(`*, ${STUDIO_FIELDS}`)
        .eq('instructor_id', instructorId!)
        .eq('status', 'pendiente')
        .or(`expires_at.is.null,expires_at.gt."${new Date().toISOString()}"`)
        .order('class_date', { ascending: true })
      if (error) throw error
      return data ?? []
    },
    enabled: !!instructorId,
    refetchInterval: 30_000,
  })

  // Historial: respondidas + pendientes que ya vencieron
  const historyQ = useQuery({
    queryKey: ['instructor-matches', instructorId, 'history'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('matches')
        .select(`*, ${STUDIO_FIELDS}`)
        .eq('instructor_id', instructorId!)
        .or(`status.neq.pendiente,expires_at.lte."${new Date().toISOString()}"`)
        .order('class_date', { ascending: false })
        .limit(50)
      if (error) throw error
      return data ?? []
    },
    enabled: !!instructorId,
  })

  // Matches que el instructor ya evaluó → puntaje que le puso al estudio
  const evaluatedQ = useQuery({
    queryKey: ['instructor-studio-evals', instructorId, 'match-ids'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('studio_evaluations').select('match_id, average_score').eq('instructor_id', instructorId!)
      if (error) throw error
      return new Map<string, number>((data ?? []).filter((e: any) => e.match_id).map((e: any) => [e.match_id, Number(e.average_score)]))
    },
    enabled: !!instructorId,
  })

  // Evaluaciones que le hicieron los estudios. La base solo devuelve las ya reveladas
  // (cuando el instructor evaluó esa clase o pasaron 7 días).
  const receivedQ = useQuery({
    queryKey: ['instructor-studio-evals', instructorId, 'received'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('evaluations').select('studio_id, class_date, average_score').eq('instructor_id', instructorId!)
      if (error) throw error
      return new Map<string, number>((data ?? []).map((e: any) => [`${e.studio_id}_${e.class_date}`, Number(e.average_score)]))
    },
    enabled: !!instructorId,
  })

  const [counter, setCounter] = useState(0)
  // Cobro garantizado: en esta red los reemplazos se pagan por la app y hace falta Mercado Pago conectado
  const { data: mp } = useMpConnection()
  const [connecting, setConnecting] = useState(false)
  const guaranteed = (m: any) => !!mp?.required && m?.class_type === 'reemplazo'
  const classesOf = (m: any) => Math.max(1, Math.floor((toMin(m.end_time) - toMin(m.start_time)) / 60))
  // Entrevista con dos opciones: cuál elige el instructor (1 = la primera, 2 = la segunda)
  const [slot, setSlot] = useState<1 | 2>(1)
  const myRates: any = Array.isArray(instructor?.rates) ? (instructor?.rates as any)[0] : instructor?.rates
  const myRateFor = (m: any) => Number(m.class_type === 'regular' ? myRates?.rate_regular : myRates?.rate_replacement) || null

  const respondMutation = useMutation({
    mutationFn: async ({ matchId, status, note, counterRate, useAlt }: { matchId: string; status?: string; note?: string; counterRate?: number; useAlt?: boolean }) => {
      const alt = useAlt ? { alt_chosen: true } : {}
      const { data, error } = await supabase
        .from('matches')
        .update(counterRate ? { counter_rate: counterRate, note_instructor: note || null, ...alt } : { status, note_instructor: note || null, ...(status === 'aceptado' ? alt : {}) })
        .eq('id', matchId)
        .eq('status', 'pendiente')
        .select('id')
      if (error) throw error
      if (!data?.length) throw new UserError('Esta propuesta ya no está disponible (puede haber vencido o sido cancelada).')
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['instructor-matches'] })
      closeModal()
      showToast(vars.counterRate ? 'Contraoferta enviada' : vars.status === 'aceptado' ? 'Propuesta aceptada' : 'Propuesta rechazada')
    },
    onError: (e: any) => {
      showToast(errorText(e), 'error')
      qc.invalidateQueries({ queryKey: ['instructor-matches'] })
    },
  })

  useFocusEffect(useCallback(() => {
    if (instructorId) {
      pendingQ.refetch()
      historyQ.refetch()
      evaluatedQ.refetch()
      receivedQ.refetch()
    }
  }, [instructorId]))

  const onRefresh = async () => {
    setRefreshing(true)
    await Promise.all([pendingQ.refetch(), historyQ.refetch(), evaluatedQ.refetch(), receivedQ.refetch()])
    setRefreshing(false)
  }

  const openAction = (match: any, type: 'accept' | 'reject' | 'counter') => {
    setSelected(match)
    setActionType(type)
    setNoteText('')
    setCounter(myRateFor(match) ?? Number(match.offered_rate) ?? 0)
    setSlot(1)
  }
  const closeModal = () => { setSelected(null); setActionType(null); setNoteText('') }

  const confirmAction = () => {
    if (!selected || !actionType) return
    if (actionType === 'counter') {
      if (counter < 1000) { showToast('Indicá el monto por clase', 'warning'); return }
      respondMutation.mutate({ matchId: selected.id, counterRate: counter, note: noteText.trim() || undefined, useAlt: hasAlt(selected) && slot === 2 })
      return
    }
    respondMutation.mutate({
      matchId: selected.id,
      status:  actionType === 'accept' ? 'aceptado' : 'rechazado',
      note:    noteText.trim() || undefined,
      useAlt:  actionType === 'accept' && hasAlt(selected) && slot === 2,
    })
  }

  const goEvaluate = (m: any) => navigation.navigate('EvaluateStudio', {
    matchId: m.id, studioId: m.studio_id, studioName: m.studio?.name ?? 'Estudio',
    classDate: m.class_date, classType: m.class_type, agreedRate: m.agreed_rate ?? null,
  })

  const pending = pendingQ.data ?? []
  const history = historyQ.data ?? []
  const evaluated: Map<string, number> = evaluatedQ.data ?? new Map()
  const received: Map<string, number> = receivedQ.data ?? new Map()
  const fmtScore = (n: number) => n.toLocaleString('es-AR', { maximumFractionDigits: 1 })
  const activeQ = tab === 'pendientes' ? pendingQ : historyQ
  const data    = tab === 'pendientes' ? pending : history
  const toEvaluate = history.filter((m: any) => m.status === 'aceptado' && matchEnd(m) <= new Date() && !evaluated.has(m.id)).length

  const renderItem = ({ item: match }: any) => {
    const studio    = match.studio
    const expired   = isExpired(match)
    const isPending = match.status === 'pendiente' && !expired
    const waitingStudio = isPending && match.counter_rate != null // contraoferta enviada, espera al estudio
    const myRate = myRateFor(match)
    const offer = match.offered_rate != null ? Number(match.offered_rate) : null
    const statusKey = expired ? 'expirado' : match.status
    const status    = MATCH_STATUS[statusKey] ?? { label: statusKey, variant: 'neutral' }
    const accepted  = match.status === 'aceptado'
    const canEvaluate = accepted && matchEnd(match) <= new Date() && !evaluated.has(match.id)
    const minutesLeft = match.expires_at ? Math.max(0, Math.round((new Date(match.expires_at).getTime() - Date.now()) / 60_000)) : null
    const scheduleDays: string[] = (match.schedule_days ?? []).slice().sort((a: string, b: string) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b))

    return (
      <BlobCard style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={[styles.studioAvatar, studio?.logo_url && { overflow: 'hidden' }]}>
            {studio?.logo_url
              ? <Image source={{ uri: studio.logo_url }} style={{ width: '100%', height: '100%' }} />
              : <Text style={styles.studioLetter}>{studio?.name?.[0]?.toUpperCase() ?? '?'}</Text>}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.studioName}>{studio?.name ?? 'Estudio'}</Text>
            {studio?.neighborhood ? (
              <Text style={styles.studioNeighborhood}>
                <Feather name="map-pin" size={11} color={colors.light} /> {studio.neighborhood}
              </Text>
            ) : null}
            <StudioRep studioId={match.studio_id} />
          </View>
          <Badge
            label={match.class_type === 'reemplazo' ? 'Reemplazo' : 'Regular'}
            variant={match.class_type === 'reemplazo' ? 'warning' : 'success'}
          />
        </View>

        <View style={styles.datetimeRow}>
          {isPending && hasAlt(match) ? (
            <>
              <Text style={styles.altTitle}>Entrevista: elegí una de estas opciones</Text>
              {slotsOf(match).map(o => (
                <View key={o.n} style={styles.datetimeItem}>
                  <Feather name="calendar" size={13} color={colors.sage} />
                  <Text style={styles.datetimeText}>Opción {o.n}: {longDate(o.date)} · {hhmm(o.start)} – {hhmm(o.end)}</Text>
                </View>
              ))}
            </>
          ) : (
            <>
              <View style={styles.datetimeItem}>
                <Feather name="calendar" size={13} color={colors.sage} />
                <Text style={styles.datetimeText}>
                  {match.class_type === 'regular' ? 'Entrevista: ' : ''}{longDate(match.class_date)}
                </Text>
              </View>
              <View style={styles.datetimeItem}>
                <Feather name="clock" size={13} color={colors.sage} />
                <Text style={styles.datetimeText}>{hhmm(match.start_time)} – {hhmm(match.end_time)}</Text>
              </View>
            </>
          )}
          {match.class_type === 'regular' && scheduleDays.length > 0 && (
            <View style={styles.datetimeItem}>
              <Feather name="repeat" size={13} color={colors.sage} />
              <Text style={styles.datetimeText}>
                {scheduleDays.map(d => DAYS_SHORT[d] ?? d).join(', ')}
                {match.schedule_from ? ` · ${hhmm(match.schedule_from)} – ${hhmm(match.schedule_to)}` : ''}
              </Text>
            </View>
          )}
        </View>

        {/* Oferta del estudio vs. mi tarifa (la tarifa nunca se le muestra al estudio) */}
        {accepted && match.agreed_rate ? (
          <View style={[styles.offerBox, { backgroundColor: colors.okBg }]}>
            <Feather name="check-circle" size={14} color={colors.okTx} />
            <Text style={[styles.offerTxt, { color: colors.okTx }]}>Acordado: {money(match.agreed_rate)} por clase</Text>
          </View>
        ) : offer != null ? (
          <View style={[styles.offerBox, { backgroundColor: myRate && offer < myRate ? colors.warnBg : colors.sageLighter }]}>
            <Feather name="dollar-sign" size={14} color={myRate && offer < myRate ? colors.warnTx : colors.sage} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.offerTxt, { color: myRate && offer < myRate ? colors.warnTx : colors.sage }]}>
                {waitingStudio ? `Pediste ${money(match.counter_rate)} por clase` : `Te ofrecen ${money(offer)} por clase`}
              </Text>
              <Text style={styles.offerSub}>
                {waitingStudio ? `Ofrecían ${money(offer)} · esperando respuesta del estudio`
                  : !myRate ? 'Cargá tu tarifa para comparar'
                  : offer >= myRate ? `Cubre tu tarifa de ${money(myRate)}`
                  : `Por debajo de tu tarifa de ${money(myRate)}: podés proponer otro monto`}
              </Text>
            </View>
          </View>
        ) : null}

        {match.note_studio ? (
          <View style={styles.noteBox}>
            <Text style={styles.noteLabel}>Nota del estudio</Text>
            <Text style={styles.noteText}>"{match.note_studio}"</Text>
          </View>
        ) : null}
        {!isPending && match.note_instructor ? (
          <View style={styles.noteBox}>
            <Text style={styles.noteLabel}>Tu respuesta</Text>
            <Text style={styles.noteText}>"{match.note_instructor}"</Text>
          </View>
        ) : null}

        {/* Clase confirmada o cancelada: ficha con contacto, calendario, cancelar y cierre */}
        {accepted || match.cancelled_at ? (
          <>
            {pendingAction(match, 'instructor') ? (
              <TouchableOpacity style={styles.todo} onPress={() => navigation.navigate('ClassDetail', { matchId: match.id })}>
                <Feather name="alert-circle" size={14} color={colors.warnTx} />
                <Text style={styles.todoTxt}>{pendingAction(match, 'instructor')}</Text>
                <Feather name="chevron-right" size={14} color={colors.warnTx} />
              </TouchableOpacity>
            ) : null}
            {match.cancelled_at ? (
              <Text style={styles.noteText}>{match.cancelled_by === 'estudio' ? 'La canceló el estudio' : 'La cancelaste'}{match.cancel_reason ? `: "${match.cancel_reason}"` : ''}</Text>
            ) : null}
            {match.hire_status === 'contratado' && !match.ended_at ? (
              <Text style={[styles.noteText, { color: colors.okTx }]}>✓ Clase regular activa</Text>
            ) : null}
            <Button label={match.cancelled_at ? 'Ver detalle' : match.class_type === 'regular' ? 'Ver entrevista' : 'Ver clase, dirección y contacto'}
              size="sm" onPress={() => navigation.navigate('ClassDetail', { matchId: match.id })}
              icon={<Feather name="calendar" size={13} color={colors.white} />} style={{ marginTop: spacing.sm, alignSelf: 'flex-start' }} />
          </>
        ) : null}

        {isPending ? (
          <Text style={[styles.expiry, minutesLeft !== null && minutesLeft < 240 && { color: colors.redTx }]}>
            <Feather name="alert-circle" size={11} />{' '}
            {minutesLeft === null ? 'Sin vencimiento'
              : minutesLeft < 60 ? 'Vence en menos de 1 h'
              : `Vence en ${Math.round(minutesLeft / 60)} h`}
          </Text>
        ) : (
          <View style={styles.statusRow}>
            <Badge label={status.label} variant={status.variant} />
            {match.responded_at ? (
              <Text style={styles.respondedAt}>Respondida el {formatDate(match.responded_at)}</Text>
            ) : null}
          </View>
        )}

        {isPending && !waitingStudio && (
          <View style={styles.actions}>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <Button label="Rechazar" variant="danger" onPress={() => openAction(match, 'reject')}
                icon={<Feather name="x" size={16} color={colors.redTx} />} style={{ flex: 1 }} />
              <Button label="Aceptar" onPress={() => openAction(match, 'accept')}
                icon={<Feather name="check" size={16} color={colors.white} />} style={{ flex: 2 }} />
            </View>
            {offer != null && (
              <Button label="Proponer otro monto" variant="secondary" size="sm" onPress={() => openAction(match, 'counter')}
                icon={<Feather name="edit-2" size={14} color={colors.sage} />} />
            )}
          </View>
        )}

        {canEvaluate && (
          <Button label="Evaluar estudio" variant="secondary" size="sm" onPress={() => goEvaluate(match)}
            icon={<Feather name="star" size={14} color={colors.sage} />} style={{ marginTop: spacing.sm }} />
        )}
        {accepted && evaluated.has(match.id) && (
          <View style={{ marginTop: spacing.xs }}>
            <Text style={styles.evaluatedTxt}>✓ Evaluaste al estudio: {fmtScore(evaluated.get(match.id)!)}/10</Text>
            <Text style={styles.receivedTxt}>
              {received.has(`${match.studio_id}_${match.class_date}`)
                ? `★ El estudio te puso ${fmtScore(received.get(`${match.studio_id}_${match.class_date}`)!)}/10`
                : 'El estudio todavía no te evaluó'}
            </Text>
          </View>
        )}
      </BlobCard>
    )
  }

  return (
    <View style={styles.container}>
      <HeroHeader
        title="Propuestas"
        subtitle="Respondé antes de que venzan"
        rightElement={pending.length > 0 ? (
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeTxt}>{pending.length}</Text>
          </View>
        ) : undefined}
        bottomElement={
          <HeaderPills value={tab} onChange={setTab} items={[
            { key: 'pendientes', label: `Pendientes${pending.length > 0 ? ` (${pending.length})` : ''}` },
            { key: 'historial', label: `Historial${toEvaluate > 0 ? ` · ${toEvaluate} por evaluar` : ''}` },
          ]} />
        }
      />

      {loadingInstructor || activeQ.isLoading ? (
        <LoadingScreen message="Cargando propuestas..." />
      ) : activeQ.isError ? (
        <ErrorState message="No pudimos cargar tus propuestas." onRetry={() => activeQ.refetch()} />
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item: any) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.sage} />}
          ListEmptyComponent={
            <EmptyState
              icon={tab === 'pendientes' ? 'inbox' : 'clock'}
              title={tab === 'pendientes' ? 'Sin propuestas pendientes' : 'Sin historial todavía'}
              message={
                tab === 'pendientes'
                  ? 'Cuando un estudio te proponga una clase, la vas a ver acá. Mantené tus horarios y zonas al día.'
                  : 'Las propuestas que respondas o que venzan van a quedar registradas acá.'
              }
            />
          }
          renderItem={renderItem}
        />
      )}

      <Modal visible={!!selected && !!actionType} transparent animationType="slide" onRequestClose={closeModal}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>
              {actionType === 'accept' ? '¿Aceptar propuesta?' : actionType === 'counter' ? 'Proponer otro monto' : '¿Rechazar propuesta?'}
            </Text>
            <Text style={styles.modalSub}>
              {actionType === 'accept' && hasAlt(selected)
                ? `Elegí el día de la entrevista en ${selected?.studio?.name ?? 'el estudio'}${selected?.offered_rate ? `. Monto: ${money(selected.offered_rate)} por clase` : ''}.`
                : actionType === 'accept'
                ? `Confirmás la clase en ${selected?.studio?.name ?? 'el estudio'} el ${selected?.class_date ? longDate(selected.class_date) : ''}${selected?.offered_rate ? ` por ${money(selected.offered_rate)} la clase` : ''}.`
                : actionType === 'counter'
                ? `Ofrecen ${selected?.offered_rate ? money(selected.offered_rate) : '—'}. Podés proponer un monto una sola vez: el estudio lo acepta o rechaza.`
                : 'El estudio va a ver en su historial que no podés tomar esta clase.'}
            </Text>
            {actionType === 'counter' && (
              <View style={styles.counterRow}>
                <TouchableOpacity style={styles.counterBtn} onPress={() => setCounter(c => Math.max(0, c - 500))}><Feather name="minus" size={18} color={colors.sage} /></TouchableOpacity>
                <TextInput style={styles.counterInput} value={counter ? String(counter) : ''} keyboardType="number-pad" maxLength={7}
                  onChangeText={v => setCounter(parseInt(v.replace(/\D/g, ''), 10) || 0)} />
                <TouchableOpacity style={styles.counterBtn} onPress={() => setCounter(c => c + 500)}><Feather name="plus" size={18} color={colors.sage} /></TouchableOpacity>
              </View>
            )}

            {selected && guaranteed(selected) && actionType !== 'reject' ? (
              <View style={[styles.slot, { marginBottom: spacing.md, alignItems: 'flex-start', backgroundColor: mp?.connected ? colors.okBg : colors.warnBg, borderColor: 'transparent' }]}>
                <Feather name={mp?.connected ? 'shield' : 'credit-card'} size={16} color={mp?.connected ? colors.okTx : colors.warnTx} style={{ marginTop: 2 }} />
                <Text style={[styles.slotTxt, { fontSize: 13, lineHeight: 19 }]}>
                  {mp?.connected
                    ? `Cobro garantizado: el estudio paga por la app antes de la clase y recibís ${money(Number(actionType === 'counter' ? counter : selected.offered_rate) * classesOf(selected))} en tu Mercado Pago (${classesOf(selected)} clase${classesOf(selected) > 1 ? 's' : ''}).`
                    : 'En tu red los reemplazos se pagan por la app. Conectá tu Mercado Pago para poder aceptarlo: la plata llega directo a tu cuenta.'}
                </Text>
              </View>
            ) : null}
            {selected && hasAlt(selected) && actionType !== 'reject' ? (
              <View style={{ gap: 8, marginBottom: spacing.md }}>
                <Text style={styles.noteInputLabel}>DÍA DE LA ENTREVISTA</Text>
                {slotsOf(selected).map(o => (
                  <TouchableOpacity key={o.n} onPress={() => setSlot(o.n)} activeOpacity={0.85}
                    style={[styles.slot, slot === o.n && styles.slotOn]} accessibilityRole="radio" accessibilityState={{ selected: slot === o.n }}>
                    <Feather name={slot === o.n ? 'check-circle' : 'circle'} size={18} color={slot === o.n ? colors.white : colors.sage} />
                    <Text style={[styles.slotTxt, slot === o.n && { color: colors.white }]}>{longDate(o.date)} · {hhmm(o.start)}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}
            {selected && hasAlt(selected) && actionType === 'reject' ? (
              <TouchableOpacity onPress={() => setNoteText('Ninguno de los días de entrevista me sirve. ¿Podemos ver otros?')} style={[styles.slot, { marginBottom: spacing.sm }]}>
                <Feather name="calendar" size={16} color={colors.sage} />
                <Text style={styles.slotTxt}>Ninguno de los días me sirve</Text>
              </TouchableOpacity>
            ) : null}
            <Text style={styles.noteInputLabel}>NOTA PARA EL ESTUDIO (OPCIONAL)</Text>
            <TextInput
              style={styles.noteInput}
              placeholder={actionType === 'accept' ? 'Ej: Confirmo. Llego 10 min antes.' : 'Ej: Ya tengo clase a esa hora.'}
              placeholderTextColor={colors.light}
              value={noteText}
              onChangeText={setNoteText}
              multiline
              maxLength={200}
            />

            <View style={styles.modalActions}>
              {selected && guaranteed(selected) && !mp?.connected && actionType !== 'reject' ? (
                <Button label="Conectar Mercado Pago" fullWidth isLoading={connecting}
                  onPress={async () => { setConnecting(true); try { await connectMp() } catch (e) { showToast(errorText(e), 'error') } finally { setConnecting(false) } }} />
              ) : (
              <Button
                label={actionType === 'accept' ? 'Confirmar' : actionType === 'counter' ? `Proponer ${counter ? money(counter) : ''}` : 'Rechazar propuesta'}
                variant={actionType === 'reject' ? 'danger' : 'primary'}
                onPress={confirmAction}
                isLoading={respondMutation.isPending}
                fullWidth
              />
              )}
              <Button label="Cancelar" variant="ghost" onPress={closeModal} fullWidth />
            </View>
          </View>
        </View>
      </Modal>
      <Toast visible={toast.visible} message={toast.message} type={toast.type} onHide={hideToast} />
    </View>
  )
}

const styles = StyleSheet.create({
  todo:    { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.warnBg, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 10, marginTop: spacing.sm },
  todoTxt: { flex: 1, fontFamily: 'Nunito-Bold', fontSize: 12, color: colors.warnTx },
  container:         { flex: 1, backgroundColor: colors.cream },
  countBadge:        { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  countBadgeTxt:     { fontFamily: 'Nunito-Bold', fontSize: 13, color: colors.sage },
  list:              { padding: spacing.md, paddingBottom: spacing.xxl, flexGrow: 1 },
  card:              { marginBottom: spacing.sm, padding: spacing.md, backgroundColor: colors.white },
  cardHeader:        { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  studioAvatar:      { width: 40, height: 40, ...radius.leaf, backgroundColor: colors.sageLight, alignItems: 'center', justifyContent: 'center', marginRight: spacing.sm },
  studioLetter:      { fontFamily: 'Nunito-SemiBold', fontSize: 17, color: colors.sage },
  studioName:        { fontFamily: 'Nunito-SemiBold', fontSize: 14, color: colors.dark },
  studioNeighborhood:{ ...typography.small, color: colors.mid, marginTop: 1 },
  datetimeRow:       { gap: spacing.xs, marginBottom: spacing.sm },
  datetimeItem:      { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  datetimeText:      { fontFamily: 'Nunito-Medium', fontSize: 13, color: colors.dark, flexShrink: 1 },
  link:              { color: colors.sage, textDecorationLine: 'underline' },
  noteBox:           { backgroundColor: colors.cream, ...radius.leaf, padding: spacing.sm, marginBottom: spacing.sm },
  contactBox:        { backgroundColor: colors.sageLighter, ...radius.leaf, padding: spacing.sm, marginBottom: spacing.sm, gap: spacing.xs },
  noteLabel:         { ...typography.small, color: colors.light, marginBottom: 2 },
  noteText:          { fontFamily: 'Nunito-Regular', fontSize: 12, color: colors.mid, fontStyle: 'italic' },
  expiry:            { ...typography.small, color: colors.mid, marginBottom: spacing.xs },
  statusRow:         { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs },
  respondedAt:       { ...typography.small, color: colors.light },
  altTitle:          { fontFamily: 'Nunito-Bold', fontSize: 12, color: colors.dark, marginBottom: 2 },
  slot:              { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white },
  slotOn:            { backgroundColor: colors.sage, borderColor: colors.sage },
  slotTxt:           { fontFamily: 'Nunito-SemiBold', fontSize: 14, color: colors.dark, flex: 1 },
  actions:           { gap: spacing.sm, marginTop: spacing.sm },
  offerBox:          { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, ...radius.leaf, padding: spacing.sm, marginBottom: spacing.sm },
  offerTxt:          { fontFamily: 'Nunito-Bold', fontSize: 13 },
  offerSub:          { fontFamily: 'Nunito-Regular', fontSize: 12, color: colors.mid, marginTop: 1 },
  counterRow:        { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  counterBtn:        { width: 44, height: 48, ...radius.leafSm, backgroundColor: colors.sageLighter, alignItems: 'center', justifyContent: 'center' },
  counterInput:      { flex: 1, minWidth: 0, height: 48, textAlign: 'center', fontFamily: 'Nunito-Bold', fontSize: 22, color: colors.sage, backgroundColor: colors.cream, ...radius.leafSm },
  evaluatedTxt:      { ...typography.small, color: colors.okTx, marginTop: spacing.xs },
  receivedTxt:       { ...typography.small, color: colors.mid, marginTop: 2 },
  modalOverlay:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalBox:          { backgroundColor: colors.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: spacing.xl, paddingBottom: spacing.xxl },
  modalTitle:        { fontFamily: 'Nunito-Bold', fontSize: 20, color: colors.dark, marginBottom: spacing.xs },
  modalSub:          { ...typography.body, color: colors.mid, marginBottom: spacing.lg },
  noteInputLabel:    { ...typography.caption, marginBottom: spacing.xs },
  noteInput:         { backgroundColor: colors.cream, ...radius.leaf, padding: spacing.md, fontFamily: 'Nunito-Regular', fontSize: 14, color: colors.dark, minHeight: 80, textAlignVertical: 'top', borderWidth: 0.5, borderColor: colors.border, marginBottom: spacing.lg },
  modalActions:      { gap: spacing.sm },
})
