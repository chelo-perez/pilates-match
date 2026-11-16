// Piezas compartidas por la pantalla de inicio animada (SplashScreen) y el login.
// La app es Trabajo Más Fácil: nuestro logo y nuestros colores mandan. La red (CAPIAF) acompaña,
// chica, debajo de nuestro logo. Todo queda EXACTAMENTE en el mismo lugar en el inicio y en el login:
// cuando el inicio se desvanece, solo aparecen el texto y los botones.
import React from 'react'
import { View, Text, Image, StyleSheet, useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import BrandLogo from '../../components/BrandLogo'
import { activeBrand, brandMark } from '../../lib/brand'

/** Nuestro petróleo: el de la pantalla de inicio fija (app.json → expo-splash-screen) y el de la entrada */
export const ENTRY_BG = '#163235'
const WHITE = '#ffffff'
const ACCENT = '#8FD6CF' // acento de nuestra marca (no el de la red)

/** Ancho de nuestro logo en la entrada */
export const LOGO_W = 176
export const LOGO_H = Math.round(LOGO_W * 462 / 600)
/** Línea de la red debajo del logo ("con CAPIAF") */
export const BADGE_GAP = 22
const BADGE_H = 30
export const ENTRY_H = LOGO_H + (activeBrand ? BADGE_GAP + BADGE_H : 0)

/** Distancia desde arriba hasta nuestro logo (la misma en el inicio y en el login) */
export function useLogoTop() {
  const { height } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  return insets.top + Math.round(height * (height < 700 ? 0.08 : 0.15))
}

/** Nuestro logo, en los colores de nuestra marca */
export const OurLogo = () => <BrandLogo width={LOGO_W} baseColor={WHITE} accentColor={ACCENT} />

/** La red que verifica a los profesionales: "con  ◯ CAPIAF" */
export function NetworkBadge() {
  const mark = brandMark()
  if (!activeBrand) return null
  return (
    <View style={s.badge} accessible accessibilityLabel={`con ${activeBrand.shortName}`}>
      <Text style={s.with}>con</Text>
      {mark ? <Image source={{ uri: mark }} style={s.mark} resizeMode="contain" /> : null}
      <Text style={s.name}>{activeBrand.shortName}</Text>
    </View>
  )
}

/** Bloque de entrada completo: nuestro logo y, debajo, la red */
export function EntryLockup() {
  return (
    <View style={{ alignItems: 'center', height: ENTRY_H }}>
      <OurLogo />
      {activeBrand ? <View style={{ marginTop: BADGE_GAP }}><NetworkBadge /></View> : null}
    </View>
  )
}

const s = StyleSheet.create({
  badge: { height: BADGE_H, flexDirection: 'row', alignItems: 'center', gap: 9 },
  with:  { fontFamily: 'Nunito-Regular', fontSize: 13, color: 'rgba(255,255,255,0.6)' },
  mark:  { width: 28, height: 28 },
  // Como el logotipo de la red: mayúsculas bien espaciadas
  name:  { fontFamily: 'Nunito-SemiBold', fontSize: 14, letterSpacing: 4, color: 'rgba(255,255,255,0.9)' },
})
