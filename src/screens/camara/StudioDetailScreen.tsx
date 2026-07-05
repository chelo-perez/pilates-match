// src/screens/camara/StudioDetailScreen.tsx
// Ficha de detalle de un estudio — vista de la Cámara
import React from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { db } from '../../lib/supabase'
import { LoadingScreen, colors, spacing } from '../../components/ui'
import { Feather } from '@expo/vector-icons'
import BlobCard from '../../components/BlobCard'
import HeroHeader from '../../components/HeroHeader'
import Toast from '../../components/Toast'
import { useToast } from '../../hooks/useToast'

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })
}

export default function StudioDetailScreen({ navigation, route }: any) {
  const { studioId } = route.params
  const qc = useQueryClient()
  const { toast, showToast, hideToast } = useToast()

  const { data: studio, isLoading } = useQuery({
    queryKey: ['studio-detail', studioId],
    queryFn: async () => {
      const { data, error } = await db.studios()
        .select('*, membership:memberships(*), user:users(email)')
        .eq('id', studioId)
        .single()
      if (error) throw error
      return data
    },
  })

  const toggleMutation = useMutation({
    mutationFn: async (activate: boolean) => {
      await db.studios().update({
        is_member: activate,
        member_since: activate ? new Date().toISOString().split('T')[0] : null,
      }).eq('id', studioId)

      if (activate) {
        const end = new Date()
        end.setFullYear(end.getFullYear() + 1)
        await db.memberships().upsert({
          studio_id: studioId,
          status: 'activa',
          start_date: new Date().toISOString().split('T')[0],
          end_date: end.toISOString().split('T')[0],
          matches_limit: null,
        }, { onConflict: 'studio_id' })
      }
    },
    onSuccess: (_, activate) => {
      qc.invalidateQueries({ queryKey: ['studio-detail', studioId] })
      qc.invalidateQueries({ queryKey: ['camara-studios-full'] })
      showToast(activate ? 'Membresía activada' : 'Membresía removida')
    },
    onError: (e: any) => showToast('Error: ' + e.message),
  })

  if (isLoading || !studio) return <LoadingScreen />

  const membership = Array.isArray(studio.membership) ? studio.membership[0] : studio.membership
  const isMember   = studio.is_member
  const matchUsed  = membership?.matches_used_month ?? 0
  const matchLimit = membership?.matches_limit ?? null

  return (
    <View style={{ flex: 1, backgroundColor: colors.cream }}>
      <HeroHeader
        title={studio.name}
        subtitle={studio.neighborhood ?? 'Buenos Aires'}
        onBack={() => navigation.goBack()}
        backLabel="Estudios"
        rightElement={
          <View style={[s.badge, { backgroundColor: isMember ? colors.okBg : colors.sageLighter }]}>
            <Text style={[s.badgeTxt, { color: isMember ? colors.okTx : colors.mid }]}>
              {isMember ? '★ Socio' : 'No socio'}
            </Text>
          </View>
        }
      />

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

        {/* Info básica */}
        <BlobCard style={s.card} delay={0}>
          <Text style={s.sectionTitle}>Información del estudio</Text>
          {[
            { label: 'Email',       val: studio.user?.email ?? '—',   icon: 'mail' },
            { label: 'Teléfono',    val: studio.phone ?? '—',          icon: 'phone' },
            { label: 'Barrio',      val: studio.neighborhood ?? '—',   icon: 'map-pin' },
            { label: 'Registrado',  val: fmtDate(studio.created_at),   icon: 'calendar' },
          ].map(row => (
            <View key={row.label} style={s.infoRow}>
              <Feather name={row.icon as any} size={13} color={colors.sageMid} />
              <Text style={s.infoLabel}>{row.label}</Text>
              <Text style={s.infoVal}>{row.val}</Text>
            </View>
          ))}
        </BlobCard>

        {/* Membresía */}
        <BlobCard
          style={s.card}
          delay={1200}
          blobColor={isMember ? 'rgba(184,150,12,0.16)' : 'rgba(74,93,78,0.10)'}
          blobColor2={isMember ? 'rgba(184,150,12,0.09)' : 'rgba(74,93,78,0.06)'}
        >
          <Text style={s.sectionTitle}>Membresía</Text>
          {isMember && membership ? (
            <>
              {[
                { label: 'Estado',         val: 'Activa' },
                { label: 'Inicio',         val: fmtDate(membership.start_date) },
                { label: 'Vencimiento',    val: fmtDate(membership.end_date) },
                { label: 'Matches/mes',    val: matchLimit !== null ? `${matchUsed} / ${matchLimit}` : `${matchUsed} (sin límite)` },
              ].map(row => (
                <View key={row.label} style={s.infoRow}>
                  <Feather name="check-circle" size={13} color={colors.gold} />
                  <Text style={s.infoLabel}>{row.label}</Text>
                  <Text style={s.infoVal}>{row.val}</Text>
                </View>
              ))}
            </>
          ) : (
            <View style={s.noMember}>
              <Feather name="info" size={16} color={colors.light} />
              <Text style={s.noMemberTxt}>Este estudio no tiene membresía activa</Text>
            </View>
          )}
        </BlobCard>

        {/* Actividad */}
        <BlobCard style={s.card} delay={2400}>
          <Text style={s.sectionTitle}>Actividad</Text>
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
        </BlobCard>

        {/* Acción membresía */}
        <TouchableOpacity
          style={[s.actionBtn, isMember ? s.actionRemove : s.actionAdd]}
          onPress={() => toggleMutation.mutate(!isMember)}
          disabled={toggleMutation.isPending}
          activeOpacity={0.85}
        >
          <Feather
            name={isMember ? 'user-minus' : 'user-plus'}
            size={16}
            color={isMember ? '#A32D2D' : colors.sage}
          />
          <Text style={[s.actionTxt, { color: isMember ? '#A32D2D' : colors.sage }]}>
            {toggleMutation.isPending
              ? 'Procesando...'
              : isMember ? 'Quitar membresía' : 'Activar membresía (12 meses)'}
          </Text>
        </TouchableOpacity>

      </ScrollView>

      <Toast visible={toast.visible} message={toast.message} type={toast.type} onHide={hideToast} />
    </View>
  )
}

