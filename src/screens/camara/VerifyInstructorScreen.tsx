// src/screens/camara/VerifyInstructorScreen.tsx
import React, { useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, TextInput, Modal
} from 'react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase, db } from '../../lib/supabase'
import { instructorAPI } from '../../lib/api'
import { Card, Badge, LoadingScreen, colors, spacing, radius, typography } from '../../components/ui'
import { Feather } from '@expo/vector-icons'
import { useAuthStore } from '../../store'

const REJECT_REASONS = [
  'Certificado inválido o vencido',
  'Institución no reconocida por la Cámara',
  'Documentación incompleta',
  'DNI no coincide con el certificado',
  'Las horas declaradas no coinciden',
  'Otro',
]

export default function VerifyInstructorScreen({ navigation, route }: any) {
  const { instructorId } = route.params
  const qc = useQueryClient()
  const user = useAuthStore(s => s.user)

  const [internalNote, setInternalNote]       = useState('')
  const [rejectReason, setRejectReason]       = useState(REJECT_REASONS[0])
  const [rejectMessage, setRejectMessage]     = useState('')
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [showPdfModal, setShowPdfModal]       = useState<any>(null)

  const { data: instructor, isLoading } = useQuery({
    queryKey: ['instructor-detail', instructorId],
    queryFn: async () => {
      const { data, error } = await db.instructors()
        .select('*, certifications(*), specialties:instructor_specialties(*)')
        .eq('id', instructorId)
        .single()
      if (error) throw error
      return data
    },
  })

  const saveNote = async (type: 'verificacion' | 'rechazo' | 'interna', extra?: string) => {
    const note = type === 'rechazo'
      ? `Motivo: ${rejectReason}${extra ? `\n${extra}` : ''}`
      : internalNote.trim()
    if (!note) return
    await supabase.from('camara_instructor_notes').insert({
      instructor_id: instructorId,
      camara_id: user?.camara_id,
      note,
      type,
      reject_reason: type === 'rechazo' ? rejectReason : null,
      created_by: user?.id,
    })
  }

  const verifyMutation = useMutation({
    mutationFn: async () => {
      await instructorAPI.verify(instructorId, true)
      await saveNote('verificacion')
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['camara-instructors'] })
      qc.invalidateQueries({ queryKey: ['pending-instructors'] })
      Alert.alert('Verificado', `${instructor?.full_name} fue verificado y ya es visible en el directorio.`, [
        { text: 'OK', onPress: () => navigation.goBack() }
      ])
    },
    onError: (e: any) => Alert.alert('Error', e.message),
  })

  const rejectMutation = useMutation({
    mutationFn: async () => {
      await instructorAPI.verify(instructorId, false)
      await saveNote('rechazo', rejectMessage.trim())
      if (internalNote.trim()) await saveNote('interna')
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['camara-instructors'] })
      qc.invalidateQueries({ queryKey: ['pending-instructors'] })
      setShowRejectModal(false)
      Alert.alert('Rechazado', 'El instructor fue notificado con el motivo del rechazo.', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ])
    },
    onError: (e: any) => Alert.alert('Error', e.message),
  })

  const handleVerify = () => {
    Alert.alert(
      '¿Verificar instructor?',
      `${instructor?.full_name} quedará activo en el directorio público y podrá recibir propuestas.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Verificar', onPress: () => verifyMutation.mutate() },
      ]
    )
  }

  if (isLoading) return <LoadingScreen message="Cargando instructor..." />
  if (!instructor) return null

  const specialties = instructor.specialties ?? []
  const certs = instructor.certifications ?? []

  return (
    <View style={s.container}>
      <ScrollView contentContainerStyle={s.content}>

        {/* Perfil */}
        <Card style={s.profileCard}>
          <View style={s.profileRow}>
            <View style={s.avatar}>
              <Text style={s.avatarLetter}>{instructor.full_name?.[0]?.toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.name}>{instructor.full_name}</Text>
              <Text style={s.meta}>
                {instructor.neighborhood ?? '—'}{instructor.dni ? ` · DNI ${instructor.dni}` : ''}
              </Text>
              {instructor.phone && <Text style={s.meta}>{instructor.phone}</Text>}
            </View>
            <Badge label="Pendiente" variant="warning" />
          </View>
          {instructor.bio && <Text style={s.bio}>{instructor.bio}</Text>}
        </Card>

        {/* Especialidades */}
        <Text style={s.sectionTitle}>Especialidades declaradas</Text>
        <Card style={{ marginBottom: spacing.md }}>
          <View style={s.tagRow}>
            {specialties.length > 0
              ? specialties.map((sp: any) => (
                  <View key={sp.id} style={s.tag}>
                    <Text style={s.tagText}>{sp.specialty}{sp.level ? ` · ${sp.level}` : ''}</Text>
                  </View>
                ))
              : <Text style={s.emptyText}>Sin especialidades declaradas</Text>
            }
          </View>
        </Card>

        {/* Certificaciones */}
        <Text style={s.sectionTitle}>Certificaciones presentadas</Text>
        <Card style={[{ paddingHorizontal: spacing.md, paddingVertical: 0 }, { marginBottom: spacing.md }]}>
          {certs.length === 0 && (
            <View style={s.certRow}>
              <Text style={s.emptyText}>Sin certificaciones cargadas</Text>
            </View>
          )}
          {certs.map((cert: any, idx: number) => (
            <View key={cert.id} style={[s.certRow, idx === certs.length - 1 && { borderBottomWidth: 0 }]}>
              <Feather name="award" size={20} color={colors.sage} style={{ flexShrink: 0, marginTop: 2 }} />
              <View style={{ flex: 1 }}>
                <Text style={s.certName}>{cert.name}</Text>
                <Text style={s.certMeta}>
                  {cert.institution}{cert.year ? ` · ${cert.year}` : ''}{cert.hours ? ` · ${cert.hours} hs` : ''}
                </Text>
              </View>
              {cert.document_url ? (
                <TouchableOpacity style={s.pdfBtn} onPress={() => setShowPdfModal(cert)}>
                  <Text style={s.pdfBtnText}>Ver PDF</Text>
                </TouchableOpacity>
              ) : (
                <View style={[s.pdfBtn, { backgroundColor: colors.borderLight }]}>
                  <Text style={[s.pdfBtnText, { color: colors.light }]}>Sin PDF</Text>
                </View>
              )}
            </View>
          ))}
        </Card>

        {/* Nota interna */}
        <Text style={s.sectionTitle}>Nota interna (solo visible para la Cámara)</Text>
        <Card style={{ marginBottom: spacing.md }}>
          <TextInput
            style={s.noteInput}
            placeholder="Ej: Certificados verificados telefónicamente con la institución..."
            placeholderTextColor={colors.light}
            value={internalNote}
            onChangeText={setInternalNote}
            multiline
            numberOfLines={3}
          />
        </Card>

        {/* Acciones */}
        <View style={s.actions}>
          <TouchableOpacity style={s.rejectBtn} onPress={() => setShowRejectModal(true)}>
            <Feather name="x" size={16} color="#A32D2D" />
            <Text style={s.rejectText}>Rechazar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.verifyBtn} onPress={handleVerify} disabled={verifyMutation.isPending}>
            <Feather name="check" size={16} color={colors.white} />
            <Text style={s.verifyText}>{verifyMutation.isPending ? 'Verificando...' : 'Verificar'}</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>

      {/* Modal rechazar */}
      <Modal visible={showRejectModal} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={s.modalBox}>
            <Text style={s.modalTitle}>Rechazar verificación</Text>
            <Text style={s.modalSub}>
              {instructor.full_name} recibirá una notificación con el motivo del rechazo.
            </Text>
            <Text style={s.inputLabel}>Motivo del rechazo</Text>
            <View style={s.reasonList}>
              {REJECT_REASONS.map(r => (
                <TouchableOpacity key={r} style={s.reasonRow} onPress={() => setRejectReason(r)}>
                  <View style={[s.radio, rejectReason === r && s.radioSelected]}>
                    {rejectReason === r && <View style={s.radioDot} />}
                  </View>
                  <Text style={s.reasonText}>{r}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={s.inputLabel}>Mensaje adicional (opcional)</Text>
            <TextInput
              style={s.noteInput}
              placeholder="Ej: Por favor reenviar el certificado con fecha visible."
              placeholderTextColor={colors.light}
              value={rejectMessage}
              onChangeText={setRejectMessage}
              multiline
              numberOfLines={3}
            />
            <TouchableOpacity
              style={s.rejectConfirmBtn}
              onPress={() => rejectMutation.mutate()}
              disabled={rejectMutation.isPending}
            >
              <Text style={s.rejectConfirmText}>
                {rejectMutation.isPending ? 'Rechazando...' : 'Confirmar rechazo'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.cancelBtn} onPress={() => setShowRejectModal(false)}>
              <Text style={s.cancelText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal PDF */}
      <Modal visible={!!showPdfModal} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={s.modalBox}>
            <Text style={s.modalTitle}>{showPdfModal?.name}</Text>
            <Text style={s.modalSub}>
              {showPdfModal?.institution}{showPdfModal?.year ? ` · ${showPdfModal.year}` : ''}
            </Text>
            <View style={s.pdfPreview}>
              <Feather name="file-text" size={40} color={colors.light} />
              <Text style={s.pdfName}>{showPdfModal?.name?.toLowerCase().replace(/ /g, '_')}.pdf</Text>
              <Text style={s.pdfDate}>Subido por el instructor</Text>
            </View>
            <TouchableOpacity style={s.verifyBtn} onPress={() => setShowPdfModal(null)}>
              <Text style={s.verifyText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const s = StyleSheet.create({
  container:         { flex: 1, backgroundColor: colors.cream },
  content:           { padding: spacing.md, paddingBottom: spacing.xxl },
  profileCard:       { marginBottom: spacing.md, padding: spacing.md },
  profileRow:        { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginBottom: spacing.sm },
  avatar:            { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.sageLight, alignItems: 'center', justifyContent: 'center' },
  avatarLetter:      { fontFamily: 'Nunito-Bold', fontSize: 20, color: colors.sage },
  name:              { fontFamily: 'Nunito-Bold', fontSize: 18, color: colors.dark },
  meta:              { fontFamily: 'Nunito-Regular', fontSize: 12, color: colors.mid, marginTop: 2 },
  bio:               { fontFamily: 'Nunito-Regular', fontSize: 13, color: colors.mid, lineHeight: 18, marginTop: spacing.sm },
  sectionTitle:      { fontFamily: 'Nunito-Bold', fontSize: 10, color: colors.light, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: spacing.sm },
  tagRow:            { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  tag:               { backgroundColor: colors.sageLight, borderTopLeftRadius: 8, borderTopRightRadius: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 8, paddingHorizontal: spacing.sm, paddingVertical: 4 },
  tagText:           { fontFamily: 'Nunito-SemiBold', fontSize: 11, color: colors.sage },
  emptyText:         { fontFamily: 'Nunito-Regular', fontSize: 12, color: colors.light },
  certRow:           { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, paddingVertical: spacing.sm + 2, borderBottomWidth: 0.5, borderColor: colors.borderLight },
  certName:          { fontFamily: 'Nunito-SemiBold', fontSize: 13, color: colors.dark },
  certMeta:          { fontFamily: 'Nunito-Regular', fontSize: 11, color: colors.mid, marginTop: 2 },
  pdfBtn:            { backgroundColor: '#E6F1FB', borderTopLeftRadius: 8, borderTopRightRadius: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 8, paddingHorizontal: spacing.sm, paddingVertical: 5 },
  pdfBtnText:        { fontFamily: 'Nunito-SemiBold', fontSize: 11, color: '#0C447C' },
  noteInput:         { fontFamily: 'Nunito-Regular', fontSize: 13, color: colors.dark, minHeight: 72, textAlignVertical: 'top' },
  inputLabel:        { fontFamily: 'Nunito-Bold', fontSize: 10, color: colors.mid, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: spacing.xs },
  actions:           { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  rejectBtn:         { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, backgroundColor: '#FCEBEB', borderTopLeftRadius: 14, borderTopRightRadius: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 14, paddingVertical: spacing.md, borderWidth: 0.5, borderColor: '#F09595' },
  rejectText:        { fontFamily: 'Nunito-SemiBold', fontSize: 14, color: '#A32D2D' },
  verifyBtn:         { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, backgroundColor: colors.sage, borderTopLeftRadius: 14, borderTopRightRadius: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 14, paddingVertical: spacing.md },
  verifyText:        { fontFamily: 'Nunito-SemiBold', fontSize: 14, color: colors.white },
  modalOverlay:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalBox:          { backgroundColor: colors.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: spacing.xl, paddingBottom: spacing.xxl },
  modalTitle:        { fontFamily: 'Nunito-Bold', fontSize: 20, color: colors.dark, marginBottom: spacing.xs },
  modalSub:          { fontFamily: 'Nunito-Regular', fontSize: 13, color: colors.mid, marginBottom: spacing.lg, lineHeight: 20 },
  reasonList:        { marginBottom: spacing.md },
  reasonRow:         { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
  radio:             { width: 20, height: 20, borderTopLeftRadius: 10, borderTopRightRadius: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 10, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  radioSelected:     { borderColor: colors.sage },
  radioDot:          { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.sage },
  reasonText:        { fontFamily: 'Nunito-Regular', fontSize: 13, color: colors.dark, flex: 1 },
  rejectConfirmBtn:  { backgroundColor: '#A32D2D', borderTopLeftRadius: 14, borderTopRightRadius: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 14, paddingVertical: spacing.md, alignItems: 'center', marginTop: spacing.md, marginBottom: spacing.sm },
  rejectConfirmText: { fontFamily: 'Nunito-SemiBold', fontSize: 14, color: colors.white },
  cancelBtn:         { alignItems: 'center', paddingVertical: spacing.md },
  cancelText:        { fontFamily: 'Nunito-SemiBold', fontSize: 14, color: colors.mid },
  pdfPreview:        { backgroundColor: colors.cream, borderTopLeftRadius: 14, borderTopRightRadius: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 14, padding: spacing.xl, alignItems: 'center', marginBottom: spacing.md, borderWidth: 0.5, borderColor: colors.border },
  pdfName:           { fontFamily: 'Nunito-SemiBold', fontSize: 13, color: colors.dark, marginTop: spacing.sm },
  pdfDate:           { fontFamily: 'Nunito-Regular', fontSize: 11, color: colors.light, marginTop: 4 },
})
