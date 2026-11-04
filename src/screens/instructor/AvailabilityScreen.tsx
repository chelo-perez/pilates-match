// src/screens/instructor/AvailabilityScreen.tsx
import React, { useState, useEffect } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal } from 'react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useMyInstructor } from '../../hooks'
import { errorText, UserError } from '../../lib/errors'
import { BARRIOS_CABA } from '../../constants/barrios'
import { Button, LoadingScreen, ErrorState, colors, spacing, typography, radius } from '../../components/ui'
import SaveButton from '../../components/SaveButton'
import HeroHeader from '../../components/HeroHeader'
import Toast from '../../components/Toast'
import { useToast } from '../../hooks/useToast'
import { Feather } from '@expo/vector-icons'
import ZonasCABA from '../../components/ZonasCABA'

type DayOfWeek = 'lunes' | 'martes' | 'miercoles' | 'jueves' | 'viernes' | 'sabado' | 'domingo'
type ClassType = 'regular' | 'reemplazo'
interface Slot { id?: string; day: DayOfWeek; start: string; end: string; type: ClassType }

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
const PRESETS = [
  { label: 'Mañana',   start: '07:00', end: '12:00' },
  { label: 'Mediodía', start: '12:00', end: '15:00' },
  { label: 'Tarde',    start: '15:00', end: '19:00' },
  { label: 'Noche',    start: '19:00', end: '22:00' },
]

