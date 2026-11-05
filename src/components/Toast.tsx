// src/components/Toast.tsx
// Aviso breve ("Guardado", errores): una píldora blanca arriba, debajo de la barra de estado.
// No tapa botones ni la barra de pestañas y se va sola.
import React, { useEffect, useRef } from 'react'
import { Animated, Text, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Feather } from '@expo/vector-icons'
import { colors, spacing } from './ui'

interface ToastProps {
  message: string
  type?: 'success' | 'error' | 'warning'
  visible: boolean
  onHide: () => void
  /** Se mantiene por compatibilidad: el aviso siempre aparece arriba */
  position?: 'top' | 'bottom'
}

const CONFIG = {
  success: { icon: 'check-circle', color: colors.okTx },
  error:   { icon: 'alert-circle', color: colors.redTx },
  warning: { icon: 'alert-triangle', color: colors.warnTx },
} as const

export default function Toast({ message, type = 'success', visible, onHide }: ToastProps) {
  const insets = useSafeAreaInsets()
  const translateY = useRef(new Animated.Value(-80)).current
  const opacity = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (!visible) return
    translateY.setValue(-80); opacity.setValue(0)
    Animated.parallel([
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 90, friction: 11 }),
      Animated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: true }),
    ]).start()
    const ms = type === 'success' ? 2000 : 3500 // los errores se leen con más calma
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(translateY, { toValue: -80, duration: 220, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]).start(() => onHide())
    }, ms)
    return () => clearTimeout(timer)
  }, [visible, message])

  if (!visible) return null
  const c = CONFIG[type]

  return (
    <Animated.View pointerEvents="none" accessibilityLiveRegion="polite"
      style={[s.container, { top: insets.top + 8, opacity, transform: [{ translateY }] }]}>
      <Animated.View style={s.pill}>
        <Feather name={c.icon as any} size={16} color={c.color} />
        <Text style={s.message} numberOfLines={2}>{message}</Text>
      </Animated.View>
    </Animated.View>
  )
}

const s = StyleSheet.create({
  container: { position: 'absolute', left: spacing.md, right: spacing.md, zIndex: 999, alignItems: 'center' },
  pill:      { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 9, paddingHorizontal: 14, borderRadius: 999,
               backgroundColor: colors.white, maxWidth: 360,
               shadowColor: colors.black, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 6 },
  message:   { fontFamily: 'Nunito-SemiBold', fontSize: 13, color: colors.dark, flexShrink: 1, lineHeight: 18 },
})
