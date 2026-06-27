// src/components/ZonasCABA.tsx
import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { colors, spacing, radius } from './ui'

const ZONAS: { nombre: string; barrios: string[] }[] = [
  { nombre: 'Norte', barrios: ['Belgrano','Núñez','Colegiales','Villa Urquiza','Villa Pueyrredón','Agronomía'] },
  { nombre: 'Palermo / Centro-Norte', barrios: ['Palermo','Villa Crespo','Chacarita','Paternal','Villa Ortúzar','Recoleta'] },
  { nombre: 'Oeste', barrios: ['Caballito','Almagro','Flores','Floresta','Monte Castro','Villa Real','Villa Luro','Versalles','Liniers','Mataderos','Villa del Parque','Villa Devoto'] },
  { nombre: 'Centro / Este', barrios: ['Balvanera','San Cristóbal','Montserrat','San Nicolás','Puerto Madero','Retiro'] },
  { nombre: 'Sur', barrios: ['Boedo','Parque Chacabuco','Nueva Pompeya','Parque Patricios','Barracas','La Boca','San Telmo','Villa Lugano'] },
]

const ALL = ZONAS.flatMap(z => z.barrios)

interface Props { selected: string[]; onToggle: (b: string) => void }

export default function ZonasCABA({ selected, onToggle }: Props) {
  const allSelected = ALL.every(b => selected.includes(b))
  return (
    <View>
      <TouchableOpacity
        style={[s.allBtn, allSelected && s.allBtnActive]}
        onPress={() => onToggle(allSelected ? '__clear__' : '__all__')}
      >
        <Text style={[s.allBtnText, allSelected && s.allBtnTextActive]}>
          {allSelected ? '✓ Toda CABA seleccionada' : 'Seleccionar toda CABA'}
        </Text>
      </TouchableOpacity>
      <Text style={s.count}>{selected.length} barrio{selected.length !== 1 ? 's' : ''} seleccionado{selected.length !== 1 ? 's' : ''}</Text>
      {ZONAS.map(zona => {
        const allIn = zona.barrios.every(b => selected.includes(b))
        const someIn = zona.barrios.some(b => selected.includes(b))
        return (
          <View key={zona.nombre} style={s.zonaSection}>
            <TouchableOpacity style={s.zonaHeader} onPress={() => {
              zona.barrios.forEach(b => {
                if (allIn && selected.includes(b)) onToggle(b)
                else if (!allIn && !selected.includes(b)) onToggle(b)
              })
            }}>
              <Text style={s.zonaName}>{zona.nombre}</Text>
              <View style={[s.check, allIn && s.checkActive, someIn && !allIn && s.checkPartial]}>
                <Text style={s.checkText}>{allIn ? '✓' : someIn ? '–' : ''}</Text>
              </View>
            </TouchableOpacity>
            <View style={s.grid}>
              {zona.barrios.map(b => (
                <TouchableOpacity key={b} style={[s.chip, selected.includes(b) && s.chipActive]} onPress={() => onToggle(b)}>
                  <Text style={[s.chipText, selected.includes(b) && s.chipTextActive]}>{b}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )
      })}
    </View>
  )
}

const s = StyleSheet.create({
  allBtn:         { borderWidth: 1.5, borderColor: colors.sage, borderRadius: radius.md, padding: spacing.md, alignItems: 'center', marginBottom: spacing.sm },
  allBtnActive:   { backgroundColor: colors.sage },
  allBtnText:     { fontFamily: 'Nunito-SemiBold', fontSize: 14, color: colors.sage },
  allBtnTextActive:{ color: colors.white },
  count:          { fontFamily: 'Nunito-Regular', fontSize: 12, color: colors.mid, marginBottom: spacing.md, textAlign: 'center' },
  zonaSection:    { marginBottom: spacing.sm, backgroundColor: colors.white, borderRadius: radius.md, overflow: 'hidden', borderWidth: 0.5, borderColor: colors.borderLight },
  zonaHeader:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.md, backgroundColor: colors.cream, borderBottomWidth: 0.5, borderColor: colors.borderLight },
  zonaName:       { fontFamily: 'Nunito-Bold', fontSize: 13, color: colors.dark },
  check:          { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  checkActive:    { backgroundColor: colors.sage, borderColor: colors.sage },
  checkPartial:   { backgroundColor: colors.sageLight, borderColor: colors.sageMid },
  checkText:      { fontFamily: 'Nunito-Bold', fontSize: 11, color: colors.white },
  grid:           { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, padding: spacing.sm },
  chip:           { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999, backgroundColor: colors.cream, borderWidth: 0.5, borderColor: colors.border },
  chipActive:     { backgroundColor: colors.sage, borderColor: colors.sage },
  chipText:       { fontFamily: 'Nunito-Regular', fontSize: 12, color: colors.mid },
  chipTextActive: { color: colors.white, fontFamily: 'Nunito-SemiBold' },
})
