import React from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { LoadingScreen, colors, spacing } from '../../components/ui'
import { Feather } from '@expo/vector-icons'
import BlobCard from '../../components/BlobCard'
import HeroHeader from '../../components/HeroHeader'
import Toast from '../../components/Toast'
import { useToast } from '../../hooks/useToast'

const PLAN_LABELS: Record<string, string> = {
  basico: 'Básico', profesional: 'Profesional', ilimitado: 'Ilimitado',
}

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })
}
function fmtMoney(n: number | null) {
  if (!n) return '—'
  return '$' + n.toLocaleString('es-AR')
}

export default function StudioDetailScreen({ navigation, route }: any) {
  const { studioId } = route.params
  const qc = useQueryClient()
  const { toast, showToast, hideToast } = useToast()

  const { data: studio, isLoading } = useQuery({
    queryKey: ['studio-detail', studioId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('studios')
        .select('*, user:users(email), membership:memberships(*)')
        .eq('id', studioId)
        .single()
      if (error) throw error
      return data
    },
  })

  const toggleMutation = useMutation({
    mutationFn: async (activate: boolean) => {
      if (activate) {
        const end = new Date()
        end.setFullYear(end.getFullYear() + 1)
        await supabase.from('memberships').upsert({
          studio_id: studioId,
          status: 'activa',
          start_date: new Date().toISOString().split('T')[0],
          end_date: end.toISOString().split('T')[0],
          matches_limit: null,
          matches_used_month: 0,
        }, { onConflict: 'studio_id' })
        await supabase.from('studios').update({ is_member: true, member_since: new Date().toISOString().split('T')[0] }).eq('id', studioId)
      } else {
        await supabase.from('memberships').update({ status: 'inactiva' }).eq('studio_id', studioId)
        await supabase.from('studios').update({ is_member: false }).eq('id', studioId)
      }
    },
    onSuccess: (_, activate) => {
      qc.invalidateQueries({ queryKey: ['studio-detail', studioId] })
      qc.invalidateQueries({ queryKey: ['camara-studios-full'] })
      showToast(activate ? 'Membresía activada (12 meses)' : 'Membresía removida')
    },
    onError: (e: any) => showToast('Error: ' + e.message),
  })

  if (isLoading || !studio) return <LoadingScreen />

  // membership puede ser array o objeto dependiendo de la relación
  const membership = Array.isArray(studio.membership)
    ? studio.membership[0]
    : studio.membership

  const isMember   = studio.is_member === true
  const isActive   = membership?.status === 'activa'
  const matchUsed  = membership?.matches_used_month ?? 0
  const matchLimit = membership?.matches_limit ?? null

  const Section = ({ title, delay = 0, gold = false, children }: any) => (
    <BlobCard
      style={s.card}
      delay={delay}
      blobColor={gold ? 'rgba(184,150,12,0.10)' : undefined}
      blobColor2={gold ? 'rgba(184,150,12,0.06)' : undefined}
    >
      <Text style={s.sectionTitle}>{title}</Text>
      {children}
    </BlobCard>
  )

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
          <View style={[s.badge, { backgroundColor: isMember && isActive ? colors.okBg : colors.sageLighter }]}>
            <Text style={[s.badgeTxt, { color: isMember && isActive ? colors.okTx : colors.mid }]}>
              {isMember && isActive ? '★ Socio activo' : 'No socio'}
            </Text>
          </View>
        }
      />

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

        {/* Info del estudio */}
        <Section title="INFORMACIÓN DEL ESTUDIO" delay={0}>
          <Row icon="mail"     label="Email"       value={studio.user?.email} />
          <Row icon="phone"    label="Teléfono"    value={studio.phone} />
          <Row icon="map-pin"  label="Barrio"      value={studio.neighborhood} />
          <Row icon="home"     label="Dirección"   value={studio.address} />
          <Row icon="hash"     label="CUIT"        value={studio.cuit} />
          <Row icon="calendar" label="Registrado"  value={fmtDate(studio.created_at)} />
          {studio.instagram && <Row icon="instagram" label="Instagram" value={`@${studio.instagram}`} />}
        </Section>

        {/* Responsable */}
        <Section title="RESPONSABLE" delay={800}>
          <Row icon="user"     label="Nombre"      value={studio.owner_name} />
          <Row icon="phone"    label="Teléfono"    value={studio.owner_phone} />
          <Row icon="mail"     label="Email"       value={studio.owner_email} />
        </Section>

        {/* Membresía */}
        <Section title="MEMBRESÍA" delay={1600} gold={isMember && isActive}>
          {isMember && isActive && membership ? (
            <>
              <Row icon="star"      label="Plan"        value={PLAN_LABELS[membership.plan_type ?? ''] ?? 'Estándar'} valueColor={colors.gold} />
              <Row icon="check"     label="Estado"      value="Activa" valueColor={colors.okTx} />
              <Row icon="calendar"  label="Inicio"      value={fmtDate(membership.start_date)} />
              <Row icon="clock"     label="Vencimiento" value={fmtDate(membership.end_date)} />
              <Row icon="dollar-sign" label="Abono"     value={fmtMoney(membership.price_ars ?? membership.monthly_price_ars)} valueColor={colors.gold} />
              <Row icon="activity"  label="Matches/mes" value={matchLimit !== null ? `${matchUsed} / ${matchLimit}` : `${matchUsed} (sin límite)`} />
            </>
          ) : (
            <View style={s.noMember}>
              <Feather name="info" size={15} color={colors.light} />
              <Text style={s.noMemberTxt}>Sin membresía activa</Text>
            </View>
          )}
        </Section>

        {/* Presupuesto para match */}
        <Section title="PRESUPUESTO POR HORA (MATCH)" delay={2400} gold>
          <Row
            icon="dollar-sign"
            label="Clase regular"
            value={studio.budget_regular ? fmtMoney(studio.budget_regular) + '/h' : 'Sin configurar'}
            valueColor={studio.budget_regular ? colors.sage : colors.light}
          />
          <Row
            icon="dollar-sign"
            label="Reemplazo"
            value={studio.budget_replacement ? fmtMoney(studio.budget_replacement) + '/h' : 'Sin configurar'}
            valueColor={studio.budget_replacement ? colors.gold : colors.light}
          />
          {studio.equipment?.length > 0 && (
            <View style={[s.row, { alignItems: 'flex-start' }]}>
              <Feather name="tool" size={13} color={colors.sageMid} style={{ width: 18, marginTop: 2 }} />
              <Text style={s.rowLabel}>Equipamiento</Text>
              <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
                {studio.equipment.map((e: string) => (
                  <View key={e} style={s.equipChip}>
                    <Text style={s.equipChipTxt}>{e.charAt(0).toUpperCase() + e.slice(1)}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </Section>

        {/* Actividad */}
        <Section title="ACTIVIDAD" delay={3200}>
          <View style={s.statsRow}>
            <View style={s.statItem}>
              <Text style={s.statNum}>{studio.total_matches ?? 0}</Text>
              <Text style={s.statLbl}>Matches totales</Text>
            </View>
            <View style={s.statItem}>
              <Text style={s.statNum}>{studio.active_instructors ?? 0}</Text>
              <Text style={s.statLbl}>Instructores</Text>
            </View>
            <View style={s.statItem}>
              <Text style={[s.statNum, { color: colors.gold }]}>{matchUsed}</Text>
              <Text style={s.statLbl}>Matches este mes</Text>
            </View>
          </View>
        </Section>

        {/* Acción membresía */}
        <TouchableOpacity
          style={[s.actionBtn, isMember && isActive ? s.actionRemove : s.actionAdd]}
          onPress={() => toggleMutation.mutate(!(isMember && isActive))}
          disabled={toggleMutation.isPending}
          activeOpacity={0.85}
        >
          <Feather
            name={isMember && isActive ? 'user-minus' : 'user-plus'}
            size={16}
            color={isMember && isActive ? '#A32D2D' : colors.sage}
          />
          <Text style={[s.actionTxt, { color: isMember && isActive ? '#A32D2D' : colors.sage }]}>
            {toggleMutation.isPending
              ? 'Procesando...'
              : isMember && isActive
                ? 'Quitar membresía'
                : 'Activar membresía (12 meses)'}
          </Text>
        </TouchableOpacity>

      </ScrollView>
      <Toast visible={toast.visible} message={toast.message} type={toast.type} onHide={hideToast} />
    </View>
  )
}

const s = StyleSheet.create({
  content:      { padding: spacing.md, paddingBottom: 48 },
  badge:        { borderTopLeftRadius: 10, borderTopRightRadius: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  badgeTxt:     { fontFamily: 'Nunito-Bold', fontSize: 10 },
  card:         { padding: spacing.md, marginBottom: spacing.md },
  sectionTitle: { fontFamily: 'Nunito-Bold', fontSize: 9, color: colors.light, letterSpacing: 0.8, marginBottom: spacing.md },
  row:          { flexDirection: 'row', alignItems: 'center', paddingVertical: 7, borderBottomWidth: 0.5, borderColor: colors.borderLight },
  rowLabel:     { fontFamily: 'Nunito-SemiBold', fontSize: 12, color: colors.mid, width: 90 },
  rowValue:     { fontFamily: 'Nunito-SemiBold', fontSize: 12, color: colors.dark, flex: 1 },
  noMember:     { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
  noMemberTxt:  { fontFamily: 'Nunito-Regular', fontSize: 13, color: colors.light },
  statsRow:     { flexDirection: 'row' },
  statItem:     { flex: 1, alignItems: 'center', paddingVertical: spacing.sm },
  statNum:      { fontFamily: 'Nunito-Bold', fontSize: 26, color: colors.dark },
  statLbl:      { fontFamily: 'Nunito-Bold', fontSize: 8, color: colors.light, textTransform: 'uppercase' as const, letterSpacing: 0.5, marginTop: 3, textAlign: 'center' },
  equipChip:    { backgroundColor: colors.sageLight, borderTopLeftRadius: 8, borderTopRightRadius: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
  equipChipTxt: { fontFamily: 'Nunito-SemiBold', fontSize: 10, color: colors.sage },
  actionBtn:    { borderTopLeftRadius: 14, borderTopRightRadius: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 14, padding: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1 },
  actionAdd:    { backgroundColor: colors.sageLight, borderColor: colors.sage },
  actionRemove: { backgroundColor: '#FCEBEB', borderColor: '#F09595' },
  actionTxt:    { fontFamily: 'Nunito-Bold', fontSize: 14 },
})
