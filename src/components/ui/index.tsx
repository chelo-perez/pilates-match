// src/components/ui/index.tsx — Design system de Trabajo Más Fácil (Nunito, verde salvia, formas "hoja")

import React from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, Image,
  ActivityIndicator, TextInput, TextInputProps, StyleProp, ViewStyle, TextStyle,
} from 'react-native'
import { Feather } from '@expo/vector-icons'

// ── Tokens de marca ───────────────────────────────────────────
export const colors = {
  sage:        '#4A5D4E',
  sageMid:     '#6B7E6F',
  sageLight:   '#EAEFEA',
  sageLighter: '#F2F5F2',
  // Verdes oscuros (encabezados, splash, login)
  forest:      '#3D5440',
  forestDark:  '#2D3F31',
  forestDeep:  '#1E2E22',
  mint:        '#D8E2D8',   // bordes suaves de tarjetas
  cream:       '#F9F9F6',
  white:       '#FFFFFF',
  black:       '#000000',
  dark:        '#1A1A1A',
  mid:         '#5C5C5C',
  light:       '#9A9A9A',
  border:      '#E2E2DE',
  borderLight: '#EFEFEB',
  gold:        '#B8960C',
  goldLight:   '#FBF6E3',
  goldBright:  '#FFD060',   // acento sobre fondo oscuro
  // Semánticos
  okBg:        '#E8F5E0',  okTx:   '#2E6B1A',
  warnBg:      '#FEF3DC',  warnTx: '#7A5000',
  redBg:       '#FDECEC',  redTx:  '#8B1F1F',  redBorder: '#F5C5C5',
  blueBg:      '#E8F1FD',  blueTx: '#1A4FA0',
  // Toast (fondo oscuro + ícono)
  toastOkBg:   '#1A2E1C',  toastOkIcon:   '#6FCF7A',
  toastErrBg:  '#2E1A1A',  toastErrIcon:  '#F87171',
  toastWarnBg: '#2E2510',  toastWarnIcon: '#FBBF24',
  overlay:     'rgba(0,0,0,0.6)',
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

/** Forma "hoja" de la marca: esquinas superior-izquierda e inferior-derecha redondeadas. */
const leaf = (r: number) => ({
  borderTopLeftRadius: r, borderTopRightRadius: 0,
  borderBottomLeftRadius: 0, borderBottomRightRadius: r,
})

export const radius = {
  sm: 6, md: 10, lg: 14, xl: 18, full: 9999,
  /** Usar con spread: `{ ...radius.leaf }` */
  leaf: leaf(14),
  leafSm: leaf(10),
  leafLg: leaf(20),
}

// ── Tipografía — Nunito ───────────────────────────────────────
export const typography = {
  h1:      { fontFamily: 'Nunito-Bold',     fontSize: 28, color: colors.dark,  letterSpacing: -0.3, lineHeight: 34 },
  h2:      { fontFamily: 'Nunito-Bold',     fontSize: 22, color: colors.dark,  letterSpacing: -0.2 },
  h3:      { fontFamily: 'Nunito-SemiBold', fontSize: 18, color: colors.dark },
  body:    { fontFamily: 'Nunito-Regular',  fontSize: 14, color: colors.mid,   lineHeight: 22 },
  label:   { fontFamily: 'Nunito-SemiBold', fontSize: 13, color: colors.dark },
  small:   { fontFamily: 'Nunito-Medium',   fontSize: 12, color: colors.light },
  /** Títulos de sección */
  caption: { fontFamily: 'Nunito-Bold',     fontSize: 11, color: colors.light, textTransform: 'uppercase' as const, letterSpacing: 0.8 },
  // Aliases legacy
  heading: { fontFamily: 'Nunito-Bold',     fontSize: 24, color: colors.dark },
  text:    { fontFamily: 'Nunito-Regular',  fontSize: 14, color: colors.dark },
}

export const shadows = {
  card: {
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
}

// ── Card ──────────────────────────────────────────────────────
export function Card({ children, style, onPress }: { children?: React.ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void }) {
  if (onPress) {
    return (
      <TouchableOpacity style={[s.card, style]} onPress={onPress} activeOpacity={0.85}>
        {children}
      </TouchableOpacity>
    )
  }
  return <View style={[s.card, style]}>{children}</View>
}

// ── Button ────────────────────────────────────────────────────
export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'

interface ButtonProps {
  label: string
  onPress?: () => void
  variant?: ButtonVariant
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
  isLoading?: boolean
  fullWidth?: boolean
  icon?: React.ReactNode
  style?: StyleProp<ViewStyle>
}

const BTN_VARIANT: Record<ButtonVariant, { box: ViewStyle; text: TextStyle; spinner: string }> = {
  primary:   { box: { backgroundColor: colors.sage },                                                   text: { color: colors.white }, spinner: colors.white },
  secondary: { box: { backgroundColor: colors.sageLight, borderWidth: 0.5, borderColor: colors.sage },   text: { color: colors.sage },  spinner: colors.sage },
  outline:   { box: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.sage },        text: { color: colors.sage },  spinner: colors.sage },
  ghost:     { box: { backgroundColor: 'transparent' },                                                  text: { color: colors.mid },   spinner: colors.sage },
  danger:    { box: { backgroundColor: colors.redBg, borderWidth: 0.5, borderColor: colors.redBorder },  text: { color: colors.redTx },  spinner: colors.redTx },
}

export function Button({
  label, onPress, variant = 'primary', size = 'md', disabled, isLoading, fullWidth, icon, style,
}: ButtonProps) {
  const v = BTN_VARIANT[variant] ?? BTN_VARIANT.primary
  const off = disabled || isLoading
  return (
    <TouchableOpacity
      style={[
        s.btn,
        size === 'sm' && s.btnSm,
        size === 'lg' && s.btnLg,
        v.box,
        fullWidth && { alignSelf: 'stretch' },
        disabled && !isLoading && s.btnDisabled,
        style,
      ]}
      onPress={onPress}
      disabled={off}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off, busy: !!isLoading }}
    >
      {isLoading ? (
        <ActivityIndicator color={v.spinner} size="small" />
      ) : (
        <View style={s.btnRow}>
          {icon}
          <Text style={[s.btnText, size === 'sm' && s.btnTextSm, v.text]}>{label}</Text>
        </View>
      )}
    </TouchableOpacity>
  )
}

