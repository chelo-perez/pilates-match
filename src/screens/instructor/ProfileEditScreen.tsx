// src/screens/instructor/ProfileEditScreen.tsx
import React, { useState, useEffect } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, FlatList, ActivityIndicator, Alert, Linking } from 'react-native'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { usePhotoCropper } from '../../components/PhotoCropper'
import * as FileSystem from 'expo-file-system/legacy'
import * as DocumentPicker from 'expo-document-picker'
import { supabase, storage } from '../../lib/supabase'
import { useAuthStore } from '../../store'
import { useMyInstructor } from '../../hooks'
import { errorText, UserError } from '../../lib/errors'
import { confirmSignOut } from '../../lib/auth'
import { BARRIOS_CABA } from '../../constants/barrios'
import { SPECIALTY_LABELS, VERIFICATION_STATUS } from '../../constants/labels'
import { Button, Input, LoadingScreen, ErrorState, colors, spacing, radius, typography } from '../../components/ui'
import HeroHeader from '../../components/HeroHeader'
import Toast from '../../components/Toast'
import { useToast } from '../../hooks/useToast'
import { Feather } from '@expo/vector-icons'
import SaveButton from '../../components/SaveButton'
import { entity } from '../../lib/entity'

const SPECIALTIES = Object.entries(SPECIALTY_LABELS as Record<string, string>).map(([key, label]) => ({ key, label }))

const CERT_STATUS: Record<string, { label: string; bg: string; tx: string }> = {
  approved: { label: '✓ Aprobado',   bg: colors.okBg,   tx: colors.okTx },
  rejected: { label: '✗ Rechazado',  bg: colors.redBg,  tx: colors.redTx },
  pending:  { label: 'En revisión',  bg: colors.warnBg, tx: colors.warnTx },
}

type PickedFile = { uri: string; name: string; mimeType: string; ext: string }

