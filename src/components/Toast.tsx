// src/components/Toast.tsx
import React, { useEffect, useRef } from 'react'
import { Animated, Text, StyleSheet, View } from 'react-native'
import { Feather } from '@expo/vector-icons'
import { colors, spacing, radius } from './ui'

interface ToastProps {
  message: string
  type?: 'success' | 'error' | 'warning'
  visible: boolean
  onHide: () => void
  /** 'top' cuando abajo hay un botón que no conviene tapar (p. ej. en un modal) */
  position?: 'top' | 'bottom'
}

export default function Toast({ message, type = 'success', visible, onHide, position = 'bottom' }: ToastProps) {
  const offscreen = position === 'top' ? -100 : 100
  const translateY = useRef(new Animated.Value(offscreen)).current
  const opacity = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 80, friction: 10 }),
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start()
      const timer = setTimeout(() => {
        Animated.parallel([
          Animated.timing(translateY, { toValue: offscreen, duration: 250, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }),
        ]).start(() => onHide())
      }, 2500)
      return () => clearTimeout(timer)
    }
  }, [visible, message])

  if (!visible) return null

  const config = {
    success: { bg: colors.toastOkBg,   icon: 'check-circle', color: colors.toastOkIcon },
    error:   { bg: colors.toastErrBg,  icon: 'x-circle',     color: colors.toastErrIcon },
    warning: { bg: colors.toastWarnBg, icon: 'alert-circle', color: colors.toastWarnIcon },
  }[type]

  return (
    <Animated.View pointerEvents="none" accessibilityLiveRegion="polite" style={[s.container, position === 'top' && s.top, { opacity, transform: [{ translateY }] }]}>
      <View style={[s.toast, { backgroundColor: config.bg }]}>
        <Feather name={config.icon as any} size={18} color={config.color} />
        <Text style={s.message}>{message}</Text>
      </View>
    </Animated.View>
  )
}

const s = StyleSheet.create({
  top:       { top: 56, bottom: undefined },
  container: { position: 'absolute', bottom: 90, left: spacing.md, right: spacing.md, zIndex: 999, alignItems: 'center' },
  toast:     { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 16, borderRadius: radius.md, shadowColor: colors.black, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8, maxWidth: 360 },
  message:   { fontFamily: 'Nunito-SemiBold', fontSize: 13, color: colors.white, flex: 1, lineHeight: 18 },
})
