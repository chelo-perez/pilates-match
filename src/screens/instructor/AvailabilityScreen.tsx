// src/screens/instructor/AvailabilityScreen.tsx
import React, { useState, useEffect } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Modal, FlatList } from 'react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { instructorAPI } from '../../lib/api'
import { useAuthStore } from '../../store'
import { Card, Button, Badge, colors, spacing, typography, radius } from '../../components/ui'
import { Feather } from '@expo/vector-icons'

type DayOfWeek = 'lunes' | 'martes' | 'miercoles' | 'jueves' | 'viernes' | 'sabado' | 'domingo'
type ClassType = 'regular' | 'reemplazo'
interface Slot { day: DayOfWeek; start: string; end: string; type: ClassType }

const DAYS: DayOfWeek[] = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo']
const DAYS_LABEL: Record<DayOfWeek, string> = {
  lunes: 'Lunes', martes: 'Martes', miercoles: 'Miércoles',
  jueves: 'Jueves', viernes: 'Viernes', sabado: 'Sábado', domingo: 'Domingo'
}
const DAYS_SHORT: Record<DayOfWeek, string> = {
  lunes: 'Lu', martes: 'Ma', miercoles: 'Mi',
  jueves: 'Ju', viernes: 'Vi', sabado: 'Sá', domingo: 'Do'
}
const TIME_OPTIONS = [
  '06:00','07:00','08:00','09:00','10:00','11:00','12:00',
  '13:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00','21:00','22:00'
]
const NEIGHBORHOODS = [
  'Agronomía','Almagro','Balvanera','Barracas','Belgrano',
  'Boedo','Caballito','Chacarita','Colegiales','Flores',
  'Floresta','La Boca','Liniers','Mataderos','Monte Castro',
  'Montserrat','Nueva Pompeya','Núñez','Palermo','Parque Chacabuco',
  'Parque Patricios','Paternal','Puerto Madero','Recoleta','Retiro',
  'San Cristóbal','San Nicolás','San Telmo','Versalles','Villa Crespo',
  'Villa del Parque','Villa Devoto','Villa Lugano','Villa Luro','Villa Ortúzar',
  'Villa Pueyrredón','Villa Real','Villa Urquiza',
]

