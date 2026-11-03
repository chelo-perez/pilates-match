// src/screens/camara/StudioDetailScreen.tsx
import React, { useState } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, TextInput, Alert } from 'react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { errorText, UserError } from '../../lib/errors'
import { formatDate } from '../../lib/dates'
import { PLANS, usedThisMonth } from '../../constants/plans'
import { LoadingScreen, ErrorState, Button, colors, spacing, radius, typography } from '../../components/ui'
import { Feather } from '@expo/vector-icons'
import BlobCard from '../../components/BlobCard'
import HeroHeader from '../../components/HeroHeader'
import Toast from '../../components/Toast'
import { useToast } from '../../hooks/useToast'
import { applyPlan, membershipOf, planDurationLabel, PlanKey, STUDIO_KEYS } from './planUtils'

// Estilo visual por plan (la definición de límites vive en constants/plans)
const PLAN_STYLE: Record<string, { desc: string; color: string; bg: string }> = {
  freemium: { desc: '1 propuesta por mes',        color: colors.mid,    bg: colors.sageLighter },
  starter:  { desc: '5 propuestas por mes',       color: colors.sage,   bg: colors.sageLight },
  socio:    { desc: '5 propuestas por mes + socio de la Cámara', color: colors.blueTx, bg: colors.blueBg },
  premium:  { desc: 'Propuestas ilimitadas',      color: colors.gold,   bg: colors.goldLight },
}

const longDate = (d?: string | null) => (d ? formatDate(d, { day: '2-digit', month: 'long', year: 'numeric' }) : '—')

function Row({ icon, label, value, valueColor }: { icon: string; label: string; value?: string | null; valueColor?: string }) {
  return (
    <View style={s.row}>
      <Feather name={icon as any} size={13} color={colors.sageMid} style={{ width: 18 }} />
      <Text style={s.rowLabel}>{label}</Text>
      <Text style={[s.rowValue, valueColor ? { color: valueColor } : null]}>{value || '—'}</Text>
    </View>
  )
}

