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

/** Firma chica al pie: "una plataforma de Trabajo Más Fácil" (solo con co-marca) */
export function PoweredBy() {
  if (!activeBrand) return null
  return (
    <View style={s.powered} accessible accessibilityLabel="Una plataforma de Trabajo Más Fácil">
      <Text style={s.poweredTxt}>Una plataforma de</Text>
      <BrandLogo width={58} />
    </View>
  )
}

const s = StyleSheet.create({
  wrap:       { height: MARK_H, alignItems: 'center', justifyContent: 'center' },
  mark:       { width: 92, height: 92 },
  // Como el logotipo de la red: sans en mayúsculas, bien espaciada
  name:       { fontFamily: 'Nunito-Medium', fontSize: 24, color: colors.white, letterSpacing: 7, marginTop: 12, paddingLeft: 7 },
  powered:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: 0.7 },
  poweredTxt: { fontFamily: 'Nunito-Regular', fontSize: 11, color: colors.white },
})
