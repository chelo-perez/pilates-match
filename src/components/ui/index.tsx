// src/components/ui/index.tsx — Design system PilatesMatch con Nunito

import React from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, TextInput,
} from 'react-native'
import { Feather } from '@expo/vector-icons'

// ── Tokens de marca ───────────────────────────────────────────
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
  border:      '#E2E2DE',
  borderLight: '#EFEFEB',
  gold:        '#B8960C',
  goldLight:   '#FBF6E3',
  // Semánticos
  okBg:        '#E8F5E0',  okTx:   '#2E6B1A',
  warnBg:      '#FEF3DC',  warnTx: '#7A5000',
  redBg:       '#FDECEC',  redTx:  '#8B1F1F',
  blueBg:      '#E8F1FD',  blueTx: '#1A4FA0',
  // Aliases legacy (compatibilidad con pantallas existentes)
  sageMid2:    '#6B7E6F',
  lavender:    '#B0A8D0',
  lavLight:    '#F0EEF8',
  lavDark:     '#5C5490',
  goldLight2:  '#F9F6E5',
  border2:     '#DDDDDD',
  borderLight2:'#EEEEEE',
}

export const spacing = {
  xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 40, xxxl: 48,
}

export const radius = {
  sm: 6, md: 10, lg: 14, xl: 18, full: 9999,
}

// ── Tipografía — Nunito ───────────────────────────────────────
export const typography = {
  h1:      { fontFamily: 'Nunito-Bold',     fontSize: 28, color: colors.dark,  letterSpacing: -0.3, lineHeight: 34 },
  h2:      { fontFamily: 'Nunito-Bold',     fontSize: 22, color: colors.dark,  letterSpacing: -0.2 },
  h3:      { fontFamily: 'Nunito-SemiBold', fontSize: 18, color: colors.dark },
  body:    { fontFamily: 'Nunito-Regular',  fontSize: 14, color: colors.mid,   lineHeight: 22 },
  label:   { fontFamily: 'Nunito-SemiBold', fontSize: 13, color: colors.dark },
  small:   { fontFamily: 'Nunito-Medium',   fontSize: 11, color: colors.light },
  caption: { fontFamily: 'Nunito-Bold',     fontSize: 10, color: colors.light, textTransform: 'uppercase' as const, letterSpacing: 0.8 },
  // Aliases legacy
  heading: { fontFamily: 'Nunito-Bold',     fontSize: 24, color: colors.dark },
  text:    { fontFamily: 'Nunito-Regular',  fontSize: 14, color: colors.dark },
}

export const shadows = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
}

// ── Card ──────────────────────────────────────────────────────
export function Card({ children, style, onPress }: any) {
  const Comp = onPress ? TouchableOpacity : View
  return (
    <Comp
      style={[s.card, style]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      {children}
    </Comp>
  )
}

// ── Button ────────────────────────────────────────────────────
export function Button({ label, onPress, isLoading, fullWidth, size, style, icon, variant }: any) {
  const isSecondary = variant === 'secondary'
  const isDanger    = variant === 'danger'
  return (
    <TouchableOpacity
      style={[
        s.btn,
        fullWidth && { width: '100%' },
        size === 'sm' && s.btnSm,
        size === 'lg' && s.btnLg,
        isSecondary && s.btnSecondary,
        isDanger    && s.btnDanger,
        style,
      ]}
      onPress={onPress}
      disabled={isLoading}
      activeOpacity={0.85}
    >
      {isLoading ? (
        <ActivityIndicator color={isSecondary ? colors.sage : '#fff'} size="small" />
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
          {icon}
          <Text style={[
            s.btnText,
            isSecondary && { color: colors.sage },
            isDanger    && { color: colors.redTx },
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
  success: { bg: colors.okBg,   tx: colors.okTx },
  warning: { bg: colors.warnBg, tx: colors.warnTx },
  danger:  { bg: colors.redBg,  tx: colors.redTx },
  info:    { bg: colors.blueBg, tx: colors.blueTx },
  sage:    { bg: colors.sageLight, tx: colors.sage },
  gold:    { bg: colors.goldLight,  tx: colors.gold },
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
      <Text style={[s.avatarLetter, { fontSize: dim * 0.38 }]}>{letter}</Text>
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

// ── ScoreSlider / TariffMatchPill (stubs) ─────────────────────
export function ScoreSlider() { return null }

export function TariffMatchPill({ status }: { status: string }) {
  const cfg: Record<string, { label: string; bg: string; tx: string }> = {
    ok:        { label: 'Tarifas OK',      bg: colors.okBg,   tx: colors.okTx },
    parcial:   { label: 'Tarifas parcial', bg: colors.warnBg, tx: colors.warnTx },
    sin_match: { label: 'Sin match',       bg: colors.redBg,  tx: colors.redTx },
  }
  const c = cfg[status] ?? cfg.sin_match
  return (
    <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.sm, backgroundColor: c.bg }}>
      <Text style={{ fontFamily: 'Nunito-Bold', fontSize: 10, color: c.tx }}>{c.label}</Text>
    </View>
  )
}

// ── Styles ────────────────────────────────────────────────────
const s = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 0.5,
    borderColor: colors.border,
    padding: spacing.md,
    ...shadows.card,
  },
  btn: {
    height: 48,
    backgroundColor: colors.sage,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  btnSm: { height: 36, borderRadius: radius.sm, paddingHorizontal: spacing.md },
  btnLg: { height: 54, borderRadius: radius.lg },
  btnSecondary: {
    backgroundColor: colors.sageLight,
    borderWidth: 0.5,
    borderColor: colors.sage,
  },
  btnDanger: {
    backgroundColor: colors.redBg,
    borderWidth: 0.5,
    borderColor: '#F5C5C5',
  },
  btnText: {
    fontFamily: 'Nunito-Bold',
    fontSize: 14,
    color: colors.white,
    letterSpacing: 0.1,
  },
  badge: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: radius.sm,
    alignSelf: 'flex-start',
  },
  badgeText: {
    fontFamily: 'Nunito-Bold',
    fontSize: 10,
    letterSpacing: 0.3,
  },
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
  score: {
    backgroundColor: colors.sageLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scoreText: {
    fontFamily: 'Nunito-Bold',
    color: colors.sage,
  },
  inputLabel: {
    fontFamily: 'Nunito-Bold',
    fontSize: 10,
    color: colors.light,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    marginBottom: spacing.xs,
  },
  input: {
    height: 48,
    borderWidth: 0.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.cream,
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
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxxl,
    paddingHorizontal: spacing.xl,
  },
  emptyTitle: {
    fontFamily: 'Nunito-SemiBold',
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
    borderRadius: radius.full,
  },
  emptyActionText: {
    fontFamily: 'Nunito-SemiBold',
    fontSize: 13,
    color: colors.sage,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cream,
  },
})
