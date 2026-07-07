import React from 'react'
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Feather } from '@expo/vector-icons'
import { colors, spacing } from './ui'

interface HeroHeaderProps {
  title: string
  subtitle?: string
  onBack?: () => void
  backLabel?: string
  rightElement?: React.ReactNode
  bottomElement?: React.ReactNode
  avatarUri?: string | null
  avatarFallback?: string
  onAvatarPress?: () => void
  centered?: boolean
}

export default function HeroHeader({
  title, subtitle, onBack, backLabel = 'Volver',
  rightElement, bottomElement,
  avatarUri, avatarFallback, onAvatarPress, centered,
}: HeroHeaderProps) {
  const insets = useSafeAreaInsets()

  return (
    <View style={[s.hero, { paddingTop: insets.top + 12 }]}>
      <View style={s.blob1} />
      <View style={s.blob2} />

      <View style={s.inner}>

        {centered ? (
          /* ── Modo centrado ── */
          <>
            {/* Fila superior: back izq + logout der */}
            {(onBack || rightElement) && (
              <View style={s.topRow}>
                {onBack ? (
                  <TouchableOpacity style={s.back} onPress={onBack}>
                    <Feather name="chevron-left" size={16} color="rgba(255,255,255,0.7)" />
                    <Text style={s.backTxt}>{backLabel}</Text>
                  </TouchableOpacity>
                ) : <View />}
                {rightElement ?? <View />}
              </View>
            )}
            {/* Avatar + nombre centrado */}
            <View style={s.centeredContent}>
              <TouchableOpacity
                style={s.avatarWrap}
                onPress={onAvatarPress}
                disabled={!onAvatarPress}
                activeOpacity={0.85}
              >
                {avatarUri ? (
                  <Image source={{ uri: avatarUri }} style={s.avatarImg} />
                ) : (
                  <View style={s.avatarFallback}>
                    <Text style={s.avatarLetter}>{(avatarFallback ?? title)[0]?.toUpperCase()}</Text>
                  </View>
                )}
                {onAvatarPress && (
                  <View style={s.cameraIcon}>
                    <Feather name="camera" size={12} color="#fff" />
                  </View>
                )}
              </TouchableOpacity>
              <Text style={s.centeredTitle}>{title}</Text>
              {subtitle ? <Text style={s.centeredSubtitle}>{subtitle}</Text> : null}
              {bottomElement}
            </View>
          </>
        ) : (
          /* ── Modo estándar ── */
          <>
            {(onBack || rightElement) && (
              <View style={s.topRow}>
                {onBack ? (
                  <TouchableOpacity style={s.back} onPress={onBack}>
                    <Feather name="chevron-left" size={16} color="rgba(255,255,255,0.7)" />
                    <Text style={s.backTxt}>{backLabel}</Text>
                  </TouchableOpacity>
                ) : <View />}
                {rightElement ?? <View />}
              </View>
            )}
            <View style={s.titleRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.title}>{title}</Text>
                {subtitle ? <Text style={s.subtitle}>{subtitle}</Text> : null}
              </View>
            </View>
            {bottomElement}
          </>
        )}

      </View>

      <View style={s.waveRow}>
        <View style={s.waveLeft} />
        <View style={s.waveRight} />
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  hero:            { backgroundColor: '#3D5440', paddingHorizontal: spacing.md, paddingBottom: 36, position: 'relative', overflow: 'hidden' },
  blob1:           { position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(255,255,255,0.06)', top: -60, right: -50 },
  blob2:           { position: 'absolute', width: 130, height: 130, borderRadius: 65, backgroundColor: 'rgba(255,255,255,0.04)', bottom: -40, left: -20 },
  inner:           { position: 'relative', zIndex: 1 },
  topRow:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  back:            { flexDirection: 'row', alignItems: 'center', gap: 4, opacity: 0.75 },
  backTxt:         { fontFamily: 'Nunito-Bold', fontSize: 11, color: '#fff' },
  // Standard mode
  titleRow:        { flexDirection: 'row', alignItems: 'flex-start' },
  title:           { fontFamily: 'Nunito-Bold', fontSize: 22, color: '#fff', letterSpacing: -0.3, marginBottom: 3 },
  subtitle:        { fontFamily: 'Nunito-SemiBold', fontSize: 11, color: 'rgba(255,255,255,0.55)' },
  // Centered mode
  centeredContent: { alignItems: 'center', paddingTop: 4, paddingBottom: 4 },
  avatarWrap:      { width: 80, height: 80, borderRadius: 40, marginBottom: 12, position: 'relative' },
  avatarImg:       { width: 80, height: 80, borderRadius: 40, borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)' },
  avatarFallback:  { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.18)', borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)', alignItems: 'center', justifyContent: 'center' },
  avatarLetter:    { fontFamily: 'Nunito-Bold', fontSize: 32, color: '#fff' },
  cameraIcon:      { position: 'absolute', bottom: 0, right: 0, width: 24, height: 24, borderRadius: 12, backgroundColor: colors.sage, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },
  centeredTitle:   { fontFamily: 'Nunito-Bold', fontSize: 22, color: '#fff', letterSpacing: -0.3, textAlign: 'center' },
  centeredSubtitle:{ fontFamily: 'Nunito-SemiBold', fontSize: 12, color: 'rgba(255,255,255,0.6)', textAlign: 'center', marginTop: 3 },
  // Wave
  waveRow:         { position: 'absolute', bottom: -1, left: 0, right: 0, height: 28, flexDirection: 'row' },
  waveLeft:        { flex: 1, height: 28, backgroundColor: colors.cream, borderTopRightRadius: 40 },
  waveRight:       { flex: 1, height: 28, backgroundColor: colors.cream, borderTopLeftRadius: 40 },
})
