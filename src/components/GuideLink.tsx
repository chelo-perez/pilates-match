// "Ver la guía de uso" en el perfil: vuelve a abrir el instructivo y lleva a la guía escrita.
import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Linking } from 'react-native'
import { Feather } from '@expo/vector-icons'
import { colors, spacing } from './ui'
import { showGuide } from './AppGuide'

const GUIDE_URL = { estudio: 'https://masfacil.com.ar/trabajo/guia-estudios', instructor: 'https://masfacil.com.ar/trabajo/guia-instructores', camara_admin: 'https://masfacil.com.ar/trabajo/guia-entidades' } as const

export default function GuideLink({ role, inset }: { role: keyof typeof GUIDE_URL; inset?: boolean }) {
  return (
    <View style={[s.wrap, inset && { marginHorizontal: spacing.md }]}>
      <TouchableOpacity style={s.row} onPress={showGuide} accessibilityRole="button">
        <Feather name="compass" size={16} color={colors.sage} />
        <Text style={s.txt}>Ver la guía de uso</Text>
        <Feather name="chevron-right" size={16} color={colors.light} />
      </TouchableOpacity>
      <TouchableOpacity style={[s.row, s.border]} onPress={() => Linking.openURL(GUIDE_URL[role])} accessibilityRole="link">
        <Feather name="book-open" size={16} color={colors.sage} />
        <Text style={s.txt}>Guía completa paso a paso</Text>
        <Feather name="external-link" size={14} color={colors.light} />
      </TouchableOpacity>
    </View>
  )
}

const s = StyleSheet.create({
  wrap:   { backgroundColor: colors.white, borderRadius: 14, borderWidth: 0.5, borderColor: colors.borderLight, marginTop: spacing.lg, marginBottom: spacing.sm },
  row:    { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14, paddingHorizontal: 16 },
  border: { borderTopWidth: 0.5, borderTopColor: colors.borderLight },
  txt:    { flex: 1, fontFamily: 'Nunito-SemiBold', fontSize: 14, color: colors.dark },
})
