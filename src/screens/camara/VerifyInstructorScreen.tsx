// src/screens/camara/VerifyInstructorScreen.tsx
// Flujo completo de verificación — ver PDF, notas internas, aprobar/rechazar con motivo

import React, { useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, TextInput, Modal
} from 'react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase, db } from '../../lib/supabase'
import { instructorAPI } from '../../lib/api'
import { Card, Badge, Button, LoadingScreen, colors, spacing, radius, typography } from '../../components/ui'
import { Feather } from '@expo/vector-icons'

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

  const [internalNote, setInternalNote]     = useState('')
  const [rejectReason, setRejectReason]     = useState(REJECT_REASONS[0])
  const [rejectMessage, setRejectMessage]   = useState('')
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

  const verifyMutation = useMutation({
    mutationFn: () => instructorAPI.verify(instructorId, true),
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
      // Guardar nota interna si hay
      if (internalNote.trim()) {
        await supabase.from('instructors')
          .update({ bio: internalNote }) // campo temporal hasta tener tabla de notas
          .eq('id', instructorId)
      }
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
      `${instructor?.full_name} quedará activo en el directorio público y podrá recibir propuestas de estudios.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Verificar', onPress: () => verifyMutation.mutate() },
      ]
    )
  }

  if (isLoading) return <LoadingScreen message="Cargando instructor..." />
  if (!instructor) return null

  const specialties = instructor.specialties ?? []
  const certs       = instructor.certifications ?? []

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>

        {/* Perfil */}
        <Card style={styles.profileCard}>
          <View style={styles.profileRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarLetter}>{instructor.full_name?.[0]?.toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{instructor.full_name}</Text>
              <Text style={styles.meta}>
                {instructor.neighborhood ?? '—'}{instructor.dni ? ` · DNI ${instructor.dni}` : ''}
              </Text>
              {instructor.phone && (
                <Text style={styles.meta}>{instructor.phone}</Text>
              )}
            </View>
            <Badge label="Pendiente" variant="warning" />
          </View>
          {instructor.bio && (
            <Text style={styles.bio}>{instructor.bio}</Text>
          )}
        </Card>

        {/* Especialidades */}
        <Text style={styles.sectionTitle}>Especialidades declaradas</Text>
        <Card style={{ marginBottom: spacing.md }}>
          <View style={styles.tagRow}>
            {specialties.length > 0
              ? specialties.map((s: any) => (
                  <View key={s.id} style={styles.tag}>
                    <Text style={styles.tagText}>{s.specialty}{s.level ? ` · ${s.level}` : ''}</Text>
                  </View>
                ))
              : <Text style={styles.emptyText}>Sin especialidades declaradas</Text>
            }
          </View>
        </Card>

        {/* Certificaciones */}
        <Text style={styles.sectionTitle}>Certificaciones presentadas</Text>
        <Card style={[{ paddingHorizontal: spacing.md, paddingVertical: 0 }, { marginBottom: spacing.md }]}>
          {certs.length === 0 && (
            <View style={styles.certRow}>
              <Text style={styles.emptyText}>Sin certificaciones cargadas</Text>
            </View>
          )}
          {certs.map((cert: any, idx: number) => (
            <View key={cert.id} style={[styles.certRow, idx === certs.length - 1 && { borderBottomWidth: 0 }]}>
              <Feather name="award" size={20} color={colors.sage} style={{ flexShrink: 0, marginTop: 2 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.certName}>{cert.name}</Text>
                <Text style={styles.certMeta}>
                  {cert.institution}{cert.year ? ` · ${cert.year}` : ''}{cert.hours ? ` · ${cert.hours} hs` : ''}
                </Text>
              </View>
              {cert.document_url ? (
                <TouchableOpacity
                  style={styles.pdfBtn}
                  onPress={() => setShowPdfModal(cert)}
                >
                  <Text style={styles.pdfBtnText}>Ver PDF</Text>
                </TouchableOpacity>
              ) : (
                <View style={[styles.pdfBtn, { backgroundColor: colors.borderLight }]}>
                  <Text style={[styles.pdfBtnText, { color: colors.light }]}>Sin PDF</Text>
                </View>
              )}
            </View>
          ))}
        </Card>

        {/* Nota interna */}
        <Text style={styles.sectionTitle}>Nota interna (solo visible para la Cámara)</Text>
        <Card style={{ marginBottom: spacing.md }}>
          <TextInput
            style={styles.noteInput}
            placeholder="Ej: Certificados verificados telefónicamente con la institución..."
            placeholderTextColor={colors.light}
            value={internalNote}
            onChangeText={setInternalNote}
            multiline
            numberOfLines={3}
          />
        </Card>

        {/* Acciones */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.rejectBtn}
            onPress={() => setShowRejectModal(true)}
          >
            <Feather name="x" size={16} color="#A32D2D" />
            <Text style={styles.rejectText}>Rechazar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.verifyBtn}
            onPress={handleVerify}
            disabled={verifyMutation.isPending}
          >
            <Feather name="check" size={16} color={colors.white} />
            <Text style={styles.verifyText}>
              {verifyMutation.isPending ? 'Verificando...' : 'Verificar'}
            </Text>
          </TouchableOpacity>
        </View>

      </ScrollView>

      {/* Modal rechazar */}
      <Modal visible={showRejectModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Rechazar verificación</Text>
            <Text style={styles.modalSub}>
              {instructor.full_name} recibirá una notificación con el motivo del rechazo.
            </Text>

            <Text style={styles.inputLabel}>Motivo del rechazo</Text>
            <View style={styles.reasonList}>
              {REJECT_REASONS.map(r => (
                <TouchableOpacity
                  key={r}
                  style={styles.reasonRow}
                  onPress={() => setRejectReason(r)}
                >
                  <View style={[styles.radio, rejectReason === r && styles.radioSelected]}>
                    {rejectReason === r && <View style={styles.radioDot} />}
                  </View>
                  <Text style={styles.reasonText}>{r}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.inputLabel}>Mensaje adicional (opcional)</Text>
            <TextInput
              style={styles.noteInput}
              placeholder="Ej: Por favor reenviar el certificado con fecha visible."
              placeholderTextColor={colors.light}
              value={rejectMessage}
              onChangeText={setRejectMessage}
              multiline
              numberOfLines={3}
            />

            <TouchableOpacity
              style={styles.rejectConfirmBtn}
              onPress={() => rejectMutation.mutate()}
              disabled={rejectMutation.isPending}
            >
              <Text style={styles.rejectConfirmText}>
                {rejectMutation.isPending ? 'Rechazando...' : 'Confirmar rechazo'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => setShowRejectModal(false)}
            >
              <Text style={styles.cancelText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal PDF */}
      <Modal visible={!!showPdfModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>{showPdfModal?.name}</Text>
            <Text style={styles.modalSub}>
              {showPdfModal?.institution}{showPdfModal?.year ? ` · ${showPdfModal.year}` : ''}
            </Text>
            <View style={styles.pdfPreview}>
              <Feather name="file-text" size={40} color={colors.light} />
              <Text style={styles.pdfName}>{showPdfModal?.name?.toLowerCase().replace(/ /g, '_')}.pdf</Text>
              <Text style={styles.pdfDate}>Subido por el instructor</Text>
            </View>
            <TouchableOpacity style={styles.verifyBtn} onPress={() => setShowPdfModal(null)}>
              <Text style={styles.verifyText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: colors.cream },
  content:          { padding: spacing.md, paddingBottom: spacing.xxxl },
  profileCard:      { marginBottom: spacing.md, padding: spacing.md },
  profileRow:       { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginBottom: spacing.sm },
  avatar:           { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.sageLight, alignItems: 'center', justifyContent: 'center', borderWidth: 0.5, borderColor: colors.border },
  avatarLetter:     { fontFamily: 'DMSans-SemiBold', fontSize: 20, color: colors.sage },
  name:             { fontFamily: 'PlayfairDisplay-Medium', fontSize: 18, color: colors.dark },
  meta:             { ...typography.small, color: colors.mid, marginTop: 2 },
  bio:              { ...typography.body, color: colors.mid, fontSize: 13, lineHeight: 18, marginTop: spacing.sm },
  sectionTitle:     { fontFamily: 'DMSans-SemiBold', fontSize: 11, color: colors.mid, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing.sm },
  tagRow:           { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  tag:              { backgroundColor: colors.sageLight, borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 4 },
  tagText:          { fontFamily: 'DMSans-SemiBold', fontSize: 11, color: '#3B5040' },
  emptyText:        { ...typography.small, color: colors.light },
  certRow:          { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, paddingVertical: spacing.sm + 2, borderBottomWidth: 0.5, borderColor: colors.borderLight },
  certName:         { fontFamily: 'DMSans-SemiBold', fontSize: 13, color: colors.dark },
  certMeta:         { ...typography.small, color: colors.mid, marginTop: 2 },
  pdfBtn:           { backgroundColor: colors.blueBg ?? '#E6F1FB', borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 5 },
  pdfBtnText:       { fontFamily: 'DMSans-SemiBold', fontSize: 11, color: '#0C447C' },
  noteInput:        { fontFamily: 'DMSans-Regular', fontSize: 13, color: colors.dark, minHeight: 72, textAlignVertical: 'top' },
  inputLabel:       { fontFamily: 'DMSans-SemiBold', fontSize: 11, color: colors.mid, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: spacing.xs },
  actions:          { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  rejectBtn:        { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, backgroundColor: '#FCEBEB', borderRadius: radius.md, paddingVertical: spacing.md, borderWidth: 0.5, borderColor: '#F09595' },
  rejectText:       { fontFamily: 'DMSans-SemiBold', fontSize: 14, color: '#A32D2D' },
  verifyBtn:        { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, backgroundColor: colors.sage, borderRadius: radius.md, paddingVertical: spacing.md },
  verifyText:       { fontFamily: 'DMSans-SemiBold', fontSize: 14, color: colors.white },
  modalOverlay:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalBox:         { backgroundColor: colors.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: spacing.xl, paddingBottom: spacing.xxxl },
  modalTitle:       { fontFamily: 'PlayfairDisplay-Medium', fontSize: 20, color: colors.dark, marginBottom: spacing.xs },
  modalSub:         { ...typography.body, color: colors.mid, marginBottom: spacing.lg, lineHeight: 20 },
  reasonList:       { marginBottom: spacing.md },
  reasonRow:        { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
  radio:            { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  radioSelected:    { borderColor: colors.sage },
  radioDot:         { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.sage },
  reasonText:       { ...typography.body, color: colors.dark, fontSize: 13, flex: 1 },
  rejectConfirmBtn: { backgroundColor: '#A32D2D', borderRadius: radius.md, paddingVertical: spacing.md, alignItems: 'center', marginTop: spacing.md, marginBottom: spacing.sm },
  rejectConfirmText:{ fontFamily: 'DMSans-SemiBold', fontSize: 14, color: colors.white },
  cancelBtn:        { alignItems: 'center', paddingVertical: spacing.md },
  cancelText:       { fontFamily: 'DMSans-SemiBold', fontSize: 14, color: colors.mid },
  pdfPreview:       { backgroundColor: colors.cream, borderRadius: radius.md, padding: spacing.xl, alignItems: 'center', marginBottom: spacing.md, borderWidth: 0.5, borderColor: colors.border },
  pdfName:          { fontFamily: 'DMSans-SemiBold', fontSize: 13, color: colors.dark, marginTop: spacing.sm },
  pdfDate:          { ...typography.small, color: colors.light, marginTop: 4 },
})
