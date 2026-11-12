// Co-marca en pantallas de entrada (inicio y login): isologo y nombre de la red,
// y debajo, chico, "con Trabajo Más Fácil". Sin co-marca, el logo de siempre.
import React from 'react'
import { View, Text, Image, StyleSheet, StyleProp, ViewStyle } from 'react-native'
import { colors } from './ui'
import BrandLogo from './BrandLogo'
import { activeBrand, titleFont } from '../lib/brand'

export default function NetworkLockup({ size = 'lg', style }: { size?: 'lg' | 'md'; style?: StyleProp<ViewStyle> }) {
  const b = activeBrand
  const big = size === 'lg'
  if (!b?.logos?.markDark) return <BrandLogo width={big ? 220 : 168} style={style} />
  return (
    <View style={[s.wrap, style]} accessible accessibilityLabel={`${b.shortName} con Trabajo Más Fácil`}>
      <Image source={{ uri: b.logos.markDark }} style={{ width: big ? 132 : 104, height: big ? 132 : 104 }} resizeMode="contain" />
      <Text style={[s.name, { fontSize: big ? 34 : 28 }]}>{b.shortName}</Text>
      <View style={s.withRow}>
        <Text style={s.with}>con</Text>
        <BrandLogo width={big ? 74 : 64} />
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  wrap:    { alignItems: 'center' },
  name:    { fontFamily: titleFont, color: colors.white, letterSpacing: 2, marginTop: 10 },
  withRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14, opacity: 0.85 },
  with:    { fontFamily: 'Nunito-SemiBold', fontSize: 12, color: 'rgba(255,255,255,0.7)' },
})
