// src/screens/instructor/MatchesScreen.tsx
// Propuestas de los estudios: el instructor acepta/rechaza, ve el historial y evalúa al estudio

import React, { useState, useCallback } from 'react'
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, Modal, RefreshControl, Linking,
} from 'react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useFocusEffect } from '@react-navigation/native'
import { supabase } from '../../lib/supabase'
import { useMyInstructor } from '../../hooks'
import { errorText, UserError } from '../../lib/errors'
import { formatDate, isPastDate } from '../../lib/dates'
import { MATCH_STATUS } from '../../constants/labels'
import { Badge, EmptyState, ErrorState, LoadingScreen, Button, colors, spacing, radius, typography } from '../../components/ui'
import BlobCard from '../../components/BlobCard'
import HeroHeader, { HeaderPills } from '../../components/HeroHeader'
import Toast from '../../components/Toast'
import { useToast } from '../../hooks/useToast'
import { Feather } from '@expo/vector-icons'

type Tab = 'pendientes' | 'historial'

const DAYS_SHORT: Record<string, string> = {
  lunes: 'Lun', martes: 'Mar', miercoles: 'Mié',
  jueves: 'Jue', viernes: 'Vie', sabado: 'Sáb', domingo: 'Dom',
}
/** Lo que el instructor ve del estudio antes de aceptar (agregados que calcula el servidor) */
function StudioRep({ studioId }: { studioId: string }) {
  const { data: r } = useQuery({
    queryKey: ['studio-reputation', studioId],
    queryFn: async () => { const { data } = await supabase.rpc('studio_reputation', { p_studio_id: studioId }); return data as any },
    staleTime: 5 * 60_000,
  })
  if (!r) return null
  if (!r.classes && !r.evals) return <Text style={styles.repTxt}>Sin historial en la app todavía</Text>
  const bad = r.paid_total > 0 && r.paid_ok < r.paid_total
  const parts = [
    r.classes ? `${r.classes} clase${r.classes === 1 ? '' : 's'}` : null,
    r.avg_payment != null ? `pago ${r.avg_payment}/10` : null,
    r.paid_total > 0 ? `pagó lo acordado ${r.paid_ok}/${r.paid_total}` : null,
  ].filter(Boolean)
  return (
    <Text style={[styles.repTxt, bad && { color: colors.warnTx }]}>
      <Feather name={bad ? 'alert-triangle' : 'shield'} size={11} /> {parts.join(' · ')}
    </Text>
  )
}

const money = (n: number) => '$' + Math.round(Number(n)).toLocaleString('es-AR')
const DAY_ORDER = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo']

const longDate = (d: string) => formatDate(d, { weekday: 'long', day: 'numeric', month: 'long' })
const hhmm = (t?: string | null) => t?.slice(0, 5) ?? ''
const isExpired = (m: any) => m.status === 'pendiente' && !!m.expires_at && new Date(m.expires_at).getTime() <= Date.now()

