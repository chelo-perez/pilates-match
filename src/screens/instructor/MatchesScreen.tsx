// src/screens/instructor/MatchesScreen.tsx
// Pantalla de solicitudes de cobertura para el instructor
// Ve solicitudes pendientes, acepta/rechaza y consulta historial

import React, { useState, useCallback } from 'react'
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Alert, TextInput, Modal, ScrollView, RefreshControl
} from 'react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useFocusEffect } from '@react-navigation/native'
import { supabase, db } from '../../lib/supabase'
import { useAuthStore } from '../../store'
import { Card, Badge, EmptyState, LoadingScreen, Button, colors, spacing, radius, typography } from '../../components/ui'
import { Feather } from '@expo/vector-icons'

type Tab = 'pendientes' | 'historial'

const DAYS_ES: Record<string, string> = {
  lunes: 'Lun', martes: 'Mar', miercoles: 'Mié',
  jueves: 'Jue', viernes: 'Vie', sabado: 'Sáb', domingo: 'Dom',
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })
}

function formatTime(t: string) {
  return t?.slice(0, 5) ?? ''
}

const STATUS_LABEL: Record<string, string> = {
  pendiente: 'Pendiente',
  aceptado:  'Aceptado',
  rechazado: 'Rechazado',
  expirado:  'Expirado',
  cancelado: 'Cancelado',
}

const STATUS_VARIANT: Record<string, any> = {
  pendiente: 'warning',
  aceptado:  'success',
  rechazado: 'danger',
  expirado:  'default',
  cancelado: 'default',
}

