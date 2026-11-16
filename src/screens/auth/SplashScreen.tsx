// Pantalla de inicio animada. Continúa la pantalla de inicio fija del celular (mismo fondo y
// mismo logo, en el mismo lugar) y la lleva hasta la entrada de la red:
//   1. Se ve igual que el inicio fijo: logo de Trabajo Más Fácil sobre petróleo.
//   2. El fondo pasa suavemente al color de la red y el logo de la red aparece donde va a estar en el login.
//   3. Cuando la app sabe a dónde ir (sesión y perfil cargados), se desvanece.
import React, { useEffect, useRef, useState } from 'react'
import { View, Animated, Easing, Image, StyleSheet } from 'react-native'
import { EntryMark, NATIVE_SPLASH_BG, entryBg, useMarkTop } from './entry'

interface Props { ready: boolean; onFinish: () => void }

const ease = Easing.bezier(0.4, 0, 0.2, 1)
const MAX_WAIT = 6000 // si la sesión tarda, no dejamos a la persona mirando el logo

export default function AnimatedSplash({ ready, onFinish }: Props) {
  const native = useRef(new Animated.Value(1)).current   // logo del inicio fijo
  const bg     = useRef(new Animated.Value(0)).current   // fondo de la red
  const mark   = useRef(new Animated.Value(0)).current   // logo de entrada
  const out    = useRef(new Animated.Value(1)).current   // todo el inicio
  const [intro, setIntro] = useState(false)
  const [timedOut, setTimedOut] = useState(false)
  const markTop = useMarkTop()

  useEffect(() => {
    Animated.sequence([
      Animated.delay(250),
      Animated.parallel([
        Animated.timing(native, { toValue: 0, duration: 420, easing: ease, useNativeDriver: true }),
        Animated.timing(bg, { toValue: 1, duration: 520, easing: ease, useNativeDriver: true }),
        Animated.timing(mark, { toValue: 1, duration: 520, delay: 200, easing: ease, useNativeDriver: true }),
      ]),
    ]).start(() => setIntro(true))
    const t = setTimeout(() => setTimedOut(true), MAX_WAIT)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    if (!intro || !(ready || timedOut)) return
    Animated.timing(out, { toValue: 0, duration: 380, delay: 120, easing: ease, useNativeDriver: true }).start(() => onFinish())
  }, [intro, ready, timedOut])

  return (
    <Animated.View style={[s.root, { opacity: out }]} pointerEvents="none">
      <View style={[StyleSheet.absoluteFill, { backgroundColor: NATIVE_SPLASH_BG }]} />
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: entryBg(), opacity: bg }]} />

      {/* Igual que el inicio fijo: imagen de 288 de ancho, centrada */}
      <Animated.View style={[s.center, { opacity: native, transform: [{ scale: native.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) }] }]}>
        <Image source={require('../../../assets/splash-icon.png')} style={s.nativeImg} resizeMode="contain" />
      </Animated.View>

      <Animated.View style={[s.mark, { top: markTop, opacity: mark, transform: [{ translateY: mark.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }]}>
        <EntryMark />
      </Animated.View>
    </Animated.View>
  )
}

const s = StyleSheet.create({
  root:      { ...StyleSheet.absoluteFillObject, zIndex: 999 },
  center:    { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  nativeImg: { width: 288, height: 288 },
  mark:      { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
})