// Lee un archivo local como bytes (funciona con content:// en Android)
async function readBytes(uri: string, ext: string): Promise<Uint8Array> {
  const cacheUri = FileSystem.cacheDirectory + 'upload_' + Date.now() + '.' + ext
  await FileSystem.copyAsync({ from: uri, to: cacheUri })
  const base64 = await FileSystem.readAsStringAsync(cacheUri, { encoding: FileSystem.EncodingType.Base64 })
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

export default function ProfileEditScreen() {
  const { pickPhoto, cropModal } = usePhotoCropper('Ajustá tu foto')
  const user = useAuthStore(s => s.user)
  const { toast, showToast, hideToast } = useToast()
  const qc = useQueryClient()
  const { data: instructor, isLoading, isError, refetch } = useMyInstructor()

  const [bio, setBio] = useState('')
  const [neighborhood, setNeighborhood] = useState('')
  const [phone, setPhone] = useState('')
  const [selectedSpecialties, setSelectedSpecialties] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [busyCert, setBusyCert] = useState<string | null>(null)
  const [savingCert, setSavingCert] = useState(false)
  const [togglingActive, setTogglingActive] = useState(false)
  const [showNeighborhoodModal, setShowNeighborhoodModal] = useState(false)
  const [certName, setCertName] = useState('')
  const [certInstitution, setCertInstitution] = useState('')
  const [certYear, setCertYear] = useState('')
  const [certFile, setCertFile] = useState<PickedFile | null>(null)
  const [certError, setCertError] = useState('')
  const [showAddCert, setShowAddCert] = useState(false)

  useEffect(() => {
    if (instructor) {
      setBio(instructor.bio ?? '')
      setNeighborhood(instructor.neighborhood ?? '')
      setPhone(instructor.phone ?? '')
      setSelectedSpecialties((instructor.specialties ?? []).map((s: any) => s.specialty))
    }
  }, [instructor])

  const invalidate = () => qc.invalidateQueries({ queryKey: ['my-instructor'] })

  const saveMutation = useMutation({
    mutationFn: async () => {
      const id = instructor!.id
      const { error } = await supabase.from('instructors')
        .update({ bio: bio.trim() || null, neighborhood: neighborhood || null, phone: phone.trim() || null })
        .eq('id', id)
      if (error) throw error

      // Especialidades: agregar las nuevas y borrar solo las quitadas
      const current: string[] = (instructor!.specialties ?? []).map((s: any) => s.specialty)
      const toAdd = selectedSpecialties.filter(k => !current.includes(k))
      const toRemove = current.filter(k => !selectedSpecialties.includes(k))
      if (toAdd.length) {
        const { error: insErr } = await supabase.from('instructor_specialties')
          .insert(toAdd.map(specialty => ({ instructor_id: id, specialty })))
        if (insErr) throw insErr
      }
      if (toRemove.length) {
        const { error: delErr } = await supabase.from('instructor_specialties')
          .delete().eq('instructor_id', id).in('specialty', toRemove)
        if (delErr) throw delErr
      }
    },
    onSuccess: () => { invalidate(); showToast('Perfil actualizado') },
    onError: (e: any) => { invalidate(); showToast(errorText(e), 'error') },
  })

  const pickAvatar = async () => {
    if (!user?.id || !instructor) return
    // Sin el recortador nativo (en Android 15 no deja guardar): recortamos nosotros
    let pickedUri: string | null
    try { pickedUri = await pickPhoto() } catch (e) { showToast(errorText(e), 'warning'); return }
    if (!pickedUri) return

    try {
      setUploading(true)
      const bytes = await readBytes(pickedUri, 'jpg')
      const path = `${user.id}/avatar.jpg`
      const { error } = await supabase.storage.from('avatars')
        .upload(path, bytes, { upsert: true, contentType: 'image/jpeg' })
      if (error) throw error
      const url = supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl + '?t=' + Date.now()
      const { error: upErr } = await supabase.from('instructors').update({ avatar_url: url }).eq('id', instructor.id)
      if (upErr) throw upErr
      invalidate()
      showToast('Foto actualizada')
    } catch (e: any) {
      showToast(errorText(e), 'error')
    } finally {
      setUploading(false)
    }
  }

  const pickFile = async (): Promise<PickedFile | null> => {
    const res = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*'], copyToCacheDirectory: true })
    if (res.canceled || !res.assets?.[0]) return null
    const a = res.assets[0]
    const mimeType = a.mimeType ?? (a.name?.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg')
    const ext = mimeType === 'application/pdf' ? 'pdf' : mimeType === 'image/png' ? 'png' : 'jpg'
    return { uri: a.uri, name: a.name ?? 'archivo', mimeType, ext }
  }

  // Sube el archivo y guarda el PATH en document_url
  const attachFile = async (certId: string, file: PickedFile) => {
    const bytes = await readBytes(file.uri, file.ext)
    const path = await storage.uploadCertification(instructor!.id, certId, bytes.buffer as ArrayBuffer, file.ext, file.mimeType)
    const { error } = await supabase.from('certifications').update({ document_url: path }).eq('id', certId)
    if (error) throw error
  }

  const resetCertForm = () => {
    setCertName(''); setCertInstitution(''); setCertYear(''); setCertFile(null); setCertError('')
  }

  const addCertification = async () => {
    const year = certYear.trim() ? parseInt(certYear, 10) : null
    if (!certName.trim()) { setCertError('Ingresá el nombre del certificado.'); return }
    if (!certInstitution.trim()) { setCertError('Ingresá la institución que lo emitió.'); return }
    if (year !== null && (isNaN(year) || year < 1950 || year > new Date().getFullYear())) {
      setCertError('Revisá el año.'); return
    }
    if (!certFile) { setCertError(`Adjuntá el certificado en PDF o foto: ${entity().la} lo necesita para verificarte.`); return }
    setCertError('')
    try {
      setSavingCert(true)
      const { data: cert, error } = await supabase.from('certifications').insert({
        instructor_id: instructor!.id, name: certName.trim(),
        institution: certInstitution.trim(), year, review_status: 'pending',
      }).select('id').single()
      if (error) throw error
      try {
        await attachFile(cert.id, certFile)
        showToast('Certificado enviado a revisión')
      } catch (e) {
        showToast('El certificado se guardó pero no pudimos subir el archivo. Tocá "Adjuntar archivo" para reintentar.', 'warning')
      }
      invalidate()
      resetCertForm()
      setShowAddCert(false)
    } catch (e: any) {
      setCertError(errorText(e))
    } finally {
      setSavingCert(false)
    }
  }

  const reattach = async (certId: string) => {
    const file = await pickFile()
    if (!file) return
    try {
      setBusyCert(certId)
      await attachFile(certId, file)
      // Si estaba rechazado, vuelve a revisión con el archivo nuevo
      const { error } = await supabase.from('certifications')
        .update({ review_status: 'pending', review_note: null }).eq('id', certId)
      if (error) throw error
      invalidate()
      showToast('Archivo adjuntado. Vuelve a revisión.')
    } catch (e: any) {
      showToast(errorText(e), 'error')
    } finally {
      setBusyCert(null)
    }
  }

  const viewFile = async (path: string) => {
    const { data, error } = await supabase.storage.from('certifications').createSignedUrl(path, 600)
    if (error || !data?.signedUrl) { showToast(errorText(error ?? new UserError('No se pudo abrir el archivo')), 'error'); return }
    Linking.openURL(data.signedUrl)
  }

  const deleteCert = (certId: string) => {
    Alert.alert('Eliminar certificado', `Se va a quitar de tu perfil y de la revisión ${entity().de}.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: async () => {
        const { error } = await supabase.from('certifications').delete().eq('id', certId)
        if (error) { showToast(errorText(error), 'error'); return }
        invalidate()
        showToast('Certificado eliminado')
      }},
    ])
  }

  const toggleActive = async () => {
    if (!instructor) return
    try {
      setTogglingActive(true)
      const { error } = await supabase.from('instructors')
        .update({ is_active: instructor.is_active === false }).eq('id', instructor.id)
      if (error) throw error
      invalidate()
    } catch (e: any) {
      showToast(errorText(e), 'error')
    } finally {
      setTogglingActive(false)
    }
  }

  const toggleSpecialty = (key: string) =>
    setSelectedSpecialties(prev => prev.includes(key) ? prev.filter(s => s !== key) : [...prev, key])

  if (isLoading) return <LoadingScreen message="Cargando tu perfil..." />
  if (isError || !instructor) return <ErrorState message="No pudimos cargar tu perfil." onRetry={refetch} />

  const status     = instructor.verification_status ?? 'pendiente'
  const statusInfo = VERIFICATION_STATUS[status] ?? VERIFICATION_STATUS.pendiente
  const isActive   = instructor.is_active !== false
  const certs: any[] = instructor.certifications ?? []

  return (
    <View style={{ flex: 1, backgroundColor: colors.cream }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <HeroHeader
          title={instructor.full_name ?? 'Mi perfil'}
          subtitle={uploading ? 'Subiendo foto...' : 'Tocá la foto para cambiarla'}
          centered
          avatarUri={instructor.avatar_url}
          avatarFallback={instructor.full_name ?? 'I'}
          onAvatarPress={uploading ? undefined : pickAvatar}
          rightElement={
            <TouchableOpacity style={s.logoutPill} onPress={() => confirmSignOut()}>
              <Feather name="log-out" size={13} color={colors.white} />
              <Text style={s.logoutPillTxt}>Salir</Text>
            </TouchableOpacity>
          }
          bottomElement={
            <View style={s.veriBadge}>
              {uploading ? <ActivityIndicator size="small" color={colors.white} /> : null}
              <Text style={s.veriText}>{statusInfo.label}</Text>
            </View>
          }
        />

        {instructor.verification_note && status !== 'verificado' ? (
          <View style={[s.noteBanner, status === 'rechazado' ? { backgroundColor: colors.redBg } : null]}>
            <Feather name="alert-circle" size={14} color={status === 'rechazado' ? colors.redTx : colors.warnTx} />
            <Text style={[s.noteBannerTxt, { color: status === 'rechazado' ? colors.redTx : colors.warnTx }]}>
              Mensaje {entity().de}: {instructor.verification_note}
            </Text>
          </View>
        ) : null}

        <View style={s.section}>
          <Text style={s.sectionLabel}>INFORMACIÓN PERSONAL</Text>
          <Input label="SOBRE MÍ" placeholder="Contá tu experiencia..." value={bio} onChangeText={setBio} multiline />
          <View style={s.rowFields}>
            <View style={{ flex: 1 }}>
              <Text style={s.fieldLabel}>BARRIO BASE</Text>
              <TouchableOpacity style={s.selector} onPress={() => setShowNeighborhoodModal(true)}>
                <Text style={[s.selectorText, !neighborhood && { color: colors.light }]} numberOfLines={1}>
                  {neighborhood || 'Elegí tu barrio'}
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
            <Text style={[s.sectionLabel, { marginBottom: 0 }]}>CERTIFICACIONES</Text>
            <Button label="Agregar" size="sm" variant="secondary" onPress={() => { resetCertForm(); setShowAddCert(true) }}
              icon={<Feather name="plus" size={14} color={colors.sage} />} />
          </View>
          <Text style={s.note}>Subí tus certificados en PDF o foto. {entity().La} los revisa para verificar tu perfil.</Text>
          {certs.length === 0 ? (
            <View style={s.emptyBox}>
              <Feather name="award" size={28} color={colors.border} />
              <Text style={s.emptyText}>Todavía no cargaste certificaciones</Text>
            </View>
          ) : certs.map((cert: any) => {
            const st = CERT_STATUS[cert.review_status ?? 'pending'] ?? CERT_STATUS.pending
            return (
              <View key={cert.id} style={s.certRow}>
                <View style={s.certIcon}><Feather name="award" size={18} color={colors.sage} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={s.certName}>{cert.name}</Text>
                  <Text style={s.certMeta}>{[cert.institution, cert.year].filter(Boolean).join(' · ')}</Text>
                  <View style={{ flexDirection: 'row', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                    <View style={[s.miniTag, { backgroundColor: st.bg }]}>
                      <Text style={[s.miniTagText, { color: st.tx }]}>{st.label}</Text>
                    </View>
                    {cert.document_url ? (
                      <TouchableOpacity style={[s.miniTag, { backgroundColor: colors.blueBg }]} onPress={() => viewFile(cert.document_url)}>
                        <Text style={[s.miniTagText, { color: colors.blueTx }]}>Ver archivo</Text>
                      </TouchableOpacity>
                    ) : (
                      <View style={[s.miniTag, { backgroundColor: colors.warnBg }]}>
                        <Text style={[s.miniTagText, { color: colors.warnTx }]}>Sin archivo</Text>
                      </View>
                    )}
                  </View>
                  {cert.review_status === 'rejected' && cert.review_note ? (
                    <Text style={s.certReject}>Motivo: {cert.review_note}</Text>
                  ) : null}
                  {(!cert.document_url || cert.review_status === 'rejected') && (
                    <TouchableOpacity onPress={() => reattach(cert.id)} disabled={busyCert === cert.id}>
                      <Text style={s.certLink}>{busyCert === cert.id ? 'Subiendo...' : cert.document_url ? 'Subir un archivo nuevo' : 'Adjuntar archivo'}</Text>
                    </TouchableOpacity>
                  )}
                </View>
                <TouchableOpacity onPress={() => deleteCert(cert.id)} style={{ padding: 4 }}>
                  <Feather name="trash-2" size={16} color={colors.redTx} />
                </TouchableOpacity>
              </View>
            )
          })}
        </View>

        <View style={{ paddingHorizontal: spacing.md, marginTop: spacing.md }}>
          <TouchableOpacity
            style={[s.activeToggle, { backgroundColor: isActive ? colors.sageLight : colors.warnBg }]}
            onPress={toggleActive}
            disabled={togglingActive}
            activeOpacity={0.85}
          >
            <View style={[s.activeDot, { backgroundColor: isActive ? colors.sage : colors.warnTx }]} />
            <Text style={[s.activeTxt, { color: isActive ? colors.sage : colors.warnTx }]}>
              {isActive ? 'Estoy recibiendo propuestas — tocá para pausar' : 'Pausado: no aparecés en búsquedas — tocá para activarte'}
            </Text>
            {togglingActive ? <ActivityIndicator size="small" color={colors.sage} /> : null}
          </TouchableOpacity>

          <SaveButton label="Guardar perfil" onPress={() => saveMutation.mutate()} isPending={saveMutation.isPending} isSuccess={saveMutation.isSuccess} />
        </View>
      </ScrollView>

      <Modal visible={showNeighborhoodModal} animationType="slide" transparent onRequestClose={() => setShowNeighborhoodModal(false)}>
        <View style={s.modalOverlay}>
          <View style={[s.modalBox, { maxHeight: '80%' }]}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Elegí tu barrio</Text>
              <TouchableOpacity onPress={() => setShowNeighborhoodModal(false)}>
                <Feather name="x" size={22} color={colors.mid} />
              </TouchableOpacity>
            </View>
            <FlatList data={BARRIOS_CABA} keyExtractor={i => i} renderItem={({ item }) => (
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

      <Modal visible={showAddCert} animationType="slide" transparent onRequestClose={() => setShowAddCert(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalBox}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Agregar certificado</Text>
              <TouchableOpacity onPress={() => setShowAddCert(false)}>
                <Feather name="x" size={22} color={colors.mid} />
              </TouchableOpacity>
            </View>
            <Input label="NOMBRE" placeholder="Ej: Instructorado de Mat Pilates" value={certName} onChangeText={setCertName} />
            <Input label="INSTITUCIÓN" placeholder="Ej: Stott Pilates" value={certInstitution} onChangeText={setCertInstitution} />
            <Input label="AÑO (OPCIONAL)" placeholder="2023" value={certYear} onChangeText={setCertYear} keyboardType="numeric" />
            <TouchableOpacity style={s.fileNote} onPress={async () => { const f = await pickFile(); if (f) { setCertFile(f); setCertError('') } }}>
              <Feather name={certFile ? 'check-circle' : 'paperclip'} size={14} color={certFile ? colors.okTx : colors.mid} />
              <Text style={s.fileNoteText} numberOfLines={1}>
                {certFile ? certFile.name : 'Elegir archivo (PDF o foto)'}
              </Text>
            </TouchableOpacity>
            {certError ? <Text style={s.certError}>{certError}</Text> : null}
            <Button label="Enviar a revisión" onPress={addCertification} isLoading={savingCert} fullWidth />
          </View>
        </View>
      </Modal>
      <Toast visible={toast.visible} message={toast.message} type={toast.type} onHide={hideToast} />
      {cropModal}
    </View>
  )
}

const s = StyleSheet.create({
  activeToggle:       { flexDirection: 'row', alignItems: 'center', gap: 10, ...radius.leaf, padding: 14, marginBottom: 12, borderWidth: 0.5, borderColor: colors.border },
  activeDot:          { width: 10, height: 10, borderRadius: 5 },
  activeTxt:          { fontFamily: 'Nunito-Bold', fontSize: 13, flex: 1 },
  rowFields:          { flexDirection: 'row', gap: spacing.sm },
  logoutPill:         { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 6 },
  logoutPillTxt:      { fontFamily: 'Nunito-SemiBold', fontSize: 11, color: colors.white },
  veriBadge:          { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center', marginTop: 10, paddingHorizontal: 12, paddingVertical: 4, borderRadius: radius.full, backgroundColor: 'rgba(255,255,255,0.2)' },
  veriText:           { fontFamily: 'Nunito-SemiBold', fontSize: 11, color: colors.white },
  noteBanner:         { flexDirection: 'row', gap: 8, alignItems: 'flex-start', margin: spacing.md, marginBottom: 0, padding: spacing.md, ...radius.leaf, backgroundColor: colors.warnBg },
  noteBannerTxt:      { fontFamily: 'Nunito-SemiBold', fontSize: 12, flex: 1, lineHeight: 17 },
  section:            { backgroundColor: colors.white, marginTop: 8, padding: spacing.md, borderTopWidth: 0.5, borderBottomWidth: 0.5, borderColor: colors.borderLight },
  sectionHeader:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  sectionLabel:       { ...typography.caption, marginBottom: spacing.md },
  fieldLabel:         { ...typography.caption, marginBottom: spacing.xs },
  selector:           { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', height: 48, borderWidth: 0.5, borderColor: colors.border, ...radius.leaf, paddingHorizontal: spacing.md, backgroundColor: colors.cream, marginBottom: spacing.md },
  selectorText:       { fontFamily: 'Nunito-Regular', fontSize: 14, color: colors.dark, flex: 1 },
  chipsGrid:          { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip:               { paddingVertical: 7, paddingHorizontal: 14, borderRadius: radius.full, backgroundColor: colors.cream, borderWidth: 0.5, borderColor: colors.border },
  chipActive:         { backgroundColor: colors.sage, borderColor: colors.sage },
  chipText:           { fontFamily: 'Nunito-Regular', fontSize: 12, color: colors.mid },
  chipTextActive:     { color: colors.white, fontFamily: 'Nunito-SemiBold' },
  note:               { fontFamily: 'Nunito-Regular', fontSize: 12, color: colors.mid, marginBottom: spacing.md, lineHeight: 18 },
  certRow:            { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, paddingVertical: spacing.sm, borderTopWidth: 0.5, borderColor: colors.borderLight },
  certIcon:           { width: 36, height: 36, ...radius.leaf, backgroundColor: colors.sageLight, alignItems: 'center', justifyContent: 'center' },
  certName:           { fontFamily: 'Nunito-SemiBold', fontSize: 13, color: colors.dark },
  certMeta:           { fontFamily: 'Nunito-Regular', fontSize: 11, color: colors.mid, marginTop: 2 },
  certReject:         { fontFamily: 'Nunito-Regular', fontSize: 11, color: colors.redTx, marginTop: 4, fontStyle: 'italic' },
  certLink:           { fontFamily: 'Nunito-Bold', fontSize: 12, color: colors.sage, marginTop: 6 },
  certError:          { fontFamily: 'Nunito-SemiBold', fontSize: 12, color: colors.redTx, marginBottom: spacing.sm },
  miniTag:            { paddingHorizontal: 7, paddingVertical: 2, borderRadius: radius.sm },
  miniTagText:        { fontFamily: 'Nunito-SemiBold', fontSize: 10 },
  emptyBox:           { alignItems: 'center', paddingVertical: spacing.lg, gap: spacing.sm },
  emptyText:          { fontFamily: 'Nunito-Regular', fontSize: 13, color: colors.light },
  fileNote:           { flexDirection: 'row', gap: spacing.xs, alignItems: 'center', backgroundColor: colors.cream, ...radius.leaf, padding: spacing.md, marginBottom: spacing.md, borderWidth: 0.5, borderColor: colors.border, borderStyle: 'dashed' },
  fileNoteText:       { fontFamily: 'Nunito-SemiBold', fontSize: 13, color: colors.mid, flex: 1 },
  modalOverlay:       { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalBox:           { backgroundColor: colors.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: spacing.lg, paddingBottom: 40 },
  modalHeader:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg },
  modalTitle:         { fontFamily: 'Nunito-Bold', fontSize: 18, color: colors.dark },
  neighborhoodItem:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.sm + 2, paddingHorizontal: spacing.sm, borderBottomWidth: 0.5, borderColor: colors.borderLight },
  neighborhoodItemActive:{ backgroundColor: colors.sageLighter },
  neighborhoodText:   { fontFamily: 'Nunito-Regular', fontSize: 14, color: colors.dark },
  neighborhoodTextActive:{ fontFamily: 'Nunito-SemiBold', color: colors.sage },
})
