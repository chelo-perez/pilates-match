// src/screens/instructor/AvailabilityScreen.tsx
import React, { useState, useEffect } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Platform, StatusBar } from 'react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { instructorAPI } from '../../lib/api'
import { useAuthStore } from '../../store'
import { Card, Button, Badge, colors, spacing, typography, radius } from '../../components/ui'

type DayOfWeek = 'lunes' | 'martes' | 'miercoles' | 'jueves' | 'viernes' | 'sabado' | 'domingo'
type ClassType = 'regular' | 'reemplazo'

interface Slot { day: DayOfWeek; start: string; end: string; type: ClassType }

const DAYS: DayOfWeek[] = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo']
const DAYS_SHORT: Record<DayOfWeek, string> = { lunes: 'Lun', martes: 'Mar', miercoles: 'Mié', jueves: 'Jue', viernes: 'Vie', sabado: 'Sáb', domingo: 'Dom' }
const TIME_OPTIONS = ['07:00', '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00']
const NEIGHBORHOODS = [
  'Palermo', 'Villa Crespo', 'Almagro', 'Caballito', 'Belgrano',
  'Recoleta', 'Núñez', 'Colegiales', 'Flores', 'Floresta',
  'Villa Urquiza', 'Villa del Parque', 'Villa Devoto', 'Villa Pueyrredón',
  'San Telmo', 'La Boca', 'Barracas', 'Parque Patricios',
  'Balvanera', 'San Cristóbal', 'Boedo', 'Parque Chacabuco',
  'Nueva Pompeya', 'Villa Lugano', 'Mataderos', 'Liniers',
  'Versalles', 'Monte Castro', 'Villa Real', 'Villa Luro',
  'Agronomía', 'Villa Ortúzar', 'Chacarita', 'Paternal',
  'Puerto Madero', 'Montserrat', 'San Nicolás', 'Retiro',
]