const s = StyleSheet.create({
  content:    { padding: spacing.md, paddingBottom: 48 },
  badge:      { borderTopLeftRadius: 10, borderTopRightRadius: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  badgeTxt:   { fontFamily: 'Nunito-Bold', fontSize: 10 },

  card:       { padding: spacing.md, marginBottom: spacing.md },
  sectionTitle:{ fontFamily: 'Nunito-Bold', fontSize: 9, color: colors.light, textTransform: 'uppercase' as const, letterSpacing: 0.8, marginBottom: spacing.md },

  infoRow:    { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 6, borderBottomWidth: 0.5, borderColor: colors.borderLight },
  infoLabel:  { fontFamily: 'Nunito-SemiBold', fontSize: 12, color: colors.mid, width: 90 },
  infoVal:    { fontFamily: 'Nunito-SemiBold', fontSize: 12, color: colors.dark, flex: 1 },

  noMember:   { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
  noMemberTxt:{ fontFamily: 'Nunito-Regular', fontSize: 13, color: colors.light },

  statsRow:   { flexDirection: 'row' },
  statItem:   { flex: 1, alignItems: 'center', paddingVertical: spacing.sm },
  statNum:    { fontFamily: 'Nunito-Bold', fontSize: 24, color: colors.dark },
  statLbl:    { fontFamily: 'Nunito-Bold', fontSize: 9, color: colors.light, textTransform: 'uppercase' as const, letterSpacing: 0.5, marginTop: 3, textAlign: 'center' },

  actionBtn:  { borderTopLeftRadius: 14, borderTopRightRadius: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 14, padding: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1 },
  actionAdd:  { backgroundColor: colors.sageLight, borderColor: colors.sage },
  actionRemove:{ backgroundColor: '#FCEBEB', borderColor: '#F09595' },
  actionTxt:  { fontFamily: 'Nunito-Bold', fontSize: 14 },
})