export default function AvailabilityScreen() {
  const user = useAuthStore(s => s.user)
  const qc = useQueryClient()
  const [slots, setSlots] = useState<Slot[]>([])
  const [selectedZones, setSelectedZones] = useState<string[]>([])
  const [showAddModal, setShowAddModal] = useState(false)
  const [addingDay, setAddingDay] = useState<DayOfWeek>('lunes')
  const [newStart, setNewStart] = useState('09:00')
  const [newEnd, setNewEnd] = useState('10:00')
  const [newType, setNewType] = useState<ClassType>('reemplazo')
  const [activeTab, setActiveTab] = useState<'horarios' | 'zonas'>('horarios')

  const { data: instructor } = useQuery({
    queryKey: ['my-instructor-availability'],
    queryFn: async () => {
      const { data } = await supabase.from('instructors')
        .select(`id, full_name, availability(*), zones:instructor_zones(*)`)
        .eq('user_id', user?.id).single()
      return data
    },
    enabled: !!user?.id,
    staleTime: 0,
  })

  useEffect(() => {
    if (instructor) {
      setSlots((instructor.availability ?? []).filter((a: any) => a.is_active).map((a: any) => ({
        day: a.day_of_week, start: a.start_time.slice(0, 5),
        end: a.end_time.slice(0, 5), type: a.class_type,
      })))
      setSelectedZones((instructor.zones ?? []).map((z: any) => z.neighborhood))
    }
  }, [instructor])

  const saveMutation = useMutation({
    mutationFn: async () => {
      await Promise.all([
        instructorAPI.upsertAvailability(instructor!.id, slots.map(s => ({
          day_of_week: s.day, start_time: s.start + ':00',
          end_time: s.end + ':00', class_type: s.type, is_active: true,
        }))),
        instructorAPI.upsertZones(instructor!.id, selectedZones),
      ])
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-instructor-availability'] })
      Alert.alert('✓ Guardado', 'Tu disponibilidad se actualizó correctamente.')
    },
  })

  const addSlot = () => {
    if (newEnd <= newStart) {
      Alert.alert('Horario inválido', 'El horario de fin debe ser posterior al inicio.')
      return
    }
    setSlots(prev => [...prev, { day: addingDay, start: newStart, end: newEnd, type: newType }])
    setShowAddModal(false)
  }

  const removeSlot = (idx: number) => setSlots(prev => prev.filter((_, i) => i !== idx))
  const toggleZone = (z: string) => setSelectedZones(prev =>
    prev.includes(z) ? prev.filter(x => x !== z) : [...prev, z]
  )

  const openAdd = (day: DayOfWeek) => {
    setAddingDay(day)
    setNewStart('09:00')
    setNewEnd('10:00')
    setNewType('reemplazo')
    setShowAddModal(true)
  }

  const slotsForDay = (day: DayOfWeek) => slots.filter(s => s.day === day)

  return (
    <View style={{ flex: 1, backgroundColor: colors.cream }}>

      {/* Header */}
      <View style={s.header}>
        <Text style={s.headerTitle}>Mi disponibilidad</Text>
        <Text style={s.headerSub}>Configurá tus horarios y zonas de trabajo</Text>
      </View>

      {/* Tabs */}
      <View style={s.tabRow}>
        <TouchableOpacity
          style={[s.tab, activeTab === 'horarios' && s.tabActive]}
          onPress={() => setActiveTab('horarios')}
        >
          <Text style={[s.tabText, activeTab === 'horarios' && s.tabTextActive]}>Horarios</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.tab, activeTab === 'zonas' && s.tabActive]}
          onPress={() => setActiveTab('zonas')}
        >
          <Text style={[s.tabText, activeTab === 'zonas' && s.tabTextActive]}>
            Zonas {selectedZones.length > 0 ? `(${selectedZones.length})` : ''}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: 100 }}>

        {activeTab === 'horarios' && (
          <>
            {DAYS.map(day => {
              const daySlots = slotsForDay(day)
              return (
                <View key={day} style={s.daySection}>
                  <View style={s.dayHeader}>
                    <Text style={s.dayName}>{DAYS_LABEL[day]}</Text>
                    <TouchableOpacity style={s.addBtn} onPress={() => openAdd(day)}>
                      <Feather name="plus" size={14} color={colors.sage} />
                      <Text style={s.addBtnText}>Agregar</Text>
                    </TouchableOpacity>
                  </View>
                  {daySlots.length === 0 ? (
                    <Text style={s.noSlots}>Sin horarios cargados</Text>
                  ) : (
                    daySlots.map((slot, i) => {
                      const globalIdx = slots.indexOf(slot)
                      return (
                        <View key={i} style={s.slotRow}>
                          <View style={[s.slotType, { backgroundColor: slot.type === 'regular' ? colors.sageLight : colors.warnBg }]}>
                            <Text style={[s.slotTypeText, { color: slot.type === 'regular' ? colors.sage : colors.warnTx }]}>
                              {slot.type === 'regular' ? 'Regular' : 'Reemplazo'}
                            </Text>
                          </View>
                          <Text style={s.slotTime}>{slot.start} – {slot.end}</Text>
                          <TouchableOpacity onPress={() => removeSlot(globalIdx)} style={s.removeBtn}>
                            <Feather name="x" size={16} color={colors.redTx} />
                          </TouchableOpacity>
                        </View>
                      )
                    })
                  )}
                </View>
              )
            })}
          </>
        )}

        {activeTab === 'zonas' && (
          <>
            <Text style={s.zoneInfo}>
              Seleccioná los barrios de CABA donde estás disponible para trabajar.
              {selectedZones.length > 0 ? ` Seleccionados: ${selectedZones.length}` : ''}
            </Text>
            <View style={s.zonesGrid}>
              {NEIGHBORHOODS.map(n => (
                <TouchableOpacity
                  key={n}
                  style={[s.zoneChip, selectedZones.includes(n) && s.zoneChipActive]}
                  onPress={() => toggleZone(n)}
                >
                  <Text style={[s.zoneText, selectedZones.includes(n) && s.zoneTextActive]}>{n}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        <Button
          label="Guardar disponibilidad"
          onPress={() => saveMutation.mutate()}
          isLoading={saveMutation.isPending}
          fullWidth size="lg"
          style={{ marginTop: spacing.lg }}
        />
      </ScrollView>

      {/* Modal agregar horario */}
      <Modal visible={showAddModal} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={s.modalBox}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Agregar horario</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <Feather name="x" size={22} color={colors.mid} />
              </TouchableOpacity>
            </View>

            {/* Día */}
            <Text style={s.fieldLabel}>DÍA</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.md }}>
              {DAYS.map(d => (
                <TouchableOpacity
                  key={d}
                  style={[s.dayChip, addingDay === d && s.dayChipActive]}
                  onPress={() => setAddingDay(d)}
                >
                  <Text style={[s.dayChipText, addingDay === d && s.dayChipTextActive]}>{DAYS_SHORT[d]}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Tipo */}
            <Text style={s.fieldLabel}>TIPO DE CLASE</Text>
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md }}>
              {(['reemplazo', 'regular'] as ClassType[]).map(t => (
                <TouchableOpacity
                  key={t}
                  style={[s.typeBtn, newType === t && s.typeBtnActive]}
                  onPress={() => setNewType(t)}
                >
                  <Text style={[s.typeBtnText, newType === t && s.typeBtnTextActive]}>
                    {t === 'regular' ? 'Clase regular' : 'Reemplazo'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Inicio */}
            <Text style={s.fieldLabel}>DESDE</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.md }}>
              {TIME_OPTIONS.map(t => (
                <TouchableOpacity key={t} style={[s.timeChip, newStart === t && s.timeChipActive]} onPress={() => setNewStart(t)}>
                  <Text style={[s.timeChipText, newStart === t && s.timeChipTextActive]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Fin */}
            <Text style={s.fieldLabel}>HASTA</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.lg }}>
              {TIME_OPTIONS.filter(t => t > newStart).map(t => (
                <TouchableOpacity key={t} style={[s.timeChip, newEnd === t && s.timeChipActive]} onPress={() => setNewEnd(t)}>
                  <Text style={[s.timeChipText, newEnd === t && s.timeChipTextActive]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Button label="Agregar horario" onPress={addSlot} fullWidth />
          </View>
        </View>
      </Modal>
    </View>
  )
}

const s = StyleSheet.create({
  header:          { paddingHorizontal: spacing.md, paddingTop: 52, paddingBottom: spacing.sm, backgroundColor: colors.white, borderBottomWidth: 0.5, borderColor: colors.borderLight },
  headerTitle:     { fontFamily: 'Nunito-Bold', fontSize: 22, color: colors.dark },
  headerSub:       { fontFamily: 'Nunito-Regular', fontSize: 12, color: colors.mid, marginTop: 2 },
  tabRow:          { flexDirection: 'row', backgroundColor: colors.white, borderBottomWidth: 0.5, borderColor: colors.borderLight },
  tab:             { flex: 1, paddingVertical: spacing.sm + 2, alignItems: 'center' },
  tabActive:       { borderBottomWidth: 2, borderColor: colors.sage },
  tabText:         { fontFamily: 'Nunito-SemiBold', fontSize: 13, color: colors.light },
  tabTextActive:   { color: colors.sage },
  daySection:      { marginBottom: spacing.md, backgroundColor: colors.white, borderRadius: radius.md, padding: spacing.md, borderWidth: 0.5, borderColor: colors.borderLight },
  dayHeader:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  dayName:         { fontFamily: 'Nunito-Bold', fontSize: 14, color: colors.dark },
  addBtn:          { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.sageLight, paddingHorizontal: spacing.sm, paddingVertical: 5, borderRadius: radius.sm },
  addBtnText:      { fontFamily: 'Nunito-SemiBold', fontSize: 12, color: colors.sage },
  noSlots:         { fontFamily: 'Nunito-Regular', fontSize: 12, color: colors.light, fontStyle: 'italic' },
  slotRow:         { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs, borderTopWidth: 0.5, borderColor: colors.borderLight },
  slotType:        { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.sm },
  slotTypeText:    { fontFamily: 'Nunito-SemiBold', fontSize: 10 },
  slotTime:        { fontFamily: 'Nunito-Regular', fontSize: 13, color: colors.dark, flex: 1 },
  removeBtn:       { padding: 4 },
  zoneInfo:        { fontFamily: 'Nunito-Regular', fontSize: 12, color: colors.mid, marginBottom: spacing.md, lineHeight: 18 },
  zonesGrid:       { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  zoneChip:        { paddingVertical: 7, paddingHorizontal: 12, borderRadius: 999, backgroundColor: colors.white, borderWidth: 0.5, borderColor: colors.border },
  zoneChipActive:  { backgroundColor: colors.sage, borderColor: colors.sage },
  zoneText:        { fontFamily: 'Nunito-Regular', fontSize: 12, color: colors.mid },
  zoneTextActive:  { color: colors.white, fontFamily: 'Nunito-SemiBold' },
  // Modal
  modalOverlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalBox:        { backgroundColor: colors.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: spacing.lg, paddingBottom: 40 },
  modalHeader:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg },
  modalTitle:      { fontFamily: 'Nunito-Bold', fontSize: 18, color: colors.dark },
  fieldLabel:      { fontFamily: 'Nunito-Bold', fontSize: 10, color: colors.light, letterSpacing: 0.7, marginBottom: spacing.xs },
  dayChip:         { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, backgroundColor: colors.cream, marginRight: spacing.xs, borderWidth: 0.5, borderColor: colors.border },
  dayChipActive:   { backgroundColor: colors.sage, borderColor: colors.sage },
  dayChipText:     { fontFamily: 'Nunito-SemiBold', fontSize: 12, color: colors.mid },
  dayChipTextActive:{ color: colors.white },
  typeBtn:         { flex: 1, paddingVertical: spacing.sm, borderRadius: radius.md, backgroundColor: colors.cream, borderWidth: 0.5, borderColor: colors.border, alignItems: 'center' },
  typeBtnActive:   { backgroundColor: colors.sage, borderColor: colors.sage },
  typeBtnText:     { fontFamily: 'Nunito-SemiBold', fontSize: 13, color: colors.mid },
  typeBtnTextActive:{ color: colors.white },
  timeChip:        { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, backgroundColor: colors.cream, marginRight: spacing.xs, borderWidth: 0.5, borderColor: colors.border },
  timeChipActive:  { backgroundColor: colors.sage, borderColor: colors.sage },
  timeChipText:    { fontFamily: 'Nunito-SemiBold', fontSize: 12, color: colors.mid },
  timeChipTextActive:{ color: colors.white },
})
