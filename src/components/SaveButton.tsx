// src/components/SaveButton.tsx
// Botón de guardar con 3 estados: idle → loading → success
// Opción A: feedback visual en el botón mismo, sin toast ni navegación forzada

import React, { useEffect, useRef } from 'react'
import { TouchableOpacity, Text, StyleSheet, Animated, ActivityIndicator, View } from 'react-native'
import { Feather } from '@expo/vector-icons'
import { colors } from './ui'

interface SaveButtonProps {
  label?: string
  labelLoading?: string
  labelSuccess?: string
  onPress: () => void
  isPending: boolean
  isSuccess: boolean
  disabled?: boolean
  style?: any
  variant?: 'primary' | 'secondary'
}

export default function SaveButton({
  label         = 'Guardar',
  labelLoading  = 'Guardando...',
  labelSuccess  = 'Guardado',
  onPress,
  isPending,
  isSuccess,
  disabled,
  style,
  variant = 'primary',
}: SaveButtonProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current
  const prevSuccess = useRef(false)

  useEffect(() => {
    if (isSuccess && !prevSuccess.current) {
      // Pulse animation when success lands
      Animated.sequence([
        Animated.timing(scaleAnim, { toValue: 0.95, duration: 80,  useNativeDriver: true }),
        Animated.spring(scaleAnim,  { toValue: 1,    friction: 4,   useNativeDriver: true }),
      ]).start()
    }
    prevSuccess.current = isSuccess
  }, [isSuccess])

  const isSecondary = variant === 'secondary'

  const bgColor = isSuccess
    ? '#2E6B1A'
    : isPending
      ? colors.sageMid
      : isSecondary ? colors.sageLight : colors.sage

  const borderColor = isSecondary && !isSuccess && !isPending ? colors.sage : bgColor

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        style={[
          s.btn,
          { backgroundColor: bgColor, borderColor },
          isSecondary && s.btnSecondary,
          (disabled || isPending) && s.btnDisabled,
          style,
        ]}
        onPress={onPress}
        disabled={disabled || isPending || isSuccess}
        activeOpacity={0.85}
      >
        {isPending ? (
          <ActivityIndicator color={isSecondary ? colors.sage : '#fff'} size="small" />
        ) : isSuccess ? (
          <View style={s.successRow}>
            <Feather name="check" size={16} color="#fff" />
            <Text style={s.btnTxt}>{labelSuccess}</Text>
          </View>
        ) : (
          <Text style={[s.btnTxt, isSecondary && s.btnTxtSecondary]}>{label}</Text>
        )}
      </TouchableOpacity>
    </Animated.View>
  )
}

const s = StyleSheet.create({
  btn: {
    borderTopLeftRadius: 14, borderTopRightRadius: 0,
    borderBottomLeftRadius: 0, borderBottomRightRadius: 14,
    padding: 15, alignItems: 'center', justifyContent: 'center',
    borderWidth: 0.5, minHeight: 50,
  },
  btnSecondary: { backgroundColor: colors.sageLight },
  btnDisabled:  { opacity: 0.7 },
  successRow:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  btnTxt:       { fontFamily: 'Nunito-Bold', fontSize: 15, color: '#fff' },
  btnTxtSecondary: { color: colors.sage },
})
