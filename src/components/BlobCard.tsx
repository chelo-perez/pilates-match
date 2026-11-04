import React, { useEffect, useRef } from 'react'
import { View, StyleSheet, Animated, TouchableOpacity, Easing } from 'react-native'

// Estilos de layout que tienen que aplicarse al contenido (no al contorno):
// si no, una tarjeta con flexDirection 'row' igual apila todo en columna.
const CONTENT_KEYS = ['flexDirection', 'alignItems', 'justifyContent', 'flexWrap', 'gap', 'rowGap', 'columnGap'] as const
import { colors, radius } from './ui'

interface BlobCardProps {
  children: React.ReactNode
  style?: any
  onPress?: () => void
  blobColor?: string
  blobColor2?: string
  delay?: number   // ms — desfasa el arranque del ciclo
}

export default function BlobCard({
  children, style, onPress,
  blobColor  = 'rgba(44,101,102,0.07)',
  blobColor2 = 'rgba(44,101,102,0.04)',
  delay = 0,
}: BlobCardProps) {
  const anim1 = useRef(new Animated.Value(0)).current
  const anim2 = useRef(new Animated.Value(0)).current

  useEffect(() => {
    const loop1 = Animated.loop(
      Animated.sequence([
        Animated.timing(anim1, { toValue: 1, duration: 14000, easing: Easing.bezier(0.45, 0, 0.55, 1), useNativeDriver: true }),
        Animated.timing(anim1, { toValue: 0, duration: 14000, easing: Easing.bezier(0.45, 0, 0.55, 1), useNativeDriver: true }),
      ])
    )
    const loop2 = Animated.loop(
      Animated.sequence([
        Animated.timing(anim2, { toValue: 1, duration: 20000, easing: Easing.bezier(0.45, 0, 0.55, 1), useNativeDriver: true }),
        Animated.timing(anim2, { toValue: 0, duration: 20000, easing: Easing.bezier(0.45, 0, 0.55, 1), useNativeDriver: true }),
      ])
    )
    // Desfase: arranca después del delay
    const t = setTimeout(() => {
      loop1.start()
      loop2.start()
    }, delay)
    return () => {
      clearTimeout(t)
      loop1.stop()
      loop2.stop()
    }
  }, [delay])

  // Movimiento suave, cerca de las esquinas, para que no tape el contenido
  const b1x = anim1.interpolate({ inputRange: [0, 1], outputRange: [-20, 40] })
  const b1y = anim1.interpolate({ inputRange: [0, 1], outputRange: [-20, 15] })
  const b2x = anim2.interpolate({ inputRange: [0, 1], outputRange: [20, -20] })
  const b2y = anim2.interpolate({ inputRange: [0, 1], outputRange: [15, -15] })

  const flat: any = { ...(StyleSheet.flatten(style) ?? {}) }
  const contentLayout: any = {}
  for (const k of CONTENT_KEYS) if (flat[k] !== undefined) { contentLayout[k] = flat[k]; delete flat[k] }

  const Comp = onPress ? TouchableOpacity : View

  return (
    <Comp style={[s.card, flat]} onPress={onPress} activeOpacity={0.88}>
      <Animated.View style={[s.blob, s.blobMain, { backgroundColor: blobColor, transform: [{ translateX: b1x }, { translateY: b1y }] }]} />
      <Animated.View style={[s.blob, s.blobSec,  { backgroundColor: blobColor2, transform: [{ translateX: b2x }, { translateY: b2y }] }]} />
      <View style={[s.content, contentLayout]}>{children}</View>
    </Comp>
  )
}

const s = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    ...radius.leafLg,
    borderWidth: 0.5,
    borderColor: colors.mint,
    overflow: 'hidden',
    shadowColor: colors.forestDark,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
  },
  blob:     { position: 'absolute', borderRadius: 9999 },
  blobMain: { width: 100, height: 100, top: -25, left: -20 },
  blobSec:  { width: 70,  height: 70,  bottom: -18, right: -15 },
  content:  { position: 'relative', zIndex: 1, flexGrow: 1 },
})
