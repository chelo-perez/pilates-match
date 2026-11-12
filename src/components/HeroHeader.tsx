import React from 'react'
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Feather } from '@expo/vector-icons'
import { colors, spacing } from './ui'
import { activeBrand, titleFont, titleTweak } from '../lib/brand'

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
    <View style={[s.hero, { paddingTop: insets.top + 10 }]}>
      {/* Con co-marca, el isologo de la red como marca de agua; si no, los círculos de siempre */}
      {activeBrand?.logos?.markDark ? (
        <Image source={{ uri: activeBrand.logos.markDark }} style={s.watermark} resizeMode="contain" accessibilityIgnoresInvertColors />
      ) : <View style={s.blob1} />}
      <View style={s.blob2} />

      <View style={s.inner}>

        {onBack ? (
          <View style={s.topRow}>
            <TouchableOpacity style={s.back} onPress={onBack} accessibilityRole="button" accessibilityLabel={`Volver a ${backLabel}`} hitSlop={10}>
              <Feather name="chevron-left" size={16} color="rgba(255,255,255,0.7)" />
              <Text style={s.backTxt}>{backLabel}</Text>
            </TouchableOpacity>
            {rightElement ?? <View />}
          </View>
        ) : null}

        {centered ? (
          /* ── Perfil: foto chica + nombre en una fila (antes, foto grande centrada) ── */
          <View style={s.profileRow}>
            <TouchableOpacity style={s.avatarWrap} onPress={onAvatarPress} disabled={!onAvatarPress} activeOpacity={0.85}
              accessibilityRole={onAvatarPress ? 'button' : undefined} accessibilityLabel={onAvatarPress ? 'Cambiar foto' : undefined}>
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={s.avatarImg} />
              ) : (
                <View style={s.avatarFallback}>
                  <Text style={s.avatarLetter}>{(avatarFallback ?? title)[0]?.toUpperCase()}</Text>
                </View>
              )}
              {onAvatarPress && (
                <View style={s.cameraIcon}>
                  <Feather name="camera" size={9} color={colors.white} />
                </View>
              )}
            </TouchableOpacity>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={s.profileTitle} numberOfLines={2}>{title}</Text>
              {subtitle ? <Text style={s.subtitle} numberOfLines={1}>{subtitle}</Text> : null}
            </View>
            {!onBack && rightElement ? <View style={s.rightInline}>{rightElement}</View> : null}
          </View>
        ) : (
          /* ── Estándar: título; sin "Volver", los botones van al lado del título ── */
          <View style={s.titleRow}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[s.title, titleTweak]}>{title}</Text>
              {subtitle ? <Text style={s.subtitle}>{subtitle}</Text> : null}
            </View>
            {!onBack && rightElement ? <View style={s.rightInline}>{rightElement}</View> : null}
          </View>
        )}
        {bottomElement}

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
  titleRow:        { flexDirection: 'row', alignItems: 'center' },
  watermark:       { position: 'absolute', width: 190, height: 190, top: -48, right: -46, opacity: 0.13 },
  title:           { fontFamily: titleFont, fontSize: 22, color: colors.white, letterSpacing: -0.3, marginBottom: 3 },
  subtitle:        { fontFamily: 'Nunito-SemiBold', fontSize: 12, color: 'rgba(255,255,255,0.65)' },
  rightInline:     { marginLeft: spacing.sm },
  // Perfil (foto + nombre en fila)
  profileRow:      { flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 4 },
  avatarWrap:      { width: 52, height: 52, borderRadius: 26, position: 'relative' },
  avatarImg:       { width: 52, height: 52, borderRadius: 26, borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)' },
  avatarFallback:  { width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(255,255,255,0.18)', borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)', alignItems: 'center', justifyContent: 'center' },
  avatarLetter:    { fontFamily: 'Nunito-Bold', fontSize: 20, color: colors.white },
  cameraIcon:      { position: 'absolute', bottom: -2, right: -2, width: 18, height: 18, borderRadius: 9, backgroundColor: colors.sage, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.forest },
  profileTitle:    { fontFamily: 'Nunito-Bold', fontSize: 19, lineHeight: 24, color: colors.white, letterSpacing: -0.2 },
})

/** Pestañas en forma de píldora para el pie del encabezado (bottomElement). */
export function HeaderPills<T extends string>({ items, value, onChange }: {
  items: { key: T; label: string }[]; value: T; onChange: (k: T) => void
}) {
  return (
    <View style={pills.row}>
      {items.map(i => {
        const on = i.key === value
        return (
          <TouchableOpacity key={i.key} style={[pills.pill, on && pills.on]} onPress={() => onChange(i.key)}
            accessibilityRole="tab" accessibilityState={{ selected: on }}>
            <Text style={[pills.txt, on && pills.txtOn]}>{i.label}</Text>
          </TouchableOpacity>
        )
      })}
    </View>
  )
}

const pills = StyleSheet.create({
  row:   { flexDirection: 'row', marginTop: 12, gap: 6 },
  pill:  { paddingVertical: 5, paddingHorizontal: 16, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.15)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.3)' },
  on:    { backgroundColor: colors.white },
  txt:   { fontFamily: 'Nunito-SemiBold', fontSize: 12, color: 'rgba(255,255,255,0.75)' },
  txtOn: { color: colors.sage, fontFamily: 'Nunito-Bold' },
})

