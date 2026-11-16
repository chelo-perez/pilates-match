// Componentes del panel de administración de la plataforma (super_admin).
// Pensados para la compu (tablas, varias columnas, menú lateral) y que en el celular
// se acomodan solos: las tablas pasan a tarjetas y las grillas a una columna.
import React, { useState } from 'react'
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, useWindowDimensions, StyleProp, ViewStyle } from 'react-native'
import { Feather } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors, spacing } from '../ui'

/** Compu o tablet horizontal: menú lateral y tablas */
export const WIDE = 900
export const useIsWide = () => useWindowDimensions().width >= WIDE

// ── Página ────────────────────────────────────────────────────────
interface PageProps {
  title: string
  subtitle?: string
  actions?: React.ReactNode
  onBack?: () => void
  backLabel?: string
  children: React.ReactNode
  scroll?: boolean
  maxWidth?: number
}
export function AdminPage({ title, subtitle, actions, onBack, backLabel = 'Volver', children, scroll = true, maxWidth = 1200 }: PageProps) {
  const wide = useIsWide()
  const insets = useSafeAreaInsets()
  const pad = wide ? 32 : spacing.md
  const header = (
    <View style={[s.pageHead, { paddingHorizontal: pad, paddingTop: wide ? 28 : insets.top + 14 }, !wide && s.pageHeadNarrow]}>
      <View style={{ width: '100%', maxWidth, alignSelf: 'center' }}>
        {onBack ? (
          <Pressable onPress={onBack} style={s.back} accessibilityRole="button" accessibilityLabel={`Volver a ${backLabel}`} hitSlop={8}>
            <Feather name="chevron-left" size={16} color={wide ? colors.mid : 'rgba(255,255,255,0.8)'} />
            <Text style={[s.backTxt, !wide && { color: 'rgba(255,255,255,0.8)' }]}>{backLabel}</Text>
          </Pressable>
        ) : null}
        <View style={[s.titleRow, !wide && { flexWrap: 'wrap' }]}>
          <View style={{ flex: 1, minWidth: 200 }}>
            <Text style={[s.title, !wide && s.titleNarrow]}>{title}</Text>
            {subtitle ? <Text style={[s.subtitle, !wide && s.subtitleNarrow]}>{subtitle}</Text> : null}
          </View>
          {actions ? <View style={s.actions}>{actions}</View> : null}
        </View>
      </View>
    </View>
  )
  const body = <View style={{ width: '100%', maxWidth, alignSelf: 'center', gap: wide ? 20 : 14 }}>{children}</View>
  return (
    <View style={{ flex: 1, backgroundColor: colors.cream }}>
      {header}
      {scroll ? (
        <ScrollView contentContainerStyle={{ padding: pad, paddingBottom: wide ? 48 : 110 }}>{body}</ScrollView>
      ) : <View style={{ flex: 1, padding: pad }}>{body}</View>}
    </View>
  )
}

// ── Botón de acción de cabecera ───────────────────────────────────
export function ActionButton({ label, icon, onPress, variant = 'primary', disabled, loading }: {
  label: string; icon?: any; onPress: () => void; variant?: 'primary' | 'secondary' | 'danger'; disabled?: boolean; loading?: boolean
}) {
  const v = variant === 'primary' ? { bg: colors.sage, fg: colors.white, bd: colors.sage }
    : variant === 'danger' ? { bg: colors.redBg, fg: colors.redTx, bd: colors.redBorder }
    : { bg: colors.white, fg: colors.sage, bd: colors.border }
  return (
    <Pressable onPress={onPress} disabled={disabled || loading} accessibilityRole="button"
      style={({ hovered, pressed }: any) => [s.btn, { backgroundColor: v.bg, borderColor: v.bd }, (hovered || pressed) && { opacity: 0.85 }, (disabled || loading) && { opacity: 0.5 }]}>
      {icon ? <Feather name={icon} size={15} color={v.fg} /> : null}
      <Text style={[s.btnTxt, { color: v.fg }]}>{loading ? 'Procesando…' : label}</Text>
    </Pressable>
  )
}