export default function StudioDetailScreen({ navigation, route }: any) {
  const studioId: string | undefined = route?.params?.studioId
  const qc = useQueryClient()
  const { toast, showToast, hideToast } = useToast()
  const [showPlanModal, setShowPlanModal] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState<PlanKey>('freemium')
  const [planNote, setPlanNote] = useState('')

  const { data: studio, isLoading, isError, refetch } = useQuery({
    queryKey: ['studio-detail', studioId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('studios')
        .select('*, user:users(email), membership:memberships(*)')
        .eq('id', studioId!).single()
      if (error) throw error
      return data
    },
    enabled: !!studioId,
  })

  const { data: notes = [] } = useQuery({
    queryKey: ['studio-detail', studioId, 'notes'],
    queryFn: async () => {
      const { data, error } = await supabase.from('camara_studio_notes')
        .select('id, note, created_at').eq('studio_id', studioId!)
        .order('created_at', { ascending: false }).limit(5)
      if (error) throw error
      return data ?? []
    },
    enabled: !!studioId,
  })

  const invalidateAll = () => STUDIO_KEYS.forEach(queryKey => qc.invalidateQueries({ queryKey }))

  const changePlanMutation = useMutation({
    mutationFn: ({ plan, note }: { plan: PlanKey; note: string }) => applyPlan(studioId!, plan, note),
    onSuccess: (res) => {
      invalidateAll()
      setShowPlanModal(false)
      setPlanNote('')
      showToast(res?.noteSaved === false ? 'Plan actualizado, pero no pudimos guardar el motivo' : 'Plan actualizado',
        res?.noteSaved === false ? 'warning' : 'success')
    },
    onError: (e: any) => showToast(errorText(e), 'error'),
  })

  // "Bloquear" = membresía cancelada: el estudio no puede enviar propuestas
  const blockMutation = useMutation({
    mutationFn: async (block: boolean) => {
      const { data, error } = await supabase.from('memberships')
        .update({ status: block ? 'cancelada' : 'activa' })
        .eq('studio_id', studioId!)
        .select('id')
      if (error) throw error
      if (!data?.length) throw new UserError('El estudio no tiene una membresía para bloquear. Asignale un plan primero.')
    },
    onSuccess: (_, block) => {
      invalidateAll()
      showToast(block ? 'Estudio bloqueado: no puede enviar propuestas' : 'Estudio desbloqueado')
    },
    onError: (e: any) => showToast(errorText(e), 'error'),
  })

  if (!studioId) return <ErrorState message="No encontramos el estudio." onRetry={() => navigation.goBack()} />
  if (isLoading) return <LoadingScreen message="Cargando estudio..." />
  if (isError || !studio) return <ErrorState message="No pudimos cargar el estudio." onRetry={refetch} />

  const membership = membershipOf(studio)
  const planKey    = (membership?.plan_type ?? 'freemium') as PlanKey
  const planDef: any = PLANS.find((p: any) => p.key === planKey) ?? PLANS[0]
  const planStyle  = PLAN_STYLE[planKey] ?? PLAN_STYLE.freemium
  const isBlocked  = membership?.status === 'cancelada'
  const isExpired  = membership?.status === 'vencida'
  const matchUsed  = membership ? usedThisMonth(membership) : 0
  const matchLimit = membership?.matches_limit ?? null

  const confirmBlock = () => {
    Alert.alert(
      isBlocked ? 'Desbloquear estudio' : 'Bloquear estudio',
      isBlocked
        ? `"${studio.name}" vuelve a poder enviar propuestas según su plan.`
        : `"${studio.name}" no va a poder enviar propuestas nuevas hasta que lo desbloquees. Puede seguir entrando a la app.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: isBlocked ? 'Desbloquear' : 'Bloquear', style: isBlocked ? 'default' : 'destructive', onPress: () => blockMutation.mutate(!isBlocked) },
      ]
    )
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.cream }}>
      <HeroHeader
        title={studio.name}
        subtitle={studio.neighborhood ?? 'Buenos Aires'}
        onBack={() => navigation.goBack()}
        backLabel="Estudios"
        rightElement={
          <View style={[s.badge, { backgroundColor: planStyle.bg }]}>
            <Text style={[s.badgeTxt, { color: planStyle.color }]}>{planDef.label}</Text>
          </View>
        }
      />

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

        <BlobCard style={s.card} delay={0}>
          <Text style={s.sectionTitle}>INFORMACIÓN DEL ESTUDIO</Text>
          <Row icon="mail"     label="Email"      value={studio.user?.email} />
          <Row icon="phone"    label="Teléfono"   value={studio.phone} />
          <Row icon="map-pin"  label="Dirección"  value={[studio.address, studio.neighborhood].filter(Boolean).join(', ')} />
          <Row icon="hash"     label="CUIT"       value={studio.cuit} />
          <Row icon="calendar" label="Registrado" value={longDate(studio.created_at)} />
          {studio.is_member ? <Row icon="award" label="Socio desde" value={longDate(studio.member_since)} valueColor={colors.okTx} /> : null}
        </BlobCard>

        <BlobCard style={s.card} delay={600}>
          <Text style={s.sectionTitle}>RESPONSABLE</Text>
          <Row icon="user"  label="Nombre"   value={studio.owner_name} />
          <Row icon="phone" label="Teléfono" value={studio.owner_phone} />
          <Row icon="mail"  label="Email"    value={studio.owner_email} />
        </BlobCard>

        <BlobCard style={s.card} delay={1200}
          blobColor={`rgba(${planKey === 'premium' ? '184,150,12' : '74,93,78'},0.10)`}
          blobColor2={`rgba(${planKey === 'premium' ? '184,150,12' : '74,93,78'},0.06)`}
        >
          <Text style={s.sectionTitle}>PLAN</Text>
          <View style={[s.planBadge, { backgroundColor: planStyle.bg }]}>
            <Text style={[s.planBadgeLabel, { color: planStyle.color }]}>{planDef.label}</Text>
            <Text style={[s.planBadgeDesc, { color: planStyle.color }]}>{planStyle.desc}</Text>
          </View>

          {membership ? (
            <>
              <Row icon="check-circle" label="Estado"
                value={isBlocked ? 'Bloqueado' : isExpired ? 'Vencida' : 'Activa'}
                valueColor={isBlocked || isExpired ? colors.redTx : colors.okTx} />
              <Row icon="calendar" label="Inicio" value={longDate(membership.start_date)} />
              {planKey !== 'freemium' ? <Row icon="clock" label="Vencimiento" value={longDate(membership.end_date)} /> : null}
              <Row icon="activity" label="Propuestas"
                value={matchLimit !== null ? `${matchUsed} de ${matchLimit} este mes` : `${matchUsed} este mes (ilimitadas)`} />
            </>
          ) : (
            <View style={s.noMember}>
              <Feather name="info" size={15} color={colors.light} />
              <Text style={s.noMemberTxt}>Todavía no tiene un plan asignado. Asignale uno para que pueda enviar propuestas.</Text>
            </View>
          )}
        </BlobCard>

        <BlobCard style={s.card} delay={1800} blobColor="rgba(184,150,12,0.10)" blobColor2="rgba(184,150,12,0.06)">
          <Text style={s.sectionTitle}>PRESUPUESTO POR CLASE</Text>
          <Row icon="dollar-sign" label="Regular"
            value={studio.budget_regular ? '$' + studio.budget_regular.toLocaleString('es-AR') : 'Sin configurar'}
            valueColor={studio.budget_regular ? colors.sage : colors.light} />
          <Row icon="dollar-sign" label="Reemplazo"
            value={studio.budget_replacement ? '$' + studio.budget_replacement.toLocaleString('es-AR') : 'Sin configurar'}
            valueColor={studio.budget_replacement ? colors.gold : colors.light} />
          {studio.equipment?.length > 0 && (
            <View style={[s.row, { alignItems: 'flex-start', paddingTop: 8 }]}>
              <Feather name="tool" size={13} color={colors.sageMid} style={{ width: 18, marginTop: 2 }} />
              <Text style={s.rowLabel}>Equipamiento</Text>
              <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
                {studio.equipment.map((e: string) => (
                  <View key={e} style={s.chip}><Text style={s.chipTxt}>{e}</Text></View>
                ))}
              </View>
            </View>
          )}
        </BlobCard>

        {notes.length > 0 ? (
          <BlobCard style={s.card} delay={2400}>
            <Text style={s.sectionTitle}>HISTORIAL DE CAMBIOS</Text>
            {notes.map((n: any) => (
              <Text key={n.id} style={s.noteItem}>• {formatDate(n.created_at)} — {n.note}</Text>
            ))}
          </BlobCard>
        ) : null}

        <Text style={s.actionsTitle}>ACCIONES</Text>

        <TouchableOpacity style={s.actionBtn} activeOpacity={0.85}
          onPress={() => { setSelectedPlan(planKey); setPlanNote(''); setShowPlanModal(true) }}>
          <View style={s.actionIcon}><Feather name="refresh-cw" size={16} color={colors.sage} /></View>
          <View style={{ flex: 1 }}>
            <Text style={s.actionLabel}>Cambiar plan</Text>
            <Text style={s.actionDesc}>Asignar Freemium, Starter, Socio o Premium</Text>
          </View>
          <Feather name="chevron-right" size={16} color={colors.border} />
        </TouchableOpacity>

        {membership ? (
          <TouchableOpacity
            style={[s.actionBtn, isBlocked && { backgroundColor: colors.redBg, borderColor: colors.redBg }]}
            onPress={confirmBlock}
            disabled={blockMutation.isPending}
            activeOpacity={0.85}
          >
            <View style={[s.actionIcon, { backgroundColor: isBlocked ? colors.white : colors.sageLighter }]}>
              <Feather name={isBlocked ? 'unlock' : 'lock'} size={16} color={isBlocked ? colors.redTx : colors.sage} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.actionLabel, isBlocked && { color: colors.redTx }]}>
                {isBlocked ? 'Desbloquear estudio' : 'Bloquear propuestas'}
              </Text>
              <Text style={s.actionDesc}>
                {isBlocked ? 'Vuelve a poder enviar propuestas' : 'El estudio no podrá enviar propuestas nuevas'}
              </Text>
            </View>
            <Feather name="chevron-right" size={16} color={colors.border} />
          </TouchableOpacity>
        ) : null}
      </ScrollView>

      <Modal visible={showPlanModal} transparent animationType="slide" onRequestClose={() => setShowPlanModal(false)}>
        <View style={s.overlay}>
          <View style={s.modalBox}>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={s.modalTitle}>Cambiar plan</Text>
              <Text style={s.modalSub}>Elegí el nuevo plan para {studio.name}. El contador de propuestas del mes vuelve a cero.</Text>

              {PLANS.map((p: any) => {
                const st = PLAN_STYLE[p.key] ?? PLAN_STYLE.freemium
                const active = selectedPlan === p.key
                return (
                  <TouchableOpacity
                    key={p.key}
                    style={[s.planOption, { borderColor: active ? st.color : colors.border, backgroundColor: active ? st.bg : colors.white }]}
                    onPress={() => setSelectedPlan(p.key)}
                    activeOpacity={0.8}
                  >
                    <View style={[s.planRadio, active && { borderColor: st.color }]}>
                      {active && <View style={[s.planRadioDot, { backgroundColor: st.color }]} />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.planOptionLabel, { color: st.color }]}>{p.label}</Text>
                      <Text style={s.planOptionDesc}>{st.desc} · {planDurationLabel(p.key)}</Text>
                    </View>
                    {membership?.plan_type === p.key && (
                      <View style={[s.currentTag, { backgroundColor: st.bg }]}>
                        <Text style={[s.currentTagTxt, { color: st.color }]}>Actual</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                )
              })}

              <Text style={[s.inputLabel, { marginTop: spacing.md }]}>MOTIVO DEL CAMBIO (OPCIONAL)</Text>
              <TextInput
                style={s.noteInput}
                value={planNote}
                onChangeText={setPlanNote}
                placeholder="Ej: Pago en efectivo registrado el 01/07"
                placeholderTextColor={colors.light}
                multiline
              />

              <Button
                label="Confirmar cambio"
                onPress={() => changePlanMutation.mutate({ plan: selectedPlan, note: planNote })}
                isLoading={changePlanMutation.isPending}
                disabled={membership?.plan_type === selectedPlan && membership?.status === 'activa'}
                fullWidth
              />
              <Button label="Cancelar" variant="ghost" onPress={() => setShowPlanModal(false)} fullWidth style={{ marginTop: spacing.xs }} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Toast visible={toast.visible} message={toast.message} type={toast.type} onHide={hideToast} />
    </View>
  )
}

const s = StyleSheet.create({
  content:         { padding: spacing.md, paddingBottom: 48 },
  badge:           { ...radius.leaf, paddingHorizontal: 10, paddingVertical: 4 },
  badgeTxt:        { fontFamily: 'Nunito-Bold', fontSize: 10 },
  card:            { padding: spacing.md, marginBottom: spacing.sm },
  sectionTitle:    { ...typography.caption, marginBottom: spacing.md },
  row:             { flexDirection: 'row', alignItems: 'center', paddingVertical: 7, borderBottomWidth: 0.5, borderColor: colors.borderLight },
  rowLabel:        { fontFamily: 'Nunito-SemiBold', fontSize: 12, color: colors.mid, width: 90 },
  rowValue:        { fontFamily: 'Nunito-SemiBold', fontSize: 12, color: colors.dark, flex: 1 },
  planBadge:       { ...radius.leaf, padding: spacing.md, marginBottom: spacing.md },
  planBadgeLabel:  { fontFamily: 'Nunito-Bold', fontSize: 16 },
  planBadgeDesc:   { fontFamily: 'Nunito-Regular', fontSize: 12, marginTop: 2 },
  noMember:        { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
  noMemberTxt:     { fontFamily: 'Nunito-Regular', fontSize: 13, color: colors.mid, flex: 1 },
  chip:            { backgroundColor: colors.sageLight, ...radius.leaf, paddingHorizontal: 7, paddingVertical: 2 },
  chipTxt:         { fontFamily: 'Nunito-SemiBold', fontSize: 10, color: colors.sage },
  noteItem:        { fontFamily: 'Nunito-Regular', fontSize: 12, color: colors.mid, marginBottom: 4 },
  actionsTitle:    { ...typography.caption, marginBottom: spacing.sm, marginTop: spacing.sm },
  actionBtn:       { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.white, ...radius.leaf, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 0.5, borderColor: colors.borderLight, elevation: 1 },
  actionIcon:      { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.sageLight, alignItems: 'center', justifyContent: 'center' },
  actionLabel:     { fontFamily: 'Nunito-Bold', fontSize: 14, color: colors.dark },
  actionDesc:      { fontFamily: 'Nunito-Regular', fontSize: 11, color: colors.light, marginTop: 2 },
  overlay:         { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalBox:        { backgroundColor: colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.xl, paddingBottom: 40, maxHeight: '90%' },
  modalTitle:      { fontFamily: 'Nunito-Bold', fontSize: 20, color: colors.dark, marginBottom: spacing.xs },
  modalSub:        { fontFamily: 'Nunito-Regular', fontSize: 13, color: colors.mid, marginBottom: spacing.md },
  planOption:      { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, ...radius.leaf, borderWidth: 1.5, marginBottom: spacing.sm },
  planRadio:       { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  planRadioDot:    { width: 10, height: 10, borderRadius: 5 },
  planOptionLabel: { fontFamily: 'Nunito-Bold', fontSize: 14 },
  planOptionDesc:  { fontFamily: 'Nunito-Regular', fontSize: 12, color: colors.mid, marginTop: 2 },
  currentTag:      { borderRadius: radius.sm, paddingHorizontal: 7, paddingVertical: 2 },
  currentTagTxt:   { fontFamily: 'Nunito-Bold', fontSize: 10 },
  inputLabel:      { ...typography.caption, marginBottom: 6 },
  noteInput:       { backgroundColor: colors.sageLighter, ...radius.leaf, padding: spacing.md, fontFamily: 'Nunito-Regular', fontSize: 13, color: colors.dark, minHeight: 64, textAlignVertical: 'top', marginBottom: spacing.md },
})
