// src/components/ZonasCABA.tsx
// Elegir barrios de trabajo: buscador, resumen de lo elegido y selección por zona.
import React, { useMemo, useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native'
import { Feather } from '@expo/vector-icons'
import { colors, spacing, radius, typography } from './ui'
import { ZONAS_CABA } from '../constants/barrios'

const ALL = ZONAS_CABA.flatMap(z => z.barrios)
// Ignora mayúsculas y tildes ("nunez" encuentra "Núñez")
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

// onToggle recibe un barrio, '__all__' (toda CABA) o '__clear__' (ninguno)
interface Props { selected: string[]; onToggle: (b: string) => void }

export default function ZonasCABA({ selected, onToggle }: Props) {
  const [query, setQuery] = useState('')
  const allSelected = ALL.every(b => selected.includes(b))
  const q = norm(query.trim())
  const matches = useMemo(() => (q ? ALL.filter(b => norm(b).includes(q)) : []), [q])

  const setZone = (barrios: string[], on: boolean) =>
    barrios.forEach(b => { if (on !== selected.includes(b)) onToggle(b) })

  const Chip = ({ b }: { b: string }) => {
    const on = selected.includes(b)
    return (
      <TouchableOpacity style={[s.chip, on && s.chipActive]} onPress={() => onToggle(b)} accessibilityState={{ selected: on }}>
        {on ? <Feather name="check" size={12} color={colors.white} /> : null}
        <Text style={[s.chipText, on && s.chipTextActive]}>{b}</Text>
      </TouchableOpacity>
    )
  }

  return (
    <View>
      {/* Lo elegido, siempre a la vista */}
      <View style={s.summary}>
        <View style={s.summaryHead}>
          <Text style={s.caption}>
            {selected.length === 0 ? 'TODAVÍA NO ELEGISTE BARRIOS' : allSelected ? 'TRABAJÁS EN TODA CABA' : `TUS BARRIOS (${selected.length})`}
          </Text>
          <TouchableOpacity onPress={() => onToggle(allSelected ? '__clear__' : '__all__')}>
            <Text style={s.link}>{allSelected ? 'Quitar todos' : 'Toda CABA'}</Text>
          </TouchableOpacity>
        </View>
        {selected.length > 0 && !allSelected ? (
          <View style={s.selectedWrap}>
            {[...selected].sort((a, b) => a.localeCompare(b, 'es')).map(b => (
              <TouchableOpacity key={b} style={s.selectedChip} onPress={() => onToggle(b)} accessibilityLabel={`Quitar ${b}`}>
                <Text style={s.selectedTxt}>{b}</Text>
                <Feather name="x" size={12} color={colors.sage} />
              </TouchableOpacity>
            ))}
          </View>
        ) : selected.length === 0 ? (
          <Text style={s.hint}>Elegí los barrios donde podés dar clases. Los estudios de esos barrios te ven primero.</Text>
        ) : null}
      </View>

      {/* Buscador */}
      <View style={s.search}>
        <Feather name="search" size={15} color={colors.light} />
        <TextInput style={s.searchInput} value={query} onChangeText={setQuery}
          placeholder="Buscar barrio..." placeholderTextColor={colors.light} autoCorrect={false} />
        {query ? (
          <TouchableOpacity onPress={() => setQuery('')} hitSlop={10}><Feather name="x" size={15} color={colors.light} /></TouchableOpacity>
        ) : null}
      </View>

      {q ? (
        <View style={s.zone}>
          {matches.length ? <View style={s.grid}>{matches.map(b => <Chip key={b} b={b} />)}</View>
            : <Text style={[s.hint, { padding: spacing.md }]}>No encontramos ese barrio</Text>}
        </View>
      ) : ZONAS_CABA.map(zona => {
        const count = zona.barrios.filter(b => selected.includes(b)).length
        const allIn = count === zona.barrios.length
        return (
          <View key={zona.nombre} style={s.zone}>
            <View style={s.zoneHead}>
              <View>
                <Text style={s.zoneName}>{zona.nombre}</Text>
                <Text style={s.zoneCount}>{count ? `${count} de ${zona.barrios.length}` : `${zona.barrios.length} barrios`}</Text>
              </View>
              <TouchableOpacity style={[s.zoneBtn, allIn && s.zoneBtnOn]} onPress={() => setZone(zona.barrios, !allIn)}>
                <Text style={[s.zoneBtnTxt, allIn && s.zoneBtnTxtOn]}>{allIn ? 'Quitar' : 'Todos'}</Text>
              </TouchableOpacity>
            </View>
            <View style={s.grid}>{zona.barrios.map(b => <Chip key={b} b={b} />)}</View>
          </View>
        )
      })}
    </View>
  )
}

const s = StyleSheet.create({
  summary:       { backgroundColor: colors.white, ...radius.leaf, borderWidth: 0.5, borderColor: colors.borderLight, padding: spacing.md, marginBottom: spacing.md },
  summaryHead:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  caption:       { ...typography.caption },
  link:          { fontFamily: 'Nunito-Bold', fontSize: 13, color: colors.sage },
  hint:          { fontFamily: 'Nunito-Regular', fontSize: 13, color: colors.mid, lineHeight: 19, marginTop: spacing.sm },
  selectedWrap:  { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing.sm },
  selectedChip:  { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingLeft: 10, paddingRight: 8, borderRadius: 999, backgroundColor: colors.sageLight },
  selectedTxt:   { fontFamily: 'Nunito-SemiBold', fontSize: 12, color: colors.sage },
  search:        { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, height: 44, paddingHorizontal: spacing.md, backgroundColor: colors.white, ...radius.leaf, borderWidth: 0.5, borderColor: colors.border, marginBottom: spacing.md },
  searchInput:   { flex: 1, fontFamily: 'Nunito-Regular', fontSize: 14, color: colors.dark },
  zone:          { marginBottom: spacing.sm, backgroundColor: colors.white, ...radius.leaf, borderWidth: 0.5, borderColor: colors.borderLight, overflow: 'hidden' },
  zoneHead:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.xs },
  zoneName:      { fontFamily: 'Nunito-Bold', fontSize: 14, color: colors.dark },
  zoneCount:     { fontFamily: 'Nunito-Regular', fontSize: 12, color: colors.light, marginTop: 1 },
  zoneBtn:       { paddingVertical: 6, paddingHorizontal: 14, ...radius.leafSm, borderWidth: 1, borderColor: colors.sage },
  zoneBtnOn:     { backgroundColor: colors.sageLight, borderColor: colors.sageLight },
  zoneBtnTxt:    { fontFamily: 'Nunito-Bold', fontSize: 12, color: colors.sage },
  zoneBtnTxtOn:  { color: colors.sage },
  grid:          { flexDirection: 'row', flexWrap: 'wrap', gap: 6, padding: spacing.md, paddingTop: spacing.sm },
  chip:          { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 7, paddingHorizontal: 12, borderRadius: 999, backgroundColor: colors.cream, borderWidth: 0.5, borderColor: colors.border },
  chipActive:    { backgroundColor: colors.sage, borderColor: colors.sage },
  chipText:      { fontFamily: 'Nunito-Regular', fontSize: 13, color: colors.mid },
  chipTextActive:{ color: colors.white, fontFamily: 'Nunito-SemiBold' },
})
