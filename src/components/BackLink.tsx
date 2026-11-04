// "‹ Volver" de las pantallas claras de registro (las internas usan el de HeroHeader).
import React from 'react'
import { TouchableOpacity, Text, StyleSheet, StyleProp, ViewStyle } from 'react-native'
import { Feather } from '@expo/vector-icons'
import { colors, spacing } from './ui'

export default function BackLink({ onPress, label = 'Volver', style }: { onPress: () => void; label?: string; style?: StyleProp<ViewStyle> }) {
  return (
    <TouchableOpacity style={[s.btn, style]} onPress={onPress} hitSlop={12} accessibilityRole="button" accessibilityLabel={`Volver a ${label}`}>
      <Feather name="chevron-left" size={16} color={colors.mid} />
      <Text style={s.txt}>{label}</Text>
    </TouchableOpacity>
  )
}

const s = StyleSheet.create({
  btn: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', minHeight: 32, marginBottom: spacing.md },
  txt: { fontFamily: 'Nunito-SemiBold', fontSize: 14, color: colors.mid },
})