// ── Chip (selección de opciones, p. ej. barrios) ─────────────
export function Chip({ label, selected, onPress, style }: { label: string; selected?: boolean; onPress?: () => void; style?: StyleProp<ViewStyle> }) {
  return (
    <TouchableOpacity
      style={[s.chip, selected && s.chipActive, style]}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
    >
      <Text style={[s.chipText, selected && s.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  )
}

// ── Badge ─────────────────────────────────────────────────────
export type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral'

const BADGE: Record<string, { bg: string; tx: string }> = {
  success: { bg: colors.okBg,   tx: colors.okTx },
  warning: { bg: colors.warnBg, tx: colors.warnTx },
  danger:  { bg: colors.redBg,  tx: colors.redTx },
  info:    { bg: colors.blueBg, tx: colors.blueTx },
  neutral: { bg: colors.borderLight, tx: colors.mid },
  // aliases
  default: { bg: colors.borderLight, tx: colors.mid },
  sage:    { bg: colors.sageLight, tx: colors.sage },
  gold:    { bg: colors.goldLight,  tx: colors.gold },
}

export function Badge({ label, variant, color, style }: { label: string; variant?: BadgeVariant | string; color?: BadgeVariant | string; style?: StyleProp<ViewStyle> }) {
  const c = BADGE[variant ?? color ?? 'neutral'] ?? BADGE.neutral
  return (
    <View style={[s.badge, { backgroundColor: c.bg }, style]}>
      <Text style={[s.badgeText, { color: c.tx }]}>{label}</Text>
    </View>
  )
}

// ── Avatar ────────────────────────────────────────────────────
interface AvatarProps {
  name?: string | null
  size?: number | 'sm' | 'md' | 'lg'
  /** Ignorado: el avatar usa siempre los colores de la marca */
  color?: string
  source?: string | null
  /** @deprecated usar `source` */
  imageUrl?: string | null
  /** @deprecated usar `source` */
  src?: string | null
  /** @deprecated usar `name` */
  fallback?: string | null
}

export function Avatar({ name, size = 44, source, imageUrl, src, fallback }: AvatarProps) {
  const dim = typeof size === 'number' ? size : size === 'sm' ? 32 : size === 'lg' ? 64 : 44
  const uri = source ?? imageUrl ?? src ?? null
  const letter = ((name ?? fallback ?? '').trim()[0] ?? '?').toUpperCase()
  const box = { width: dim, height: dim, borderRadius: dim / 2 }
  if (uri) {
    return <Image source={{ uri }} style={[s.avatar, box]} accessibilityIgnoresInvertColors />
  }
  return (
    <View style={[s.avatar, box]}>
      <Text style={[s.avatarLetter, { fontSize: dim * 0.38 }]}>{letter}</Text>
    </View>
  )
}

// ── ScoreDisplay ──────────────────────────────────────────────
export function ScoreDisplay({ score, size = 'md' }: { score?: number | string | null; size?: 'sm' | 'md' | 'lg' }) {
  const dim = size === 'lg' ? 52 : size === 'sm' ? 30 : 42
  const fs  = size === 'lg' ? 18 : size === 'sm' ? 11 : 14
  const n = score === null || score === undefined || score === '' ? NaN : Number(score)
  return (
    <View style={[s.score, { width: dim, height: dim, borderRadius: dim / 2 }]}>
      <Text style={[s.scoreText, { fontSize: fs }]}>
        {Number.isFinite(n) && n > 0 ? n.toFixed(1) : '—'}
      </Text>
    </View>
  )
}

// ── Input ─────────────────────────────────────────────────────
interface InputProps extends Omit<TextInputProps, 'style'> {
  label?: string
  error?: string
  /** Estilo del TextInput */
  style?: StyleProp<TextStyle>
  /** Estilo del contenedor (label + input + error): usar para flex/márgenes */
  containerStyle?: StyleProp<ViewStyle>
}

export function Input({
  label, error, multiline, editable = true, style, containerStyle,
  keyboardType, secureTextEntry, autoCapitalize, autoCorrect, ...rest
}: InputProps) {
  const isEmail = keyboardType === 'email-address'
  return (
    <View style={[{ marginBottom: spacing.md }, containerStyle]}>
      {label ? <Text style={s.inputLabel}>{label}</Text> : null}
      <TextInput
        {...rest}
        style={[
          s.input,
          multiline && { height: 88, textAlignVertical: 'top', paddingTop: spacing.sm },
          !!error && { borderColor: colors.redTx },
          !editable && { opacity: 0.55 },
          style,
        ]}
        placeholderTextColor={colors.light}
        keyboardType={keyboardType}
        secureTextEntry={secureTextEntry}
        autoCapitalize={autoCapitalize ?? (secureTextEntry || isEmail ? 'none' : 'sentences')}
        autoCorrect={autoCorrect ?? !(secureTextEntry || isEmail)}
        multiline={multiline}
        editable={editable}
      />
      {error ? <Text style={s.inputError}>{error}</Text> : null}
    </View>
  )
}

// ── EmptyState ────────────────────────────────────────────────
interface EmptyStateProps {
  icon?: React.ComponentProps<typeof Feather>['name'] | string
  title?: string
  message?: string
  /** @deprecated usar `message` */
  subtitle?: string
  action?: string
  onAction?: () => void
  style?: StyleProp<ViewStyle>
}

export function EmptyState({ icon, title, subtitle, message, action, onAction, style }: EmptyStateProps) {
  const displayTitle = title ?? message
  const sub = title ? (message ?? subtitle) : subtitle
  return (
    <View style={[s.empty, style]}>
      {icon ? (
        <Feather name={icon as any} size={38} color={colors.mint} style={{ marginBottom: spacing.md }} />
      ) : null}
      {displayTitle ? <Text style={s.emptyTitle}>{displayTitle}</Text> : null}
      {sub ? <Text style={s.emptySub}>{sub}</Text> : null}
      {action && onAction ? (
        <Button label={action} onPress={onAction} variant="secondary" size="sm" style={{ marginTop: spacing.md }} />
      ) : null}
    </View>
  )
}

// ── ErrorState ────────────────────────────────────────────────
export function ErrorState({
  message = 'No pudimos cargar la información.', onRetry, retryLabel = 'Reintentar', style,
}: { message?: string; onRetry?: () => void; retryLabel?: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[s.empty, { backgroundColor: colors.cream }, style]}>
      <Feather name="wifi-off" size={36} color={colors.sageMid} style={{ marginBottom: spacing.md }} />
      <Text style={s.emptyTitle}>{message}</Text>
      <Text style={s.emptySub}>Revisá tu conexión y probá de nuevo.</Text>
      {onRetry ? (
        <Button label={retryLabel} onPress={onRetry} variant="secondary" size="sm" style={{ marginTop: spacing.md }} />
      ) : null}
    </View>
  )
}

// ── LoadingScreen ─────────────────────────────────────────────
export function LoadingScreen({ message }: { message?: string }) {
  return (
    <View style={s.loadingWrap}>
      <ActivityIndicator size="large" color={colors.sage} />
      {message ? <Text style={[s.emptySub, { marginTop: spacing.md }]}>{message}</Text> : null}
    </View>
  )
}

// ── TariffMatchPill ───────────────────────────────────────────
export function TariffMatchPill({ status }: { status: string }) {
  const cfg: Record<string, { label: string; bg: string; tx: string }> = {
    ok:        { label: 'Tarifa dentro de tu presupuesto', bg: colors.okBg,   tx: colors.okTx },
    parcial:   { label: 'Tarifa parcialmente dentro',      bg: colors.warnBg, tx: colors.warnTx },
    sin_match: { label: 'Tarifa fuera de tu presupuesto',  bg: colors.redBg,  tx: colors.redTx },
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
    ...radius.leafLg,
    borderWidth: 0.5,
    borderColor: colors.mint,
    padding: spacing.md,
    ...shadows.card,
  },
  btn: {
    minHeight: 48,
    backgroundColor: colors.sage,
    ...radius.leaf,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  btnSm:       { minHeight: 36, ...radius.leafSm, paddingHorizontal: spacing.md },
  btnLg:       { minHeight: 54 },
  btnDisabled: { opacity: 0.5 },
  btnRow:      { flexDirection: 'row', alignItems: 'center', gap: 7 },
  btnText: {
    fontFamily: 'Nunito-Bold',
    fontSize: 15,
    color: colors.white,
    letterSpacing: 0.1,
  },
  btnTextSm: { fontSize: 13 },
  chip: {
    paddingVertical: 7, paddingHorizontal: 14,
    borderRadius: radius.full, backgroundColor: colors.white,
    borderWidth: 0.5, borderColor: colors.border,
  },
  chipActive:     { backgroundColor: colors.sage, borderColor: colors.sage },
  chipText:       { fontFamily: 'Nunito-Medium', fontSize: 13, color: colors.mid },
  chipTextActive: { fontFamily: 'Nunito-SemiBold', color: colors.white },
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
    ...typography.caption,
    marginBottom: spacing.xs,
  },
  input: {
    height: 48,
    borderWidth: 0.5,
    borderColor: colors.border,
    ...radius.leafSm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.sageLighter,
    fontFamily: 'Nunito-Regular',
    fontSize: 14,
    color: colors.dark,
  },
  inputError: {
    fontFamily: 'Nunito-Regular',
    fontSize: 12,
    color: colors.redTx,
    marginTop: 3,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
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
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cream,
  },
})
