// src/screens/studio/ProfileEditScreen.tsx
import React, { useState, useEffect } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput } from 'react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store'
import { useMyStudio } from '../../hooks'
import { LoadingScreen, colors, spacing } from '../../components/ui'
import { Feather } from '@expo/vector-icons'
import BlobCard from '../../components/BlobCard'
import HeroHeader from '../../components/HeroHeader'
import SaveButton from '../../components/SaveButton'
import Toast from '../../components/Toast'
import { useToast } from '../../hooks/useToast'

const EQUIPMENT_OPTIONS = [
  { key: 'mat',      label: 'Mat',       icon: 'layout' },
  { key: 'reformer', label: 'Reformer',  icon: 'sliders' },
  { key: 'cadillac', label: 'Cadillac',  icon: 'maximize' },
  { key: 'chair',    label: 'Chair',     icon: 'square' },
  { key: 'barrel',   label: 'Barrel',    icon: 'disc' },
  { key: 'tower',    label: 'Tower',     icon: 'server' },
]

export default function StudioProfileEditScreen({ navigation }: any) {
  const { data: studio, isLoading } = useMyStudio()
  const user = useAuthStore(s => s.user)
  const qc   = useQueryClient()
  const { toast, showToast, hideToast } = useToast()

  const [bio,        setBio]        = useState('')
  const [phone,      setPhone]      = useState('')
  const [instagram,  setInstagram]  = useState('')
  const [equipment,  setEquipment]  = useState<string[]>([])
  const [budgetReg,  setBudgetReg]  = useState('')
  const [budgetRep,  setBudgetRep]  = useState('')

  useEffect(() => {
    if (!studio) return
    setBio(studio.bio ?? '')
    setPhone(studio.phone ?? '')
    setInstagram(studio.instagram ?? '')
    setEquipment(studio.equipment ?? [])
    setBudgetReg(studio.budget_regular?.toString() ?? '')
    setBudgetRep(studio.budget_replacement?.toString() ?? '')
  }, [studio])

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('studios').update({
        bio:                bio.trim() || null,
        phone:              phone.trim() || null,
        instagram:          instagram.trim() || null,
        equipment,
        budget_regular:     budgetReg    ? parseInt(budgetReg)    : null,
        budget_replacement: budgetRep    ? parseInt(budgetRep)    : null,
      }).eq('id', studio!.id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-studio'] }),
    onError: (e: any) => showToast('Error: ' + e.message),
  })

  const toggleEquip = (key: string) =>
    setEquipment(prev => prev.includes(key) ? prev.filter(e => e !== key) : [...prev, key])

  const fmt = (val: string) => val ? '$' + parseInt(val).toLocaleString('es-AR') : '—'

  if (isLoading) return <LoadingScreen />

  return (
    <View style={{ flex: 1, backgroundColor: colors.cream }}>
      <HeroHeader
        title="Perfil del estudio"
        subtitle="Esta info alimenta el sistema de match"
      />

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

        {/* Info básica */}
        <BlobCard style={s.card} delay={0}>
          <Text style={s.sectionTitle}>INFORMACIÓN BÁSICA</Text>
          <Text style={s.label}>DESCRIPCIÓN</Text>
          <TextInput
            style={s.textarea}
            value={bio}
            onChangeText={setBio}
            placeholder="Contá de tu estudio: metodología, ambiente, nivel de alumnos..."
            placeholderTextColor={colors.light}
            multiline numberOfLines={3}
          />
          <View style={s.rowFields}>
            <View style={{ flex: 1 }}>
              <Text style={s.label}>TELÉFONO</Text>
              <TextInput style={s.input} value={phone} onChangeText={setPhone} placeholder="11 5555-6666" placeholderTextColor={colors.light} keyboardType="phone-pad" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.label}>INSTAGRAM</Text>
              <TextInput style={s.input} value={instagram} onChangeText={setInstagram} placeholder="@tuestudio" placeholderTextColor={colors.light} autoCapitalize="none" />
            </View>
          </View>
        </BlobCard>

        {/* Equipamiento — clave para el match */}
        <BlobCard style={s.card} delay={2000}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>EQUIPAMIENTO</Text>
            <View style={s.matchTag}>
              <Feather name="zap" size={10} color={colors.sage} />
              <Text style={s.matchTagTxt}>Afecta el match</Text>
            </View>
          </View>
          <Text style={s.hint}>Seleccioná el equipamiento disponible en tu estudio. Solo verás instructores que saben usarlo.</Text>
          <View style={s.equipGrid}>
            {EQUIPMENT_OPTIONS.map(e => (
              <TouchableOpacity
                key={e.key}
                style={[s.equipChip, equipment.includes(e.key) && s.equipChipActive]}
                onPress={() => toggleEquip(e.key)}
                activeOpacity={0.75}
              >
                <Feather
                  name={e.icon as any}
                  size={14}
                  color={equipment.includes(e.key) ? '#fff' : colors.sageMid}
                />
                <Text style={[s.equipLabel, equipment.includes(e.key) && s.equipLabelActive]}>
                  {e.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </BlobCard>

        {/* Presupuesto — clave para el match */}
        <BlobCard style={s.card} delay={4000} blobColor="rgba(184,150,12,0.10)" blobColor2="rgba(184,150,12,0.06)">
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>PRESUPUESTO POR HORA</Text>
            <View style={s.matchTag}>
              <Feather name="zap" size={10} color={colors.sage} />
              <Text style={s.matchTagTxt}>Afecta el match</Text>
            </View>
          </View>
          <Text style={s.hint}>Solo verás instructores cuya tarifa mínima esté dentro de tu presupuesto.</Text>

          <View style={s.rowFields}>
            <View style={{ flex: 1 }}>
              <Text style={s.label}>CLASE REGULAR</Text>
              <View style={s.budgetInput}>
                <Text style={s.budgetSign}>$</Text>
                <TextInput
                  style={s.budgetField}
                  value={budgetReg}
                  onChangeText={v => setBudgetReg(v.replace(/\D/g, ''))}
                  placeholder="8.500"
                  placeholderTextColor={colors.light}
                  keyboardType="numeric"
                />
              </View>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.label}>REEMPLAZO</Text>
              <View style={s.budgetInput}>
                <Text style={s.budgetSign}>$</Text>
                <TextInput
                  style={s.budgetField}
                  value={budgetRep}
                  onChangeText={v => setBudgetRep(v.replace(/\D/g, ''))}
                  placeholder="12.000"
                  placeholderTextColor={colors.light}
                  keyboardType="numeric"
                />
              </View>
            </View>
          </View>

          {(budgetReg || budgetRep) && (
            <View style={s.budgetSummary}>
              <Text style={s.budgetSummaryTxt}>
                Verás instructores hasta {fmt(budgetReg)} / h (regular) y {fmt(budgetRep)} / h (reemplazo)
              </Text>
            </View>
          )}
        </BlobCard>

        {/* Match preview */}
        {equipment.length > 0 && (budgetReg || budgetRep) && (
          <View style={s.matchPreview}>
            <Feather name="check-circle" size={16} color={colors.sage} />
            <Text style={s.matchPreviewTxt}>
              Tu perfil está completo. La app mostrará instructores que saben usar {equipment.map(e => e.charAt(0).toUpperCase() + e.slice(1)).join(', ')} y cobran dentro de tu presupuesto.
            </Text>
          </View>
        )}

        <SaveButton
          label="Guardar perfil"
          onPress={() => saveMutation.mutate()}
          isPending={saveMutation.isPending}
          isSuccess={saveMutation.isSuccess}
        />
      </ScrollView>

      <Toast visible={toast.visible} message={toast.message} type={toast.type} onHide={hideToast} />
    </View>
  )
}

const s = StyleSheet.create({
  content:        { padding: spacing.md, paddingBottom: 48 },
  card:           { padding: spacing.md, marginBottom: spacing.md },
  sectionHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  sectionTitle:   { fontFamily: 'Nunito-Bold', fontSize: 9, color: colors.light, letterSpacing: 0.8 },
  matchTag:       { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: colors.sageLight, borderTopLeftRadius: 8, borderTopRightRadius: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 8, paddingHorizontal: 7, paddingVertical: 2 },
  matchTagTxt:    { fontFamily: 'Nunito-Bold', fontSize: 9, color: colors.sage },
  hint:           { fontFamily: 'Nunito-Regular', fontSize: 12, color: colors.mid, lineHeight: 17, marginBottom: spacing.md },
  label:          { fontFamily: 'Nunito-Bold', fontSize: 9, color: colors.light, letterSpacing: 0.7, marginBottom: 5 },
  input:          { backgroundColor: colors.sageLighter, borderTopLeftRadius: 12, borderTopRightRadius: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 12, borderWidth: 0.5, borderColor: colors.border, padding: 12, fontFamily: 'Nunito-Regular', fontSize: 13, color: colors.dark },
  textarea:       { backgroundColor: colors.sageLighter, borderTopLeftRadius: 12, borderTopRightRadius: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 12, borderWidth: 0.5, borderColor: colors.border, padding: 12, fontFamily: 'Nunito-Regular', fontSize: 13, color: colors.dark, minHeight: 72, textAlignVertical: 'top', marginBottom: spacing.md },
  rowFields:      { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },

  equipGrid:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  equipChip:      { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 14, borderTopLeftRadius: 12, borderTopRightRadius: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 12, backgroundColor: colors.sageLighter, borderWidth: 0.5, borderColor: colors.border },
  equipChipActive:{ backgroundColor: colors.sage, borderColor: colors.sage },
  equipLabel:     { fontFamily: 'Nunito-Bold', fontSize: 12, color: colors.sageMid },
  equipLabelActive:{ color: '#fff' },

  budgetInput:    { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.goldLight, borderTopLeftRadius: 12, borderTopRightRadius: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 12, borderWidth: 0.5, borderColor: 'rgba(184,150,12,0.3)', paddingHorizontal: 12 },
  budgetSign:     { fontFamily: 'Nunito-Bold', fontSize: 16, color: colors.gold, marginRight: 4 },
  budgetField:    { flex: 1, fontFamily: 'Nunito-Bold', fontSize: 18, color: colors.gold, paddingVertical: 10 },
  budgetSummary:  { marginTop: spacing.md, backgroundColor: colors.goldLight, borderTopLeftRadius: 10, borderTopRightRadius: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 10, padding: spacing.sm },
  budgetSummaryTxt:{ fontFamily: 'Nunito-SemiBold', fontSize: 11, color: '#7A5000', lineHeight: 16 },

  matchPreview:   { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, backgroundColor: colors.sageLight, borderTopLeftRadius: 14, borderTopRightRadius: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 14, padding: spacing.md, marginBottom: spacing.md, borderWidth: 0.5, borderColor: colors.border },
  matchPreviewTxt:{ fontFamily: 'Nunito-SemiBold', fontSize: 12, color: colors.sage, flex: 1, lineHeight: 18 },
})
