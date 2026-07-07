import React, { useState } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, TextInput, Modal, Linking } from 'react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase, db } from '../../lib/supabase'
import { instructorAPI } from '../../lib/api'
import { LoadingScreen, colors, spacing } from '../../components/ui'
import { Feather } from '@expo/vector-icons'
import HeroHeader from '../../components/HeroHeader'
import BlobCard from '../../components/BlobCard'
import { useAuthStore } from '../../store'

const REJECT_CERT_REASONS = [
  'Certificado inválido o vencido',
  'Institución no reconocida por la Cámara',
  'Imagen ilegible o incompleta',
  'DNI no coincide con el certificado',
  'Las horas declaradas no coinciden',
  'Otro',
]

const NO_VERIFY_REASONS = [
  'No cumple los requisitos mínimos de la Cámara',
  'Información inconsistente en el perfil',
  'Instructor inhabilitado',
  'En espera de documentación adicional',
  'Decisión del directorio',
  'Otro',
]

export default function VerifyInstructorScreen({ navigation, route }: any) {
  const { instructorId } = route.params
  const qc = useQueryClient()
  const user = useAuthStore(s => s.user)

  const [internalNote,    setInternalNote]    = useState('')
  const [showModal,       setShowModal]       = useState<'reject_cert' | 'no_verify' | null>(null)
  const [selectedCert,    setSelectedCert]    = useState<any>(null)
  const [selectedReason,  setSelectedReason]  = useState('')
  const [extraMessage,    setExtraMessage]    = useState('')

  const { data: instructor, isLoading } = useQuery({
    queryKey: ['instructor-detail', instructorId],
    queryFn: async () => {
      const { data, error } = await db.instructors()
        .select('*, certifications(*), specialties:instructor_specialties(*), rates:instructor_rates(*)')
        .eq('id', instructorId).single()
      if (error) throw error
      return data
    },
  })

  // ── Aprobar certificado ──
  const approveCertMutation = useMutation({
    mutationFn: async (certId: string) => {
      await supabase.from('certifications').update({
        review_status: 'approved',
        reviewed_by: user?.id,
        reviewed_at: new Date().toISOString(),
        review_note: null,
      }).eq('id', certId)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['instructor-detail', instructorId] }),
    onError: (e: any) => Alert.alert('Error', e.message),
  })

  // ── Rechazar certificado ──
  const rejectCertMutation = useMutation({
    mutationFn: async () => {
      await supabase.from('certifications').update({
        review_status: 'rejected',
        reviewed_by: user?.id,
        reviewed_at: new Date().toISOString(),
        review_note: `${selectedReason}${extraMessage ? ': ' + extraMessage : ''}`,
      }).eq('id', selectedCert.id)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['instructor-detail', instructorId] })
      setShowModal(null)
      setSelectedCert(null)
      setExtraMessage('')
    },
    onError: (e: any) => Alert.alert('Error', e.message),
  })

  // ── Verificar instructor ──
  const verifyMutation = useMutation({
    mutationFn: async () => {
      await instructorAPI.verify(instructorId, true)
      if (internalNote.trim()) {
        await supabase.from('camara_instructor_notes').insert({
          instructor_id: instructorId, camara_id: user?.camara_id,
          note: internalNote.trim(), type: 'verificacion', created_by: user?.id,
        })
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['instructor-detail', instructorId] })
      navigation.goBack()
    },
    onError: (e: any) => Alert.alert('Error', e.message),
  })

  // ── No verificar ──
  const noVerifyMutation = useMutation({
    mutationFn: async () => {
      await instructorAPI.verify(instructorId, false)
      await supabase.from('camara_instructor_notes').insert({
        instructor_id: instructorId, camara_id: user?.camara_id,
        note: `${selectedReason}${extraMessage ? ': ' + extraMessage : ''}`,
        type: 'rechazo', reject_reason: selectedReason, created_by: user?.id,
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['instructor-detail', instructorId] })
      setShowModal(null)
      navigation.goBack()
    },
    onError: (e: any) => Alert.alert('Error', e.message),
  })

  // ── Toggle activo/inactivo ──
  const toggleActiveMutation = useMutation({
    mutationFn: async (active: boolean) => {
      await supabase.from('instructors').update({ is_active: active }).eq('id', instructorId)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['instructor-detail', instructorId] }),
    onError: (e: any) => Alert.alert('Error', e.message),
  })

  if (isLoading) return <LoadingScreen message="Cargando instructor..." />
  if (!instructor) return null

  const isVerified = instructor.verification_status === 'verified'
  const isActive   = instructor.is_active !== false
  const certs      = instructor.certifications ?? []
  const specialties = instructor.specialties ?? []
  const allCertsReviewed = certs.length > 0 && certs.every((c: any) => c.review_status !== 'pending')

  const CertStatusIcon = ({ status }: { status: string }) => {
    if (status === 'approved') return <Feather name="check-circle" size={20} color={colors.okTx} />
    if (status === 'rejected') return <Feather name="x-circle" size={20} color={colors.redTx} />
    return <Feather name="clock" size={20} color={colors.warnTx} />
  }

  return (
    <View style={s.container}>
      <HeroHeader
        title={instructor.full_name}
        subtitle={[instructor.neighborhood, instructor.dni ? `DNI ${instructor.dni}` : null].filter(Boolean).join(' · ')}
        onBack={() => navigation.goBack()}
        backLabel="Directorio"
        rightElement={
          <View style={[s.statusBadge, {
            backgroundColor: isVerified ? (isActive ? colors.okBg : colors.warnBg) : colors.warnBg
          }]}>
            <Text style={[s.statusBadgeTxt, {
              color: isVerified ? (isActive ? colors.okTx : colors.warnTx) : colors.warnTx
            }]}>
              {isVerified ? (isActive ? '✓ Activo' : '⏸ Inactivo') : '⏳ Pendiente'}
            </Text>
          </View>
        }
      />

      <ScrollView contentContainerStyle={s.content}>

        {/* Info */}
        <BlobCard style={s.card} delay={0}>
          <View style={s.profileRow}>
            <View style={s.avatar}>
              <Text style={s.avatarLetter}>{instructor.full_name?.[0]?.toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.name}>{instructor.full_name}</Text>
              <Text style={s.meta}>{instructor.neighborhood ?? '—'}{instructor.phone ? ` · ${instructor.phone}` : ''}</Text>
            </View>
          </View>
          {instructor.bio && <Text style={s.bio}>{instructor.bio}</Text>}
        </BlobCard>

        {/* Tarifas */}
        {instructor.rates && (
          <BlobCard style={s.card} delay={600}
            blobColor="rgba(184,150,12,0.10)" blobColor2="rgba(184,150,12,0.06)">
            <Text style={s.sectionTitle}>TARIFAS</Text>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <View style={[s.rateBox, { backgroundColor: colors.sageLight }]}>
                <Text style={s.rateLabel}>REGULAR</Text>
                <Text style={s.rateVal}>{instructor.rates.rate_regular ? '$' + instructor.rates.rate_regular.toLocaleString('es-AR') : '—'}</Text>
              </View>
              <View style={[s.rateBox, { backgroundColor: colors.goldLight }]}>
                <Text style={[s.rateLabel, { color: '#7A5000' }]}>REEMPLAZO</Text>
                <Text style={[s.rateVal, { color: colors.gold }]}>{instructor.rates.rate_replacement ? '$' + instructor.rates.rate_replacement.toLocaleString('es-AR') : '—'}</Text>
              </View>
            </View>
          </BlobCard>
        )}

        {/* Especialidades */}
        {specialties.length > 0 && (
          <BlobCard style={s.card} delay={1200}>
            <Text style={s.sectionTitle}>ESPECIALIDADES</Text>
            <View style={s.tagRow}>
              {specialties.map((sp: any) => (
                <View key={sp.id} style={s.tag}>
                  <Text style={s.tagTxt}>{sp.specialty}</Text>
                </View>
              ))}
            </View>
          </BlobCard>
        )}

        {/* Certificados — uno por uno */}
        <Text style={s.groupTitle}>CERTIFICACIONES</Text>
        {certs.length === 0 && (
          <Text style={s.emptyTxt}>Sin certificaciones cargadas</Text>
        )}
        {certs.map((cert: any, idx: number) => (
          <View key={cert.id}>
          <BlobCard style={s.certCard} delay={idx * 500}
            blobColor={
              cert.review_status === 'approved' ? 'rgba(46,107,26,0.10)' :
              cert.review_status === 'rejected' ? 'rgba(139,31,31,0.08)' :
              'rgba(74,93,78,0.08)'
            }
          >
            <View style={s.certTop}>
              <CertStatusIcon status={cert.review_status ?? 'pending'} />
              <View style={{ flex: 1 }}>
                <Text style={s.certName}>{cert.name}</Text>
                <Text style={s.certMeta}>{cert.institution}{cert.year ? ` · ${cert.year}` : ''}</Text>
                {cert.review_note && (
                  <Text style={s.certNote}>↳ {cert.review_note}</Text>
                )}
              </View>
              {cert.document_url && (
                <TouchableOpacity style={s.pdfBtn} onPress={() => Linking.openURL(cert.document_url)}>
                  <Feather name="external-link" size={12} color="#0C447C" />
                  <Text style={s.pdfTxt}>PDF</Text>
                </TouchableOpacity>
              )}
            </View>
            {/* Acciones por certificado */}
            {cert.review_status !== 'approved' && (
              <View style={s.certActions}>
                <TouchableOpacity
                  style={s.certRejectBtn}
                  onPress={() => { setSelectedCert(cert); setSelectedReason(REJECT_CERT_REASONS[0]); setShowModal('reject_cert') }}
                >
                  <Text style={s.certRejectTxt}>✗ Rechazar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={s.certApproveBtn}
                  onPress={() => approveCertMutation.mutate(cert.id)}
                  disabled={approveCertMutation.isPending}
                >
                  <Text style={s.certApproveTxt}>✓ Aprobar</Text>
                </TouchableOpacity>
              </View>
            )}
            {cert.review_status === 'approved' && (
              <TouchableOpacity style={s.undoBtn} onPress={() => approveCertMutation.mutate(cert.id)}>
                <Text style={s.undoTxt}>Volver a pendiente</Text>
              </TouchableOpacity>
            )}
          </BlobCard>
          </View>
        ))}

        {/* Nota interna */}
        <BlobCard style={s.card} delay={800}>
          <Text style={s.sectionTitle}>NOTA INTERNA (SOLO VISIBLE PARA LA CÁMARA)</Text>
          <TextInput
            style={s.noteInput}
            placeholder="Ej: Certificados verificados telefónicamente..."
            placeholderTextColor={colors.light}
            value={internalNote}
            onChangeText={setInternalNote}
            multiline numberOfLines={3}
          />
        </BlobCard>

        {/* Toggle Activo/Inactivo */}
        {isVerified && (
          <TouchableOpacity
            style={[s.toggleBtn, { backgroundColor: isActive ? colors.warnBg : colors.sageLight }]}
            onPress={() => toggleActiveMutation.mutate(!isActive)}
            disabled={toggleActiveMutation.isPending}
            activeOpacity={0.85}
          >
            <Feather name={isActive ? 'pause-circle' : 'play-circle'} size={18}
              color={isActive ? colors.warnTx : colors.sage} />
            <Text style={[s.toggleTxt, { color: isActive ? colors.warnTx : colors.sage }]}>
              {isActive ? 'Marcar como inactivo' : 'Reactivar instructor'}
            </Text>
          </TouchableOpacity>
        )}

        {/* Acciones principales */}
        <View style={s.actions}>
          {!isVerified ? (
            <>
              <TouchableOpacity style={s.noVerifyBtn}
                onPress={() => { setSelectedReason(NO_VERIFY_REASONS[0]); setShowModal('no_verify') }}>
                <Feather name="x" size={16} color="#A32D2D" />
                <Text style={s.noVerifyTxt}>No verificar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.verifyBtn, (!allCertsReviewed) && { opacity: 0.5 }]}
                onPress={() => verifyMutation.mutate()}
                disabled={verifyMutation.isPending || !allCertsReviewed}
              >
                <Feather name="check" size={16} color="#fff" />
                <Text style={s.verifyTxt}>
                  {verifyMutation.isPending ? 'Verificando...' : 'Verificar instructor'}
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity style={s.noVerifyBtn}
              onPress={() => { setSelectedReason(NO_VERIFY_REASONS[0]); setShowModal('no_verify') }}>
              <Feather name="rotate-ccw" size={16} color="#A32D2D" />
              <Text style={s.noVerifyTxt}>Revocar verificación</Text>
            </TouchableOpacity>
          )}
        </View>

        {!allCertsReviewed && !isVerified && certs.length > 0 && (
          <Text style={s.hint}>Revisá todos los certificados antes de verificar</Text>
        )}

      </ScrollView>

      {/* Modal rechazar certificado */}
      <Modal visible={showModal === 'reject_cert'} transparent animationType="slide">
        <View style={s.overlay}>
          <View style={s.modalBox}>
            <Text style={s.modalTitle}>Rechazar certificado</Text>
            <Text style={s.modalSub}>{selectedCert?.name}</Text>
            <Text style={s.inputLabel}>Motivo</Text>
            {REJECT_CERT_REASONS.map(r => (
              <TouchableOpacity key={r} style={s.reasonRow} onPress={() => setSelectedReason(r)}>
                <View style={[s.radio, selectedReason === r && s.radioOn]}>
                  {selectedReason === r && <View style={s.radioDot} />}
                </View>
                <Text style={s.reasonTxt}>{r}</Text>
              </TouchableOpacity>
            ))}
            <Text style={[s.inputLabel, { marginTop: spacing.md }]}>Mensaje adicional (opcional)</Text>
            <TextInput style={s.noteInput} value={extraMessage} onChangeText={setExtraMessage}
              placeholder="Ej: Reenviar con fecha visible" placeholderTextColor={colors.light} multiline />
            <TouchableOpacity style={s.confirmBtn} onPress={() => rejectCertMutation.mutate()}
              disabled={rejectCertMutation.isPending}>
              <Text style={s.confirmTxt}>{rejectCertMutation.isPending ? 'Rechazando...' : 'Confirmar rechazo'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.cancelBtn} onPress={() => setShowModal(null)}>
              <Text style={s.cancelTxt}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal no verificar / revocar */}
      <Modal visible={showModal === 'no_verify'} transparent animationType="slide">
        <View style={s.overlay}>
          <View style={s.modalBox}>
            <Text style={s.modalTitle}>{isVerified ? 'Revocar verificación' : 'No verificar instructor'}</Text>
            <Text style={s.modalSub}>{instructor.full_name} recibirá una notificación.</Text>
            <Text style={s.inputLabel}>Motivo</Text>
            {NO_VERIFY_REASONS.map(r => (
              <TouchableOpacity key={r} style={s.reasonRow} onPress={() => setSelectedReason(r)}>
                <View style={[s.radio, selectedReason === r && s.radioOn]}>
                  {selectedReason === r && <View style={s.radioDot} />}
                </View>
                <Text style={s.reasonTxt}>{r}</Text>
              </TouchableOpacity>
            ))}
            <Text style={[s.inputLabel, { marginTop: spacing.md }]}>Mensaje adicional (opcional)</Text>
            <TextInput style={s.noteInput} value={extraMessage} onChangeText={setExtraMessage}
              placeholder="Ej: Contactarse con la Cámara para más información" placeholderTextColor={colors.light} multiline />
            <TouchableOpacity style={s.confirmBtn} onPress={() => noVerifyMutation.mutate()}
              disabled={noVerifyMutation.isPending}>
              <Text style={s.confirmTxt}>{noVerifyMutation.isPending ? 'Procesando...' : 'Confirmar'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.cancelBtn} onPress={() => setShowModal(null)}>
              <Text style={s.cancelTxt}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </View>
  )
}

