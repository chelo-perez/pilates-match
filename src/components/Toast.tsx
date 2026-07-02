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
}

export default function Toast({ message, type = 'success', visible, onHide }: ToastProps) {
  const translateY = useRef(new Animated.Value(100)).current
  const opacity = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 80, friction: 10 }),
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start()
      const timer = setTimeout(() => {
        Animated.parallel([
          Animated.timing(translateY, { toValue: 100, duration: 250, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }),
        ]).start(() => onHide())
      }, 2500)
      return () => clearTimeout(timer)
    }
  }, [visible])

  if (!visible) return null

  const config = {
    success: { bg: '#1A2E1C', icon: 'check-circle', color: '#6FCF7A' },
    error:   { bg: '#2E1A1A', icon: 'x-circle',    color: '#F87171' },
    warning: { bg: '#2E2510', icon: 'alert-circle', color: '#FBBF24' },
  }[type]

  return (
    <Animated.View style={[s.container, { opacity, transform: [{ translateY }] }]}>
      <View style={[s.toast, { backgroundColor: config.bg }]}>
        <Feather name={config.icon as any} size={18} color={config.color} />
        <Text style={s.message}>{message}</Text>
      </View>
    </Animated.View>
  )
}

const s = StyleSheet.create({
  container: { position: 'absolute', bottom: 90, left: spacing.md, right: spacing.md, zIndex: 999, alignItems: 'center' },
  toast:     { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 16, borderTopLeftRadius: 14, borderTopRightRadius: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8, maxWidth: 360 },
  message:   { fontFamily: 'Nunito-SemiBold', fontSize: 13, color: '#FFFFFF', flex: 1 },
})
