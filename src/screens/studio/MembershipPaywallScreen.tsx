// src/screens/studio/MembershipPaywallScreen.tsx
// Se muestra cuando el estudio ya usó las propuestas que incluye su plan
import React from 'react'
import { View, Text, StyleSheet, ScrollView } from 'react-native'
import { useMyStudio } from '../../hooks'
import { Button, LoadingScreen, colors, spacing, typography } from '../../components/ui'
import { PLANS, usedThisMonth } from '../../constants/plans'
import { Feather } from '@expo/vector-icons'
import BlobCard from '../../components/BlobCard'
import HeroHeader from '../../components/HeroHeader'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { usePlanPrices } from '../../lib/payments'
import { contactCamaraForPlan, limitText, nextResetLabel, useCamaraContact, useStudioMembership, useStudioQuota } from './studioQueries'
import { entity } from '../../lib/entity'

type Props = NativeStackScreenProps<any, 'MembershipPaywall'>

export default function MembershipPaywallScreen({ navigation }: Props) {
  const { data: studio } = useMyStudio()
  const { data: prices = [] } = usePlanPrices((studio as any)?.camara_id)
  const { data: membership, isLoading } = useStudioMembership(studio?.id)
  const { data: contact } = useCamaraContact((studio as any)?.camara_id)
  const { data: quota } = useStudioQuota(studio?.id)
  const perMember = contact?.billing_model === 'per_member'
  const isMember = !!(studio as any)?.is_member
  // Con cobro por socio solo los socios pueden pagar Premium; los demás se asocian
  const online = perMember ? isMember && prices.some(p => p.active && p.plan_type === 'premium') : prices.some(p => p.active)
  const plans = perMember ? PLANS.filter(p => p.key !== 'starter') : PLANS

  if (isLoading) return <LoadingScreen />

  const plan    = PLANS.find(p => p.key === (membership?.plan_type ?? 'freemium')) ?? PLANS[0]
  const limit: number | null = membership ? (membership.matches_limit ?? null) : plan.limit
  const used    = quota?.covered ?? (membership ? usedThisMonth(membership) : 0)
  const inProgress = (quota?.pending ?? 0) + (quota?.open ?? 0)
  const inactive = membership && membership.status !== 'activa'

  const title = !membership
    ? 'Tu estudio no tiene un plan activo'
    : inactive
      ? `Tu plan está ${membership.status}`
      : limit != null && used >= limit
        ? `Ya cubriste ${limit === 1 ? 'el aviso' : `los ${limit} avisos`} de este mes`
        : limit != null && used + inProgress >= limit
          ? 'Tenés avisos en curso que ocupan tu cupo'
          : 'Ampliá tu plan'
  const subtitle = inactive || !membership
    ? `Para enviar propuestas, ${entity().la} tiene que activar tu plan.`
    : `Tu plan ${plan.label} incluye ${limitText(limit).toLowerCase()}: ${used} cubierto${used === 1 ? '' : 's'}${inProgress ? ` y ${inProgress} en curso (propuestas pendientes o clases abiertas)` : ''}. El contador vuelve a cero el ${nextResetLabel()}.`

  return (
    <View style={styles.container}>
      <HeroHeader title="Mi plan" subtitle={plan.label} onBack={() => navigation.goBack()} backLabel="Volver" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        <BlobCard style={styles.card} delay={0}>
          <View style={styles.iconWrap}>
            <Feather name="send" size={22} color={colors.sage} />
          </View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.sub}>{subtitle}</Text>
        </BlobCard>

        <Text style={styles.caption}>AVISOS CUBIERTOS POR MES SEGÚN EL PLAN</Text>
        <View style={styles.table}>
          {plans.map((p, i) => {
            const isCurrent = p.key === plan.key
            return (
              <View key={p.key} style={[styles.tableRow, i % 2 === 1 && styles.tableRowAlt, isCurrent && styles.tableRowCurrent]}>
                <Text style={[styles.tdName, isCurrent && { color: colors.sage }]}>
                  {p.label}{isCurrent ? ' (tu plan)' : ''}
                </Text>
                <Text style={styles.tdVal}>{p.limit == null ? 'Sin límite' : p.limit}</Text>
              </View>
            )
          })}
        </View>

        <View style={styles.infoBox}>
          <Feather name="info" size={14} color={colors.sage} />
          <Text style={styles.infoText}>
            {perMember && !isMember
              ? `${entity().La} paga la app por sus socios: al asociarte pasás al plan Socio, con 5 avisos cubiertos por mes, sin costo extra en la app.`
              : online
                ? 'Podés pasar a Premium ahora mismo con Mercado Pago y seguir cubriendo clases apenas se acredite el pago.'
                : `El cambio de plan y el pago se coordinan directamente con ${entity().la}. Cuando lo actualice, vas a poder seguir enviando propuestas.`}
          </Text>
        </View>

        <Button
          label={perMember && !isMember ? `Quiero asociarme ${entity().a}` : online ? 'Ver planes y pagar' : `Pedile ${entity().a} que actualice tu plan`}
          onPress={() => online ? navigation.navigate('Membership' as any) : contactCamaraForPlan(contact, studio?.name)}
          fullWidth
          size="lg"
        />
        <Button
          label="Ahora no"
          variant="secondary"
          onPress={() => navigation.goBack()}
          fullWidth
          style={{ marginTop: spacing.sm }}
        />
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: colors.cream },
  content:         { padding: spacing.md, paddingBottom: spacing.xxl },
  card:            { padding: spacing.lg, marginBottom: spacing.md, alignItems: 'center' },
  iconWrap:        { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.sageLight, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md },
  title:           { fontFamily: 'Nunito-Bold', fontSize: 20, color: colors.dark, textAlign: 'center', marginBottom: spacing.sm },
  sub:             { ...typography.body, color: colors.mid, textAlign: 'center' },
  caption:         { ...typography.caption, marginBottom: spacing.sm },
  table:           { backgroundColor: colors.white, borderTopLeftRadius: 14, borderTopRightRadius: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 14, overflow: 'hidden', marginBottom: spacing.md, borderWidth: 0.5, borderColor: colors.border },
  tableRow:        { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: spacing.md },
  tableRowAlt:     { backgroundColor: colors.sageLighter },
  tableRowCurrent: { backgroundColor: colors.sageLight },
  tdName:          { flex: 1, fontFamily: 'Nunito-SemiBold', fontSize: 13, color: colors.dark },
  tdVal:           { fontFamily: 'Nunito-Bold', fontSize: 13, color: colors.sage },
  infoBox:         { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: colors.sageLighter, borderTopLeftRadius: 10, borderTopRightRadius: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 10, padding: spacing.md, marginBottom: spacing.md, borderWidth: 0.5, borderColor: colors.border },
  infoText:        { fontFamily: 'Nunito-Regular', fontSize: 12, color: colors.mid, lineHeight: 18, flex: 1 },
})
