import React from 'react'
import { View, Text, StyleSheet, ScrollView } from 'react-native'
import { useMyStudio } from '../../hooks'
import { Button, ErrorState, LoadingScreen, colors, spacing, typography } from '../../components/ui'
import { PLANS, usedThisMonth } from '../../constants/plans'
import { formatDate } from '../../lib/dates'
import { Feather } from '@expo/vector-icons'
import BlobCard from '../../components/BlobCard'
import HeroHeader from '../../components/HeroHeader'
import { contactCamaraForPlan, limitText, nextResetLabel, useCamaraContact, useStudioMembership } from './studioQueries'

// Solo beneficios que la app ofrece hoy
const EXTRA_FEATURES: Record<string, string[]> = {
  freemium: ['Directorio de instructores verificados', 'Historial de tus propuestas'],
  starter:  ['Directorio de instructores verificados', 'Historial de tus propuestas'],
  socio:    ['Sos socio de la Cámara: lo vas a ver en tu perfil', 'Directorio e historial completos'],
  premium:  ['Directorio e historial completos'],
}

const STATUS_LABEL: Record<string, { label: string; ok: boolean }> = {
  activa:    { label: 'Activa', ok: true },
  vencida:   { label: 'Vencida', ok: false },
  cancelada: { label: 'Cancelada', ok: false },
}

export default function MembershipScreen({ navigation }: any) {
  const { data: studio, isLoading } = useMyStudio()
  const { data: membership, isLoading: memLoading, isError, refetch } = useStudioMembership(studio?.id)
  const { data: contact } = useCamaraContact((studio as any)?.camara_id)

  if (isLoading || memLoading) return <LoadingScreen />

  const planKey    = membership?.plan_type ?? 'freemium'
  const currentPlan = PLANS.find(p => p.key === planKey) ?? PLANS[0]
  const matchLimit: number | null = membership ? (membership.matches_limit ?? null) : currentPlan.limit
  const matchUsed  = membership ? usedThisMonth(membership) : 0
  const status     = STATUS_LABEL[membership?.status ?? ''] ?? { label: 'Sin plan', ok: false }
  const price      = membership?.price_ars ?? null

  return (
    <View style={{ flex: 1, backgroundColor: colors.cream }}>
      <HeroHeader
        title="Mi plan"
        subtitle="Cuántas propuestas podés enviar por mes"
        onBack={() => navigation.goBack()}
        backLabel="Inicio"
      />

      {isError ? (
        <ErrorState message="No pudimos cargar tu plan." onRetry={refetch} />
      ) : (
        <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

          <BlobCard style={s.card} delay={0}>
            <Text style={s.caption}>TU PLAN ACTUAL</Text>
            <View style={s.currentRow}>
              <Text style={s.currentPlan}>{currentPlan.label}</Text>
              <View style={[s.statusTag, { backgroundColor: status.ok ? colors.okBg : colors.warnBg }]}>
                <Text style={[s.statusTxt, { color: status.ok ? colors.okTx : colors.warnTx }]}>{status.label}</Text>
              </View>
            </View>

            <View style={s.usageBar}>
              <View style={[s.usageFill, {
                width: matchLimit ? `${Math.min(100, (matchUsed / matchLimit) * 100)}%` : '0%',
              }]} />
            </View>
            <Text style={s.usageTxt}>
              {matchLimit != null
                ? `${matchUsed} de ${matchLimit} propuesta${matchLimit === 1 ? '' : 's'} usada${matchLimit === 1 ? '' : 's'} este mes`
                : `${matchUsed} propuesta${matchUsed === 1 ? '' : 's'} enviada${matchUsed === 1 ? '' : 's'} este mes (sin límite)`}
            </Text>
            {matchLimit != null && <Text style={s.metaTxt}>El contador vuelve a cero el {nextResetLabel()}.</Text>}
            {membership?.end_date && <Text style={s.metaTxt}>Vigente hasta el {formatDate(membership.end_date)}</Text>}
            {price ? <Text style={s.metaTxt}>Abono: ${Number(price).toLocaleString('es-AR')} por mes</Text> : null}
            {!status.ok && membership && (
              <Text style={[s.metaTxt, { color: colors.warnTx }]}>
                Con el plan {status.label.toLowerCase()} no podés enviar propuestas. Pedile a la Cámara que lo reactive.
              </Text>
            )}
          </BlobCard>

          <Text style={[s.caption, { marginBottom: spacing.sm }]}>PLANES</Text>

          {PLANS.map((plan, idx) => {
            const isCurrent = plan.key === currentPlan.key
            return (
              <BlobCard key={plan.key} style={[s.planCard, isCurrent && s.planCardCurrent]} delay={idx * 500}>
                <View style={s.planHeader}>
                  <Text style={s.planName}>{plan.label}</Text>
                  {isCurrent && (
                    <View style={s.currentBadge}><Text style={s.currentBadgeTxt}>Tu plan</Text></View>
                  )}
                </View>
                {[limitText(plan.limit), ...(EXTRA_FEATURES[plan.key] ?? [])].map((f, fi) => (
                  <View key={fi} style={s.featureRow}>
                    <Feather name="check" size={14} color={colors.sage} />
                    <Text style={s.featureTxt}>{f}</Text>
                  </View>
                ))}
              </BlobCard>
            )
          })}

          <View style={s.infoBox}>
            <Feather name="info" size={14} color={colors.sage} />
            <Text style={s.infoTxt}>
              Los planes los gestiona la Cámara: el pago y el cambio de plan se coordinan directamente con ella. Cuando lo actualice, lo vas a ver acá.
            </Text>
          </View>

          <Button
            label="Pedile a la Cámara que actualice tu plan"
            onPress={() => contactCamaraForPlan(contact, studio?.name)}
            fullWidth
            size="lg"
          />
        </ScrollView>
      )}
    </View>
  )
}

