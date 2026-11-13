// src/screens/studio/ProfileEditScreen.tsx
import React, { useState, useEffect } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert } from 'react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { usePhotoCropper } from '../../components/PhotoCropper'
import * as FileSystem from 'expo-file-system/legacy'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store'
import { useMyStudio } from '../../hooks'
import { LoadingScreen, colors, spacing, typography } from '../../components/ui'
import { SPECIALTY_LABELS } from '../../constants/labels'
import { humanizeError, UserError } from '../../lib/errors'
import { Feather } from '@expo/vector-icons'
import BlobCard from '../../components/BlobCard'
import HeroHeader from '../../components/HeroHeader'
import SaveButton from '../../components/SaveButton'
import Toast from '../../components/Toast'
import { useToast } from '../../hooks/useToast'
import DeleteAccount from '../../components/DeleteAccount'
import BarrioSelect from '../../components/BarrioSelect'
import { BARRIOS_CABA } from '../../constants/barrios'

// Deben coincidir con el enum specialty para poder compararse con los instructores
const EQUIPMENT_OPTIONS = [
  { key: 'mat',      icon: 'layout' },
  { key: 'reformer', icon: 'sliders' },
  { key: 'cadillac', icon: 'maximize' },
  { key: 'chair',    icon: 'square' },
  { key: 'barrel',   icon: 'disc' },
] as const
const EQUIPMENT_KEYS: string[] = EQUIPMENT_OPTIONS.map(e => e.key)
const equipLabel = (k: string) => (SPECIALTY_LABELS as Record<string, string>)[k] ?? k

