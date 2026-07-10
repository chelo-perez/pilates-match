import React, { useState } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, TextInput } from 'react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { LoadingScreen, colors, spacing } from '../../components/ui'
import { Feather } from '@expo/vector-icons'
import BlobCard from '../../components/BlobCard'
import HeroHeader from '../../components/HeroHeader'
import Toast from '../../components/Toast'
import { useToast } from '../../hooks/useToast'

const PLANS = [
  { key: 'freemium',    label: 'Freemium',     desc: '1 propuesta/mes',              color: colors.mid,   bg: colors.sageLighter },
  { key: 'starter',     label: 'Starter',      desc: '5 propuestas/mes',             color: colors.sage,  bg: colors.sageLight },
  { key: 'socio',       label: 'Socio Cámara', desc: '5 propuestas + badge + desc.', color: '#0C447C',    bg: '#E6F1FB' },
  { key: 'premium',     label: 'Premium',      desc: 'Ilimitadas + destacado',       color: colors.gold,  bg: colors.goldLight },
]

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })
}

export default function StudioDetailScreen({ navigation, route }: any) {
  const { studioId } = route.params
  const qc = useQueryClient()
  const { toast, showToast, hideToast } = useToast()
  const [showPlanModal, setShowPlanModal] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState('')
  const [planNote, setPlanNote] = useState('')

  const { data: studio, isLoading } = useQuery({
    queryKey: ['studio-detail', studioId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('studios')
        .select('*, user:users(email), membership:memberships(*)')
        .eq('id', studioId).single()
      if (error) throw error
      return data
    },
  })

  const changePlanMutation = useMutation({
    mutationFn: async ({ plan, note }: { plan: string; note: string }) => {
      const planData = PLANS.find(p => p.key === plan)
      const matchLimit = plan === 'freemium' ? 1 : plan === 'starter' ? 5 : plan === 'socio' ? 5 : null

      const end = new Date()
      end.setMonth(end.getMonth() + 1)

      // Check if membership exists
      const { data: existing } = await supabase
        .from('memberships').select('id').eq('studio_id', studioId).maybeSingle()

      if (existing?.id) {
        const { error: upErr } = await supabase.from('memberships').update({
          status: 'activa',
          plan_type: plan,
          start_date: new Date().toISOString().split('T')[0],
          end_date: end.toISOString().split('T')[0],
          matches_limit: matchLimit,
          matches_used_month: 0,
        }).eq('id', existing.id)
        if (upErr) throw upErr
      } else {
        const { error: insErr } = await supabase.from('memberships').insert({
          studio_id: studioId,
          status: 'activa',
          plan_type: plan,
          start_date: new Date().toISOString().split('T')[0],
          end_date: end.toISOString().split('T')[0],
          matches_limit: matchLimit,
          matches_used_month: 0,
        })
        if (insErr) throw insErr
      }

      await supabase.from('studios').update({
        is_member: plan !== 'freemium',
        member_since: plan !== 'freemium' ? new Date().toISOString().split('T')[0] : null,
      }).eq('id', studioId)

      if (note.trim()) {
        await supabase.from('camara_studio_notes').insert({
          studio_id: studioId,
          note: `Cambio de plan a ${planData?.label}: ${note}`,
          created_at: new Date().toISOString(),
        })
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['studio-detail', studioId] })
      setShowPlanModal(false)
      setPlanNote('')
      showToast('Plan actualizado correctamente')
    },
    onError: (e: any) => showToast('Error: ' + e.message),
  })

  const blockMutation = useMutation({
    mutationFn: async (block: boolean) => {
      await supabase.from('memberships')
        .update({ status: block ? 'bloqueada' : 'activa' })
        .eq('studio_id', studioId)
    },
    onSuccess: (_, block) => {
      qc.invalidateQueries({ queryKey: ['studio-detail', studioId] })
      showToast(block ? 'Estudio bloqueado' : 'Estudio desbloqueado')
    },
    onError: (e: any) => showToast('Error: ' + e.message),
  })

  if (isLoading || !studio) return <LoadingScreen />

  const membership = Array.isArray(studio.membership) ? studio.membership[0] : studio.membership
  const plan = PLANS.find(p => p.key === membership?.plan_type) ?? PLANS[0]
  const isBlocked = membership?.status === 'bloqueada'
  const isActive  = membership?.status === 'activa'
  const matchUsed = membership?.matches_used_month ?? 0
  const matchLimit = membership?.matches_limit

  const Row = ({ icon, label, value, valueColor }: any) => (
    <View style={s.row}>
      <Feather name={icon} size={13} color={colors.sageMid} style={{ width: 18 }} />
      <Text style={s.rowLabel}>{label}</Text>
      <Text style={[s.rowValue, valueColor && { color: valueColor }]}>{value || '—'}</Text>
    </View>
  )

  return (
    <View style={{ flex: 1, backgroundColor: colors.cream }}>
      <HeroHeader
        title={studio.name}
        subtitle={studio.neighborhood ?? 'Buenos Aires'}
        onBack={() => navigation.goBack()}
        backLabel="Estudios"
        rightElement={
          <View style={[s.badge, { backgroundColor: plan.bg }]}>
            <Text style={[s.badgeTxt, { color: plan.color }]}>{plan.label}</Text>
          </View>
        }
      />

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

        {/* Info básica */}
        <BlobCard style={s.card} delay={0}>
          <Text style={s.sectionTitle}>INFORMACIÓN DEL ESTUDIO</Text>
          <Row icon="mail"       label="Email"       value={studio.user?.email} />
          <Row icon="phone"      label="Teléfono"    value={studio.phone} />
          <Row icon="map-pin"    label="Barrio"      value={studio.neighborhood} />
          <Row icon="hash"       label="CUIT"        value={studio.cuit} />
          <Row icon="calendar"   label="Registrado"  value={fmtDate(studio.created_at)} />
        </BlobCard>

        {/* Responsable */}
        <BlobCard style={s.card} delay={600}>
          <Text style={s.sectionTitle}>RESPONSABLE</Text>
          <Row icon="user"  label="Nombre"   value={studio.owner_name} />
          <Row icon="phone" label="Teléfono" value={studio.owner_phone} />
          <Row icon="mail"  label="Email"    value={studio.owner_email} />
        </BlobCard>

        {/* Membresía actual */}
        <BlobCard style={s.card} delay={1200}
          blobColor={`rgba(${plan.key === 'premium' ? '184,150,12' : '74,93,78'},0.10)`}
          blobColor2={`rgba(${plan.key === 'premium' ? '184,150,12' : '74,93,78'},0.06)`}
        >
          <Text style={s.sectionTitle}>MEMBRESÍA ACTIVA</Text>

          {/* Plan badge */}
          <View style={[s.planBadge, { backgroundColor: plan.bg }]}>
            <Text style={[s.planBadgeLabel, { color: plan.color }]}>{plan.label}</Text>
            <Text style={[s.planBadgeDesc, { color: plan.color }]}>{plan.desc}</Text>
          </View>

          {membership ? (
            <>
              <Row icon="check-circle" label="Estado"      value={isBlocked ? 'Bloqueada' : isActive ? 'Activa' : 'Sin membresía'} valueColor={isBlocked ? colors.redTx : isActive ? colors.okTx : colors.light} />
              <Row icon="calendar"     label="Inicio"      value={fmtDate(membership.start_date)} />
              <Row icon="clock"        label="Vencimiento" value={fmtDate(membership.end_date)} />
              <Row icon="activity"     label="Propuestas"  value={matchLimit !== null ? `${matchUsed} / ${matchLimit} este mes` : `${matchUsed} este mes (ilimitadas)`} />
            </>
          ) : (
            <View style={s.noMember}>
              <Feather name="info" size={15} color={colors.light} />
              <Text style={s.noMemberTxt}>Sin membresía registrada. El estudio está en Freemium.</Text>
            </View>
          )}
        </BlobCard>

        {/* Presupuesto */}
        <BlobCard style={s.card} delay={1800}
          blobColor="rgba(184,150,12,0.10)" blobColor2="rgba(184,150,12,0.06)">
          <Text style={s.sectionTitle}>PRESUPUESTO POR HORA</Text>
          <Row icon="dollar-sign" label="Regular"   value={studio.budget_regular ? '$' + studio.budget_regular.toLocaleString('es-AR') + '/h' : 'Sin configurar'} valueColor={studio.budget_regular ? colors.sage : colors.light} />
          <Row icon="dollar-sign" label="Reemplazo" value={studio.budget_replacement ? '$' + studio.budget_replacement.toLocaleString('es-AR') + '/h' : 'Sin configurar'} valueColor={studio.budget_replacement ? colors.gold : colors.light} />
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

        {/* Acciones administrativas */}
        <Text style={s.actionsTitle}>ACCIONES ADMINISTRATIVAS</Text>

        {/* Cambiar plan */}
        <TouchableOpacity style={s.actionBtn} onPress={() => { setSelectedPlan(membership?.plan_type ?? 'freemium'); setShowPlanModal(true) }} activeOpacity={0.85}>
          <View style={s.actionIcon}><Feather name="refresh-cw" size={16} color={colors.sage} /></View>
          <View style={{ flex: 1 }}>
            <Text style={s.actionLabel}>Cambiar plan</Text>
            <Text style={s.actionDesc}>Upgrade, downgrade o asignar plan manual</Text>
          </View>
          <Feather name="chevron-right" size={16} color={colors.border} />
        </TouchableOpacity>

        {/* Bloquear/desbloquear */}
        <TouchableOpacity
          style={[s.actionBtn, isBlocked && { backgroundColor: '#FCEBEB', borderColor: '#F09595' }]}
          onPress={() => blockMutation.mutate(!isBlocked)}
          disabled={blockMutation.isPending}
          activeOpacity={0.85}
        >
          <View style={[s.actionIcon, { backgroundColor: isBlocked ? colors.redBg : colors.sageLighter }]}>
            <Feather name={isBlocked ? 'unlock' : 'lock'} size={16} color={isBlocked ? colors.redTx : colors.sage} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[s.actionLabel, isBlocked && { color: colors.redTx }]}>
              {isBlocked ? 'Desbloquear estudio' : 'Bloquear acceso'}
            </Text>
            <Text style={s.actionDesc}>
              {isBlocked ? 'Restablecer el acceso a la plataforma' : 'Suspender temporalmente el acceso'}
            </Text>
          </View>
          <Feather name="chevron-right" size={16} color={colors.border} />
        </TouchableOpacity>

      </ScrollView>

      {/* Modal cambiar plan */}
      <Modal visible={showPlanModal} transparent animationType="slide">
        <View style={s.overlay}>
          <View style={s.modalBox}>
            <Text style={s.modalTitle}>Cambiar plan</Text>
            <Text style={s.modalSub}>Seleccioná el nuevo plan para {studio.name}</Text>

            {PLANS.map(p => (
              <TouchableOpacity
                key={p.key}
                style={[s.planOption, { borderColor: selectedPlan === p.key ? p.color : colors.border, backgroundColor: selectedPlan === p.key ? p.bg : colors.white }]}
                onPress={() => setSelectedPlan(p.key)}
                activeOpacity={0.8}
              >
                <View style={[s.planRadio, selectedPlan === p.key && { borderColor: p.color }]}>
                  {selectedPlan === p.key && <View style={[s.planRadioDot, { backgroundColor: p.color }]} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.planOptionLabel, { color: p.color }]}>{p.label}</Text>
                  <Text style={s.planOptionDesc}>{p.desc}</Text>
                </View>
                {membership?.plan_type === p.key && (
                  <View style={[s.currentTag, { backgroundColor: p.bg }]}>
                    <Text style={[s.currentTagTxt, { color: p.color }]}>Actual</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}

            <Text style={[s.inputLabel, { marginTop: spacing.md }]}>MOTIVO DEL CAMBIO</Text>
            <TextInput
              style={s.noteInput}
              value={planNote}
              onChangeText={setPlanNote}
              placeholder="Ej: Upgrade por pago en efectivo registrado el 01/07"
              placeholderTextColor={colors.light}
              multiline
            />

            <TouchableOpacity
              style={[s.confirmBtn, !selectedPlan && { opacity: 0.5 }]}
              onPress={() => changePlanMutation.mutate({ plan: selectedPlan, note: planNote })}
              disabled={!selectedPlan || changePlanMutation.isPending}
            >
              <Text style={s.confirmTxt}>{changePlanMutation.isPending ? 'Guardando...' : 'Confirmar cambio'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.cancelBtn} onPress={() => setShowPlanModal(false)}>
              <Text style={s.cancelTxt}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Toast visible={toast.visible} message={toast.message} type={toast.type} onHide={hideToast} />
    </View>
  )
}

const s = StyleSheet.create({
  content:         { padding: spacing.md, paddingBottom: 48 },
  badge:           { borderTopLeftRadius: 10, borderTopRightRadius: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  badgeTxt:        { fontFamily: 'Nunito-Bold', fontSize: 10 },
  card:            { padding: spacing.md, marginBottom: spacing.sm },
  sectionTitle:    { fontFamily: 'Nunito-Bold', fontSize: 9, color: colors.light, letterSpacing: 0.8, marginBottom: spacing.md },
  row:             { flexDirection: 'row', alignItems: 'center', paddingVertical: 7, borderBottomWidth: 0.5, borderColor: colors.borderLight },
  rowLabel:        { fontFamily: 'Nunito-SemiBold', fontSize: 12, color: colors.mid, width: 90 },
  rowValue:        { fontFamily: 'Nunito-SemiBold', fontSize: 12, color: colors.dark, flex: 1 },
  planBadge:       { borderTopLeftRadius: 12, borderTopRightRadius: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 12, padding: spacing.md, marginBottom: spacing.md },
  planBadgeLabel:  { fontFamily: 'Nunito-Bold', fontSize: 16 },
  planBadgeDesc:   { fontFamily: 'Nunito-Regular', fontSize: 12, marginTop: 2, opacity: 0.8 },
  noMember:        { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
  noMemberTxt:     { fontFamily: 'Nunito-Regular', fontSize: 13, color: colors.light, flex: 1 },
  chip:            { backgroundColor: colors.sageLight, borderTopLeftRadius: 6, borderTopRightRadius: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  chipTxt:         { fontFamily: 'Nunito-SemiBold', fontSize: 10, color: colors.sage },
  actionsTitle:    { fontFamily: 'Nunito-Bold', fontSize: 9, color: colors.light, letterSpacing: 0.8, marginBottom: spacing.sm, marginTop: spacing.sm },
  actionBtn:       { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.white, borderTopLeftRadius: 14, borderTopRightRadius: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 14, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 0.5, borderColor: colors.borderLight, elevation: 1 },
  actionIcon:      { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.sageLight, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  actionLabel:     { fontFamily: 'Nunito-Bold', fontSize: 14, color: colors.dark },
  actionDesc:      { fontFamily: 'Nunito-Regular', fontSize: 11, color: colors.light, marginTop: 2 },
  overlay:         { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalBox:        { backgroundColor: colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.xl, paddingBottom: 40 },
  modalTitle:      { fontFamily: 'Nunito-Bold', fontSize: 20, color: colors.dark, marginBottom: spacing.xs },
  modalSub:        { fontFamily: 'Nunito-Regular', fontSize: 13, color: colors.mid, marginBottom: spacing.md },
  planOption:      { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: 12, borderWidth: 1.5, marginBottom: spacing.sm },
  planRadio:       { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  planRadioDot:    { width: 10, height: 10, borderRadius: 5 },
  planOptionLabel: { fontFamily: 'Nunito-Bold', fontSize: 14 },
  planOptionDesc:  { fontFamily: 'Nunito-Regular', fontSize: 12, color: colors.mid, marginTop: 2 },
  currentTag:      { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  currentTagTxt:   { fontFamily: 'Nunito-Bold', fontSize: 9 },
  inputLabel:      { fontFamily: 'Nunito-Bold', fontSize: 9, color: colors.light, letterSpacing: 0.7, marginBottom: 6 },
  noteInput:       { backgroundColor: colors.sageLighter, borderTopLeftRadius: 10, borderTopRightRadius: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 10, padding: spacing.md, fontFamily: 'Nunito-Regular', fontSize: 13, color: colors.dark, minHeight: 64, textAlignVertical: 'top', marginBottom: spacing.md },
  confirmBtn:      { backgroundColor: colors.sage, borderTopLeftRadius: 14, borderTopRightRadius: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 14, padding: 14, alignItems: 'center', marginBottom: spacing.sm },
  confirmTxt:      { fontFamily: 'Nunito-Bold', fontSize: 14, color: '#fff' },
  cancelBtn:       { alignItems: 'center', padding: spacing.sm },
  cancelTxt:       { fontFamily: 'Nunito-SemiBold', fontSize: 14, color: colors.mid },
})