export default function InstructorMatchesScreen() {
  const qc = useQueryClient()
  const user = useAuthStore(s => s.user)
  const [tab, setTab]                   = useState<Tab>('pendientes')
  const [selected, setSelected]         = useState<any>(null)
  const [noteText, setNoteText]         = useState('')
  const [actionType, setActionType]     = useState<'accept' | 'reject' | null>(null)
  const [refreshing, setRefreshing]     = useState(false)

  // Obtener instructor_id del usuario logueado
  const { data: instructor } = useQuery({
    queryKey: ['my-instructor-id', user?.id],
    queryFn: async () => {
      const { data } = await db.instructors().select('id').eq('user_id', user!.id).single()
      return data
    },
    enabled: !!user?.id,
  })

  // Solicitudes pendientes
  const { data: pending = [], isLoading: loadingPending, refetch: refetchPending } = useQuery({
    queryKey: ['instructor-matches-pending', instructor?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('matches')
        .select(`
          *,
          studio:studios(id, name, neighborhood, address, phone, instagram)
        `)
        .eq('instructor_id', instructor!.id)
        .eq('status', 'pendiente')
        .gt('expires_at', new Date().toISOString())
        .order('class_date', { ascending: true })
      if (error) throw error
      return data ?? []
    },
    enabled: !!instructor?.id,
    refetchInterval: 30_000, // refrescar cada 30s para nuevas solicitudes
  })

  // Historial
  const { data: history = [], isLoading: loadingHistory, refetch: refetchHistory } = useQuery({
    queryKey: ['instructor-matches-history', instructor?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('matches')
        .select(`
          *,
          studio:studios(id, name, neighborhood)
        `)
        .eq('instructor_id', instructor!.id)
        .not('status', 'eq', 'pendiente')
        .order('class_date', { ascending: false })
        .limit(30)
      if (error) throw error
      return data ?? []
    },
    enabled: !!instructor?.id,
  })

  const respondMutation = useMutation({
    mutationFn: async ({ matchId, status, note }: { matchId: string; status: string; note?: string }) => {
      const { error } = await supabase
        .from('matches')
        .update({
          status,
          note_instructor: note || null,
          responded_at: new Date().toISOString(),
        })
        .eq('id', matchId)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['instructor-matches-pending'] })
      qc.invalidateQueries({ queryKey: ['instructor-matches-history'] })
      setSelected(null)
      setNoteText('')
      setActionType(null)
    },
    onError: (e: any) => Alert.alert('Error', e.message),
  })

  useFocusEffect(useCallback(() => {
    if (instructor?.id) {
      refetchPending()
      refetchHistory()
    }
  }, [instructor?.id]))

  const onRefresh = async () => {
    setRefreshing(true)
    await Promise.all([refetchPending(), refetchHistory()])
    setRefreshing(false)
  }

  const openAction = (match: any, type: 'accept' | 'reject') => {
    setSelected(match)
    setActionType(type)
    setNoteText('')
  }

  const confirmAction = () => {
    if (!selected || !actionType) return
    respondMutation.mutate({
      matchId: selected.id,
      status:  actionType === 'accept' ? 'aceptado' : 'rechazado',
      note:    noteText.trim() || undefined,
    })
  }

  const isLoading = tab === 'pendientes' ? loadingPending : loadingHistory
  const data      = tab === 'pendientes' ? pending : history

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Solicitudes</Text>
        {pending.length > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{pending.length}</Text>
          </View>
        )}
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {(['pendientes', 'historial'] as Tab[]).map(t => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, tab === t && styles.tabActive]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t === 'pendientes' ? `Pendientes${pending.length > 0 ? ` (${pending.length})` : ''}` : 'Historial'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading ? (
        <LoadingScreen message="Cargando solicitudes..." />
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item: any) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.sage} />}
          ListEmptyComponent={
            <EmptyState
              icon={tab === 'pendientes' ? 'inbox' : 'clock'}
              title={tab === 'pendientes' ? 'Sin solicitudes pendientes' : 'Sin historial aún'}
              subtitle={
                tab === 'pendientes'
                  ? 'Cuando un estudio te contacte, la solicitud aparecerá acá.'
                  : 'Las solicitudes respondidas quedarán registradas acá.'
              }
            />
          }
          renderItem={({ item: match }: any) => {
            const studio = match.studio
            const isPending = match.status === 'pendiente'
            const expiresAt = new Date(match.expires_at)
            const now = new Date()
            const hoursLeft = Math.max(0, Math.round((expiresAt.getTime() - now.getTime()) / 3_600_000))

            return (
              <Card style={styles.card}>
                {/* Studio + tipo */}
                <View style={styles.cardHeader}>
                  <View style={styles.studioAvatar}>
                    <Text style={styles.studioLetter}>{studio?.name?.[0] ?? '?'}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.studioName}>{studio?.name ?? 'Estudio'}</Text>
                    <Text style={styles.studioNeighborhood}>
                      <Feather name="map-pin" size={11} color={colors.light} /> {studio?.neighborhood}
                    </Text>
                  </View>
                  <Badge
                    label={match.class_type === 'reemplazo' ? 'Reemplazo' : 'Regular'}
                    variant={match.class_type === 'reemplazo' ? 'warning' : 'success'}
                  />
                </View>

                {/* Fecha y hora */}
                <View style={styles.datetimeRow}>
                  <View style={styles.datetimeItem}>
                    <Feather name="calendar" size={13} color={colors.sage} />
                    <Text style={styles.datetimeText}>{formatDate(match.class_date)}</Text>
                  </View>
                  <View style={styles.datetimeItem}>
                    <Feather name="clock" size={13} color={colors.sage} />
                    <Text style={styles.datetimeText}>
                      {formatTime(match.start_time)} – {formatTime(match.end_time)}
                    </Text>
                  </View>
                </View>

                {/* Nota del estudio */}
                {match.note_studio ? (
                  <View style={styles.noteBox}>
                    <Text style={styles.noteLabel}>Nota del estudio</Text>
                    <Text style={styles.noteText}>"{match.note_studio}"</Text>
                  </View>
                ) : null}

                {/* Expiración o estado */}
                {isPending ? (
                  <Text style={[styles.expiry, hoursLeft < 4 && { color: '#A32D2D' }]}>
                    <Feather name="alert-circle" size={11} /> Expira en {hoursLeft}h
                  </Text>
                ) : (
                  <View style={styles.statusRow}>
                    <Badge label={STATUS_LABEL[match.status] ?? match.status} variant={STATUS_VARIANT[match.status]} />
                    {match.responded_at && (
                      <Text style={styles.respondedAt}>
                        {new Date(match.responded_at).toLocaleDateString('es-AR')}
                      </Text>
                    )}
                  </View>
                )}

                {/* Acciones para pendientes */}
                {isPending && (
                  <View style={styles.actions}>
                    <TouchableOpacity
                      style={styles.rejectBtn}
                      onPress={() => openAction(match, 'reject')}
                    >
                      <Feather name="x" size={16} color="#A32D2D" />
                      <Text style={styles.rejectText}>Rechazar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.acceptBtn}
                      onPress={() => openAction(match, 'accept')}
                    >
                      <Feather name="check" size={16} color={colors.white} />
                      <Text style={styles.acceptText}>Aceptar</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </Card>
            )
          }}
        />
      )}

      {/* Modal de confirmación con nota opcional */}
      <Modal visible={!!selected && !!actionType} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>
              {actionType === 'accept' ? '¿Aceptar solicitud?' : '¿Rechazar solicitud?'}
            </Text>
            <Text style={styles.modalSub}>
              {actionType === 'accept'
                ? `Confirmarás la cobertura en ${selected?.studio?.name} el ${selected?.class_date ? formatDate(selected.class_date) : ''}.`
                : 'El estudio recibirá una notificación informando que no podés cubrir la clase.'}
            </Text>

            <Text style={styles.noteInputLabel}>Nota para el estudio (opcional)</Text>
            <TextInput
              style={styles.noteInput}
              placeholder={
                actionType === 'accept'
                  ? 'Ej: Confirmo asistencia. Llego 10 min antes.'
                  : 'Ej: Ya tengo clase a esa hora.'
              }
              placeholderTextColor={colors.light}
              value={noteText}
              onChangeText={setNoteText}
              multiline
              maxLength={200}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => { setSelected(null); setActionType(null); setNoteText('') }}
              >
                <Text style={styles.cancelText}>Cancelar</Text>
              </TouchableOpacity>
              <Button
                label={actionType === 'accept' ? 'Confirmar aceptación' : 'Confirmar rechazo'}
                onPress={confirmAction}
                isLoading={respondMutation.isPending}
                style={[
                  styles.confirmBtn,
                  actionType === 'reject' && { backgroundColor: '#A32D2D' }
                ]}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container:         { flex: 1, backgroundColor: colors.cream },
  header:            { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingTop: spacing.lg, paddingBottom: spacing.sm, gap: spacing.sm },
  title:             { fontFamily: 'Nunito-Bold', fontSize: 22, color: colors.dark },
  badge:             { backgroundColor: colors.sage, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText:         { color: colors.white, fontFamily: 'DM_Sans-SemiBold', fontSize: 12 },
  tabs:              { flexDirection: 'row', marginHorizontal: spacing.md, marginBottom: spacing.sm, backgroundColor: colors.white, borderRadius: radius.md, padding: 3, borderWidth: 0.5, borderColor: colors.border },
  tab:               { flex: 1, paddingVertical: spacing.sm, alignItems: 'center', borderRadius: radius.sm },
  tabActive:         { backgroundColor: colors.sage },
  tabText:           { ...typography.small, fontFamily: 'DM_Sans-SemiBold', color: colors.mid },
  tabTextActive:     { color: colors.white },
  list:              { paddingHorizontal: spacing.md, paddingBottom: spacing.xl },
  card:              { marginBottom: spacing.sm, padding: spacing.md, backgroundColor: colors.white },
  cardHeader:        { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  studioAvatar:      { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.sageLight, alignItems: 'center', justifyContent: 'center', marginRight: spacing.sm },
  studioLetter:      { fontFamily: 'DM_Sans-SemiBold', fontSize: 17, color: colors.sage },
  studioName:        { fontFamily: 'DM_Sans-SemiBold', fontSize: 14, color: colors.dark },
  studioNeighborhood:{ ...typography.small, color: colors.mid, marginTop: 1 },
  datetimeRow:       { gap: spacing.xs, marginBottom: spacing.sm },
  datetimeItem:      { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  datetimeText:      { ...typography.small, color: colors.dark, fontSize: 13 },
  noteBox:           { backgroundColor: colors.cream, borderRadius: radius.sm, padding: spacing.sm, marginBottom: spacing.sm },
  noteLabel:         { ...typography.small, color: colors.light, marginBottom: 2 },
  noteText:          { ...typography.small, color: colors.mid, fontStyle: 'italic' },
  expiry:            { ...typography.small, color: colors.mid, marginBottom: spacing.sm },
  statusRow:         { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs },
  respondedAt:       { ...typography.small, color: colors.light },
  actions:           { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  rejectBtn:         { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, paddingVertical: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: '#F09595', backgroundColor: '#FCEBEB' },
  rejectText:        { fontFamily: 'DM_Sans-SemiBold', fontSize: 14, color: '#A32D2D' },
  acceptBtn:         { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, paddingVertical: spacing.sm, borderRadius: radius.md, backgroundColor: colors.sage },
  acceptText:        { fontFamily: 'DM_Sans-SemiBold', fontSize: 14, color: colors.white },
  // Modal
  modalOverlay:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalBox:          { backgroundColor: colors.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: spacing.xl, paddingBottom: spacing.xxxl },
  modalTitle:        { fontFamily: 'Nunito-Bold', fontSize: 20, color: colors.dark, marginBottom: spacing.xs },
  modalSub:          { ...typography.body, color: colors.mid, marginBottom: spacing.lg },
  noteInputLabel:    { ...typography.small, color: colors.mid, fontFamily: 'DM_Sans-SemiBold', marginBottom: spacing.xs },
  noteInput:         { backgroundColor: colors.cream, borderRadius: radius.md, padding: spacing.md, ...typography.body, color: colors.dark, minHeight: 80, textAlignVertical: 'top', borderWidth: 0.5, borderColor: colors.border, marginBottom: spacing.lg },
  modalActions:      { gap: spacing.sm },
  cancelBtn:         { alignItems: 'center', paddingVertical: spacing.md },
  cancelText:        { ...typography.body, color: colors.mid, fontFamily: 'DM_Sans-SemiBold' },
  confirmBtn:        { borderRadius: radius.md },
})