export default function AvailabilityScreen() {
  const user = useAuthStore(s => s.user)
  const qc = useQueryClient()
  const [slots, setSlots] = useState<Slot[]>([])
  const [selectedZones, setSelectedZones] = useState<string[]>([])
  const [addingDay, setAddingDay] = useState<DayOfWeek | null>(null)
  const [newStart, setNewStart] = useState('09:00')
  const [newEnd, setNewEnd] = useState('10:00')
  const [newType, setNewType] = useState<ClassType>('reemplazo')

  const { data: instructor } = useQuery({
    queryKey: ['my-instructor-availability'],
    queryFn: async () => {
      const { data, error } = await supabase.from('instructors')
        .select(`id, full_name, availability(*), zones:instructor_zones(*)`)
        .eq('user_id', user?.id)
        .single()
      console.log('availability query error:', JSON.stringify(error))
      console.log('availability data:', JSON.stringify(data?.availability?.length), 'slots,', JSON.stringify(data?.zones?.length), 'zones')
      return data
    },
    enabled: !!user?.id,
    staleTime: 0, // siempre refrescar
  })

  useEffect(() => {
    if (instructor) {
      setSlots((instructor.availability ?? []).filter((a: any) => a.is_active).map((a: any) => ({
        day: a.day_of_week, start: a.start_time.slice(0, 5), end: a.end_time.slice(0, 5), type: a.class_type,
      })))
      setSelectedZones((instructor.zones ?? []).map((z: any) => z.neighborhood))
    }
  }, [instructor])

  const saveMutation = useMutation({
    mutationFn: async () => {
      await Promise.all([
        instructorAPI.upsertAvailability(instructor!.id, slots.map(s => ({
          day_of_week: s.day, start_time: s.start + ':00', end_time: s.end + ':00',
          class_type: s.type, is_active: true,
        }))),
        instructorAPI.upsertZones(instructor!.id, selectedZones),
      ])
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-instructor-availability'] })
      Alert.alert('✓ Guardado', 'Tu disponibilidad se actualizó.')
    },
  })

  const addSlot = () => {
    if (!addingDay) return
    setSlots(prev => [...prev, { day: addingDay, start: newStart, end: newEnd, type: newType }])
    setAddingDay(null)
  }

  const removeSlot = (index: number) => setSlots(prev => prev.filter((_, i) => i !== index))
  const toggleZone = (z: string) => setSelectedZones(prev => prev.includes(z) ? prev.filter(x => x !== z) : [...prev, z])

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.cream }} contentContainerStyle={{ padding: spacing.lg, paddingTop: (Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) : 44) + spacing.lg, paddingBottom: 120 }}>

      {/* Days strip */}
      <Text style={styles.sectionTitle}>Días disponibles</Text>
      <View style={styles.daysRow}>
        {DAYS.map(day => {
          const hasSlots = slots.some(s => s.day === day)
          return (
            <TouchableOpacity key={day}
              style={[styles.dayBtn, hasSlots && styles.dayBtnActive]}
              onPress={() => setAddingDay(day)}>
              <Text style={[styles.dayBtnText, hasSlots && styles.dayBtnTextActive]}>{DAYS_SHORT[day]}</Text>
              {hasSlots && <View style={styles.dayDot} />}
            </TouchableOpacity>
          )
        })}
      </View>

      {/* Slots list */}
      {DAYS.filter(d => slots.some(s => s.day === d)).map(day => (
        <Card key={day} style={styles.dayCard}>
          <Text style={styles.dayTitle}>{day.charAt(0).toUpperCase() + day.slice(1)}</Text>
          {slots.filter(s => s.day === day).map((slot, i) => (
            <View key={i} style={styles.slotRow}>
              <Text style={styles.slotTime}>{slot.start} – {slot.end}</Text>
              <Badge label={slot.type === 'regular' ? 'Regular' : 'Reemplazo'}
                color={slot.type === 'regular' ? 'sage' : 'blush'} />
              <TouchableOpacity onPress={() => removeSlot(slots.indexOf(slot))}>
                <Text style={{ color: colors.danger, fontSize: 18, padding: spacing.xs }}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}
          <TouchableOpacity style={styles.addSlotBtn} onPress={() => setAddingDay(day)}>
            <Text style={styles.addSlotText}>+ Agregar horario</Text>
          </TouchableOpacity>
        </Card>
      ))}

      {/* Add slot panel */}
      {addingDay && (
        <Card style={styles.addPanel}>
          <Text style={styles.addPanelTitle}>Agregar horario — {addingDay.charAt(0).toUpperCase() + addingDay.slice(1)}</Text>

          <Text style={styles.fieldLabel}>INICIO</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.md }}>
            {TIME_OPTIONS.map(t => (
              <TouchableOpacity key={t} style={[styles.timeChip, newStart === t && styles.timeChipActive]} onPress={() => setNewStart(t)}>
                <Text style={[styles.timeChipText, newStart === t && styles.timeChipTextActive]}>{t}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={styles.fieldLabel}>FIN</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.md }}>
            {TIME_OPTIONS.filter(t => t > newStart).map(t => (
              <TouchableOpacity key={t} style={[styles.timeChip, newEnd === t && styles.timeChipActive]} onPress={() => setNewEnd(t)}>
                <Text style={[styles.timeChipText, newEnd === t && styles.timeChipTextActive]}>{t}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={styles.fieldLabel}>TIPO</Text>
          <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md }}>
            {(['regular', 'reemplazo'] as ClassType[]).map(t => (
              <Button key={t} label={t === 'regular' ? 'Clase regular' : 'Reemplazo'}
                variant={newType === t ? 'primary' : 'ghost'}
                onPress={() => setNewType(t)} style={{ flex: 1 }} />
            ))}
          </View>

          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Button label="Agregar" onPress={addSlot} style={{ flex: 1 }} />
            <Button label="Cancelar" variant="ghost" onPress={() => setAddingDay(null)} style={{ flex: 1 }} />
          </View>
        </Card>
      )}

      {/* Zonas */}
      <Text style={[styles.sectionTitle, { marginTop: spacing.lg }]}>Zonas donde trabajás</Text>
      <View style={styles.zonesGrid}>
        {NEIGHBORHOODS.map(n => (
          <TouchableOpacity key={n}
            style={[styles.zoneChip, selectedZones.includes(n) && styles.zoneChipActive]}
            onPress={() => toggleZone(n)}>
            <Text style={[styles.zoneChipText, selectedZones.includes(n) && styles.zoneChipTextActive]}>{n}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Button label="Guardar disponibilidad" onPress={() => saveMutation.mutate()}
        isLoading={saveMutation.isPending} fullWidth size="lg" style={{ marginTop: spacing.xl }} />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  sectionTitle: { fontFamily: 'DM_Sans-SemiBold', fontSize: 14, color: colors.dark, marginBottom: spacing.md },
  daysRow: { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.lg },
  dayBtn: { flex: 1, alignItems: 'center', paddingVertical: spacing.sm, borderRadius: radius.sm, backgroundColor: colors.cream, borderWidth: 0.5, borderColor: colors.border },
  dayBtnActive: { backgroundColor: colors.sageLight, borderColor: colors.sageMid },
  dayBtnText: { fontSize: 10, color: colors.light },
  dayBtnTextActive: { color: colors.sage, fontFamily: 'DM_Sans-Medium' },
  dayDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.sage, marginTop: 3 },
  dayCard: { padding: spacing.md, marginBottom: spacing.sm, backgroundColor: colors.white },
  dayTitle: { fontFamily: 'DM_Sans-SemiBold', fontSize: 13, color: colors.dark, marginBottom: spacing.sm },
  slotRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.xs },
  slotTime: { ...typography.body, color: colors.dark, flex: 1 },
  addSlotBtn: { marginTop: spacing.xs },
  addSlotText: { ...typography.small, color: colors.sage, fontFamily: 'DM_Sans-Medium' },
  addPanel: { padding: spacing.lg, marginBottom: spacing.md, backgroundColor: colors.sageLight },
  addPanelTitle: { fontFamily: 'DM_Sans-SemiBold', fontSize: 14, color: colors.dark, marginBottom: spacing.md },
  fieldLabel: { ...typography.label, color: colors.mid, marginBottom: spacing.xs },
  timeChip: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999, backgroundColor: colors.white, marginRight: spacing.xs, borderWidth: 0.5, borderColor: colors.border },
  timeChipActive: { backgroundColor: colors.sage, borderColor: colors.sage },
  timeChipText: { ...typography.small, color: colors.mid },
  timeChipTextActive: { color: colors.white, fontFamily: 'DM_Sans-SemiBold' },
  zonesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  zoneChip: { paddingVertical: 7, paddingHorizontal: 14, borderRadius: 999, backgroundColor: colors.white, borderWidth: 0.5, borderColor: colors.border },
  zoneChipActive: { backgroundColor: colors.sage, borderColor: colors.sage },
  zoneChipText: { ...typography.small, color: colors.mid },
  zoneChipTextActive: { color: colors.white, fontFamily: 'DM_Sans-SemiBold' },
})
