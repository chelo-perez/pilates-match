// src/screens/instructor/ProfileEditScreen.tsx
import React, { useState, useEffect } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, FlatList, ActivityIndicator, Alert } from 'react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as ImagePicker from 'expo-image-picker'
import { decode } from 'base64-arraybuffer'
import * as DocumentPicker from 'expo-document-picker'
import { supabase } from '../../lib/supabase'
import { storage } from '../../lib/supabase'
import { useAuthStore } from '../../store'
import { Avatar, Button, Input, colors, spacing, radius } from '../../components/ui'
import Toast from '../../components/Toast'
import { useToast } from '../../hooks/useToast'
import { Feather } from '@expo/vector-icons'

const SPECIALTIES = [
  { key: 'mat', label: 'Mat' }, { key: 'reformer', label: 'Reformer' },
  { key: 'cadillac', label: 'Cadillac' }, { key: 'chair', label: 'Chair' },
  { key: 'TRX', label: 'TRX' }, { key: 'prenatal', label: 'Pre/post parto' },
  { key: 'terapeutico', label: 'Terapéutico' }, { key: 'adultos_mayores', label: 'Adultos mayores' },
]

const NEIGHBORHOODS = [
  'Agronomía','Almagro','Balvanera','Barracas','Belgrano','Boedo','Caballito',
  'Chacarita','Colegiales','Flores','Floresta','La Boca','Liniers','Mataderos',
  'Monte Castro','Montserrat','Nueva Pompeya','Núñez','Palermo','Parque Chacabuco',
  'Parque Patricios','Paternal','Puerto Madero','Recoleta','Retiro','San Cristóbal',
  'San Nicolás','San Telmo','Versalles','Villa Crespo','Villa del Parque','Villa Devoto',
  'Villa Lugano','Villa Luro','Villa Ortúzar','Villa Pueyrredón','Villa Real','Villa Urquiza',
]