// ── Tarjeta / sección ─────────────────────────────────────────────
export function Card({ title, subtitle, action, children, style, pad = true }: {
  title?: string; subtitle?: string; action?: React.ReactNode; children?: React.ReactNode; style?: StyleProp<ViewStyle>; pad?: boolean
}) {
  return (
    <View style={[s.card, style]}>
      {title ? (
        <View style={s.cardHead}>
          <View style={{ flex: 1 }}>
            <Text style={s.cardTitle}>{title}</Text>
            {subtitle ? <Text style={s.cardSub}>{subtitle}</Text> : null}
          </View>
          {action}
        </View>
      ) : null}
      <View style={pad ? { padding: 16, paddingTop: title ? 4 : 16 } : undefined}>{children}</View>
    </View>
  )
}

/** Varias columnas en la compu, una en el celular */
export function Columns({ children, min = 340 }: { children: React.ReactNode; min?: number }) {
  return <View style={s.columns}>{React.Children.map(children, c => c ? <View style={{ flexGrow: 1, flexBasis: min, minWidth: Math.min(min, 280) }}>{c}</View> : null)}</View>
}

// ── Indicadores ───────────────────────────────────────────────────
export type Tone = 'ok' | 'warn' | 'red' | 'info' | 'neutral' | 'brand'
const TONE: Record<Tone, { bg: string; tx: string }> = {
  ok: { bg: colors.okBg, tx: colors.okTx }, warn: { bg: colors.warnBg, tx: colors.warnTx }, red: { bg: colors.redBg, tx: colors.redTx },
  info: { bg: colors.blueBg, tx: colors.blueTx }, neutral: { bg: colors.sageLighter, tx: colors.mid }, brand: { bg: colors.sageLight, tx: colors.sage },
}

export function Kpi({ label, value, hint, icon, tone = 'brand', onPress }: {
  label: string; value: string | number; hint?: string; icon?: any; tone?: Tone; onPress?: () => void
}) {
  const t = TONE[tone]
  const body = (
    <>
      <View style={s.kpiTop}>
        <Text style={s.kpiLabel} numberOfLines={2}>{label}</Text>
        {icon ? <View style={[s.kpiIcon, { backgroundColor: t.bg }]}><Feather name={icon} size={15} color={t.tx} /></View> : null}
      </View>
      <Text style={s.kpiValue} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      {hint ? <Text style={[s.kpiHint, tone === 'warn' || tone === 'red' ? { color: t.tx } : null]} numberOfLines={2}>{hint}</Text> : null}
    </>
  )
  return onPress ? (
    <Pressable onPress={onPress} style={({ hovered }: any) => [s.kpi, hovered && s.hover]} accessibilityRole="button">{body}</Pressable>
  ) : <View style={s.kpi}>{body}</View>
}
export const KpiGrid = ({ children }: { children: React.ReactNode }) => <View style={s.kpiGrid}>{children}</View>

export function Pill({ label, tone = 'neutral' }: { label: string; tone?: Tone }) {
  const t = TONE[tone]
  return <View style={[s.pill, { backgroundColor: t.bg }]}><Text style={[s.pillTxt, { color: t.tx }]} numberOfLines={1}>{label}</Text></View>
}

// ── Tabla ─────────────────────────────────────────────────────────
export interface Column<T> {
  key: string
  label: string
  flex?: number
  width?: number
  align?: 'left' | 'right' | 'center'
  render: (row: T) => React.ReactNode
  /** En el celular, no mostrar esta columna en la tarjeta */
  hideOnNarrow?: boolean
}

