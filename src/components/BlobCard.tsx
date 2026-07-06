import React, { useEffect, useRef } from 'react'
import { View, StyleSheet, Animated, TouchableOpacity, Easing } from 'react-native'

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
  blobColor  = 'rgba(74,93,78,0.10)',
  blobColor2 = 'rgba(74,93,78,0.06)',
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

  const b1x = anim1.interpolate({ inputRange: [0, 1], outputRange: [-20, 110] })
  const b1y = anim1.interpolate({ inputRange: [0, 1], outputRange: [-20, 80] })
  const b2x = anim2.interpolate({ inputRange: [0, 1], outputRange: [80, -30] })
  const b2y = anim2.interpolate({ inputRange: [0, 1], outputRange: [60, -20] })

  const Comp = onPress ? TouchableOpacity : View

  return (
    <Comp style={[s.card, style]} onPress={onPress} activeOpacity={0.88}>
      <Animated.View style={[s.blob, s.blobMain, { backgroundColor: blobColor, transform: [{ translateX: b1x }, { translateY: b1y }] }]} />
      <Animated.View style={[s.blob, s.blobSec,  { backgroundColor: blobColor2, transform: [{ translateX: b2x }, { translateY: b2y }] }]} />
      <View style={s.content}>{children}</View>
    </Comp>
  )
}

const s = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 0,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 20,
    borderWidth: 0.5,
    borderColor: '#D8E2D8',
    overflow: 'hidden',
    shadowColor: '#2D3F31',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
  },
  blob:     { position: 'absolute', borderRadius: 9999 },
  blobMain: { width: 100, height: 100, top: -25, left: -20 },
  blobSec:  { width: 70,  height: 70,  bottom: -18, right: -15 },
  content:  { position: 'relative', zIndex: 1 },
})
