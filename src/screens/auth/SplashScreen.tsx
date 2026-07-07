// src/screens/auth/SplashScreen.tsx
import React, { useEffect, useRef } from 'react'
import { View, Image, Animated, StyleSheet, Dimensions } from 'react-native'

const { width } = Dimensions.get('window')

interface Props {
  onFinish: () => void
}

export default function AnimatedSplash({ onFinish }: Props) {
  const opacity    = useRef(new Animated.Value(0)).current
  const scale      = useRef(new Animated.Value(0.82)).current
  const fadeOut    = useRef(new Animated.Value(1)).current

  useEffect(() => {
    Animated.sequence([
      // 1. Fade in + scale up del logo
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
      // 3. Fade out suave de toda la pantalla
      Animated.timing(fadeOut, {
        toValue: 0, duration: 500,
        useNativeDriver: true,
      }),
    ]).start(() => onFinish())
  }, [])

  return (
    <Animated.View style={[s.container, { opacity: fadeOut }]}>
      {/* Gradiente simulado con dos Views superpuestas */}
      <View style={s.gradTop} />
      <View style={s.gradBottom} />

      {/* Blobs decorativos */}
      <View style={s.blob1} />
      <View style={s.blob2} />

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
    backgroundColor: '#2D3F31',
    zIndex: 999,
  },
  gradTop:    { ...StyleSheet.absoluteFillObject, backgroundColor: '#2D3F31', opacity: 1 },
  gradBottom: { position: 'absolute', bottom: 0, left: 0, right: 0, height: '60%', backgroundColor: '#4A5D4E', opacity: 0.6 },
  blob1: { position: 'absolute', width: 300, height: 300, borderRadius: 150, backgroundColor: 'rgba(255,255,255,0.04)', top: -80, right: -60 },
  blob2: { position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(255,255,255,0.03)', bottom: -50, left: -40 },
  logo:  { width: width * 0.6, height: width * 0.4 },
})