export function DataTable<T>({ columns, rows, keyOf, onRowPress, empty = 'No hay datos para mostrar.', title }: {
  columns: Column<T>[]; rows: T[]; keyOf: (r: T) => string; onRowPress?: (r: T) => void; empty?: string; title?: (r: T) => React.ReactNode
}) {
  const wide = useIsWide()
  if (!rows.length) return <Text style={s.empty}>{empty}</Text>
  const cell = (c: Column<T>) => ({ flex: c.width ? undefined : (c.flex ?? 1), width: c.width, alignItems: c.align === 'right' ? 'flex-end' as const : c.align === 'center' ? 'center' as const : 'stretch' as const })

  if (!wide) {
    // Celular: cada fila es una tarjeta con la primera columna como título
    const [first, ...rest] = columns
    return (
      <View style={{ gap: 8 }}>
        {rows.map(r => (
          <Pressable key={keyOf(r)} onPress={onRowPress ? () => onRowPress(r) : undefined} disabled={!onRowPress} style={s.mCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ flex: 1, minWidth: 0 }}>{title ? title(r) : renderCell(first.render(r))}</View>
              {onRowPress ? <Feather name="chevron-right" size={16} color={colors.light} /> : null}
            </View>
            {rest.filter(c => !c.hideOnNarrow).map(c => (
              <View key={c.key} style={s.mRow}>
                <Text style={s.mLabel}>{c.label}</Text>
                <View style={{ flexShrink: 1, alignItems: 'flex-end' }}>{renderCell(c.render(r))}</View>
              </View>
            ))}
          </Pressable>
        ))}
      </View>
    )
  }

  return (
    <View style={s.table}>
      <View style={s.thead}>
        {columns.map(c => <View key={c.key} style={[s.th, cell(c)]}><Text style={s.thTxt}>{c.label}</Text></View>)}
        {onRowPress ? <View style={{ width: 24 }} /> : null}
      </View>
      {rows.map((r, i) => (
        <Pressable key={keyOf(r)} onPress={onRowPress ? () => onRowPress(r) : undefined} disabled={!onRowPress}
          style={({ hovered }: any) => [s.tr, i === rows.length - 1 && { borderBottomWidth: 0 }, hovered && onRowPress && s.trHover]}>
          {columns.map(c => (
            <View key={c.key} style={[s.td, cell(c)]}>
              <View style={{ flexDirection: 'row', justifyContent: c.align === 'right' ? 'flex-end' : c.align === 'center' ? 'center' : 'flex-start' }}>
                <View style={{ flexShrink: 1, minWidth: 0, maxWidth: '100%', alignItems: c.align === 'right' ? 'flex-end' : c.align === 'center' ? 'center' : 'stretch' }}>{renderCell(c.render(r))}</View>
              </View>
            </View>
          ))}
          {onRowPress ? <View style={{ width: 24, alignItems: 'flex-end' }}><Feather name="chevron-right" size={16} color={colors.light} /></View> : null}
        </Pressable>
      ))}
    </View>
  )
}
const renderCell = (v: React.ReactNode) => (typeof v === 'string' || typeof v === 'number') ? <Text style={s.tdTxt} numberOfLines={2}>{v}</Text> : v

/** Texto principal + secundario dentro de una celda */
export function CellTitle({ title, sub, avatar }: { title: string; sub?: string | null; avatar?: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 0, maxWidth: '100%' }}>
      {avatar}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={s.cellTitle} numberOfLines={1}>{title}</Text>
        {sub ? <Text style={s.cellSub} numberOfLines={1}>{sub}</Text> : null}
      </View>
    </View>
  )
}

// ── Filtros ───────────────────────────────────────────────────────
export function Segmented<K extends string>({ items, value, onChange }: { items: { key: K; label: string; count?: number }[]; value: K; onChange: (k: K) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.seg}>
      {items.map(i => {
        const on = i.key === value
        return (
          <Pressable key={i.key} onPress={() => onChange(i.key)} style={({ hovered }: any) => [s.segItem, on && s.segOn, hovered && !on && s.hover]}
            accessibilityRole="tab" accessibilityState={{ selected: on }}>
            <Text style={[s.segTxt, on && s.segTxtOn]}>{i.label}</Text>
            {i.count != null ? <View style={[s.segCount, on && { backgroundColor: 'rgba(255,255,255,0.25)' }]}><Text style={[s.segCountTxt, on && { color: colors.white }]}>{i.count}</Text></View> : null}
          </Pressable>
        )
      })}
    </ScrollView>
  )
}

export function SearchBox({ value, onChange, placeholder = 'Buscar…' }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <View style={s.search}>
      <Feather name="search" size={15} color={colors.light} />
      <TextInput style={s.searchInput} value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={colors.light} autoCorrect={false} />
      {value ? <Pressable onPress={() => onChange('')} hitSlop={8}><Feather name="x" size={15} color={colors.light} /></Pressable> : null}
    </View>
  )
}

export const Toolbar = ({ children }: { children: React.ReactNode }) => <View style={s.toolbar}>{children}</View>

