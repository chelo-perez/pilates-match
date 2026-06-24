// src/screens/instructor/ProfileEditScreen.tsx
import React, { useState, useEffect } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, Modal, FlatList
} from 'react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as ImagePicker from 'expo-image-picker'
import * as DocumentPicker from 'expo-document-picker'
import { supabase } from '../../lib/supabase'
import { storage } from '../../lib/supabase'
import { useAuthStore } from '../../store'
import { Avatar, Button, Input, Badge, colors, spacing, typography, radius } from '../../components/ui'
import { Feather } from '@expo/vector-icons'

const SPECIALTIES = [
  { key: 'mat', label: 'Mat' },
  { key: 'reformer', label: 'Reformer' },
  { key: 'cadillac', label: 'Cadillac' },
  { key: 'chair', label: 'Chair' },
  { key: 'TRX', label: 'TRX' },
  { key: 'prenatal', label: 'Pre/post parto' },
  { key: 'terapeutico', label: 'Terapéutico' },
  { key: 'adultos_mayores', label: 'Adultos mayores' },
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

export default function ProfileEditScreen({ navigation }: any) {
  const user = useAuthStore(s => s.user)
  const { reset } = useAuthStore()
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
      Alert.alert('✓ Perfil actualizado')
    },
  })

  const pickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') return
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [1, 1], quality: 0.7,
    })
    if (result.canceled || !result.assets[0]) return
    try {
      setUploading(true)
      const uri = result.assets[0].uri
      const ext = uri.split('.').pop() ?? 'jpg'
      const path = `${user!.id}/avatar.${ext}`
      const formData = new FormData()
      formData.append('file', { uri, name: `avatar.${ext}`, type: `image/${ext}` } as any)
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, formData, { upsert: true, contentType: `image/${ext}` })
      if (uploadError) throw uploadError
      const url = supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl
      await supabase.from('instructors').update({ avatar_url: url }).eq('id', instructor!.id)
      qc.invalidateQueries({ queryKey: ['my-instructor-profile'] })
      Alert.alert('✓ Foto actualizada')
    } catch (e: any) {
      Alert.alert('Error al subir foto', e.message)
    } finally {
      setUploading(false)
    }
  }

  const addCertification = async () => {
    if (!certName.trim()) {
      Alert.alert('Falta el nombre del certificado')
      return
    }
    try {
      setUploadingCert(true)

      // Primero crear el registro para obtener el ID
      const { data: certData, error: certError } = await supabase.from('certifications').insert({
        instructor_id: instructor!.id,
        name: certName.trim(),
        institution: certInstitution.trim() || null,
        year: certYear ? parseInt(certYear) : null,
        verified: false,
      }).select().single()

      if (certError) throw certError

      // Subir archivo usando storage.uploadCertification
      const docResult = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      })

      if (!docResult.canceled && docResult.assets?.[0] && certData) {
        try {
          const asset = docResult.assets[0]
          const blob = await (await fetch(asset.uri)).blob()
          const fileUrl = await storage.uploadCertification(instructor!.id, certData.id, blob)
          if (fileUrl) {
            await supabase.from('certifications').update({ file_url: fileUrl }).eq('id', certData.id)
          }
        } catch (uploadErr) {
          console.log('Error subiendo archivo:', uploadErr)
          // El certificado se guardó igual, solo sin archivo
        }
      }

      qc.invalidateQueries({ queryKey: ['my-instructor-profile'] })
      setCertName('')
      setCertInstitution('')
      setCertYear('')
      setShowAddCert(false)
      Alert.alert('✓ Certificado agregado', 'La Cámara lo revisará para verificarlo.')
    } catch (e: any) {
      Alert.alert('Error', e.message)
    } finally {
      setUploadingCert(false)
    }
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

  const handleSignOut = () => {
    Alert.alert('Cerrar sesión', '¿Seguro que querés salir?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Salir', style: 'destructive', onPress: async () => {
        await supabase.auth.signOut()
        reset()
      }},
    ])
  }

  const isVerified = instructor?.verification_status === 'verificado' || instructor?.verification_status === 'verified'

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.cream }} contentContainerStyle={{ paddingBottom: 120 }}>

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={pickAvatar} disabled={uploading} style={s.avatarWrap}>
          <Avatar name={instructor?.full_name ?? 'I'} size={72} />
          <View style={s.avatarEdit}>
            <Feather name="camera" size={12} color={colors.white} />
          </View>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.name}>{instructor?.full_name}</Text>
          <View style={{ flexDirection: 'row', gap: spacing.xs, marginTop: spacing.xs }}>
            <View style={[s.statusBadge, { backgroundColor: isVerified ? colors.sageLight : colors.warnBg }]}>
              <Text style={[s.statusText, { color: isVerified ? colors.sage : colors.warnTx }]}>
                {isVerified ? '✓ Verificado' : '⏳ Pendiente'}
              </Text>
            </View>
          </View>
        </View>
      </View>

      <View style={s.section}>
        <Text style={s.sectionTitle}>INFORMACIÓN PERSONAL</Text>

        <Input label="SOBRE MÍ" placeholder="Contá tu experiencia y lo que te apasiona..."
          value={bio} onChangeText={setBio} multiline />

        {/* Barrio base — selector de lista */}
        <Text style={s.inputLabel}>BARRIO BASE</Text>
        <TouchableOpacity style={s.selectorBtn} onPress={() => setShowNeighborhoodModal(true)}>
          <Text style={[s.selectorText, !neighborhood && { color: colors.light }]}>
            {neighborhood || 'Seleccioná tu barrio'}
          </Text>
          <Feather name="chevron-down" size={16} color={colors.light} />
        </TouchableOpacity>

        <Input label="TELÉFONO" placeholder="11 5555-6666"
          value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
      </View>

      {/* Especialidades */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>MIS ESPECIALIDADES</Text>
        <View style={s.chipsGrid}>
          {SPECIALTIES.map(sp => (
            <TouchableOpacity
              key={sp.key}
              style={[s.chip, selectedSpecialties.includes(sp.key) && s.chipActive]}
              onPress={() => toggleSpecialty(sp.key)}
            >
              <Text style={[s.chipText, selectedSpecialties.includes(sp.key) && s.chipTextActive]}>
                {sp.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Certificaciones */}
      <View style={s.section}>
        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>CERTIFICACIONES</Text>
          <TouchableOpacity style={s.addBtn} onPress={() => setShowAddCert(true)}>
            <Feather name="plus" size={14} color={colors.sage} />
            <Text style={s.addBtnText}>Agregar</Text>
          </TouchableOpacity>
        </View>
        <Text style={s.sectionNote}>
          Subí tus certificados en PDF o foto. La Cámara los verifica para validar tu perfil.
        </Text>

        {(instructor?.certifications ?? []).length === 0 ? (
          <View style={s.emptyCerts}>
            <Feather name="award" size={28} color={colors.border} />
            <Text style={s.emptyCertsText}>Sin certificaciones cargadas</Text>
          </View>
        ) : (
          (instructor?.certifications ?? []).map((cert: any) => (
            <View key={cert.id} style={s.certRow}>
              <View style={s.certIcon}>
                <Feather name="award" size={18} color={colors.sage} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.certName}>{cert.name}</Text>
                {cert.institution && <Text style={s.certMeta}>{cert.institution}{cert.year ? ` · ${cert.year}` : ''}</Text>}
                <View style={{ flexDirection: 'row', gap: spacing.xs, marginTop: 4 }}>
                  {cert.verified
                    ? <View style={[s.statusBadge, { backgroundColor: colors.sageLight }]}><Text style={[s.statusText, { color: colors.sage }]}>✓ Verificado</Text></View>
                    : <View style={[s.statusBadge, { backgroundColor: colors.warnBg }]}><Text style={[s.statusText, { color: colors.warnTx }]}>En revisión</Text></View>
                  }
                  {cert.file_url && (
                    <View style={[s.statusBadge, { backgroundColor: colors.blueBg }]}>
                      <Text style={[s.statusText, { color: colors.blueTx }]}>Archivo adjunto</Text>
                    </View>
                  )}
                </View>
              </View>
              <TouchableOpacity onPress={() => deleteCert(cert.id)} style={{ padding: 4 }}>
                <Feather name="trash-2" size={16} color={colors.redTx} />
              </TouchableOpacity>
            </View>
          ))
        )}
      </View>

      <View style={{ paddingHorizontal: spacing.md }}>
        <Button label="Guardar perfil" onPress={() => saveMutation.mutate()}
          isLoading={saveMutation.isPending} fullWidth size="lg" />
        <Button label="Cerrar sesión" variant="secondary" onPress={handleSignOut}
          fullWidth style={{ marginTop: spacing.sm }} />
      </View>

      {/* Modal barrio */}
      <Modal visible={showNeighborhoodModal} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={[s.modalBox, { maxHeight: '80%' }]}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Seleccioná tu barrio</Text>
              <TouchableOpacity onPress={() => setShowNeighborhoodModal(false)}>
                <Feather name="x" size={22} color={colors.mid} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={NEIGHBORHOODS}
              keyExtractor={item => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[s.neighborhoodItem, neighborhood === item && s.neighborhoodItemActive]}
                  onPress={() => { setNeighborhood(item); setShowNeighborhoodModal(false) }}
                >
                  <Text style={[s.neighborhoodText, neighborhood === item && s.neighborhoodTextActive]}>{item}</Text>
                  {neighborhood === item && <Feather name="check" size={16} color={colors.sage} />}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* Modal agregar certificado */}
      <Modal visible={showAddCert} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={s.modalBox}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Agregar certificado</Text>
              <TouchableOpacity onPress={() => setShowAddCert(false)}>
                <Feather name="x" size={22} color={colors.mid} />
              </TouchableOpacity>
            </View>
            <Input label="NOMBRE DEL CERTIFICADO" placeholder="Ej: Instructora de Mat Pilates"
              value={certName} onChangeText={setCertName} />
            <Input label="INSTITUCIÓN" placeholder="Ej: Stott Pilates, BASI Pilates..."
              value={certInstitution} onChangeText={setCertInstitution} />
            <Input label="AÑO" placeholder="2023" value={certYear}
              onChangeText={setCertYear} keyboardType="numeric" />
            <View style={s.fileNote}>
              <Feather name="file-text" size={14} color={colors.mid} />
              <Text style={s.fileNoteText}>
                Al tocar "Agregar" podrás adjuntar el certificado en PDF o foto.
              </Text>
            </View>
            <Button label="Agregar y adjuntar archivo" onPress={addCertification}
              isLoading={uploadingCert} fullWidth />
          </View>
        </View>
      </Modal>
    </ScrollView>
  )
}

