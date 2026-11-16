// Pantalla de inicio animada. Continúa la pantalla de inicio fija del celular y termina en el login:
//   1. Logo de Trabajo Más Fácil, grande y centrado, sobre nuestro petróleo (igual que el inicio fijo).
//   2. Nuestro logo se achica y baja hasta su lugar al pie del login ("Una plataforma de…"), mientras el
//      fondo pasa al color de la red y aparece arriba el logo de la red (CAPIAF).
//      Sin co-marca, nuestro logo sube a su lugar arriba del login.
//   3. Cuando la app sabe a dónde ir (sesión y perfil cargados), se desvanece: el login ya está debajo,
//      con todo en el mismo lugar, y solo aparecen el texto y los botones.
import React, { useEffect, useRef, useState } from 'react'
import { View, Animated, Easing, Image, StyleSheet, useWindowDimensions } from 'react-native'
import { activeBrand } from '../../lib/brand'
import { EntryMark, MARK_H, NATIVE_SPLASH_BG, FOOTER_LOGO_W, entryBg, useMarkTop, useFooterLogoCenterFromBottom } from './entry'

interface Props { ready: boolean; onFinish: () => void }

const ease = Easing.bezier(0.65, 0, 0.35, 1)
const MAX_WAIT = 6000 // si la sesión tarda, no dejamos a la persona mirando el logo
// En la imagen del inicio fijo (288 × 288) el logo mide ~143 de ancho y está centrado
const NATIVE_IMG = 288
const NATIVE_LOGO_W = 143
const BRAND_LOGO_W = 160 // logo de Trabajo Más Fácil arriba del login, sin co-marca

export default function AnimatedSplash({ ready, onFinish }: Props) {
  const move = useRef(new Animated.Value(0)).current   // 0 → 1: nuestro logo viaja y se achica
  const bg   = useRef(new Animated.Value(0)).current   // fondo de la red
  const mark = useRef(new Animated.Value(0)).current   // logo de la red
  const out  = useRef(new Animated.Value(1)).current   // todo el inicio
  const [intro, setIntro] = useState(false)
  const [timedOut, setTimedOut] = useState(false)
  const { height } = useWindowDimensions()
  const markTop = useMarkTop()
  const footerFromBottom = useFooterLogoCenterFromBottom()
  const brand = !!activeBrand

  // Destino de nuestro logo: al pie (con co-marca) o arriba (sin co-marca)
  const targetY = brand ? height - footerFromBottom : markTop + MARK_H / 2
  const targetScale = (brand ? FOOTER_LOGO_W : BRAND_LOGO_W) / NATIVE_LOGO_W

  useEffect(() => {
    Animated.sequence([
      Animated.delay(450),
      Animated.parallel([
        Animated.timing(move, { toValue: 1, duration: 800, easing: ease, useNativeDriver: true }),
        Animated.timing(bg, { toValue: 1, duration: 700, delay: 100, easing: ease, useNativeDriver: true }),
        Animated.timing(mark, { toValue: 1, duration: 550, delay: 380, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
    ]).start(() => setIntro(true))
    const t = setTimeout(() => setTimedOut(true), MAX_WAIT)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    if (!intro || !(ready || timedOut)) return
    Animated.timing(out, { toValue: 0, duration: 360, delay: 150, easing: Easing.out(Easing.quad), useNativeDriver: true }).start(() => onFinish())
  }, [intro, ready, timedOut])

  return (
    <Animated.View style={[s.root, { opacity: out }]} pointerEvents="none">
      <View style={[StyleSheet.absoluteFill, { backgroundColor: NATIVE_SPLASH_BG }]} />
      {brand ? <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: entryBg(), opacity: bg }]} /> : null}

      {/* Logo de la red, en el mismo lugar que en el login */}
      {brand ? (
        <Animated.View style={[s.mark, { top: markTop, opacity: mark, transform: [{ scale: mark.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) }] }]}>
          <EntryMark />
        </Animated.View>
      ) : null}

      {/* Nuestro logo: arranca igual que el inicio fijo y viaja a su lugar en el login */}
      <Animated.View style={[s.ours, { top: height / 2 - NATIVE_IMG / 2, transform: [
        { translateY: move.interpolate({ inputRange: [0, 1], outputRange: [0, targetY - height / 2] }) },
        { scale: move.interpolate({ inputRange: [0, 1], outputRange: [1, targetScale] }) },
      ] }]}>
        <Image source={require('../../../assets/splash-icon.png')} style={s.oursImg} resizeMode="contain" />
      </Animated.View>
    </Animated.View>
  )
}

const s = StyleSheet.create({
  root:    { ...StyleSheet.absoluteFillObject, zIndex: 999 },
  mark:    { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  ours:    { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  oursImg: { width: NATIVE_IMG, height: NATIVE_IMG },
})
