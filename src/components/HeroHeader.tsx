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
  // El encabezado cierra recto en todas las pantallas (sin la punta de "hoja")

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
                    <Feather name="camera" size={12} color={colors.white} />
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

    </View>
  )
}

const s = StyleSheet.create({
  hero:            { backgroundColor: colors.forest, paddingHorizontal: spacing.md, paddingBottom: spacing.md + 2, position: 'relative', overflow: 'hidden' },
  blob1:           { position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(255,255,255,0.06)', top: -60, right: -50 },
  blob2:           { position: 'absolute', width: 130, height: 130, borderRadius: 65, backgroundColor: 'rgba(255,255,255,0.04)', bottom: -40, left: -20 },
  inner:           { position: 'relative', zIndex: 1 },
  topRow:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  back:            { flexDirection: 'row', alignItems: 'center', gap: 4, opacity: 0.75 },
  backTxt:         { fontFamily: 'Nunito-Bold', fontSize: 12, color: colors.white },
  // Standard mode
  titleRow:        { flexDirection: 'row', alignItems: 'flex-start' },
  title:           { fontFamily: 'Nunito-Bold', fontSize: 22, color: colors.white, letterSpacing: -0.3, marginBottom: 3 },
  subtitle:        { fontFamily: 'Nunito-SemiBold', fontSize: 12, color: 'rgba(255,255,255,0.65)' },
  // Centered mode
  centeredContent: { alignItems: 'center', paddingTop: 2, paddingBottom: 2 },
  avatarWrap:      { width: 64, height: 64, borderRadius: 32, marginBottom: 8, position: 'relative' },
  avatarImg:       { width: 64, height: 64, borderRadius: 32, borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)' },
  avatarFallback:  { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(255,255,255,0.18)', borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)', alignItems: 'center', justifyContent: 'center' },
  avatarLetter:    { fontFamily: 'Nunito-Bold', fontSize: 24, color: colors.white },
  cameraIcon:      { position: 'absolute', bottom: 0, right: 0, width: 20, height: 20, borderRadius: 10, backgroundColor: colors.sage, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.white },
  centeredTitle:   { fontFamily: 'Nunito-Bold', fontSize: 20, color: colors.white, letterSpacing: -0.3, textAlign: 'center' },
  centeredSubtitle:{ fontFamily: 'Nunito-SemiBold', fontSize: 12, color: 'rgba(255,255,255,0.7)', textAlign: 'center', marginTop: 2 },
})