const s = StyleSheet.create({
  header:              { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, paddingTop: 52, backgroundColor: colors.white, borderBottomWidth: 0.5, borderColor: colors.borderLight, marginBottom: spacing.sm },
  avatarWrap:          { position: 'relative' },
  avatarEdit:          { position: 'absolute', bottom: 0, right: 0, width: 22, height: 22, borderRadius: 11, backgroundColor: colors.sage, alignItems: 'center', justifyContent: 'center' },
  name:                { fontFamily: 'Nunito-Bold', fontSize: 18, color: colors.dark },
  statusBadge:         { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.sm, alignSelf: 'flex-start' },
  statusText:          { fontFamily: 'Nunito-SemiBold', fontSize: 10 },
  section:             { backgroundColor: colors.white, marginBottom: spacing.sm, padding: spacing.md, borderTopWidth: 0.5, borderBottomWidth: 0.5, borderColor: colors.borderLight },
  sectionHeader:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  sectionTitle:        { fontFamily: 'Nunito-Bold', fontSize: 10, color: colors.light, letterSpacing: 0.8, marginBottom: spacing.md },
  sectionNote:         { fontFamily: 'Nunito-Regular', fontSize: 12, color: colors.mid, marginBottom: spacing.md, lineHeight: 18 },
  addBtn:              { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.sageLight, paddingHorizontal: spacing.sm, paddingVertical: 5, borderRadius: radius.sm },
  addBtnText:          { fontFamily: 'Nunito-SemiBold', fontSize: 12, color: colors.sage },
  inputLabel:          { fontFamily: 'Nunito-Bold', fontSize: 10, color: colors.light, letterSpacing: 0.7, marginBottom: spacing.xs },
  selectorBtn:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', height: 48, borderWidth: 0.5, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, backgroundColor: colors.cream, marginBottom: spacing.md },
  selectorText:        { fontFamily: 'Nunito-Regular', fontSize: 14, color: colors.dark },
  chipsGrid:           { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip:                { paddingVertical: 7, paddingHorizontal: 14, borderRadius: 999, backgroundColor: colors.cream, borderWidth: 0.5, borderColor: colors.border },
  chipActive:          { backgroundColor: colors.sage, borderColor: colors.sage },
  chipText:            { fontFamily: 'Nunito-Regular', fontSize: 12, color: colors.mid },
  chipTextActive:      { color: colors.white, fontFamily: 'Nunito-SemiBold' },
  certRow:             { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, paddingVertical: spacing.sm, borderTopWidth: 0.5, borderColor: colors.borderLight },
  certIcon:            { width: 36, height: 36, borderRadius: 8, backgroundColor: colors.sageLight, alignItems: 'center', justifyContent: 'center' },
  certName:            { fontFamily: 'Nunito-SemiBold', fontSize: 13, color: colors.dark },
  certMeta:            { fontFamily: 'Nunito-Regular', fontSize: 11, color: colors.mid, marginTop: 2 },
  emptyCerts:          { alignItems: 'center', paddingVertical: spacing.lg, gap: spacing.sm },
  emptyCertsText:      { fontFamily: 'Nunito-Regular', fontSize: 13, color: colors.light },
  fileNote:            { flexDirection: 'row', gap: spacing.xs, alignItems: 'flex-start', backgroundColor: colors.cream, borderRadius: radius.sm, padding: spacing.sm, marginBottom: spacing.md },
  fileNoteText:        { fontFamily: 'Nunito-Regular', fontSize: 12, color: colors.mid, flex: 1, lineHeight: 18 },
  modalOverlay:        { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalBox:            { backgroundColor: colors.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: spacing.lg, paddingBottom: 40 },
  modalHeader:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg },
  modalTitle:          { fontFamily: 'Nunito-Bold', fontSize: 18, color: colors.dark },
  neighborhoodItem:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.sm + 2, paddingHorizontal: spacing.sm, borderBottomWidth: 0.5, borderColor: colors.borderLight },
  neighborhoodItemActive:{ backgroundColor: colors.sageLighter },
  neighborhoodText:    { fontFamily: 'Nunito-Regular', fontSize: 14, color: colors.dark },
  neighborhoodTextActive:{ fontFamily: 'Nunito-SemiBold', color: colors.sage },
})