export default function ProfileEditScreen({ navigation }: any) {
  const user = useAuthStore(s => s.user)
  const { reset } = useAuthStore()
  const { toast, showToast, hideToast } = useToast()
  const qc = useQueryClient()
  const [bio, setBio] = useState('')
  const [neighborhood, setNeighborhood] = useState('')
  const [phone, setPhone] = useState('')
  const [selectedSpecialties, setSelectedSpecialties] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadingCert, setUploadingCert] = useState(false)
  const [showNeighborhoodModal, setShowNeighborhoodModal] = useState(false)
  const [certName, setCertName] = useState('')
  const [certInstitution, setCertInstitution] = useState('')
  const [certYear, setCertYear] = useState('')
  const [showAddCert, setShowAddCert] = useState(false)

  const { data: instructor } = useQuery({
    queryKey: ['my-instructor-profile'],
    queryFn: async () => {
      const { data } = await supabase.from('instructors')
        .select(`*, specialties:instructor_specialties(*), certifications(*)`)
        .eq('user_id', user?.id).single()
      return data
    },
    enabled: !!user?.id,
  })

  useEffect(() => {
    if (instructor) {
      setBio(instructor.bio ?? '')
      setNeighborhood(instructor.neighborhood ?? '')
      setPhone(instructor.phone ?? '')
      setSelectedSpecialties((instructor.specialties ?? []).map((s: any) => s.specialty))
    }
  }, [instructor])

  const saveMutation = useMutation({
    mutationFn: async () => {
      await supabase.from('instructors').update({ bio, neighborhood, phone }).eq('id', instructor!.id)
      await supabase.from('instructor_specialties').delete().eq('instructor_id', instructor!.id)
      if (selectedSpecialties.length > 0) {
        await supabase.from('instructor_specialties').insert(
          selectedSpecialties.map(s => ({ instructor_id: instructor!.id, specialty: s }))
        )
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-instructor-profile'] })
      showToast('Perfil actualizado correctamente')
    },
  })

  const pickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') return
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 0.7, base64: true,
    })
    if (result.canceled || !result.assets[0]) return
    try {
      setUploading(true)
      const { base64, uri } = result.assets[0]
      if (!base64) throw new Error('No se pudo leer la imagen')
      const ext = uri.split('.').pop()?.toLowerCase().replace('jpeg','jpg') ?? 'jpg'
      const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg'
      const path = `${user!.id}/avatar.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, decode(base64), { upsert: true, contentType: mimeType })
      if (uploadError) throw uploadError
      const url = supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl
      await supabase.from('instructors').update({ avatar_url: url }).eq('id', instructor!.id)
      qc.invalidateQueries({ queryKey: ['my-instructor-profile'] })
      showToast('Foto de perfil actualizada')
    } catch (e: any) {
      showToast('Error al subir foto: ' + e.message)
    } finally { setUploading(false) }
  }

  const addCertification = async () => {
    if (!certName.trim()) { Alert.alert('Ingresá el nombre del certificado'); return }
    try {
      setUploadingCert(true)
      const { data: certData, error: certError } = await supabase.from('certifications').insert({
        instructor_id: instructor!.id, name: certName.trim(),
        institution: certInstitution.trim() || null,
        year: certYear ? parseInt(certYear) : null, verified: false,
      }).select().single()
      if (certError) throw certError
      const docResult = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*'], copyToCacheDirectory: true })
      if (!docResult.canceled && docResult.assets?.[0] && certData) {
        try {
          const asset = docResult.assets[0]
          const blob = await (await fetch(asset.uri)).blob()
          const fileUrl = await storage.uploadCertification(instructor!.id, certData.id, blob)
          if (fileUrl) await supabase.from('certifications').update({ file_url: fileUrl }).eq('id', certData.id)
        } catch (e) { console.log('Error archivo:', e) }
      }
      qc.invalidateQueries({ queryKey: ['my-instructor-profile'] })
      setCertName(''); setCertInstitution(''); setCertYear(''); setShowAddCert(false)
      showToast('Certificado agregado correctamente')
    } catch (e: any) { Alert.alert('Error', e.message)
    } finally { setUploadingCert(false) }
  }

  const deleteCert = (certId: string) => {
    Alert.alert('Eliminar certificado', '¿Seguro?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: async () => {
        await supabase.from('certifications').delete().eq('id', certId)
        qc.invalidateQueries({ queryKey: ['my-instructor-profile'] })
      }},
    ])
  }

  const toggleSpecialty = (key: string) =>
    setSelectedSpecialties(prev => prev.includes(key) ? prev.filter(s => s !== key) : [...prev, key])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    reset()
  }

  const isVerified = instructor?.verification_status === 'verificado' || instructor?.verification_status === 'verified'

  return (
    <View style={{ flex: 1, backgroundColor: colors.cream }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <View style={s.hero}>
          <TouchableOpacity onPress={pickAvatar} disabled={uploading} style={s.avatarWrap}>
            <Avatar name={instructor?.full_name ?? 'I'} size={72} imageUrl={instructor?.avatar_url} />
            <View style={s.avatarEdit}>
              {uploading ? <ActivityIndicator size="small" color={colors.white} /> : <Feather name="camera" size={12} color={colors.white} />}
            </View>
          </TouchableOpacity>
          <View style={{ flex: 1, marginLeft: spacing.md }}>
            <Text style={s.heroName}>{instructor?.full_name}</Text>
            <View style={[s.veriBadge, { backgroundColor: isVerified ? 'rgba(255,255,255,0.2)' : 'rgba(239,159,39,0.25)' }]}>
              <Text style={[s.veriText, { color: isVerified ? colors.white : '#FFD080' }]}>
                {isVerified ? '✓ Verificado · CAPIAF' : '⏳ Pendiente de verificación'}
              </Text>
            </View>
          </View>
          <TouchableOpacity style={s.logoutPill} onPress={handleSignOut}>
            <Feather name="log-out" size={13} color="rgba(255,255,255,0.65)" />
            <Text style={s.logoutPillTxt}>Salir</Text>
          </TouchableOpacity>
        </View>

        <View style={s.section}>
          <Text style={s.sectionLabel}>INFORMACIÓN PERSONAL</Text>
          <Input label="SOBRE MÍ" placeholder="Contá tu experiencia..." value={bio} onChangeText={setBio} multiline />
          <View style={s.rowFields}>
            <View style={{ flex: 1 }}>
              <Text style={s.fieldLabel}>BARRIO BASE</Text>
              <TouchableOpacity style={s.selector} onPress={() => setShowNeighborhoodModal(true)}>
                <Text style={[s.selectorText, !neighborhood && { color: colors.light }]} numberOfLines={1}>
                  {neighborhood || 'Seleccioná'}
                </Text>
                <Feather name="chevron-down" size={14} color={colors.light} />
              </TouchableOpacity>
            </View>
            <View style={{ flex: 1 }}>
              <Input label="TELÉFONO" placeholder="11 5555-6666" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
            </View>
          </View>
        </View>

        <View style={s.section}>
          <Text style={s.sectionLabel}>MIS ESPECIALIDADES</Text>
          <View style={s.chipsGrid}>
            {SPECIALTIES.map(sp => (
              <TouchableOpacity key={sp.key}
                style={[s.chip, selectedSpecialties.includes(sp.key) && s.chipActive]}
                onPress={() => toggleSpecialty(sp.key)}>
                <Text style={[s.chipText, selectedSpecialties.includes(sp.key) && s.chipTextActive]}>{sp.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionLabel}>CERTIFICACIONES</Text>
            <TouchableOpacity style={s.addBtn} onPress={() => setShowAddCert(true)}>
              <Feather name="plus" size={14} color={colors.sage} />
              <Text style={s.addBtnText}>Agregar</Text>
            </TouchableOpacity>
          </View>
          <Text style={s.note}>Subí tus certificados en PDF o foto. La Cámara los verifica para validar tu perfil.</Text>
          {(instructor?.certifications ?? []).length === 0 ? (
            <View style={s.emptyBox}>
              <Feather name="award" size={28} color={colors.border} />
              <Text style={s.emptyText}>Sin certificaciones cargadas</Text>
            </View>
          ) : (instructor?.certifications ?? []).map((cert: any) => (
            <View key={cert.id} style={s.certRow}>
              <View style={s.certIcon}><Feather name="award" size={18} color={colors.sage} /></View>
              <View style={{ flex: 1 }}>
                <Text style={s.certName}>{cert.name}</Text>
                {cert.institution && <Text style={s.certMeta}>{cert.institution}{cert.year ? ` · ${cert.year}` : ''}</Text>}
                <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
                  <View style={[s.miniTag, { backgroundColor: cert.verified ? colors.sageLight : colors.warnBg }]}>
                    <Text style={[s.miniTagText, { color: cert.verified ? colors.sage : colors.warnTx }]}>
                      {cert.verified ? '✓ Verificado' : 'En revisión'}
                    </Text>
                  </View>
                  {cert.file_url && (
                    <View style={[s.miniTag, { backgroundColor: colors.blueBg }]}>
                      <Text style={[s.miniTagText, { color: colors.blueTx }]}>Archivo adjunto</Text>
                    </View>
                  )}
                </View>
              </View>
              <TouchableOpacity onPress={() => deleteCert(cert.id)} style={{ padding: 4 }}>
                <Feather name="trash-2" size={16} color={colors.redTx} />
              </TouchableOpacity>
            </View>
          ))}
        </View>

        <View style={{ paddingHorizontal: spacing.md }}>
          <Button label="Guardar perfil" onPress={() => saveMutation.mutate()} isLoading={saveMutation.isPending} fullWidth size="lg" />
        </View>
      </ScrollView>

      <Modal visible={showNeighborhoodModal} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={[s.modalBox, { maxHeight: '80%' }]}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Seleccioná tu barrio</Text>
              <TouchableOpacity onPress={() => setShowNeighborhoodModal(false)}>
                <Feather name="x" size={22} color={colors.mid} />
              </TouchableOpacity>
            </View>
            <FlatList data={NEIGHBORHOODS} keyExtractor={i => i} renderItem={({ item }) => (
              <TouchableOpacity
                style={[s.neighborhoodItem, neighborhood === item && s.neighborhoodItemActive]}
                onPress={() => { setNeighborhood(item); setShowNeighborhoodModal(false) }}>
                <Text style={[s.neighborhoodText, neighborhood === item && s.neighborhoodTextActive]}>{item}</Text>
                {neighborhood === item && <Feather name="check" size={16} color={colors.sage} />}
              </TouchableOpacity>
            )} />
          </View>
        </View>
      </Modal>

      <Modal visible={showAddCert} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={s.modalBox}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Agregar certificado</Text>
              <TouchableOpacity onPress={() => setShowAddCert(false)}>
                <Feather name="x" size={22} color={colors.mid} />
              </TouchableOpacity>
            </View>
            <Input label="NOMBRE" placeholder="Ej: Instructora de Mat Pilates" value={certName} onChangeText={setCertName} />
            <Input label="INSTITUCIÓN" placeholder="Ej: Stott Pilates..." value={certInstitution} onChangeText={setCertInstitution} />
            <Input label="AÑO" placeholder="2023" value={certYear} onChangeText={setCertYear} keyboardType="numeric" />
            <View style={s.fileNote}>
              <Feather name="file-text" size={14} color={colors.mid} />
              <Text style={s.fileNoteText}>Al tocar "Agregar" podrás adjuntar el certificado en PDF o foto.</Text>
            </View>
            <Button label="Agregar y adjuntar archivo" onPress={addCertification} isLoading={uploadingCert} fullWidth />
          </View>
        </View>
      </Modal>
    </View>
  )
}

const s = StyleSheet.create({
  rowFields:          { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  logoutPill:         { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  logoutPillTxt:      { fontFamily: 'Nunito-SemiBold', fontSize: 11, color: 'rgba(255,255,255,0.65)' },
  hero:               { backgroundColor: '#3D5440', paddingTop: 52, paddingBottom: 44, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', position: 'relative', overflow: 'hidden' },
  heroName:           { fontFamily: 'Nunito-Bold', fontSize: 20, color: colors.white, marginBottom: 6 },
  avatarWrap:         { position: 'relative' },
  avatarEdit:         { position: 'absolute', bottom: 0, right: 0, width: 24, height: 24, borderTopLeftRadius: 12, borderTopRightRadius: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 12, backgroundColor: colors.sage, borderWidth: 2, borderColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  veriBadge:          { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  veriText:           { fontFamily: 'Nunito-SemiBold', fontSize: 11 },
  section:            { backgroundColor: colors.white, marginTop: 8, padding: spacing.md, borderTopWidth: 0.5, borderBottomWidth: 0.5, borderColor: colors.borderLight },
  sectionHeader:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  sectionLabel:       { fontFamily: 'Nunito-Bold', fontSize: 10, color: colors.light, letterSpacing: 0.8, marginBottom: spacing.md },
  fieldLabel:         { fontFamily: 'Nunito-Bold', fontSize: 10, color: colors.light, letterSpacing: 0.7, marginBottom: spacing.xs },
  selector:           { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', height: 48, borderWidth: 0.5, borderColor: colors.border, borderTopLeftRadius: 14, borderTopRightRadius: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 14, paddingHorizontal: spacing.md, backgroundColor: colors.cream, marginBottom: spacing.md },
  selectorText:       { fontFamily: 'Nunito-Regular', fontSize: 14, color: colors.dark },
  chipsGrid:          { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip:               { paddingVertical: 7, paddingHorizontal: 14, borderRadius: 999, backgroundColor: colors.cream, borderWidth: 0.5, borderColor: colors.border },
  chipActive:         { backgroundColor: colors.sage, borderColor: colors.sage },
  chipText:           { fontFamily: 'Nunito-Regular', fontSize: 12, color: colors.mid },
  chipTextActive:     { color: colors.white, fontFamily: 'Nunito-SemiBold' },
  addBtn:             { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.sageLight, paddingHorizontal: spacing.sm, paddingVertical: 5, borderTopLeftRadius: 8, borderTopRightRadius: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 8 },
  addBtnText:         { fontFamily: 'Nunito-SemiBold', fontSize: 12, color: colors.sage },
  note:               { fontFamily: 'Nunito-Regular', fontSize: 12, color: colors.mid, marginBottom: spacing.md, lineHeight: 18 },
  certRow:            { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, paddingVertical: spacing.sm, borderTopWidth: 0.5, borderColor: colors.borderLight },
  certIcon:           { width: 36, height: 36, borderRadius: 8, backgroundColor: colors.sageLight, alignItems: 'center', justifyContent: 'center' },
  certName:           { fontFamily: 'Nunito-SemiBold', fontSize: 13, color: colors.dark },
  certMeta:           { fontFamily: 'Nunito-Regular', fontSize: 11, color: colors.mid, marginTop: 2 },
  miniTag:            { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 5 },
  miniTagText:        { fontFamily: 'Nunito-SemiBold', fontSize: 9 },
  emptyBox:           { alignItems: 'center', paddingVertical: spacing.lg, gap: spacing.sm },
  emptyText:          { fontFamily: 'Nunito-Regular', fontSize: 13, color: colors.light },
  fileNote:           { flexDirection: 'row', gap: spacing.xs, alignItems: 'flex-start', backgroundColor: colors.cream, borderTopLeftRadius: 8, borderTopRightRadius: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 8, padding: spacing.sm, marginBottom: spacing.md },
  fileNoteText:       { fontFamily: 'Nunito-Regular', fontSize: 12, color: colors.mid, flex: 1, lineHeight: 18 },
  modalOverlay:       { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalBox:           { backgroundColor: colors.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: spacing.lg, paddingBottom: 40 },
  modalHeader:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg },
  modalTitle:         { fontFamily: 'Nunito-Bold', fontSize: 18, color: colors.dark },
  neighborhoodItem:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.sm + 2, paddingHorizontal: spacing.sm, borderBottomWidth: 0.5, borderColor: colors.borderLight },
  neighborhoodItemActive:{ backgroundColor: colors.sageLighter },
  neighborhoodText:   { fontFamily: 'Nunito-Regular', fontSize: 14, color: colors.dark },
  neighborhoodTextActive:{ fontFamily: 'Nunito-SemiBold', color: colors.sage },
})