const STUDIO_FIELDS = 'studio:studios(id, name, neighborhood, address, phone, instagram)'

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

  // Matches que el instructor ya evaluó
  const evaluatedQ = useQuery({
    queryKey: ['instructor-studio-evals', instructorId, 'match-ids'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('studio_evaluations').select('match_id').eq('instructor_id', instructorId!)
      if (error) throw error
      return new Set((data ?? []).map((e: any) => e.match_id).filter(Boolean))
    },
    enabled: !!instructorId,
  })

  const [counter, setCounter] = useState(0)
  const myRates: any = Array.isArray(instructor?.rates) ? (instructor?.rates as any)[0] : instructor?.rates
  const myRateFor = (m: any) => Number(m.class_type === 'regular' ? myRates?.rate_regular : myRates?.rate_replacement) || null

  const respondMutation = useMutation({
    mutationFn: async ({ matchId, status, note, counterRate }: { matchId: string; status?: string; note?: string; counterRate?: number }) => {
      const { data, error } = await supabase
        .from('matches')
        .update(counterRate ? { counter_rate: counterRate, note_instructor: note || null } : { status, note_instructor: note || null })
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
    }
  }, [instructorId]))

  const onRefresh = async () => {
    setRefreshing(true)
    await Promise.all([pendingQ.refetch(), historyQ.refetch(), evaluatedQ.refetch()])
    setRefreshing(false)
  }

  const openAction = (match: any, type: 'accept' | 'reject' | 'counter') => {
    setSelected(match)
    setActionType(type)
    setNoteText('')
    setCounter(myRateFor(match) ?? Number(match.offered_rate) ?? 0)
  }
  const closeModal = () => { setSelected(null); setActionType(null); setNoteText('') }

  const confirmAction = () => {
    if (!selected || !actionType) return
    if (actionType === 'counter') {
      if (counter < 1000) { showToast('Indicá el monto por clase', 'warning'); return }
      respondMutation.mutate({ matchId: selected.id, counterRate: counter, note: noteText.trim() || undefined })
      return
    }
    respondMutation.mutate({
      matchId: selected.id,
      status:  actionType === 'accept' ? 'aceptado' : 'rechazado',
      note:    noteText.trim() || undefined,
    })
  }

  const goEvaluate = (m: any) => navigation.navigate('EvaluateStudio', {
    matchId: m.id, studioId: m.studio_id, studioName: m.studio?.name ?? 'Estudio',
    classDate: m.class_date, classType: m.class_type, agreedRate: m.agreed_rate ?? null,
  })

  const pending = pendingQ.data ?? []
  const history = historyQ.data ?? []
  const evaluated: Set<string> = evaluatedQ.data ?? new Set()
  const activeQ = tab === 'pendientes' ? pendingQ : historyQ
  const data    = tab === 'pendientes' ? pending : history
  const toEvaluate = history.filter((m: any) => m.status === 'aceptado' && isPastDate(m.class_date) && !evaluated.has(m.id)).length

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
    const canEvaluate = accepted && isPastDate(match.class_date) && !evaluated.has(match.id)
    const minutesLeft = match.expires_at ? Math.max(0, Math.round((new Date(match.expires_at).getTime() - Date.now()) / 60_000)) : null
    const scheduleDays: string[] = (match.schedule_days ?? []).slice().sort((a: string, b: string) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b))

    return (
      <BlobCard style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.studioAvatar}>
            <Text style={styles.studioLetter}>{studio?.name?.[0]?.toUpperCase() ?? '?'}</Text>
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
          <View style={styles.datetimeItem}>
            <Feather name="calendar" size={13} color={colors.sage} />
            <Text style={styles.datetimeText}>
              {match.class_type === 'regular' ? 'Desde el ' : ''}{longDate(match.class_date)}
            </Text>
          </View>
          <View style={styles.datetimeItem}>
            <Feather name="clock" size={13} color={colors.sage} />
            <Text style={styles.datetimeText}>{hhmm(match.start_time)} – {hhmm(match.end_time)}</Text>
          </View>
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

        {/* Datos de contacto cuando la clase está confirmada */}
        {accepted && (studio?.address || studio?.phone) ? (
          <View style={styles.contactBox}>
            {studio?.address ? (
              <View style={styles.datetimeItem}>
                <Feather name="navigation" size={13} color={colors.sage} />
                <Text style={styles.datetimeText}>{studio.address}</Text>
              </View>
            ) : null}
            {studio?.phone ? (
              <TouchableOpacity style={styles.datetimeItem} onPress={() => Linking.openURL(`tel:${studio.phone}`)}>
                <Feather name="phone" size={13} color={colors.sage} />
                <Text style={[styles.datetimeText, styles.link]}>{studio.phone}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
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
          <Text style={styles.evaluatedTxt}>✓ Ya evaluaste esta clase</Text>
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
              {actionType === 'accept'
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
              <Button
                label={actionType === 'accept' ? 'Confirmar' : actionType === 'counter' ? `Proponer ${counter ? money(counter) : ''}` : 'Rechazar propuesta'}
                variant={actionType === 'reject' ? 'danger' : 'primary'}
                onPress={confirmAction}
                isLoading={respondMutation.isPending}
                fullWidth
              />
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
  repTxt:            { fontFamily: 'Nunito-SemiBold', fontSize: 11, color: colors.sage, marginTop: 2 },
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
  actions:           { gap: spacing.sm, marginTop: spacing.sm },
  offerBox:          { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, ...radius.leaf, padding: spacing.sm, marginBottom: spacing.sm },
  offerTxt:          { fontFamily: 'Nunito-Bold', fontSize: 13 },
  offerSub:          { fontFamily: 'Nunito-Regular', fontSize: 12, color: colors.mid, marginTop: 1 },
  counterRow:        { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  counterBtn:        { width: 44, height: 48, ...radius.leafSm, backgroundColor: colors.sageLighter, alignItems: 'center', justifyContent: 'center' },
  counterInput:      { flex: 1, minWidth: 0, height: 48, textAlign: 'center', fontFamily: 'Nunito-Bold', fontSize: 22, color: colors.sage, backgroundColor: colors.cream, ...radius.leafSm },
  evaluatedTxt:      { ...typography.small, color: colors.okTx, marginTop: spacing.xs },
  modalOverlay:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalBox:          { backgroundColor: colors.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: spacing.xl, paddingBottom: spacing.xxl },
  modalTitle:        { fontFamily: 'Nunito-Bold', fontSize: 20, color: colors.dark, marginBottom: spacing.xs },
  modalSub:          { ...typography.body, color: colors.mid, marginBottom: spacing.lg },
  noteInputLabel:    { ...typography.caption, marginBottom: spacing.xs },
  noteInput:         { backgroundColor: colors.cream, ...radius.leaf, padding: spacing.md, fontFamily: 'Nunito-Regular', fontSize: 14, color: colors.dark, minHeight: 80, textAlignVertical: 'top', borderWidth: 0.5, borderColor: colors.border, marginBottom: spacing.lg },
  modalActions:      { gap: spacing.sm },
})
