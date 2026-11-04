import React, { useState } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, Alert, ActivityIndicator } from 'react-native'
import { useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '../../store'
import { cancelSubscription, formatARS, PaidPlan, startSubscription, usePlanPrices, useStudioSubscription } from '../../lib/payments'
import { errorText } from '../../lib/errors'
import { Input } from '../../components/ui'
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
  const { data: prices = [] } = usePlanPrices()
  const { data: sub } = useStudioSubscription(studio?.id)
  const session = useAuthStore(st => st.session)
  const qc = useQueryClient()
  const [buying, setBuying] = useState<PaidPlan | null>(null)
  const [payerEmail, setPayerEmail] = useState('')
  const [busy, setBusy] = useState(false)

  const priceOf = (k: string) => prices.find(p => p.plan_type === k && p.active)?.price_ars ?? null
  const onlinePayments = prices.some(p => p.active)

  const refresh = () => {
    // El webhook de Mercado Pago puede tardar unos segundos en activar el plan
    const run = () => ['studio-membership', 'studio-subscription', 'studio-memberships'].forEach(k => qc.invalidateQueries({ queryKey: [k] }))
    run(); setTimeout(run, 4000); setTimeout(run, 12000)
  }

  const openBuy = (plan: PaidPlan) => { setPayerEmail(session?.user?.email ?? ''); setBuying(plan) }

  const pay = async () => {
    if (!buying) return
    try {
      setBusy(true)
      await startSubscription(buying, payerEmail)
      setBuying(null)
      refresh()
      Alert.alert('¿Completaste el pago?', 'Si ya pagaste, tu plan se activa en unos segundos. Si no, podés volver a intentarlo cuando quieras.')
    } catch (e) {
      Alert.alert('No pudimos iniciar el pago', errorText(e))
    } finally { setBusy(false) }
  }

  const askCancel = () => Alert.alert(
    'Cancelar suscripción',
    'No se te va a volver a cobrar. Tu plan sigue activo hasta el final del período que ya pagaste y después pasa a Freemium.',
    [{ text: 'Volver', style: 'cancel' }, { text: 'Cancelar suscripción', style: 'destructive', onPress: async () => {
      try { setBusy(true); await cancelSubscription(); refresh() }
      catch (e) { Alert.alert('No pudimos cancelar', errorText(e)) }
      finally { setBusy(false) }
    } }],
  )

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
                {priceOf(plan.key) ? <Text style={s.planPrice}>{formatARS(priceOf(plan.key)!)}<Text style={s.planPer}> por mes</Text></Text> : null}
                {[limitText(plan.limit), ...(EXTRA_FEATURES[plan.key] ?? [])].map((f, fi) => (
                  <View key={fi} style={s.featureRow}>
                    <Feather name="check" size={14} color={colors.sage} />
                    <Text style={s.featureTxt}>{f}</Text>
                  </View>
                ))}
                {sub && sub.plan_type === plan.key ? (
                  <View style={s.subBox}>
                    <Text style={s.subTxt}>
                      {sub.status === 'paused' ? 'Débito automático en pausa' : 'Débito automático activo'}
                      {sub.next_payment_date ? ` · próximo cobro ${formatDate(sub.next_payment_date.slice(0, 10))}` : ''}
                    </Text>
                    <TouchableOpacity onPress={askCancel} disabled={busy}><Text style={s.cancelTxt}>Cancelar suscripción</Text></TouchableOpacity>
                  </View>
                ) : priceOf(plan.key) && !(isCurrent && status.ok && !sub) ? (
                  <Button label={sub ? `Cambiar a ${plan.label}` : 'Suscribirme con Mercado Pago'} onPress={() => openBuy(plan.key as PaidPlan)} fullWidth style={{ marginTop: spacing.sm }} />
                ) : null}
              </BlobCard>
            )
          })}

          <View style={s.infoBox}>
            <Feather name="info" size={14} color={colors.sage} />
            <Text style={s.infoTxt}>
              {onlinePayments
                ? 'Pagás con Mercado Pago con débito automático todos los meses. Podés cancelar cuando quieras: el plan sigue hasta el final del período pagado. El plan Socio Cámara se gestiona con la Cámara.'
                : 'Los planes los gestiona la Cámara: el pago y el cambio de plan se coordinan directamente con ella. Cuando lo actualice, lo vas a ver acá.'}
            </Text>
          </View>

          <Button
            label={onlinePayments ? 'Consultar a la Cámara' : 'Pedile a la Cámara que actualice tu plan'}
            variant={onlinePayments ? 'outline' : undefined}
            onPress={() => contactCamaraForPlan(contact, studio?.name)}
            fullWidth
            size="lg"
          />
        </ScrollView>
      )}

      <Modal visible={!!buying} transparent animationType="fade" onRequestClose={() => setBuying(null)}>
        <View style={s.overlay}>
          <View style={s.sheet}>
            <Text style={s.sheetTitle}>Plan {PLANS.find(p => p.key === buying)?.label}</Text>
            <Text style={s.sheetSub}>
              {buying && priceOf(buying) ? `${formatARS(priceOf(buying)!)} por mes con débito automático. ` : ''}
              Ingresá el email de tu cuenta de Mercado Pago: tiene que ser el mismo con el que vas a pagar.
            </Text>
            <Input label="EMAIL DE MERCADO PAGO" value={payerEmail} onChangeText={setPayerEmail}
              keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
            {busy ? <ActivityIndicator color={colors.sage} style={{ marginVertical: spacing.md }} /> : (
              <>
                <Button label="Ir a pagar" onPress={pay} fullWidth size="lg" />
                <TouchableOpacity onPress={() => setBuying(null)} style={{ alignItems: 'center', paddingVertical: spacing.md }}>
                  <Text style={s.cancelTxt}>Ahora no</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
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
  planPrice:        { fontFamily: 'Nunito-Bold', fontSize: 20, color: colors.sage, marginBottom: 6 },
  planPer:          { fontFamily: 'Nunito-Regular', fontSize: 13, color: colors.mid },
  subBox:           { marginTop: spacing.sm, padding: spacing.sm, backgroundColor: colors.okBg, borderRadius: 10, gap: 6 },
  subTxt:           { fontFamily: 'Nunito-SemiBold', fontSize: 12, color: colors.okTx },
  cancelTxt:        { fontFamily: 'Nunito-Bold', fontSize: 13, color: colors.mid },
  overlay:          { flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', padding: spacing.lg },
  sheet:            { backgroundColor: colors.cream, borderRadius: 20, padding: spacing.lg },
  sheetTitle:       { fontFamily: 'Nunito-Bold', fontSize: 18, color: colors.dark, marginBottom: 6 },
  sheetSub:         { fontFamily: 'Nunito-Regular', fontSize: 13, color: colors.mid, lineHeight: 19, marginBottom: spacing.md },
  infoBox:          { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: colors.sageLighter, borderTopLeftRadius: 10, borderTopRightRadius: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 10, padding: spacing.md, marginTop: spacing.sm, marginBottom: spacing.md, borderWidth: 0.5, borderColor: colors.border },
  infoTxt:          { fontFamily: 'Nunito-Regular', fontSize: 12, color: colors.mid, flex: 1, lineHeight: 18 },
})