const s = StyleSheet.create({
  content:          { padding: spacing.md, paddingBottom: 48 },
  card:             { padding: spacing.md, marginBottom: spacing.md },
  caption:          { ...typography.caption, marginBottom: spacing.sm },
  currentRow:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  currentPlan:      { fontFamily: 'Nunito-Bold', fontSize: 22, color: colors.sage },
  statusTag:        { borderTopLeftRadius: 8, borderTopRightRadius: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  statusTxt:        { fontFamily: 'Nunito-Bold', fontSize: 11 },
  usageBar:         { height: 6, backgroundColor: colors.sageLighter, borderRadius: 3, overflow: 'hidden', marginBottom: 6 },
  usageFill:        { height: '100%' as any, borderRadius: 3, backgroundColor: colors.sage },
  usageTxt:         { fontFamily: 'Nunito-SemiBold', fontSize: 12, color: colors.mid },
  metaTxt:          { fontFamily: 'Nunito-Regular', fontSize: 11, color: colors.light, marginTop: 4 },
  planCard:         { padding: spacing.md, marginBottom: spacing.sm },
  planCardCurrent:  { borderWidth: 1.5, borderColor: colors.sage },
  planHeader:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  planName:         { fontFamily: 'Nunito-Bold', fontSize: 16, color: colors.dark },
  currentBadge:     { backgroundColor: colors.sageLight, borderTopLeftRadius: 8, borderTopRightRadius: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  currentBadgeTxt:  { fontFamily: 'Nunito-Bold', fontSize: 10, color: colors.sage },
  featureRow:       { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 3 },
  featureTxt:       { fontFamily: 'Nunito-Regular', fontSize: 13, color: colors.dark, flex: 1 },
  infoBox:          { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: colors.sageLighter, borderTopLeftRadius: 10, borderTopRightRadius: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 10, padding: spacing.md, marginTop: spacing.sm, marginBottom: spacing.md, borderWidth: 0.5, borderColor: colors.border },
  infoTxt:          { fontFamily: 'Nunito-Regular', fontSize: 12, color: colors.mid, flex: 1, lineHeight: 18 },
})
