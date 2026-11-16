// Pantalla de inicio animada. Continúa la pantalla de inicio fija del celular y termina en el login:
//   1. Logo de Trabajo Más Fácil, grande y centrado, sobre nuestro petróleo (igual que el inicio fijo).
//   2. Nuestro logo sube hasta su lugar arriba del login y, debajo, aparece la red ("con CAPIAF").
//   3. Cuando la app sabe a dónde ir (sesión y perfil cargados), se desvanece: el login ya está debajo,
//      con todo en el mismo lugar, y solo aparecen el texto y los botones.
import React, { useEffect, useRef, useState } from 'react'
import { View, Animated, Easing, Image, StyleSheet, useWindowDimensions } from 'react-native'
import { activeBrand } from '../../lib/brand'
import { BADGE_GAP, ENTRY_BG, LOGO_H, LOGO_W, NetworkBadge, useLogoTop } from './entry'

interface Props { ready: boolean; onFinish: () => void }

const ease = Easing.bezier(0.65, 0, 0.35, 1)
const MAX_WAIT = 6000 // si la sesión tarda, no dejamos a la persona mirando el logo
// En la imagen del inicio fijo (288 × 288) el logo mide ~143 de ancho y está centrado
const NATIVE_IMG = 288
const NATIVE_LOGO_W = 143

export default function AnimatedSplash({ ready, onFinish }: Props) {
  const move  = useRef(new Animated.Value(0)).current   // 0 → 1: nuestro logo sube a su lugar
  const badge = useRef(new Animated.Value(0)).current   // la red aparece debajo
  const out   = useRef(new Animated.Value(1)).current   // todo el inicio
  const [intro, setIntro] = useState(false)
  const [timedOut, setTimedOut] = useState(false)
  const { height } = useWindowDimensions()
  const logoTop = useLogoTop()

  const targetY = logoTop + LOGO_H / 2
  const targetScale = LOGO_W / NATIVE_LOGO_W

  useEffect(() => {
    Animated.sequence([
      Animated.delay(450),
      Animated.timing(move, { toValue: 1, duration: 750, easing: ease, useNativeDriver: true }),
      activeBrand ? Animated.timing(badge, { toValue: 1, duration: 450, easing: Easing.out(Easing.cubic), useNativeDriver: true }) : Animated.delay(0),
    ]).start(() => setIntro(true))
    const t = setTimeout(() => setTimedOut(true), MAX_WAIT)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    if (!intro || !(ready || timedOut)) return
    Animated.timing(out, { toValue: 0, duration: 360, delay: 200, easing: Easing.out(Easing.quad), useNativeDriver: true }).start(() => onFinish())
  }, [intro, ready, timedOut])

  return (
    <Animated.View style={[s.root, { opacity: out }]} pointerEvents="none">
      {/* Nuestro logo: arranca igual que el inicio fijo y sube a su lugar en el login */}
      <Animated.View style={[s.row, { top: height / 2 - NATIVE_IMG / 2, transform: [
        { translateY: move.interpolate({ inputRange: [0, 1], outputRange: [0, targetY - height / 2] }) },
        { scale: move.interpolate({ inputRange: [0, 1], outputRange: [1, targetScale] }) },
      ] }]}>
        <Image source={require('../../../assets/splash-icon.png')} style={s.img} resizeMode="contain" />
      </Animated.View>

      {/* La red, debajo de nuestro logo, en el mismo lugar que en el login */}
      {activeBrand ? (
        <Animated.View style={[s.row, { top: logoTop + LOGO_H + BADGE_GAP, opacity: badge, transform: [{ translateY: badge.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }) }] }]}>
          <NetworkBadge />
        </Animated.View>
      ) : null}
    </Animated.View>
  )
}

const s = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, zIndex: 999, backgroundColor: ENTRY_BG },
  row:  { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  img:  { width: NATIVE_IMG, height: NATIVE_IMG },
})
