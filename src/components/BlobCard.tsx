// src/components/BlobCard.tsx
// Card con luz cenital animada — variante B (top-left + bottom-right curvos)
import React, { useEffect, useRef } from 'react'
import { View, StyleSheet, Animated, TouchableOpacity, Easing } from 'react-native'

interface BlobCardProps {
  children: React.ReactNode
  style?: any
  onPress?: () => void
  blobColor?: string
  blobColor2?: string
}

export default function BlobCard({
  children, style, onPress,
  blobColor = 'rgba(74,93,78,0.16)',
  blobColor2 = 'rgba(74,93,78,0.10)',
}: BlobCardProps) {
  const anim1 = useRef(new Animated.Value(0)).current
  const anim2 = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim1, { toValue: 1, duration: 7000, easing: Easing.bezier(0.45, 0, 0.55, 1), useNativeDriver: true }),
        Animated.timing(anim1, { toValue: 0, duration: 7000, easing: Easing.bezier(0.45, 0, 0.55, 1), useNativeDriver: true }),
      ])
    ).start()
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim2, { toValue: 1, duration: 10000, easing: Easing.bezier(0.45, 0, 0.55, 1), useNativeDriver: true }),
        Animated.timing(anim2, { toValue: 0, duration: 10000, easing: Easing.bezier(0.45, 0, 0.55, 1), useNativeDriver: true }),
      ])
    ).start()
  }, [])

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
  blobMain: { width: 130, height: 130, top: -35, left: -30 },
  blobSec:  { width: 90,  height: 90,  bottom: -25, right: -20 },
  content:  { position: 'relative', zIndex: 1 },
})