export default function StudioProfileEditScreen({ navigation }: any) {
  const { pickPhoto, cropModal } = usePhotoCropper('Ajustá el logo')
  const { data: studio, isLoading } = useMyStudio()
  const user = useAuthStore(s => s.user)
  const qc   = useQueryClient()
  const { toast, showToast, hideToast } = useToast()

  const [barrio,     setBarrio]     = useState('')
  const [bio,        setBio]        = useState('')
  const [phone,      setPhone]      = useState('')
  const [instagram,  setInstagram]  = useState('')
  const [equipment,  setEquipment]  = useState<string[]>([])
  const [budgetReg,  setBudgetReg]  = useState('')
  const [budgetRep,  setBudgetRep]  = useState('')
  const [uploading,  setUploading]  = useState(false)

  useEffect(() => {
    if (!studio) return
    // Solo barrios reales: las cuentas viejas tienen "Buenos Aires" y hay que elegirlo de nuevo
    setBarrio(BARRIOS_CABA.includes(studio.neighborhood ?? '') ? studio.neighborhood! : '')
    setBio(studio.bio ?? '')
    setPhone(studio.phone ?? '')
    setInstagram(studio.instagram ?? '')
    setEquipment((studio.equipment ?? []).filter((e: string) => EQUIPMENT_KEYS.includes(e)))
    setBudgetReg(studio.budget_regular?.toString() ?? '')
    setBudgetRep(studio.budget_replacement?.toString() ?? '')
  }, [studio])


  const pickLogo = async () => {
    // Sin el recortador nativo (en Android 15 no deja guardar): recortamos nosotros
    let pickedUri: string | null
    try { pickedUri = await pickPhoto() } catch (e) { showToast(humanizeError(e), 'warning'); return }
    if (!pickedUri) return
    try {
      setUploading(true)
      const cacheUri = FileSystem.cacheDirectory + 'logo_' + Date.now() + '.jpg'
      await FileSystem.copyAsync({ from: pickedUri, to: cacheUri })
      const base64 = await FileSystem.readAsStringAsync(cacheUri, { encoding: FileSystem.EncodingType.Base64 })
      const binary = atob(base64)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
      if (!user?.id) throw new Error('Sin sesión')
      // El bucket avatars exige que el path empiece con el uid del usuario
      const path = `${user.id}/studio-logo.jpg`
      const { error } = await supabase.storage.from('avatars').upload(path, bytes, { upsert: true, contentType: 'image/jpeg' })
      if (error) throw error
      const url = supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl + '?t=' + Date.now()
      const { error: updError } = await supabase.from('studios').update({ logo_url: url }).eq('id', studio!.id)
      if (updError) throw updError
      qc.invalidateQueries({ queryKey: ['my-studio'] })
      showToast('Logo actualizado')
    } catch (e: any) { showToast(humanizeError(e), 'error') }
    finally { setUploading(false) }
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!barrio) throw new UserError('Elegí el barrio de tu estudio')
      const { error } = await supabase.from('studios').update({
        neighborhood:       barrio,
        bio:                bio.trim() || null,
        phone:              phone.trim() || null,
        instagram:          instagram.trim() || null,
        equipment,
        budget_regular:     budgetReg    ? parseInt(budgetReg, 10)    : null,
        budget_replacement: budgetRep    ? parseInt(budgetRep, 10)    : null,
      }).eq('id', studio!.id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-studio'] })
      qc.invalidateQueries({ queryKey: ['instructor-match'] })
      qc.invalidateQueries({ queryKey: ['studio'] })
      showToast('Perfil guardado')
    },
    onError: (e: any) => showToast(humanizeError(e), 'error'),
  })

  const toggleEquip = (key: string) =>
    setEquipment(prev => prev.includes(key) ? prev.filter(e => e !== key) : [...prev, key])

  const fmt = (val: string) => val ? '$' + parseInt(val, 10).toLocaleString('es-AR') : '—'

  if (isLoading) return <LoadingScreen />

  return (
    <View style={{ flex: 1, backgroundColor: colors.cream }}>
      <HeroHeader
        title="Perfil del estudio"
        subtitle="Con estos datos calculamos qué instructores te convienen"
        onBack={() => navigation.goBack()}
        backLabel="Inicio"
      />

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

        {/* Info básica */}
        {/* Logo del estudio */}
        <BlobCard style={s.card} delay={0}>
          <Text style={s.sectionTitle}>LOGO DEL ESTUDIO</Text>
          <TouchableOpacity style={s.logoBtn} onPress={pickLogo} disabled={uploading} activeOpacity={0.8}>
            <Feather name="upload" size={16} color={colors.sage} />
            <Text style={s.logoBtnTxt}>{uploading ? 'Subiendo...' : studio?.logo_url ? 'Cambiar logo' : 'Subir logo'}</Text>
          </TouchableOpacity>
          <Text style={s.hint}>Imagen cuadrada, idealmente de 512 × 512 px o más.</Text>
        </BlobCard>

        <BlobCard style={s.card} delay={300}>
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

        {/* Barrio — clave para el match por zona */}
        <BlobCard style={s.card} delay={1000}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>UBICACIÓN</Text>
            <View style={s.matchTag}>
              <Feather name="zap" size={10} color={colors.sage} />
              <Text style={s.matchTagTxt}>Afecta el match</Text>
            </View>
          </View>
          <Text style={s.hint}>Te mostramos primero a quienes trabajan en tu barrio.</Text>
          <BarrioSelect value={barrio} onChange={setBarrio} label="BARRIO DEL ESTUDIO"
            error={!barrio && studio?.neighborhood ? `"${studio.neighborhood}" no es un barrio: elegilo de la lista` : undefined} />
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
          <Text style={s.hint}>Elegí el equipamiento que tiene tu estudio. Te mostramos primero a quienes saben usarlo.</Text>
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
                  color={equipment.includes(e.key) ? colors.white : colors.sageMid}
                />
                <Text style={[s.equipLabel, equipment.includes(e.key) && s.equipLabelActive]}>
                  {equipLabel(e.key)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </BlobCard>

        {/* Presupuesto — clave para el match */}
        <BlobCard style={s.card} delay={4000}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>PRESUPUESTO POR CLASE</Text>
          </View>
          <Text style={s.hint}>Cuánto pagás por clase. Lo usamos como monto sugerido cuando hacés una propuesta o publicás una clase abierta; siempre lo podés cambiar.</Text>

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
                Hasta {fmt(budgetReg)} por clase regular y {fmt(budgetRep)} por reemplazo
              </Text>
            </View>
          )}
        </BlobCard>

        {/* Match preview */}
        {equipment.length > 0 && (budgetReg || budgetRep) && (
          <View style={s.matchPreview}>
            <Feather name="check-circle" size={16} color={colors.sage} />
            <Text style={s.matchPreviewTxt}>
              Perfil completo. Vas a ver primero a quienes saben usar {equipment.map(equipLabel).join(', ')} y cobran dentro de tu presupuesto.
            </Text>
          </View>
        )}

        <SaveButton
          label="Guardar perfil"
          onPress={() => saveMutation.mutate()}
          isPending={saveMutation.isPending}
          isSuccess={saveMutation.isSuccess}
        />
        <DeleteAccount />
      </ScrollView>

      <Toast visible={toast.visible} message={toast.message} type={toast.type} onHide={hideToast} />
      {cropModal}
    </View>
  )
}

