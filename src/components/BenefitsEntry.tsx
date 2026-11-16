// Acceso a "Beneficios de tu red" desde el inicio. Solo aparece si la red tiene beneficios o formaciones publicados.
import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { Feather } from '@expo/vector-icons'
import { colors, radius, spacing } from './ui'
import { useMySponsorOffers } from '../lib/sponsors'

export default function BenefitsEntry({ onPress }: { onPress: () => void }) {
  const { data: offers = [] } = useMySponsorOffers()
  if (!offers.length) return null
  const courses = offers.filter(o => o.kind === 'formacion').length
  const perks = offers.length - courses
  const sub = [perks ? `${perks} beneficio${perks > 1 ? 's' : ''}` : null, courses ? `${courses} formaci${courses > 1 ? 'ones' : 'ón'}` : null].filter(Boolean).join(' y ')
  return (
    <TouchableOpacity style={s.card} onPress={onPress} activeOpacity={0.85} accessibilityRole="button">
      <View style={s.icon}><Feather name="gift" size={16} color={colors.sage} /></View>
      <View style={{ flex: 1 }}>
        <Text style={s.title}>Beneficios de tu red</Text>
        <Text style={s.sub}>{sub} para vos</Text>
      </View>
      <Feather name="chevron-right" size={18} color={colors.sage} />
    </TouchableOpacity>
  )
}

const s = StyleSheet.create({
  card:  { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginHorizontal: spacing.md, marginBottom: spacing.md, backgroundColor: colors.white, ...radius.leaf, padding: spacing.md, borderWidth: 1, borderColor: colors.borderLight },
  icon:  { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.sageLighter, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: 'Nunito-Bold', fontSize: 14, color: colors.dark },
  sub:   { fontFamily: 'Nunito-Regular', fontSize: 12, color: colors.mid, marginTop: 1 },
})
