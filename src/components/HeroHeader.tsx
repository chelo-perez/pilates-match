// src/components/HeroHeader.tsx
import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { Feather } from '@expo/vector-icons'
import Svg, { Path } from 'react-native-svg'
import { colors, spacing } from './ui'

interface HeroHeaderProps {
  title: string
  subtitle?: string
  onBack?: () => void
  backLabel?: string
  rightElement?: React.ReactNode
  bottomElement?: React.ReactNode
}

export default function HeroHeader({
  title, subtitle, onBack, backLabel = 'Volver',
  rightElement, bottomElement,
}: HeroHeaderProps) {
  const insets = useSafeAreaInsets()

  return (
    <LinearGradient
      colors={['#2D3F31', '#4A5D4E', '#5C7060']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[s.hero, { paddingTop: insets.top + 12 }]}
    >
      <View style={s.blob1} />
      <View style={s.blob2} />

      <View style={s.inner}>
        {onBack && (
          <TouchableOpacity style={s.back} onPress={onBack}>
            <Feather name="chevron-left" size={16} color="rgba(255,255,255,0.7)" />
            <Text style={s.backTxt}>{backLabel}</Text>
          </TouchableOpacity>
        )}
        <View style={s.titleRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>{title}</Text>
            {subtitle ? <Text style={s.subtitle}>{subtitle}</Text> : null}
          </View>
          {rightElement}
        </View>
        {bottomElement}
      </View>

      <Svg width="100%" height={28} viewBox="0 0 375 28" preserveAspectRatio="none" style={s.wave}>
        <Path d="M0,14 C93,28 187,0 280,14 C327,21 351,24 375,14 L375,28 L0,28 Z" fill={colors.cream} />
      </Svg>
    </LinearGradient>
  )
}

const s = StyleSheet.create({
  hero:     { paddingHorizontal: spacing.md, paddingBottom: 32, position: 'relative', overflow: 'hidden' },
  blob1:    { position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(255,255,255,0.06)', top: -60, right: -50 },
  blob2:    { position: 'absolute', width: 130, height: 130, borderRadius: 65,  backgroundColor: 'rgba(255,255,255,0.04)', bottom: -40, left: -20 },
  inner:    { position: 'relative', zIndex: 1 },
  back:     { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 12, opacity: 0.75 },
  backTxt:  { fontFamily: 'Nunito-Bold', fontSize: 11, color: '#fff' },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start' },
  title:    { fontFamily: 'Nunito-Bold', fontSize: 22, color: '#fff', letterSpacing: -0.3, marginBottom: 3 },
  subtitle: { fontFamily: 'Nunito-SemiBold', fontSize: 11, color: 'rgba(255,255,255,0.55)' },
  wave:     { position: 'absolute', bottom: 0, left: 0, right: 0 },
})
