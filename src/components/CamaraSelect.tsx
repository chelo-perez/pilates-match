// Registro: ¿a qué red se suma? (Estudio de Pilates, Gimnasio...). Cada opción es una Cámara activa.
// Si hay una sola Cámara no se muestra nada: la base asigna la principal.
import React, { useEffect } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { Feather } from '@expo/vector-icons'
import { supabase } from '../lib/supabase'
import { colors, spacing, radius, typography } from './ui'

export interface CamaraOption { id: string; name: string; business_label: string; instructor_label: string }

export const useActiveCamaras = () =>
  useQuery({
    queryKey: ['active-camaras'],
    queryFn: async (): Promise<CamaraOption[]> => {
      const { data, error } = await supabase.from('camaras')
        .select('id, name, business_label, instructor_label').eq('is_active', true).order('created_at')
      if (error) return [] // base sin sectores todavía
      return (data ?? []) as CamaraOption[]
    },
    staleTime: 5 * 60_000,
  })

interface Props { value: string | null; onChange: (id: string) => void; kind: 'estudio' | 'instructor'; label?: string }

export default function CamaraSelect({ value, onChange, kind, label }: Props) {
  const { data: camaras = [] } = useActiveCamaras()
  // Preselecciona la primera para que nunca quede vacío
  useEffect(() => { if (!value && camaras.length) onChange(camaras[0].id) }, [camaras.length])
  if (camaras.length <= 1) return null

  return (
    <View style={s.wrap}>
      <Text style={s.label}>{label ?? (kind === 'estudio' ? '¿QUÉ TIPO DE NEGOCIO TENÉS?' : '¿QUÉ CLASES DAS?')}</Text>
      {camaras.map(c => {
        const on = value === c.id
        return (
          <TouchableOpacity key={c.id} style={[s.opt, on && s.optOn]} onPress={() => onChange(c.id)} accessibilityState={{ selected: on }}>
            <View style={[s.radio, on && s.radioOn]}>{on ? <View style={s.dot} /> : null}</View>
            <View style={{ flex: 1 }}>
              <Text style={[s.title, on && { color: colors.sage }]}>{kind === 'estudio' ? c.business_label : c.instructor_label}</Text>
              <Text style={s.sub}>Red coordinada por {c.name}</Text>
            </View>
            {on ? <Feather name="check" size={16} color={colors.sage} /> : null}
          </TouchableOpacity>
        )
      })}
    </View>
  )
}

const s = StyleSheet.create({
  wrap:    { marginBottom: spacing.md },
  label:   { ...typography.caption, color: colors.light, marginBottom: 6 },
  opt:     { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, backgroundColor: colors.white, ...radius.leaf, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm },
  optOn:   { borderColor: colors.sage, backgroundColor: colors.sageLighter },
  radio:   { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  radioOn: { borderColor: colors.sage },
  dot:     { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.sage },
  title:   { fontFamily: 'Nunito-Bold', fontSize: 14, color: colors.dark },
  sub:     { fontFamily: 'Nunito-Regular', fontSize: 12, color: colors.mid, marginTop: 2 },
})
