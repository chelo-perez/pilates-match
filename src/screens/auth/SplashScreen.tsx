// src/screens/auth/SplashScreen.tsx
import React, { useEffect, useRef } from 'react'
import { View, Image, Animated, StyleSheet, Dimensions } from 'react-native'
import { colors } from '../../components/ui'

const { width } = Dimensions.get('window')

interface Props {
  onFinish: () => void
}

export default function AnimatedSplash({ onFinish }: Props) {
  // Arranca con el logo visible (igual que el splash nativo) para que no parpadee
  const opacity    = useRef(new Animated.Value(1)).current
  const scale      = useRef(new Animated.Value(0.94)).current
  const fadeOut    = useRef(new Animated.Value(1)).current

  useEffect(() => {
    Animated.sequence([
      // 1. Leve zoom del logo (ya visible, igual que el splash nativo)
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1, duration: 700,
          useNativeDriver: true,
        }),
        Animated.spring(scale, {
          toValue: 1, friction: 6, tension: 40,
          useNativeDriver: true,
        }),
      ]),
      // 2. Pausa con el logo visible
      Animated.delay(900),
      // 3. Primero se va el logo y después el fondo: así no se ven dos logos
      //    a la vez (el del login está en otra posición)
      Animated.timing(opacity, {
        toValue: 0, duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(fadeOut, {
        toValue: 0, duration: 400,
        useNativeDriver: true,
      }),
    ]).start(() => onFinish())
  }, [])

  return (
    <Animated.View style={[s.container, { opacity: fadeOut }]}>
      {/* Mismo fondo y círculos que el login, para que el paso sea continuo */}
      <View style={s.blob1} />
      <View style={s.blob2} />
      <View style={s.blob3} />

      {/* Logo */}
      <Animated.View style={{ opacity, transform: [{ scale }] }}>
        <Image
          source={require('../../../assets/logo-white.png')}
          style={s.logo}
          resizeMode="contain"
        />
      </Animated.View>
    </Animated.View>
  )
}

const s = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.forestDeep,
    zIndex: 999,
  },
  blob1: { position: 'absolute', width: 300, height: 300, borderRadius: 150, backgroundColor: 'rgba(255,208,96,0.06)', top: -80, right: -80 },
  blob2: { position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(74,93,78,0.4)', bottom: 100, left: -60 },
  blob3: { position: 'absolute', width: 150, height: 150, borderRadius: 75, backgroundColor: 'rgba(255,255,255,0.03)', top: '40%', right: -40 },
  logo:  { width: 220, height: 170 },
})
