// src/components/ui/index.tsx — Design system PilatesMatch · Variante B
// Diagonal: top-left + bottom-right curvos · top-right + bottom-left rectos

import React, { useEffect, useRef } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, TextInput, Animated, Easing,
} from 'react-native'
import { Feather } from '@expo/vector-icons'

// ── Tokens de color ────────────────────────────────────────────
export const colors = {
  sage:        '#4A5D4E',
  sageMid:     '#6B7E6F',
  sageLight:   '#EAEFEA',
  sageLighter: '#F2F5F2',
  cream:       '#F9F9F6',
  white:       '#FFFFFF',
  dark:        '#1A1A1A',
  mid:         '#5C5C5C',
  light:       '#9A9A9A',
  border:      '#D8E2D8',
  borderLight: '#EAEFEA',
  gold:        '#B8960C',
  goldLight:   '#FBF6E3',
  // Semánticos
  okBg:        '#E8F5E0',  okTx:   '#2E6B1A',
  warnBg:      '#FEF3DC',  warnTx: '#7A5000',
  redBg:       '#FDECEC',  redTx:  '#8B1F1F',
  blueBg:      '#E8F1FD',  blueTx: '#1A4FA0',
  // Aliases legacy
  sageMid2:    '#6B7E6F',
  lavender:    '#B0A8D0',
  lavLight:    '#F0EEF8',
  lavDark:     '#5C5490',
  goldLight2:  '#F9F6E5',
  border2:     '#D8E2D8',
  borderLight2:'#EAEFEA',
}

export const spacing = {
  xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 40, xxxl: 48,
}

// ── Radius variante B: top-left + bottom-right curvos ─────────
export const radius = {
  sm:   { borderTopLeftRadius: 8,  borderTopRightRadius: 0, borderBottomLeftRadius: 0,  borderBottomRightRadius: 8  },
  md:   { borderTopLeftRadius: 14, borderTopRightRadius: 0, borderBottomLeftRadius: 0,  borderBottomRightRadius: 14 },
  lg:   { borderTopLeftRadius: 20, borderTopRightRadius: 0, borderBottomLeftRadius: 0,  borderBottomRightRadius: 20 },
  xl:   { borderTopLeftRadius: 26, borderTopRightRadius: 0, borderBottomLeftRadius: 0,  borderBottomRightRadius: 26 },
  full: { borderRadius: 9999 },
  // Valores planos para casos que siguen necesitando un número
  smN:  8,
  mdN:  14,
  lgN:  20,
  xlN:  26,
}

// ── Tipografía — Nunito ────────────────────────────────────────
export const typography = {
  h1:      { fontFamily: 'Nunito-Bold',     fontSize: 26, color: colors.dark,  letterSpacing: -0.4, lineHeight: 32 },
  h2:      { fontFamily: 'Nunito-Bold',     fontSize: 20, color: colors.dark,  letterSpacing: -0.2 },
  h3:      { fontFamily: 'Nunito-Bold',     fontSize: 16, color: colors.dark },
  body:    { fontFamily: 'Nunito-Regular',  fontSize: 14, color: colors.mid,   lineHeight: 22 },
  label:   { fontFamily: 'Nunito-Bold',     fontSize: 10, color: colors.light, textTransform: 'uppercase' as const, letterSpacing: 0.7 },
  small:   { fontFamily: 'Nunito-SemiBold', fontSize: 11, color: colors.light },
  caption: { fontFamily: 'Nunito-Bold',     fontSize: 9,  color: colors.light, textTransform: 'uppercase' as const, letterSpacing: 0.8 },
  // Aliases legacy
  heading: { fontFamily: 'Nunito-Bold',     fontSize: 24, color: colors.dark },
  text:    { fontFamily: 'Nunito-Regular',  fontSize: 14, color: colors.dark },
}

export const shadows = {
  card: {
    shadowColor: '#2D3F31',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
  },
}

