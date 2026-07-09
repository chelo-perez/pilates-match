import React from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useMyStudio } from '../../hooks'
import { LoadingScreen, colors, spacing } from '../../components/ui'
import { Feather } from '@expo/vector-icons'
import BlobCard from '../../components/BlobCard'
import HeroHeader from '../../components/HeroHeader'

const PLANS = [
  {
    key: 'freemium',
    label: 'Freemium',
    price: 'Gratis',
    period: '',
    color: colors.mid,
    bg: colors.sageLighter,
    features: [
      { text: '1 propuesta por mes', ok: true },
      { text: 'Ver directorio de instructores', ok: true },
      { text: 'Sin badge de Cámara', ok: false },
      { text: 'Sin propuestas destacadas', ok: false },
    ],
    mpUrl: null,
  },
  {
    key: 'starter',
    label: 'Starter',
    price: '$X.000',
    period: '/mes',
    color: colors.sage,
    bg: colors.sageLight,
    features: [
      { text: '5 propuestas por mes', ok: true },
      { text: 'Acceso a todo el directorio', ok: true },
      { text: 'Historial de propuestas', ok: true },
      { text: 'Sin badge de Cámara', ok: false },
    ],
    mpUrl: 'https://www.mercadopago.com.ar/subscriptions/starter', // reemplazar
  },
  {
    key: 'socio',
    label: 'Socio Cámara',
    price: '$X.000',
    period: '/mes',
    color: '#0C447C',
    bg: '#E6F1FB',
    badge: '★ Recomendado',
    features: [
      { text: '5 propuestas por mes', ok: true },
      { text: 'Badge "Socio Cámara" visible para instructores', ok: true },
      { text: 'Descuento en capacitaciones', ok: true },
      { text: 'Acceso a eventos exclusivos', ok: true },
    ],
    mpUrl: 'https://www.mercadopago.com.ar/subscriptions/socio', // reemplazar
  },
  {
    key: 'premium',
    label: 'Premium',
    price: '$X.000',
    period: '/mes',
    color: colors.gold,
    bg: colors.goldLight,
    features: [
      { text: 'Propuestas ilimitadas', ok: true },
      { text: 'Tu estudio aparece destacado para instructores', ok: true },
      { text: 'Búsqueda avanzada por filtros', ok: true },
      { text: 'Soporte prioritario', ok: true },
    ],
    mpUrl: 'https://www.mercadopago.com.ar/subscriptions/premium', // reemplazar
  },
]

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })
}