const s = StyleSheet.create({
  container:      { flex: 1, backgroundColor: colors.cream },
  content:        { padding: spacing.md, paddingBottom: 48 },
  statusBadge:    { borderTopLeftRadius: 10, borderTopRightRadius: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  statusBadgeTxt: { fontFamily: 'Nunito-Bold', fontSize: 10 },

  card:           { padding: spacing.md, marginBottom: spacing.sm },
  profileRow:     { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginBottom: spacing.sm },
  avatar:         { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.sageLight, alignItems: 'center', justifyContent: 'center' },
  avatarLetter:   { fontFamily: 'Nunito-Bold', fontSize: 18, color: colors.sage },
  name:           { fontFamily: 'Nunito-Bold', fontSize: 16, color: colors.dark },
  meta:           { fontFamily: 'Nunito-Regular', fontSize: 12, color: colors.mid, marginTop: 2 },
  bio:            { fontFamily: 'Nunito-Regular', fontSize: 13, color: colors.mid, lineHeight: 18, marginTop: spacing.sm },

  sectionTitle:   { fontFamily: 'Nunito-Bold', fontSize: 9, color: colors.light, letterSpacing: 0.8, marginBottom: spacing.sm },
  groupTitle:     { fontFamily: 'Nunito-Bold', fontSize: 9, color: colors.light, letterSpacing: 0.8, marginBottom: spacing.sm, marginTop: spacing.sm },

  rateBox:        { flex: 1, borderTopLeftRadius: 12, borderTopRightRadius: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 12, padding: spacing.md },
  rateLabel:      { fontFamily: 'Nunito-Bold', fontSize: 9, color: colors.sageMid, letterSpacing: 0.5, marginBottom: 3 },
  rateVal:        { fontFamily: 'Nunito-Bold', fontSize: 20, color: colors.sage },

  tagRow:         { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag:            { backgroundColor: colors.sageLight, borderTopLeftRadius: 8, borderTopRightRadius: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  tagTxt:         { fontFamily: 'Nunito-SemiBold', fontSize: 11, color: colors.sage },

  certCard:       { padding: spacing.md, marginBottom: spacing.sm },
  certTop:        { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginBottom: spacing.sm },
  certName:       { fontFamily: 'Nunito-Bold', fontSize: 13, color: colors.dark },
  certMeta:       { fontFamily: 'Nunito-Regular', fontSize: 11, color: colors.mid, marginTop: 2 },
  certNote:       { fontFamily: 'Nunito-Regular', fontSize: 11, color: colors.redTx, marginTop: 3, fontStyle: 'italic' },
  pdfBtn:         { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#E6F1FB', borderTopLeftRadius: 8, borderTopRightRadius: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 8, paddingHorizontal: 8, paddingVertical: 5 },
  pdfTxt:         { fontFamily: 'Nunito-SemiBold', fontSize: 11, color: '#0C447C' },
  certActions:    { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  certRejectBtn:  { flex: 1, backgroundColor: colors.redBg, borderTopLeftRadius: 10, borderTopRightRadius: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 10, padding: 9, alignItems: 'center', borderWidth: 0.5, borderColor: '#F5C5C5' },
  certRejectTxt:  { fontFamily: 'Nunito-Bold', fontSize: 12, color: colors.redTx },
  certApproveBtn: { flex: 2, backgroundColor: colors.okBg, borderTopLeftRadius: 10, borderTopRightRadius: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 10, padding: 9, alignItems: 'center', borderWidth: 0.5, borderColor: 'rgba(46,107,26,0.25)' },
  certApproveTxt: { fontFamily: 'Nunito-Bold', fontSize: 12, color: colors.okTx },
  undoBtn:        { alignItems: 'center', paddingTop: spacing.xs },
  undoTxt:        { fontFamily: 'Nunito-Regular', fontSize: 11, color: colors.light },

  noteInput:      { fontFamily: 'Nunito-Regular', fontSize: 13, color: colors.dark, minHeight: 64, textAlignVertical: 'top' },

  toggleBtn:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderTopLeftRadius: 14, borderTopRightRadius: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 14, padding: 13, marginBottom: spacing.sm, borderWidth: 0.5, borderColor: colors.border },
  toggleTxt:      { fontFamily: 'Nunito-Bold', fontSize: 14 },

  actions:        { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  noVerifyBtn:    { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: colors.redBg, borderTopLeftRadius: 14, borderTopRightRadius: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 14, padding: 14, borderWidth: 0.5, borderColor: '#F5C5C5' },
  noVerifyTxt:    { fontFamily: 'Nunito-Bold', fontSize: 13, color: colors.redTx },
  verifyBtn:      { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: colors.sage, borderTopLeftRadius: 14, borderTopRightRadius: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 14, padding: 14 },
  verifyTxt:      { fontFamily: 'Nunito-Bold', fontSize: 13, color: '#fff' },
  hint:           { fontFamily: 'Nunito-Regular', fontSize: 11, color: colors.light, textAlign: 'center', marginTop: spacing.xs },

  overlay:        { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalBox:       { backgroundColor: colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.xl, paddingBottom: 40, maxHeight: '85%' },
  modalTitle:     { fontFamily: 'Nunito-Bold', fontSize: 20, color: colors.dark, marginBottom: spacing.xs },
  modalSub:       { fontFamily: 'Nunito-Regular', fontSize: 13, color: colors.mid, marginBottom: spacing.md },
  inputLabel:     { fontFamily: 'Nunito-Bold', fontSize: 9, color: colors.light, letterSpacing: 0.7, marginBottom: spacing.xs },
  reasonRow:      { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 8 },
  radio:          { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  radioOn:        { borderColor: colors.sage },
  radioDot:       { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.sage },
  reasonTxt:      { fontFamily: 'Nunito-Regular', fontSize: 13, color: colors.dark, flex: 1 },
  confirmBtn:     { backgroundColor: '#A32D2D', borderTopLeftRadius: 14, borderTopRightRadius: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 14, padding: 14, alignItems: 'center', marginTop: spacing.md, marginBottom: spacing.sm },
  confirmTxt:     { fontFamily: 'Nunito-Bold', fontSize: 14, color: '#fff' },
  cancelBtn:      { alignItems: 'center', padding: spacing.sm },
  cancelTxt:      { fontFamily: 'Nunito-SemiBold', fontSize: 14, color: colors.mid },
  emptyTxt:       { fontFamily: 'Nunito-Regular', fontSize: 13, color: colors.light, marginBottom: spacing.md },
})