export default function AvailabilityScreen() {
  const { toast, showToast, hideToast } = useToast()
  const qc = useQueryClient()
  const [slots, setSlots] = useState<Slot[]>([])
  const [selectedZones, setSelectedZones] = useState<string[]>([])
  const [dirty, setDirty] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [addingDays, setAddingDays] = useState<DayOfWeek[]>(['lunes'])
  const [newStart, setNewStart] = useState('09:00')
  const [newEnd, setNewEnd] = useState('13:00')
  const [newType, setNewType] = useState<ClassType | 'ambos'>('ambos')
  const [addError, setAddError] = useState('')
  const [activeTab, setActiveTab] = useState<'horarios' | 'zonas'>('horarios')

  const { data: instructor, isLoading: loadingInstructor, isError: errorInstructor, refetch: refetchInstructor } = useMyInstructor()
  const instructorId = instructor?.id

  const { data: saved, isLoading: loadingSaved, isError: errorSaved, refetch: refetchSaved } = useQuery({
    queryKey: ['my-availability', instructorId],
    queryFn: async () => {
      const [av, zn] = await Promise.all([
        supabase.from('availability').select('*').eq('instructor_id', instructorId!),
        supabase.from('instructor_zones').select('*').eq('instructor_id', instructorId!),
      ])
      if (av.error) throw av.error
      if (zn.error) throw zn.error
      return { availability: av.data ?? [], zones: zn.data ?? [] }
    },
    enabled: !!instructorId,
    staleTime: 0,
  })

  // Cargar lo guardado solo si el usuario no está editando
  useEffect(() => {
    if (saved && !dirty) {
      setSlots(saved.availability.filter((a: any) => a.is_active !== false).map((a: any) => ({
        id: a.id, day: a.day_of_week, start: a.start_time.slice(0, 5),
        end: a.end_time.slice(0, 5), type: a.class_type,
      })))
      setSelectedZones(saved.zones.map((z: any) => z.neighborhood))
    }
  }, [saved])

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!instructorId || !saved) throw new UserError('Tu perfil todavía no cargó. Probá de nuevo en unos segundos.')

      // Horarios: primero insertar los nuevos y después borrar los quitados (nunca se queda sin datos)
      const keep = new Set(slots.filter(s => s.id).map(s => s.id))
      const toInsert = slots.filter(s => !s.id)
      const toDelete = saved.availability.filter((a: any) => !keep.has(a.id)).map((a: any) => a.id)
      if (toInsert.length) {
        const { error } = await supabase.from('availability').insert(toInsert.map(s => ({
          instructor_id: instructorId, day_of_week: s.day, start_time: s.start + ':00',
          end_time: s.end + ':00', class_type: s.type, is_active: true,
        })))
        if (error) throw error
      }
      if (toDelete.length) {
        const { error } = await supabase.from('availability').delete().in('id', toDelete)
        if (error) throw error
      }

      // Zonas: agregar las nuevas y borrar solo las quitadas
      const current = new Set(saved.zones.map((z: any) => z.neighborhood))
      const wanted  = new Set(selectedZones)
      const addZones = selectedZones.filter(z => !current.has(z))
      const delZones = saved.zones.filter((z: any) => !wanted.has(z.neighborhood)).map((z: any) => z.id)
      if (addZones.length) {
        const { error } = await supabase.from('instructor_zones')
          .insert(addZones.map(n => ({ instructor_id: instructorId, neighborhood: n })))
        if (error) throw error
      }
      if (delZones.length) {
        const { error } = await supabase.from('instructor_zones').delete().in('id', delZones)
        if (error) throw error
      }
    },
    onSuccess: () => {
      setDirty(false)
      qc.invalidateQueries({ queryKey: ['my-availability'] })
      qc.invalidateQueries({ queryKey: ['my-instructor'] })
      showToast('Disponibilidad guardada')
    },
    onError: (e: any) => {
      showToast(errorText(e), 'error')
      setDirty(false)
      qc.invalidateQueries({ queryKey: ['my-availability'] })
    },
  })

  // Agrega la misma franja a todos los días elegidos (y a los dos tipos si es "ambos").
  // Los días donde se superpone con algo ya cargado se saltean y se avisa.
  const addSlot = () => {
    if (!addingDays.length) { setAddError('Elegí al menos un día.'); return }
    if (newEnd <= newStart) { setAddError('El horario de fin tiene que ser posterior al de inicio.'); return }
    const types: ClassType[] = newType === 'ambos' ? ['regular', 'reemplazo'] : [newType]
    const added: Slot[] = []
    const skipped: DayOfWeek[] = []
    for (const day of addingDays) {
      const clash = slots.some(s => s.day === day && types.includes(s.type) && s.start < newEnd && newStart < s.end)
      if (clash) { skipped.push(day); continue }
      types.forEach(type => added.push({ day, start: newStart, end: newEnd, type }))
    }
    if (!added.length) {
      setAddError(skipped.length === 1
        ? `El ${DAYS_LABEL[skipped[0]].toLowerCase()} ya tiene un horario que se superpone.`
        : 'Esos días ya tienen horarios que se superponen.')
      return
    }
    setSlots(prev => [...prev, ...added].sort((a, b) => a.start.localeCompare(b.start)))
    setDirty(true)
    setShowAddModal(false)
    if (skipped.length) showToast(`No se agregó el ${skipped.map(d => DAYS_LABEL[d].toLowerCase()).join(', ')}: se superponía con otro horario`, 'warning')
  }

  // Quita una franja (todas sus filas: regular y/o reemplazo)
  const removeGroup = (day: DayOfWeek, start: string, end: string) => {
    setSlots(prev => prev.filter(s => !(s.day === day && s.start === start && s.end === end)))
    setDirty(true)
  }
  const toggleZone = (z: string) => {
    setDirty(true)
    if (z === '__all__') { setSelectedZones(BARRIOS_CABA); return }
    if (z === '__clear__') { setSelectedZones([]); return }
    setSelectedZones(prev => prev.includes(z) ? prev.filter(x => x !== z) : [...prev, z])
  }

  const openAdd = (days: DayOfWeek[]) => {
    setAddingDays(days)
    setNewStart('09:00')
    setNewEnd('13:00')
    setNewType('ambos')
    setAddError('')
    setShowAddModal(true)
  }
  const toggleDay = (d: DayOfWeek) => {
    setAddError('')
    setAddingDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : DAYS.filter(x => prev.includes(x) || x === d))
  }

  // Franjas del día agrupadas por horario: una misma franja regular + reemplazo se muestra como "Ambos"
  const groupsForDay = (day: DayOfWeek) => {
    const map = new Map<string, { start: string; end: string; types: Set<ClassType> }>()
    for (const s of slots.filter(x => x.day === day)) {
      const k = `${s.start}-${s.end}`
      if (!map.has(k)) map.set(k, { start: s.start, end: s.end, types: new Set() })
      map.get(k)!.types.add(s.type)
    }
    return [...map.values()].sort((a, b) => a.start.localeCompare(b.start))
  }
  const typeLabel = (types: Set<ClassType>) => types.size === 2 ? 'Ambos' : types.has('regular') ? 'Regular' : 'Reemplazo'
  const daysWithSlots = DAYS.filter(d => slots.some(s => s.day === d)).length

  if (loadingInstructor || (instructorId && loadingSaved)) return <LoadingScreen message="Cargando tu disponibilidad..." />
  if (errorInstructor || errorSaved || !instructor) {
    return <ErrorState message="No pudimos cargar tu disponibilidad." onRetry={() => { refetchInstructor(); refetchSaved() }} />
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.cream }}>

      {/* Header */}
      <HeroHeader
        title="Mi disponibilidad"
        subtitle="Configurá tus horarios y zonas de trabajo"
      />

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
            <Text style={s.intro}>
              {daysWithSlots
                ? `Cargaste horarios en ${daysWithSlots} día${daysWithSlots > 1 ? 's' : ''}. Los estudios ven si una clase coincide con tu disponibilidad.`
                : 'Contá cuándo podés dar clases. Podés cargar la misma franja para varios días a la vez.'}
            </Text>
            <View style={s.week}>
              {DAYS.map((day, idx) => {
                const groups = groupsForDay(day)
                return (
                  <View key={day} style={[s.weekRow, idx > 0 && s.weekRowBorder]}>
                    <Text style={[s.weekDay, !groups.length && s.weekDayEmpty]}>{DAYS_SHORT[day]}</Text>
                    <View style={s.weekSlots}>
                      {groups.length === 0 ? <Text style={s.weekNone}>—</Text> : groups.map(g => {
                        const label = typeLabel(g.types)
                        const tone = label === 'Reemplazo' ? s.pillRep : label === 'Regular' ? s.pillReg : s.pillBoth
                        return (
                          <View key={`${g.start}-${g.end}`} style={[s.pill, tone]}>
                            <Text style={s.pillTime}>{g.start}–{g.end}</Text>
                            <Text style={s.pillType}>{label}</Text>
                            <TouchableOpacity onPress={() => removeGroup(day, g.start, g.end)} hitSlop={10} accessibilityLabel={`Quitar ${g.start} a ${g.end}`}>
                              <Feather name="x" size={13} color={colors.mid} />
                            </TouchableOpacity>
                          </View>
                        )
                      })}
                    </View>
                    <TouchableOpacity onPress={() => openAdd([day])} hitSlop={10} style={s.weekAdd} accessibilityLabel={`Agregar horario el ${DAYS_LABEL[day]}`}>
                      <Feather name="plus" size={16} color={colors.sage} />
                    </TouchableOpacity>
                  </View>
                )
              })}
            </View>
            <Button label="Agregar horario" variant="secondary" fullWidth
              icon={<Feather name="plus" size={16} color={colors.sage} />}
              onPress={() => openAdd(['lunes', 'martes', 'miercoles', 'jueves', 'viernes'])}
              style={{ marginBottom: spacing.lg }} />
          </>
        )}

        {activeTab === 'zonas' && (
          <>
            <ZonasCABA selected={selectedZones} onToggle={toggleZone} />
          </>
        )}

        {dirty && <Text style={s.dirtyHint}>Tenés cambios sin guardar</Text>}
        <SaveButton label="Guardar disponibilidad" onPress={() => saveMutation.mutate()} isPending={saveMutation.isPending} isSuccess={saveMutation.isSuccess && !dirty} />
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

            {/* Días (varios) */}
            <View style={s.labelRow}>
              <Text style={s.fieldLabel}>DÍAS</Text>
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <TouchableOpacity onPress={() => { setAddingDays(DAYS.slice(0, 5)); setAddError('') }}><Text style={s.quickLink}>Lun a Vie</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => { setAddingDays([...DAYS]); setAddError('') }}><Text style={s.quickLink}>Todos</Text></TouchableOpacity>
              </View>
            </View>
            <View style={s.daysRow}>
              {DAYS.map(d => (
                <TouchableOpacity key={d} style={[s.dayChip, addingDays.includes(d) && s.dayChipActive]} onPress={() => toggleDay(d)}>
                  <Text style={[s.dayChipText, addingDays.includes(d) && s.dayChipTextActive]}>{DAYS_SHORT[d]}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Tipo */}
            <Text style={s.fieldLabel}>PARA</Text>
            <View style={{ flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.md }}>
              {([['ambos', 'Ambos'], ['reemplazo', 'Reemplazo'], ['regular', 'Clase regular']] as const).map(([k, l]) => (
                <TouchableOpacity key={k} style={[s.typeBtn, newType === k && s.typeBtnActive]} onPress={() => setNewType(k)}>
                  <Text style={[s.typeBtnText, newType === k && s.typeBtnTextActive]}>{l}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Franjas rápidas */}
            <Text style={s.fieldLabel}>FRANJA</Text>
            <View style={[s.daysRow, { marginBottom: spacing.sm }]}>
              {PRESETS.map(p => {
                const on = newStart === p.start && newEnd === p.end
                return (
                  <TouchableOpacity key={p.label} style={[s.presetChip, on && s.dayChipActive]} onPress={() => { setNewStart(p.start); setNewEnd(p.end); setAddError('') }}>
                    <Text style={[s.dayChipText, on && s.dayChipTextActive]}>{p.label}</Text>
                    <Text style={[s.presetSub, on && s.dayChipTextActive]}>{p.start.slice(0, 2)}–{p.end.slice(0, 2)} h</Text>
                  </TouchableOpacity>
                )
              })}
            </View>
            <Text style={s.orExact}>o elegí la hora exacta</Text>

            {/* Inicio */}
            <Text style={s.fieldLabel}>DESDE</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.md }}>
              {TIME_OPTIONS.map(t => (
                <TouchableOpacity key={t} style={[s.timeChip, newStart === t && s.timeChipActive]} onPress={() => { setNewStart(t); setAddError(''); if (newEnd <= t) setNewEnd(TIME_OPTIONS[TIME_OPTIONS.indexOf(t) + 1] ?? t) }}>
                  <Text style={[s.timeChipText, newStart === t && s.timeChipTextActive]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Fin */}
            <Text style={s.fieldLabel}>HASTA</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.lg }}>
              {TIME_OPTIONS.filter(t => t > newStart).map(t => (
                <TouchableOpacity key={t} style={[s.timeChip, newEnd === t && s.timeChipActive]} onPress={() => { setNewEnd(t); setAddError('') }}>
                  <Text style={[s.timeChipText, newEnd === t && s.timeChipTextActive]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {addError ? <Text style={s.addError}>{addError}</Text> : null}
            <Button label={addingDays.length > 1 ? `Agregar a ${addingDays.length} días` : 'Agregar horario'} onPress={addSlot} fullWidth disabled={!addingDays.length} />
          </View>
        </View>
      </Modal>
      <Toast visible={toast.visible} message={toast.message} type={toast.type} onHide={hideToast} />
    </View>
  )
}

const s = StyleSheet.create({

  tabRow:          { flexDirection: 'row', backgroundColor: colors.white, borderBottomWidth: 0.5, borderColor: colors.borderLight },
  tab:             { flex: 1, paddingVertical: spacing.sm + 2, alignItems: 'center' },
  tabActive:       { borderBottomWidth: 2, borderColor: colors.sage },
  tabText:         { fontFamily: 'Nunito-SemiBold', fontSize: 13, color: colors.light },
  tabTextActive:   { color: colors.sage },
  dirtyHint:       { fontFamily: 'Nunito-SemiBold', fontSize: 12, color: colors.warnTx, textAlign: 'center', marginBottom: spacing.sm },
  addError:        { fontFamily: 'Nunito-SemiBold', fontSize: 12, color: colors.redTx, marginBottom: spacing.sm },
  daySection:      { marginBottom: spacing.md, backgroundColor: colors.white, ...radius.leaf, padding: spacing.md, borderWidth: 0.5, borderColor: colors.borderLight },
  dayHeader:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  dayName:         { fontFamily: 'Nunito-Bold', fontSize: 14, color: colors.dark },
  addBtn:          { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.sageLight, paddingHorizontal: spacing.sm, paddingVertical: 5, borderTopLeftRadius: 8, borderTopRightRadius: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 8 },
  addBtnText:      { fontFamily: 'Nunito-SemiBold', fontSize: 12, color: colors.sage },
  noSlots:         { fontFamily: 'Nunito-Regular', fontSize: 12, color: colors.light, fontStyle: 'italic' },
  slotRow:         { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs, borderTopWidth: 0.5, borderColor: colors.borderLight },
  slotType:        { paddingHorizontal: 8, paddingVertical: 3, borderTopLeftRadius: 8, borderTopRightRadius: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 8 },
  slotTypeText:    { fontFamily: 'Nunito-SemiBold', fontSize: 10 },
  slotTime:        { fontFamily: 'Nunito-Regular', fontSize: 13, color: colors.dark, flex: 1 },
  removeBtn:       { padding: 4 },
  zoneInfo:        { fontFamily: 'Nunito-Regular', fontSize: 12, color: colors.mid, marginBottom: spacing.md, lineHeight: 18 },
  zonesGrid:       { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  zoneChip:        { paddingVertical: 7, paddingHorizontal: 12, borderRadius: 999, backgroundColor: colors.white, borderWidth: 0.5, borderColor: colors.border },
  zoneChipActive:  { backgroundColor: colors.sage, borderColor: colors.sage },
  zoneText:        { fontFamily: 'Nunito-Regular', fontSize: 12, color: colors.mid },
  zoneTextActive:  { color: colors.white, fontFamily: 'Nunito-SemiBold' },
  intro:           { fontFamily: 'Nunito-Regular', fontSize: 13, color: colors.mid, lineHeight: 19, marginBottom: spacing.md },
  week:            { backgroundColor: colors.white, ...radius.leaf, borderWidth: 0.5, borderColor: colors.borderLight, paddingHorizontal: spacing.md, marginBottom: spacing.md },
  weekRow:         { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 10, minHeight: 50 },
  weekRowBorder:   { borderTopWidth: 0.5, borderColor: colors.borderLight },
  weekDay:         { width: 28, fontFamily: 'Nunito-Bold', fontSize: 14, color: colors.dark },
  weekDayEmpty:    { color: colors.light },
  weekSlots:       { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  weekNone:        { fontFamily: 'Nunito-Regular', fontSize: 14, color: colors.light },
  weekAdd:         { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.sageLight, alignItems: 'center', justifyContent: 'center' },
  pill:            { flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 10, paddingRight: 8, paddingVertical: 5, ...radius.leafSm },
  pillReg:         { backgroundColor: colors.sageLight },
  pillRep:         { backgroundColor: colors.goldLight },
  pillBoth:        { backgroundColor: colors.sageLighter, borderWidth: 0.5, borderColor: colors.mint },
  pillTime:        { fontFamily: 'Nunito-Bold', fontSize: 12, color: colors.dark },
  pillType:        { fontFamily: 'Nunito-SemiBold', fontSize: 11, color: colors.mid },
  labelRow:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  quickLink:       { fontFamily: 'Nunito-Bold', fontSize: 12, color: colors.sage, marginBottom: spacing.xs },
  daysRow:         { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: spacing.md },
  presetChip:      { paddingVertical: 7, paddingHorizontal: 12, ...radius.leafSm, backgroundColor: colors.cream, borderWidth: 0.5, borderColor: colors.border, alignItems: 'center' },
  presetSub:       { fontFamily: 'Nunito-Regular', fontSize: 10, color: colors.light, marginTop: 1 },
  orExact:         { fontFamily: 'Nunito-Regular', fontSize: 12, color: colors.light, marginBottom: spacing.sm },
  // Modal
  modalOverlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalBox:        { backgroundColor: colors.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: spacing.lg, paddingBottom: 40 },
  modalHeader:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg },
  modalTitle:      { fontFamily: 'Nunito-Bold', fontSize: 18, color: colors.dark },
  fieldLabel:      { ...typography.caption, marginBottom: spacing.xs },
  dayChip:         { minWidth: 42, alignItems: 'center', paddingVertical: 8, paddingHorizontal: 10, borderRadius: 999, backgroundColor: colors.cream, borderWidth: 0.5, borderColor: colors.border },
  dayChipActive:   { backgroundColor: colors.sage, borderColor: colors.sage },
  dayChipText:     { fontFamily: 'Nunito-SemiBold', fontSize: 12, color: colors.mid },
  dayChipTextActive:{ color: colors.white },
  typeBtn:         { flex: 1, paddingVertical: spacing.sm, borderTopLeftRadius: 14, borderTopRightRadius: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 14, backgroundColor: colors.cream, borderWidth: 0.5, borderColor: colors.border, alignItems: 'center' },
  typeBtnActive:   { backgroundColor: colors.sage, borderColor: colors.sage },
  typeBtnText:     { fontFamily: 'Nunito-SemiBold', fontSize: 13, color: colors.mid },
  typeBtnTextActive:{ color: colors.white },
  timeChip:        { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, backgroundColor: colors.cream, marginRight: spacing.xs, borderWidth: 0.5, borderColor: colors.border },
  timeChipActive:  { backgroundColor: colors.sage, borderColor: colors.sage },
  timeChipText:    { fontFamily: 'Nunito-SemiBold', fontSize: 12, color: colors.mid },
  timeChipTextActive:{ color: colors.white },
})
