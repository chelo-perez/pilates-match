// src/components/HeroHeader.tsx
import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Feather } from '@expo/vector-icons'

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
    <View style={[s.hero, { paddingTop: insets.top + 12 }]}>
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
      {/* Ola con View — sin SVG nativo */}
      <View style={s.waveRow}>
        <View style={s.waveLeft} />
        <View style={s.waveRight} />
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  hero:      { backgroundColor: '#3D5440', paddingHorizontal: 16, paddingBottom: 32, position: 'relative', overflow: 'hidden' },
  blob1:     { position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(255,255,255,0.06)', top: -60, right: -50 },
  blob2:     { position: 'absolute', width: 130, height: 130, borderRadius: 65,  backgroundColor: 'rgba(255,255,255,0.04)', bottom: -40, left: -20 },
  inner:     { position: 'relative', zIndex: 1 },
  back:      { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 12, opacity: 0.75 },
  backTxt:   { fontFamily: 'Nunito-Bold', fontSize: 11, color: '#fff' },
  titleRow:  { flexDirection: 'row', alignItems: 'flex-start' },
  title:     { fontFamily: 'Nunito-Bold', fontSize: 22, color: '#fff', letterSpacing: -0.3, marginBottom: 3 },
  subtitle:  { fontFamily: 'Nunito-SemiBold', fontSize: 11, color: 'rgba(255,255,255,0.55)' },
  waveRow:   { position: 'absolute', bottom: -1, left: 0, right: 0, height: 28, flexDirection: 'row' },
  waveLeft:  { flex: 1, height: 28, backgroundColor: '#F9F9F6', borderTopRightRadius: 40 },
  waveRight: { flex: 1, height: 28, backgroundColor: '#F9F9F6', borderTopLeftRadius: 40 },
})