// ── BlobCard — card con luz cenital animada ────────────────────
interface BlobCardProps {
  children: React.ReactNode
  style?: any
  onPress?: () => void
  blobColor?: string   // color base del blob principal (rgba)
  blobColor2?: string  // color base del blob secundario
  size?: 'sm' | 'md' | 'lg'
}

export function BlobCard({
  children, style, onPress,
  blobColor  = 'rgba(74,93,78,',
  blobColor2 = 'rgba(74,93,78,',
  size = 'md',
}: BlobCardProps) {
  const anim1 = useRef(new Animated.Value(0)).current
  const anim2 = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim1, { toValue: 1, duration: 7000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(anim1, { toValue: 0, duration: 7000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    ).start()
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim2, { toValue: 1, duration: 10000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(anim2, { toValue: 0, duration: 10000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    ).start()
  }, [])

  const r = size === 'sm' ? radius.sm : size === 'lg' ? radius.lg : radius.md
  const Comp = onPress ? TouchableOpacity : View

  // Blob 1: orbita de esquina top-left a bottom-right
  const b1x = anim1.interpolate({ inputRange: [0, 1], outputRange: [-20, 110] })
  const b1y = anim1.interpolate({ inputRange: [0, 1], outputRange: [-20, 80] })
  // Blob 2: dirección opuesta, desde bottom-right
  const b2x = anim2.interpolate({ inputRange: [0, 1], outputRange: [80, -30] })
  const b2y = anim2.interpolate({ inputRange: [0, 1], outputRange: [60, -20] })

  return (
    <Comp
      style={[s.blobCard, r, style]}
      onPress={onPress}
      activeOpacity={0.88}
    >
      {/* Blob principal */}
      <Animated.View
        style={[
          s.blob,
          s.blobMain,
          {
            backgroundColor: blobColor + '0.18)',
            transform: [{ translateX: b1x }, { translateY: b1y }],
          },
        ]}
      />
      {/* Blob secundario */}
      <Animated.View
        style={[
          s.blob,
          s.blobSec,
          {
            backgroundColor: blobColor2 + '0.12)',
            transform: [{ translateX: b2x }, { translateY: b2y }],
          },
        ]}
      />
      <View style={s.blobContent}>{children}</View>
    </Comp>
  )
}

// ── Card (sin blob, legacy) ────────────────────────────────────
export function Card({ children, style, onPress }: any) {
  const Comp = onPress ? TouchableOpacity : View
  return (
    <Comp style={[s.card, style]} onPress={onPress} activeOpacity={0.88}>
      {children}
    </Comp>
  )
}

// ── Button ────────────────────────────────────────────────────
export function Button({ label, onPress, isLoading, fullWidth, size, style, icon, variant }: any) {
  const isSecondary = variant === 'secondary'
  const isDanger    = variant === 'danger'
  const isGhost     = variant === 'ghost'
  return (
    <TouchableOpacity
      style={[
        s.btn,
        fullWidth && { width: '100%' },
        size === 'sm' && s.btnSm,
        size === 'lg' && s.btnLg,
        isSecondary && s.btnSecondary,
        isDanger    && s.btnDanger,
        isGhost     && s.btnGhost,
        style,
      ]}
      onPress={onPress}
      disabled={isLoading}
      activeOpacity={0.85}
    >
      {isLoading ? (
        <ActivityIndicator color={isSecondary || isGhost ? colors.sage : '#fff'} size="small" />
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
          {icon}
          <Text style={[
            s.btnText,
            isSecondary && { color: colors.sage },
            isDanger    && { color: colors.redTx },
            isGhost     && { color: colors.mid },
          ]}>
            {label}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  )
}

// ── Badge ─────────────────────────────────────────────────────
const BADGE: Record<string, { bg: string; tx: string }> = {
  success: { bg: colors.okBg,    tx: colors.okTx },
  warning: { bg: colors.warnBg,  tx: colors.warnTx },
  danger:  { bg: colors.redBg,   tx: colors.redTx },
  info:    { bg: colors.blueBg,  tx: colors.blueTx },
  sage:    { bg: colors.sageLight, tx: colors.sage },
  gold:    { bg: colors.goldLight, tx: colors.gold },
  default: { bg: colors.borderLight, tx: colors.mid },
}

export function Badge({ label, variant = 'default' }: any) {
  const c = BADGE[variant] ?? BADGE.default
  return (
    <View style={[s.badge, { backgroundColor: c.bg }]}>
      <Text style={[s.badgeText, { color: c.tx }]}>{label}</Text>
    </View>
  )
}

// ── Avatar ────────────────────────────────────────────────────
export function Avatar({ source, name, size = 44 }: any) {
  const dim    = typeof size === 'number' ? size : 44
  const letter = (name ?? '?')[0]?.toUpperCase() ?? '?'
  return (
    <View style={[s.avatar, { width: dim, height: dim, borderRadius: dim / 2 }]}>
      {source
        ? null /* Image component iría acá con fallback */
        : <Text style={[s.avatarLetter, { fontSize: dim * 0.38 }]}>{letter}</Text>
      }
    </View>
  )
}

// ── ScoreDisplay ──────────────────────────────────────────────
export function ScoreDisplay({ score, size = 'md' }: any) {
  const dim = size === 'lg' ? 52 : size === 'sm' ? 30 : 42
  const fs  = size === 'lg' ? 18 : size === 'sm' ? 11 : 14
  return (
    <View style={[s.score, { width: dim, height: dim, borderRadius: dim / 2 }]}>
      <Text style={[s.scoreText, { fontSize: fs }]}>
        {score ? Number(score).toFixed(1) : '—'}
      </Text>
    </View>
  )
}

// ── Input ─────────────────────────────────────────────────────
export function Input({
  label, placeholder, value, onChangeText,
  secureTextEntry, keyboardType, autoCapitalize,
  error, multiline, numberOfLines, editable = true, style,
}: any) {
  return (
    <View style={{ marginBottom: spacing.md }}>
      {label ? <Text style={s.inputLabel}>{label}</Text> : null}
      <TextInput
        style={[
          s.input,
          multiline && { height: 88, textAlignVertical: 'top', paddingTop: spacing.sm },
          error    && { borderColor: colors.redTx },
          !editable && { opacity: 0.55 },
          style,
        ]}
        placeholder={placeholder}
        placeholderTextColor={colors.light}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize ?? (secureTextEntry ? 'none' : 'sentences')}
        multiline={multiline}
        numberOfLines={numberOfLines}
        editable={editable}
      />
      {error ? <Text style={s.inputError}>{error}</Text> : null}
    </View>
  )
}

// ── EmptyState ────────────────────────────────────────────────
export function EmptyState({ icon, title, subtitle, message, action, onAction, style }: any) {
  const displayTitle = title ?? message
  return (
    <View style={[s.empty, style]}>
      {icon ? (
        <Feather name={icon} size={38} color={colors.border} style={{ marginBottom: spacing.md }} />
      ) : null}
      <Text style={s.emptyTitle}>{displayTitle}</Text>
      {subtitle ? <Text style={s.emptySub}>{subtitle}</Text> : null}
      {action && onAction ? (
        <TouchableOpacity style={s.emptyAction} onPress={onAction}>
          <Text style={s.emptyActionText}>{action}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  )
}

// ── LoadingScreen ─────────────────────────────────────────────
export function LoadingScreen({ message }: any) {
  return (
    <View style={s.loadingWrap}>
      <ActivityIndicator size="large" color={colors.sage} />
      {message ? <Text style={[s.emptySub, { marginTop: spacing.md }]}>{message}</Text> : null}
    </View>
  )
}

// ── Stubs ─────────────────────────────────────────────────────
export function ScoreSlider() { return null }

export function TariffMatchPill({ status }: { status: string }) {
  const cfg: Record<string, { label: string; bg: string; tx: string }> = {
    ok:        { label: 'Match',         bg: colors.okBg,   tx: colors.okTx },
    parcial:   { label: 'Match parcial', bg: colors.warnBg, tx: colors.warnTx },
    sin_match: { label: 'Sin match',     bg: colors.redBg,  tx: colors.redTx },
  }
  const c = cfg[status] ?? cfg.sin_match
  return (
    <View style={[s.tariffPill, { backgroundColor: c.bg }]}>
      <Text style={[s.tariffPillText, { color: c.tx }]}>{c.label}</Text>
    </View>
  )
}

// ── Styles ────────────────────────────────────────────────────
const s = StyleSheet.create({
  // BlobCard
  blobCard: {
    backgroundColor: colors.white,
    borderWidth: 0.5,
    borderColor: colors.border,
    padding: spacing.md,
    overflow: 'hidden',
    ...shadows.card,
  },
  blob: {
    position: 'absolute',
    borderRadius: 9999,
  },
  blobMain: { width: 130, height: 130, top: -35, left: -30 },
  blobSec:  { width: 90,  height: 90,  bottom: -25, right: -20 },
  blobContent: { position: 'relative', zIndex: 1 },

  // Card legacy
  card: {
    backgroundColor: colors.white,
    ...radius.md,
    borderWidth: 0.5,
    borderColor: colors.border,
    padding: spacing.md,
    ...shadows.card,
  },

  // Button
  btn: {
    height: 48,
    backgroundColor: colors.sage,
    ...radius.md,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  btnSm:        { height: 36, ...radius.sm, paddingHorizontal: spacing.md },
  btnLg:        { height: 54, ...radius.lg },
  btnSecondary: { backgroundColor: colors.sageLight, borderWidth: 0.5, borderColor: colors.sage },
  btnDanger:    { backgroundColor: colors.redBg, borderWidth: 0.5, borderColor: '#F5C5C5' },
  btnGhost:     { backgroundColor: colors.sageLighter, borderWidth: 0.5, borderColor: colors.border },
  btnText: {
    fontFamily: 'Nunito-Bold',
    fontSize: 14,
    color: colors.white,
    letterSpacing: 0.1,
  },

  // Badge
  badge: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    ...radius.sm,
    alignSelf: 'flex-start',
  },
  badgeText: {
    fontFamily: 'Nunito-Bold',
    fontSize: 10,
    letterSpacing: 0.3,
  },

  // Avatar
  avatar: {
    backgroundColor: colors.sageLight,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: colors.border,
  },
  avatarLetter: {
    fontFamily: 'Nunito-Bold',
    color: colors.sage,
  },

  // Score
  score: {
    backgroundColor: colors.sageLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scoreText: {
    fontFamily: 'Nunito-Bold',
    color: colors.sage,
  },

  // Input
  inputLabel: {
    fontFamily: 'Nunito-Bold',
    fontSize: 9,
    color: colors.light,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    marginBottom: spacing.xs,
  },
  input: {
    height: 48,
    borderWidth: 0.5,
    borderColor: colors.border,
    ...radius.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.white,
    fontFamily: 'Nunito-Regular',
    fontSize: 14,
    color: colors.dark,
  },
  inputError: {
    fontFamily: 'Nunito-Regular',
    fontSize: 11,
    color: colors.redTx,
    marginTop: 3,
  },

  // EmptyState
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.xl,
  },
  emptyTitle: {
    fontFamily: 'Nunito-Bold',
    fontSize: 15,
    color: colors.mid,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  emptySub: {
    fontFamily: 'Nunito-Regular',
    fontSize: 13,
    color: colors.light,
    textAlign: 'center',
    lineHeight: 18,
  },
  emptyAction: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.sageLight,
    ...radius.full,
  },
  emptyActionText: {
    fontFamily: 'Nunito-SemiBold',
    fontSize: 13,
    color: colors.sage,
  },

  // Loading
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cream,
  },

  // TariffMatchPill
  tariffPill: {
    ...radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  tariffPillText: {
    fontFamily: 'Nunito-Bold',
    fontSize: 10,
  },
})
