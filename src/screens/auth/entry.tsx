// Piezas compartidas por la pantalla de inicio animada (SplashScreen) y el login.
// El logo de entrada queda EXACTAMENTE en el mismo lugar en las dos: cuando el inicio se desvanece,
// el login ya está debajo con el mismo fondo y el mismo logo, y solo aparecen el texto y los botones.
import React from 'react'
import { View, Text, Image, StyleSheet, useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors } from '../../components/ui'
import BrandLogo from '../../components/BrandLogo'
import { activeBrand, brandMark } from '../../lib/brand'

/** Color de la pantalla de inicio fija de la app (app.json → expo-splash-screen) */
export const NATIVE_SPLASH_BG = '#163235'
/** Fondo de las pantallas de entrada: el de la red, o el petróleo de Trabajo Más Fácil */
export const entryBg = () => (activeBrand ? colors.forest : colors.forestDeep)

export const MARK_H = 136

/** Distancia desde arriba hasta el logo de entrada (la misma en el inicio y en el login) */
export function useMarkTop() {
  const { height } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  return insets.top + Math.round(height * (height < 700 ? 0.08 : 0.16))
}

/** Logo de entrada: isologo + nombre de la red, o el logo de Trabajo Más Fácil */
export function EntryMark() {
  const mark = brandMark()
  return (
    <View style={s.wrap} accessible accessibilityRole="image" accessibilityLabel={activeBrand?.shortName ?? 'Trabajo Más Fácil'}>
      {mark ? (
        <>
          <Image source={{ uri: mark }} style={s.mark} resizeMode="contain" />
          <Text style={s.name}>{activeBrand!.shortName}</Text>
        </>
      ) : <BrandLogo width={160} />}
    </View>
  )
}

// ── Pie del login con medidas fijas: la animación de inicio lleva nuestro logo hasta acá ──
export const FOOTER_LOGO_W = 64
const FOOTER_LOGO_H = Math.round(FOOTER_LOGO_W * 462 / 600)
const FOOTER_CAPTION_H = 14
const FOOTER_GAP = 6
const FOOTER_LEGAL_H = 32
const FOOTER_LEGAL_GAP = 14
export const FOOTER_H = FOOTER_CAPTION_H + FOOTER_GAP + FOOTER_LOGO_H + FOOTER_LEGAL_GAP + FOOTER_LEGAL_H

/** Distancia desde abajo de la pantalla hasta el centro del logo del pie */
export function useFooterLogoCenterFromBottom() {
  const insets = useSafeAreaInsets()
  return insets.bottom + 16 + FOOTER_LEGAL_H + FOOTER_LEGAL_GAP + FOOTER_LOGO_H / 2
}

/** Firma al pie: "Una plataforma de" + logo de Trabajo Más Fácil (solo con co-marca) */
export function PoweredBy() {
  if (!activeBrand) return null
  return (
    <View style={s.powered} accessible accessibilityLabel="Una plataforma de Trabajo Más Fácil">
      <Text style={s.poweredTxt}>UNA PLATAFORMA DE</Text>
      <BrandLogo width={FOOTER_LOGO_W} />
    </View>
  )
}
export const LEGAL_H = FOOTER_LEGAL_H
export const LEGAL_GAP = FOOTER_LEGAL_GAP

const s = StyleSheet.create({
  wrap:       { height: MARK_H, alignItems: 'center', justifyContent: 'center' },
  mark:       { width: 92, height: 92 },
  // Como el logotipo de la red: sans en mayúsculas, bien espaciada
  name:       { fontFamily: 'Nunito-Medium', fontSize: 24, color: colors.white, letterSpacing: 7, marginTop: 12, paddingLeft: 7 },
  powered:    { alignItems: 'center', gap: FOOTER_GAP },
  poweredTxt: { height: FOOTER_CAPTION_H, fontFamily: 'Nunito-SemiBold', fontSize: 9, lineHeight: 14, letterSpacing: 1.6, color: 'rgba(255,255,255,0.55)' },
})
