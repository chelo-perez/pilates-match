// Selector de barrio: un campo que abre una lista con buscador.
// Reemplaza las grillas de 48 chips que ocupaban toda la pantalla en el registro.
import React, { useMemo, useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, Modal, FlatList, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Feather } from '@expo/vector-icons'
import { BARRIOS_CABA } from '../constants/barrios'
import { colors, spacing, radius, typography } from './ui'

interface Props {
  value: string
  onChange: (barrio: string) => void
  label?: string
  placeholder?: string
  error?: string
}

// Ignora mayúsculas y tildes al buscar ("nunez" encuentra "Núñez")
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export default function BarrioSelect({ value, onChange, label = 'BARRIO', placeholder = 'Elegí el barrio', error }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const insets = useSafeAreaInsets()
  const items = useMemo(() => {
    const q = norm(query.trim())
    return q ? BARRIOS_CABA.filter(b => norm(b).includes(q)) : BARRIOS_CABA
  }, [query])

  const close = () => { setOpen(false); setQuery('') }

  return (
    <View style={s.wrap}>
      {label ? <Text style={s.label}>{label}</Text> : null}
      <TouchableOpacity style={[s.field, !!error && s.fieldError]} onPress={() => setOpen(true)} accessibilityRole="button">
        <Feather name="map-pin" size={15} color={value ? colors.sage : colors.light} />
        <Text style={[s.value, !value && s.placeholder]} numberOfLines={1}>{value || placeholder}</Text>
        <Feather name="chevron-down" size={16} color={colors.light} />
      </TouchableOpacity>
      {error ? <Text style={s.error}>{error}</Text> : null}

      <Modal visible={open} animationType="slide" transparent onRequestClose={close}>
        <View style={s.overlay}>
          <View style={[s.sheet, { paddingBottom: insets.bottom + spacing.md }]}>
            <View style={s.header}>
              <Text style={s.title}>Elegí el barrio</Text>
              <TouchableOpacity onPress={close} hitSlop={12} accessibilityLabel="Cerrar">
                <Feather name="x" size={22} color={colors.mid} />
              </TouchableOpacity>
            </View>
            <View style={s.search}>
              <Feather name="search" size={15} color={colors.light} />
              <TextInput
                style={s.searchInput} value={query} onChangeText={setQuery}
                placeholder="Buscar barrio..." placeholderTextColor={colors.light}
                autoCorrect={false} autoCapitalize="none"
              />
            </View>
            <FlatList
              data={items} keyExtractor={i => i} keyboardShouldPersistTaps="handled"
              ListEmptyComponent={<Text style={s.empty}>No encontramos ese barrio</Text>}
              renderItem={({ item }) => {
                const selected = item === value
                return (
                  <TouchableOpacity style={[s.item, selected && s.itemActive]} onPress={() => { onChange(item); close() }}>
                    <Text style={[s.itemText, selected && s.itemTextActive]}>{item}</Text>
                    {selected ? <Feather name="check" size={16} color={colors.sage} /> : null}
                  </TouchableOpacity>
                )
              }}
            />
          </View>
        </View>
      </Modal>
    </View>
  )
}

const s = StyleSheet.create({
  wrap:          { marginBottom: spacing.md },
  label:         { ...typography.caption, color: colors.light, marginBottom: 6 },
  field:         { flexDirection: 'row', alignItems: 'center', gap: 10, height: 50, paddingHorizontal: spacing.md, backgroundColor: colors.white, borderWidth: 0.5, borderColor: colors.border, ...radius.leaf },
  fieldError:    { borderColor: colors.redTx },
  value:         { flex: 1, fontFamily: 'Nunito-Regular', fontSize: 15, color: colors.dark },
  placeholder:   { color: colors.light },
  error:         { fontFamily: 'Nunito-Regular', fontSize: 12, color: colors.redTx, marginTop: 4 },
  overlay:       { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  sheet:         { maxHeight: '80%', backgroundColor: colors.cream, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  header:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  title:         { fontFamily: 'Nunito-Bold', fontSize: 18, color: colors.dark },
  search:        { flexDirection: 'row', alignItems: 'center', gap: 8, height: 44, paddingHorizontal: spacing.md, backgroundColor: colors.white, borderWidth: 0.5, borderColor: colors.border, ...radius.leaf, marginBottom: spacing.sm },
  searchInput:   { flex: 1, fontFamily: 'Nunito-Regular', fontSize: 14, color: colors.dark },
  item:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, paddingHorizontal: spacing.sm, borderBottomWidth: 0.5, borderBottomColor: colors.border },
  itemActive:    { backgroundColor: colors.sageLighter },
  itemText:      { fontFamily: 'Nunito-Regular', fontSize: 15, color: colors.dark },
  itemTextActive:{ fontFamily: 'Nunito-SemiBold', color: colors.sage },
  empty:         { fontFamily: 'Nunito-Regular', fontSize: 14, color: colors.light, textAlign: 'center', paddingVertical: spacing.lg },
})