export default function MembershipScreen({ navigation }: any) {
  const { data: studio, isLoading } = useMyStudio()

  const { data: membership } = useQuery({
    queryKey: ['studio-membership', studio?.id],
    queryFn: async () => {
      const { data } = await supabase.from('memberships').select('*').eq('studio_id', studio!.id).single()
      return data
    },
    enabled: !!studio?.id,
  })

  if (isLoading) return <LoadingScreen />

  const currentPlan = PLANS.find(p => p.key === membership?.plan_type) ?? PLANS[0]
  const matchUsed  = membership?.matches_used_month ?? 0
  const matchLimit = membership?.matches_limit

  return (
    <View style={{ flex: 1, backgroundColor: colors.cream }}>
      <HeroHeader
        title="Membresía"
        subtitle="Elegí el plan que mejor se adapta a tu estudio"
        onBack={() => navigation.goBack()}
        backLabel="Inicio"
      />

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

        {/* Plan actual */}
        <BlobCard style={s.currentCard} delay={0}
          blobColor={`rgba(${currentPlan.key === 'premium' ? '184,150,12' : currentPlan.key === 'socio' ? '12,68,124' : '74,93,78'},0.12)`}
          blobColor2={`rgba(${currentPlan.key === 'premium' ? '184,150,12' : currentPlan.key === 'socio' ? '12,68,124' : '74,93,78'},0.07)`}
        >
          <Text style={s.currentLabel}>TU PLAN ACTUAL</Text>
          <View style={s.currentRow}>
            <Text style={[s.currentPlan, { color: currentPlan.color }]}>{currentPlan.label}</Text>
            <View style={[s.statusTag, { backgroundColor: membership?.status === 'activa' ? colors.okBg : colors.warnBg }]}>
              <Text style={[s.statusTxt, { color: membership?.status === 'activa' ? colors.okTx : colors.warnTx }]}>
                {membership?.status === 'activa' ? 'Activo' : 'Sin plan activo'}
              </Text>
            </View>
          </View>
          {membership && (
            <>
              <View style={s.usageBar}>
                <View style={[s.usageFill, {
                  width: matchLimit ? `${Math.min(100, (matchUsed / matchLimit) * 100)}%` : '20%',
                  backgroundColor: currentPlan.color,
                }]} />
              </View>
              <Text style={s.usageTxt}>
                {matchLimit !== null
                  ? `${matchUsed} de ${matchLimit} propuestas usadas este mes`
                  : `${matchUsed} propuestas enviadas este mes (ilimitadas)`
                }
              </Text>
              {membership.end_date && (
                <Text style={s.expiryTxt}>Vence el {fmtDate(membership.end_date)}</Text>
              )}
            </>
          )}
        </BlobCard>

        {/* Planes disponibles */}
        <Text style={s.plansTitle}>PLANES DISPONIBLES</Text>

        {PLANS.map((plan, idx) => {
          const isCurrent = plan.key === currentPlan.key
          return (
            <View key={plan.key}>
            <BlobCard style={[s.planCard, isCurrent && { borderWidth: 2, borderColor: plan.color }]}
              delay={idx * 500}
              blobColor={`rgba(${plan.key === 'premium' ? '184,150,12' : '74,93,78'},0.08)`}
            >
              {plan.badge && (
                <View style={[s.recommendedBadge, { backgroundColor: plan.bg }]}>
                  <Text style={[s.recommendedTxt, { color: plan.color }]}>{plan.badge}</Text>
                </View>
              )}
              {isCurrent && (
                <View style={[s.currentBadge, { backgroundColor: plan.bg }]}>
                  <Text style={[s.currentBadgeTxt, { color: plan.color }]}>Plan actual</Text>
                </View>
              )}

              <View style={s.planHeader}>
                <Text style={[s.planName, { color: plan.color }]}>{plan.label}</Text>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[s.planPrice, { color: plan.color }]}>{plan.price}</Text>
                  {plan.period && <Text style={s.planPeriod}>{plan.period}</Text>}
                </View>
              </View>

              {plan.features.map((f, fi) => (
                <View key={fi} style={s.featureRow}>
                  <Feather
                    name={f.ok ? 'check' : 'x'}
                    size={14}
                    color={f.ok ? plan.color : colors.light}
                  />
                  <Text style={[s.featureTxt, !f.ok && { color: colors.light }]}>{f.text}</Text>
                </View>
              ))}

              {!isCurrent && plan.mpUrl && (
                <TouchableOpacity
                  style={[s.subscribeBtn, { backgroundColor: plan.bg, borderColor: plan.color }]}
                  onPress={() => Linking.openURL(plan.mpUrl!)}
                  activeOpacity={0.85}
                >
                  <Text style={[s.subscribeTxt, { color: plan.color }]}>Suscribirme con Mercado Pago →</Text>
                </TouchableOpacity>
              )}

              {isCurrent && plan.key !== 'freemium' && (
                <View style={[s.subscribeBtn, { backgroundColor: plan.bg, borderColor: plan.color }]}>
                  <Text style={[s.subscribeTxt, { color: plan.color }]}>✓ Plan contratado</Text>
                </View>
              )}
            </BlobCard>
            </View>
          )
        })}

        <Text style={s.footer}>
          Los planes se renuevan automáticamente cada mes. Para cancelar, contactá a la Cámara.
        </Text>

      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  content:          { padding: spacing.md, paddingBottom: 48 },
  currentCard:      { padding: spacing.md, marginBottom: spacing.md },
  currentLabel:     { fontFamily: 'Nunito-Bold', fontSize: 9, color: colors.light, letterSpacing: 0.8, marginBottom: spacing.sm },
  currentRow:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  currentPlan:      { fontFamily: 'Nunito-Bold', fontSize: 22 },
  statusTag:        { borderTopLeftRadius: 8, borderTopRightRadius: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  statusTxt:        { fontFamily: 'Nunito-Bold', fontSize: 11 },
  usageBar:         { height: 6, backgroundColor: colors.sageLighter, borderRadius: 3, overflow: 'hidden', marginBottom: 6 },
  usageFill:        { height: '100%' as any, borderRadius: 3 },
  usageTxt:         { fontFamily: 'Nunito-SemiBold', fontSize: 12, color: colors.mid },
  expiryTxt:        { fontFamily: 'Nunito-Regular', fontSize: 11, color: colors.light, marginTop: 4 },
  plansTitle:       { fontFamily: 'Nunito-Bold', fontSize: 9, color: colors.light, letterSpacing: 0.8, marginBottom: spacing.sm },
  planCard:         { padding: spacing.md, marginBottom: spacing.md },
  recommendedBadge: { alignSelf: 'flex-start', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, marginBottom: spacing.sm },
  recommendedTxt:   { fontFamily: 'Nunito-Bold', fontSize: 10 },
  currentBadge:     { alignSelf: 'flex-start', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, marginBottom: spacing.sm },
  currentBadgeTxt:  { fontFamily: 'Nunito-Bold', fontSize: 10 },
  planHeader:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.md },
  planName:         { fontFamily: 'Nunito-Bold', fontSize: 18 },
  planPrice:        { fontFamily: 'Nunito-Bold', fontSize: 20 },
  planPeriod:       { fontFamily: 'Nunito-Regular', fontSize: 11, color: colors.light },
  featureRow:       { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  featureTxt:       { fontFamily: 'Nunito-Regular', fontSize: 13, color: colors.dark, flex: 1 },
  subscribeBtn:     { marginTop: spacing.md, borderTopLeftRadius: 12, borderTopRightRadius: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 12, padding: 13, alignItems: 'center', borderWidth: 1.5 },
  subscribeTxt:     { fontFamily: 'Nunito-Bold', fontSize: 13 },
  footer:           { fontFamily: 'Nunito-Regular', fontSize: 11, color: colors.light, textAlign: 'center', lineHeight: 17, marginTop: spacing.sm },
})