const s = StyleSheet.create({
  content:        { padding: spacing.md, paddingBottom: 48 },
  card:           { padding: spacing.md, marginBottom: spacing.md },
  sectionHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  sectionTitle:   { ...typography.caption },
  matchTag:       { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: colors.sageLight, borderTopLeftRadius: 8, borderTopRightRadius: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 8, paddingHorizontal: 7, paddingVertical: 2 },
  matchTagTxt:    { fontFamily: 'Nunito-Bold', fontSize: 10, color: colors.sage },
  logoBtn:  { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.sageLight, borderTopLeftRadius: 12, borderTopRightRadius: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 12, padding: 14, borderWidth: 0.5, borderColor: colors.border },
  logoBtnTxt: { fontFamily: 'Nunito-Bold', fontSize: 14, color: colors.sage },
  hint:           { fontFamily: 'Nunito-Regular', fontSize: 12, color: colors.mid, lineHeight: 17, marginBottom: spacing.md },
  label:          { ...typography.caption, marginBottom: 5 },
  input:          { backgroundColor: colors.sageLighter, borderTopLeftRadius: 12, borderTopRightRadius: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 12, borderWidth: 0.5, borderColor: colors.border, padding: 12, fontFamily: 'Nunito-Regular', fontSize: 13, color: colors.dark },
  textarea:       { backgroundColor: colors.sageLighter, borderTopLeftRadius: 12, borderTopRightRadius: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 12, borderWidth: 0.5, borderColor: colors.border, padding: 12, fontFamily: 'Nunito-Regular', fontSize: 13, color: colors.dark, minHeight: 72, textAlignVertical: 'top', marginBottom: spacing.md },
  rowFields:      { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },

  equipGrid:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  equipChip:      { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 14, borderTopLeftRadius: 12, borderTopRightRadius: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 12, backgroundColor: colors.sageLighter, borderWidth: 0.5, borderColor: colors.border },
  equipChipActive:{ backgroundColor: colors.sage, borderColor: colors.sage },
  equipLabel:     { fontFamily: 'Nunito-Bold', fontSize: 12, color: colors.sageMid },
  equipLabelActive:{ color: colors.white },

  budgetInput:    { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.goldLight, borderTopLeftRadius: 12, borderTopRightRadius: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 12, borderWidth: 0.5, borderColor: colors.border, paddingHorizontal: 12 },
  budgetSign:     { fontFamily: 'Nunito-Bold', fontSize: 16, color: colors.gold, marginRight: 4 },
  budgetField:    { flex: 1, fontFamily: 'Nunito-Bold', fontSize: 18, color: colors.gold, paddingVertical: 10 },
  budgetSummary:  { marginTop: spacing.md, backgroundColor: colors.goldLight, borderTopLeftRadius: 10, borderTopRightRadius: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 10, padding: spacing.sm },
  budgetSummaryTxt:{ fontFamily: 'Nunito-SemiBold', fontSize: 11, color: colors.warnTx, lineHeight: 16 },

  matchPreview:   { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, backgroundColor: colors.sageLight, borderTopLeftRadius: 14, borderTopRightRadius: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 14, padding: spacing.md, marginBottom: spacing.md, borderWidth: 0.5, borderColor: colors.border },
  matchPreviewTxt:{ fontFamily: 'Nunito-SemiBold', fontSize: 12, color: colors.sage, flex: 1, lineHeight: 18 },
})
