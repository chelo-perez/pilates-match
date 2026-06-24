// src/components/ZonasCABA.tsx
// Mapa visual de barrios de CABA con selección táctil
import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native'
import { colors, spacing, radius } from './ui'

// Agrupados por zona geográfica
const ZONAS: { nombre: string; barrios: string[] }[] = [
  {
    nombre: 'Norte',
    barrios: ['Belgrano', 'Núñez', 'Colegiales', 'Villa Urquiza', 'Villa Pueyrredón', 'Agronomía'],
  },
  {
    nombre: 'Palermo / Centro',
    barrios: ['Palermo', 'Villa Crespo', 'Chacarita', 'Paternal', 'Villa Ortúzar', 'Recoleta'],
  },
  {
    nombre: 'Oeste',
    barrios: ['Caballito', 'Almagro', 'Flores', 'Floresta', 'Monte Castro', 'Villa Real', 'Villa Luro', 'Versalles', 'Liniers', 'Mataderos', 'Villa del Parque', 'Villa Devoto'],
  },
  {
    nombre: 'Centro / Este',
    barrios: ['Balvanera', 'San Cristóbal', 'Montserrat', 'San Nicolás', 'Puerto Madero', 'Retiro'],
  },
  {
    nombre: 'Sur',
    barrios: ['Boedo', 'Parque Chacabuco', 'Nueva Pompeya', 'Parque Patricios', 'Barracas', 'La Boca', 'San Telmo', 'Villa Lugano'],
  },
]

interface Props {
  selected: string[]
  onToggle: (barrio: string) => void
}

export default function ZonasCABA({ selected, onToggle }: Props) {
  const allSelected = ZONAS.every(z => z.barrios.every(b => selected.includes(b)))

  const toggleAll = () => {
    if (allSelected) {
      // Deseleccionar todos
      onToggle('__clear__')
    } else {
      // Seleccionar todos
      onToggle('__all__')
    }
  }

  const toggleZona = (zona: { nombre: string; barrios: string[] }) => {
    const allInZona = zona.barrios.every(b => selected.includes(b))
    zona.barrios.forEach(b => {
      if (allInZona && selected.includes(b)) onToggle(b)
      else if (!allInZona && !selected.includes(b)) onToggle(b)
    })
  }

  return (
    <View>
      {/* Botón "Toda CABA" */}
      <TouchableOpacity
        style={[s.allBtn, allSelected && s.allBtnActive]}
        onPress={toggleAll}
      >
        <Text style={[s.allBtnText, allSelected && s.allBtnTextActive]}>
          {allSelected ? '✓ Toda CABA seleccionada' : 'Seleccionar toda CABA'}
        </Text>
      </TouchableOpacity>

      <Text style={s.count}>
        {selected.length} barrio{selected.length !== 1 ? 's' : ''} seleccionado{selected.length !== 1 ? 's' : ''}
      </Text>

      {/* Zonas */}
      {ZONAS.map(zona => {
        const allInZona = zona.barrios.every(b => selected.includes(b))
        const someInZona = zona.barrios.some(b => selected.includes(b))
        return (
          <View key={zona.nombre} style={s.zonaSection}>
            <TouchableOpacity style={s.zonaHeader} onPress={() => toggleZona(zona)}>
              <Text style={s.zonaName}>{zona.nombre}</Text>
              <View style={[s.zonaCheck, allInZona && s.zonaCheckActive, someInZona && !allInZona && s.zonaCheckPartial]}>
                <Text style={[s.zonaCheckText, (allInZona || someInZona) && s.zonaCheckTextActive]}>
                  {allInZona ? '✓' : someInZona ? '–' : ''}
                </Text>
              </View>
            </TouchableOpacity>
            <View style={s.barriosGrid}>
              {zona.barrios.map(barrio => {
                const isSelected = selected.includes(barrio)
                return (
                  <TouchableOpacity
                    key={barrio}
                    style={[s.barrioChip, isSelected && s.barrioChipActive]}
                    onPress={() => onToggle(barrio)}
                  >
                    <Text style={[s.barrioText, isSelected && s.barrioTextActive]}>
                      {barrio}
                    </Text>
                  </TouchableOpacity>
                )
              })}
            </View>
          </View>
        )
      })}
    </View>
  )
}

const s = StyleSheet.create({
  allBtn:              { borderWidth: 1.5, borderColor: colors.sage, borderRadius: radius.md, padding: spacing.md, alignItems: 'center', marginBottom: spacing.sm },
  allBtnActive:        { backgroundColor: colors.sage },
  allBtnText:          { fontFamily: 'Nunito-SemiBold', fontSize: 14, color: colors.sage },
  allBtnTextActive:    { color: colors.white },
  count:               { fontFamily: 'Nunito-Regular', fontSize: 12, color: colors.mid, marginBottom: spacing.md, textAlign: 'center' },
  zonaSection:         { marginBottom: spacing.md, backgroundColor: colors.white, borderRadius: radius.md, overflow: 'hidden', borderWidth: 0.5, borderColor: colors.borderLight },
  zonaHeader:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.md, backgroundColor: colors.cream, borderBottomWidth: 0.5, borderColor: colors.borderLight },
  zonaName:            { fontFamily: 'Nunito-Bold', fontSize: 13, color: colors.dark },
  zonaCheck:           { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  zonaCheckActive:     { backgroundColor: colors.sage, borderColor: colors.sage },
  zonaCheckPartial:    { backgroundColor: colors.sageLight, borderColor: colors.sageMid },
  zonaCheckText:       { fontFamily: 'Nunito-Bold', fontSize: 11, color: colors.white },
  zonaCheckTextActive: { color: colors.white },
  barriosGrid:         { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, padding: spacing.sm },
  barrioChip:          { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999, backgroundColor: colors.cream, borderWidth: 0.5, borderColor: colors.border },
  barrioChipActive:    { backgroundColor: colors.sage, borderColor: colors.sage },
  barrioText:          { fontFamily: 'Nunito-Regular', fontSize: 12, color: colors.mid },
  barrioTextActive:    { color: colors.white, fontFamily: 'Nunito-SemiBold' },
})