/** Elegir una red (o todas) */
export function NetworkFilter({ networks, value, onChange }: { networks: { id: string; name: string }[]; value: string | null; onChange: (id: string | null) => void }) {
  const [open, setOpen] = useState(false)
  const current = networks.find(n => n.id === value)
  if (networks.length <= 1) return null
  return (
    <View style={{ zIndex: 10 }}>
      <Pressable onPress={() => setOpen(o => !o)} style={s.select}>
        <Feather name="share-2" size={14} color={colors.sage} />
        <Text style={s.selectTxt} numberOfLines={1}>{current ? current.name : 'Todas las redes'}</Text>
        <Feather name={open ? 'chevron-up' : 'chevron-down'} size={14} color={colors.mid} />
      </Pressable>
      {open ? (
        <View style={s.menu}>
          {[{ id: null as any, name: 'Todas las redes' }, ...networks].map(n => (
            <Pressable key={n.id ?? 'all'} onPress={() => { onChange(n.id); setOpen(false) }} style={({ hovered }: any) => [s.menuItem, hovered && s.hover]}>
              <Text style={[s.menuTxt, n.id === value && { fontFamily: 'Nunito-Bold', color: colors.sage }]} numberOfLines={1}>{n.name}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  )
}

/** Mes: ‹ Noviembre 2026 › */
export function MonthPicker({ label, onPrev, onNext, nextDisabled }: { label: string; onPrev: () => void; onNext: () => void; nextDisabled?: boolean }) {
  return (
    <View style={s.month}>
      <Pressable onPress={onPrev} hitSlop={8} style={s.monthBtn} accessibilityLabel="Mes anterior"><Feather name="chevron-left" size={18} color={colors.sage} /></Pressable>
      <Text style={s.monthTxt}>{label}</Text>
      <Pressable onPress={onNext} disabled={nextDisabled} hitSlop={8} style={[s.monthBtn, nextDisabled && { opacity: 0.3 }]} accessibilityLabel="Mes siguiente"><Feather name="chevron-right" size={18} color={colors.sage} /></Pressable>
    </View>
  )
}

/** Fila de "para hacer" del resumen */
export function TodoRow({ icon, tone = 'warn', title, sub, cta, onPress }: { icon: any; tone?: Tone; title: string; sub?: string; cta?: string; onPress?: () => void }) {
  const t = TONE[tone]
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={({ hovered }: any) => [s.todo, hovered && onPress && s.hover]}>
      <View style={[s.todoIcon, { backgroundColor: t.bg }]}><Feather name={icon} size={16} color={t.tx} /></View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={s.todoTitle} numberOfLines={2}>{title}</Text>
        {sub ? <Text style={s.todoSub} numberOfLines={2}>{sub}</Text> : null}
      </View>
      {cta ? <Text style={s.todoCta}>{cta}</Text> : null}
      {onPress ? <Feather name="chevron-right" size={16} color={colors.light} /> : null}
    </Pressable>
  )
}

const s = StyleSheet.create({
  pageHead:      { backgroundColor: colors.cream, paddingBottom: 8 },
  pageHeadNarrow:{ backgroundColor: colors.forest, paddingBottom: 18 },
  back:          { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 8, alignSelf: 'flex-start' },
  backTxt:       { fontFamily: 'Nunito-SemiBold', fontSize: 13, color: colors.mid },
  titleRow:      { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title:         { fontFamily: 'Nunito-Bold', fontSize: 26, color: colors.dark, letterSpacing: -0.3 },
  titleNarrow:   { fontSize: 22, color: colors.white },
  subtitle:      { fontFamily: 'Nunito-Regular', fontSize: 14, color: colors.mid, marginTop: 2 },
  subtitleNarrow:{ color: 'rgba(255,255,255,0.7)', fontSize: 12 },
  actions:       { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  btn:           { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 9, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1 },
  btnTxt:        { fontFamily: 'Nunito-Bold', fontSize: 13 },
  card:          { backgroundColor: colors.white, borderRadius: 14, borderWidth: 1, borderColor: colors.borderLight, overflow: 'visible' },
  cardHead:      { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10 },
  cardTitle:     { fontFamily: 'Nunito-Bold', fontSize: 15, color: colors.dark },
  cardSub:       { fontFamily: 'Nunito-Regular', fontSize: 12, color: colors.mid, marginTop: 1 },
  columns:       { flexDirection: 'row', flexWrap: 'wrap', gap: 20 },
  kpiGrid:       { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  kpi:           { flexGrow: 1, flexBasis: 170, minWidth: 150, backgroundColor: colors.white, borderRadius: 14, borderWidth: 1, borderColor: colors.borderLight, padding: 14, gap: 6 },
  kpiTop:        { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  kpiLabel:      { flex: 1, fontFamily: 'Nunito-SemiBold', fontSize: 12, color: colors.mid },
  kpiIcon:       { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  kpiValue:      { fontFamily: 'Nunito-Bold', fontSize: 24, color: colors.dark },
  kpiHint:       { fontFamily: 'Nunito-Regular', fontSize: 11, color: colors.light },
  hover:         { backgroundColor: colors.sageLighter },
  pill:          { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  pillTxt:       { fontFamily: 'Nunito-Bold', fontSize: 11 },
  table:         { borderRadius: 12, borderWidth: 1, borderColor: colors.borderLight, overflow: 'hidden', backgroundColor: colors.white },
  thead:         { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.sageLighter, paddingHorizontal: 14, paddingVertical: 10, gap: 12 },
  th:            {},
  thTxt:         { fontFamily: 'Nunito-Bold', fontSize: 11, letterSpacing: 0.4, color: colors.mid, textTransform: 'uppercase' },
  tr:            { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 11, gap: 12, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  trHover:       { backgroundColor: colors.sageLighter },
  td:            { minWidth: 0, overflow: 'hidden' },
  tdTxt:         { fontFamily: 'Nunito-Regular', fontSize: 13, color: colors.dark },
  cellTitle:     { fontFamily: 'Nunito-Bold', fontSize: 13, color: colors.dark },
  cellSub:       { fontFamily: 'Nunito-Regular', fontSize: 12, color: colors.mid },
  empty:         { fontFamily: 'Nunito-Regular', fontSize: 13, color: colors.light, paddingVertical: 16, textAlign: 'center' },
  mCard:         { backgroundColor: colors.white, borderRadius: 12, borderWidth: 1, borderColor: colors.borderLight, padding: 12, gap: 6 },
  mRow:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  mLabel:        { fontFamily: 'Nunito-SemiBold', fontSize: 12, color: colors.mid },
  seg:           { flexDirection: 'row', gap: 6, padding: 4, backgroundColor: colors.white, borderRadius: 12, borderWidth: 1, borderColor: colors.borderLight },
  segItem:       { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 7, paddingHorizontal: 12, borderRadius: 9 },
  segOn:         { backgroundColor: colors.sage },
  segTxt:        { fontFamily: 'Nunito-SemiBold', fontSize: 13, color: colors.mid },
  segTxtOn:      { color: colors.white, fontFamily: 'Nunito-Bold' },
  segCount:      { minWidth: 20, paddingHorizontal: 6, height: 20, borderRadius: 10, backgroundColor: colors.sageLighter, alignItems: 'center', justifyContent: 'center' },
  segCountTxt:   { fontFamily: 'Nunito-Bold', fontSize: 11, color: colors.mid },
  search:        { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.white, borderRadius: 10, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, height: 40, flexGrow: 1, flexBasis: 220, minWidth: 180 },
  searchInput:   { flex: 1, fontFamily: 'Nunito-Regular', fontSize: 14, color: colors.dark, outlineStyle: 'none' } as any,
  toolbar:       { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10, zIndex: 10 },
  select:        { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.white, borderRadius: 10, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, height: 40, maxWidth: 280 },
  selectTxt:     { fontFamily: 'Nunito-SemiBold', fontSize: 13, color: colors.dark, flexShrink: 1 },
  menu:          { position: 'absolute', top: 44, left: 0, minWidth: 240, backgroundColor: colors.white, borderRadius: 10, borderWidth: 1, borderColor: colors.border, paddingVertical: 4, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  menuItem:      { paddingVertical: 9, paddingHorizontal: 12 },
  menuTxt:       { fontFamily: 'Nunito-Regular', fontSize: 13, color: colors.dark },
  month:         { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.white, borderRadius: 10, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 6, height: 40 },
  monthBtn:      { width: 30, height: 30, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
  monthTxt:      { fontFamily: 'Nunito-Bold', fontSize: 14, color: colors.dark, minWidth: 150, textAlign: 'center' },
  todo:          { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 8, borderRadius: 10 },
  todoIcon:      { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  todoTitle:     { fontFamily: 'Nunito-Bold', fontSize: 13, color: colors.dark },
  todoSub:       { fontFamily: 'Nunito-Regular', fontSize: 12, color: colors.mid },
  todoCta:       { fontFamily: 'Nunito-Bold', fontSize: 12, color: colors.sage },
})
