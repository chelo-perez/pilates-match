// src/screens/camara/VerifyInstructorScreen.tsx
// La Cámara revisa certificados uno por uno y verifica, pide corrección o rechaza al instructor
import React, { useState } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Modal, Linking } from 'react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase, db } from '../../lib/supabase'
import { instructorAPI } from '../../lib/api'
import { errorText, UserError } from '../../lib/errors'
import { formatDate } from '../../lib/dates'
import { SPECIALTY_LABELS, VERIFICATION_STATUS } from '../../constants/labels'
import { LoadingScreen, ErrorState, Button, colors, spacing, radius, typography } from '../../components/ui'
import { Feather } from '@expo/vector-icons'
import HeroHeader from '../../components/HeroHeader'
import BlobCard from '../../components/BlobCard'
import { useAuthStore } from '../../store'
import Toast from '../../components/Toast'
import { useToast } from '../../hooks/useToast'

const REJECT_CERT_REASONS = [
  'Certificado inválido o vencido',
  'Institución no reconocida por la entidad',
  'Imagen ilegible o incompleta',
  'El nombre no coincide con el del perfil',
  'Las horas declaradas no coinciden',
  'Otro',
]

const FIX_REASONS = [
  'Falta documentación',
  'Información inconsistente en el perfil',
  'Certificados ilegibles o incompletos',
  'Otro',
]

const REJECT_REASONS = [
  'No cumple los requisitos mínimos de la entidad',
  'Instructor inhabilitado',
  'Decisión del directorio',
  'Otro',
]

type ModalMode = 'reject_cert' | 'request_fix' | 'reject' | null

const CERT_ICON: Record<string, { icon: string; color: string }> = {
  approved: { icon: 'check-circle', color: colors.okTx },
  rejected: { icon: 'x-circle',     color: colors.redTx },
  pending:  { icon: 'clock',        color: colors.warnTx },
}

export default function VerifyInstructorScreen({ navigation, route }: any) {
  const { toast, showToast, hideToast } = useToast()
  const instructorId: string | undefined = route?.params?.instructorId
  const qc = useQueryClient()
  const user = useAuthStore(s => s.user)

  const [internalNote,   setInternalNote]   = useState('')
  const [modal,          setModal]          = useState<ModalMode>(null)
  const [selectedCert,   setSelectedCert]   = useState<any>(null)
  const [selectedReason, setSelectedReason] = useState('')
  const [extraMessage,   setExtraMessage]   = useState('')

  const { data: instructor, isLoading, isError, refetch } = useQuery({
    queryKey: ['instructor-detail', instructorId],
    queryFn: async () => {
      const { data, error } = await db.instructors()
        .select('*, certifications(id, name, institution, year, hours, document_url, review_status, review_note, reviewed_at), specialties:instructor_specialties(*), rates:instructor_rates(*)')
        .eq('id', instructorId!).single()
      if (error) throw error
      return data
    },
    enabled: !!instructorId,
  })

  const { data: notes = [] } = useQuery({
    queryKey: ['instructor-detail', instructorId, 'notes'],
    queryFn: async () => {
      const { data, error } = await supabase.from('camara_instructor_notes')
        .select('id, note, type, created_at').eq('instructor_id', instructorId!)
        .order('created_at', { ascending: false }).limit(5)
      if (error) throw error
      return data ?? []
    },
    enabled: !!instructorId,
  })

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ['instructor-detail', instructorId] })
    qc.invalidateQueries({ queryKey: ['camara-instructors'] })
    qc.invalidateQueries({ queryKey: ['camara-stats'] })
    qc.invalidateQueries({ queryKey: ['camara-reports'] })
    qc.invalidateQueries({ queryKey: ['pending-instructors'] })
    qc.invalidateQueries({ queryKey: ['instructor'] })
  }

  const closeModal = () => { setModal(null); setSelectedCert(null); setExtraMessage('') }
  const reasonText = () => `${selectedReason}${extraMessage.trim() ? ': ' + extraMessage.trim() : ''}`

  // Nota interna: si falla, avisamos pero no bloqueamos la acción principal
  const saveNote = async (note: string, type: string, rejectReason?: string) => {
    const { error } = await supabase.from('camara_instructor_notes').insert({
      instructor_id: instructorId, camara_id: user?.camara_id ?? null,
      note, type, reject_reason: rejectReason ?? null, created_by: user?.id,
    })
    if (error) showToast('La acción se guardó, pero no pudimos guardar la nota interna.', 'warning')
    return !error
  }

  const updateCert = async (certId: string, fields: Record<string, any>) => {
    const { data, error } = await supabase.from('certifications').update(fields).eq('id', certId).select('id')
    if (error) throw error
    if (!data?.length) throw new UserError('No tenés permiso para modificar este certificado.')
  }

  const updateInstructor = async (fields: Record<string, any>) => {
    const { data, error } = await supabase.from('instructors').update(fields).eq('id', instructorId!).select('id')
    if (error) throw error
    if (!data?.length) throw new UserError('No tenés permiso para modificar este instructor.')
  }

  const certMutation = useMutation({
    mutationFn: async ({ certId, status }: { certId: string; status: 'approved' | 'rejected' | 'pending' }) => {
      const now = new Date().toISOString()
      await updateCert(certId, {
        review_status: status,
        review_note:   status === 'rejected' ? reasonText() : null,
        reviewed_by:   status === 'pending' ? null : user?.id,
        reviewed_at:   status === 'pending' ? null : now,
        verified:      status === 'approved',
        verified_at:   status === 'approved' ? now : null,
      })
    },
    onSuccess: (_d, v) => {
      invalidateAll()
      closeModal()
      showToast(v.status === 'approved' ? 'Certificado aprobado' : v.status === 'rejected' ? 'Certificado rechazado' : 'Certificado vuelto a revisión')
    },
    onError: (e: any) => showToast(errorText(e), 'error'),
  })

  const verifyMutation = useMutation({
    mutationFn: async () => {
      await instructorAPI.verify(instructorId!, true, null)
      if (internalNote.trim()) await saveNote(internalNote.trim(), 'verificacion')
    },
    onSuccess: () => {
      invalidateAll()
      setInternalNote('')
      showToast('Instructor verificado')
    },
    onError: (e: any) => showToast(errorText(e), 'error'),
  })

  // Pedir corrección (queda pendiente) o rechazar/revocar (queda rechazado); el instructor ve el motivo
  const statusMutation = useMutation({
    mutationFn: async (mode: 'request_fix' | 'reject') => {
      const msg = reasonText()
      await updateInstructor({
        verification_status: mode === 'reject' ? 'rechazado' : 'pendiente',
        verification_note: msg,
        verified_at: null,
        verified_by: null,
      })
      await saveNote(
        internalNote.trim() ? `${msg} — Nota interna: ${internalNote.trim()}` : msg,
        mode === 'reject' ? 'rechazo' : 'correccion',
        selectedReason,
      )
    },
    onSuccess: (_d, mode) => {
      invalidateAll()
      closeModal()
      setInternalNote('')
      showToast(mode === 'reject' ? 'Instructor marcado como rechazado' : 'Pedido de corrección enviado')
    },
    onError: (e: any) => showToast(errorText(e), 'error'),
  })

  const toggleActiveMutation = useMutation({
    mutationFn: (active: boolean) => updateInstructor({ is_active: active }),
    onSuccess: (_d, active) => { invalidateAll(); showToast(active ? 'Instructor reactivado' : 'Instructor pausado') },
    onError: (e: any) => showToast(errorText(e), 'error'),
  })

  const viewFile = async (path: string) => {
    // document_url guarda el path del bucket privado; los registros viejos pueden tener una URL completa
    if (/^https?:\/\//.test(path)) { Linking.openURL(path); return }
    const { data, error } = await supabase.storage.from('certifications').createSignedUrl(path, 600)
    if (error || !data?.signedUrl) { showToast(errorText(error ?? new UserError('No se pudo abrir el archivo')), 'error'); return }
    Linking.openURL(data.signedUrl)
  }

  const goBack = () => navigation.goBack()

  if (!instructorId) return <ErrorState message="No encontramos el instructor." onRetry={goBack} />
  if (isLoading) return <LoadingScreen message="Cargando instructor..." />
  if (isError || !instructor) return <ErrorState message="No pudimos cargar el instructor." onRetry={refetch} />

  const status      = instructor.verification_status ?? 'pendiente'
  const statusInfo  = VERIFICATION_STATUS[status] ?? VERIFICATION_STATUS.pendiente
  const isVerified  = status === 'verificado'
  const isActive    = instructor.is_active !== false
  const certs: any[] = instructor.certifications ?? []
  const specialties: any[] = instructor.specialties ?? []
  const rates: any  = Array.isArray(instructor.rates) ? instructor.rates[0] : instructor.rates
  const pendingCerts  = certs.filter(c => (c.review_status ?? 'pending') === 'pending').length
  const approvedCerts = certs.filter(c => c.review_status === 'approved').length
  const canVerify   = certs.length > 0 && pendingCerts === 0 && approvedCerts > 0
  const verifyHint  = certs.length === 0
    ? 'El instructor todavía no cargó certificados. Podés pedirle que los suba.'
    : pendingCerts > 0
      ? (pendingCerts > 1 ? `Revisá los ${pendingCerts} certificados pendientes antes de verificar.` : 'Revisá el certificado pendiente antes de verificar.')
      : approvedCerts === 0
        ? 'Para verificar tiene que haber al menos un certificado aprobado.'
        : null
  const badgeColors = isVerified
    ? (isActive ? { bg: colors.okBg, tx: colors.okTx } : { bg: colors.warnBg, tx: colors.warnTx })
    : status === 'rechazado' ? { bg: colors.redBg, tx: colors.redTx } : { bg: colors.warnBg, tx: colors.warnTx }

  const openModal = (mode: Exclude<ModalMode, null>, cert?: any) => {
    setSelectedCert(cert ?? null)
    setExtraMessage('')
    setSelectedReason((mode === 'reject_cert' ? REJECT_CERT_REASONS : mode === 'request_fix' ? FIX_REASONS : REJECT_REASONS)[0])
    setModal(mode)
  }
  const reasons = modal === 'reject_cert' ? REJECT_CERT_REASONS : modal === 'request_fix' ? FIX_REASONS : REJECT_REASONS
  const modalTitle = modal === 'reject_cert' ? 'Rechazar certificado'
    : modal === 'request_fix' ? 'Pedir corrección'
    : isVerified ? 'Revocar verificación' : 'Rechazar instructor'
  const modalSub = modal === 'reject_cert'
    ? `${selectedCert?.name ?? ''}. El instructor va a ver el motivo en su perfil y podrá subir otro archivo.`
    : modal === 'request_fix'
      ? `${instructor.full_name} queda pendiente y va a ver este mensaje en su perfil para corregir.`
      : `${instructor.full_name} queda como rechazado y va a ver el motivo en su perfil.`
  const modalPending = certMutation.isPending || statusMutation.isPending

  const confirmModal = () => {
    if (modal === 'reject_cert' && selectedCert) certMutation.mutate({ certId: selectedCert.id, status: 'rejected' })
    else if (modal === 'request_fix' || modal === 'reject') statusMutation.mutate(modal)
  }

  return (
    <View style={s.container}>
      <HeroHeader
        title={instructor.full_name}
        subtitle={[instructor.neighborhood, instructor.dni ? `DNI ${instructor.dni}` : null].filter(Boolean).join(' · ') || undefined}
        onBack={goBack}
        backLabel="Instructores"
        rightElement={
          <View style={[s.statusBadge, { backgroundColor: badgeColors.bg }]}>
            <Text style={[s.statusBadgeTxt, { color: badgeColors.tx }]}>
              {isVerified && !isActive ? 'Pausado' : statusInfo.label}
            </Text>
          </View>
        }
      />

      <ScrollView contentContainerStyle={s.content}>

        {instructor.verification_note && !isVerified ? (
          <View style={s.noteBanner}>
            <Feather name="message-circle" size={13} color={colors.warnTx} />
            <Text style={s.noteBannerTxt}>Último mensaje al instructor: {instructor.verification_note}</Text>
          </View>
        ) : null}

        <BlobCard style={s.card} delay={0}>
          <View style={s.profileRow}>
            <View style={s.avatar}>
              <Text style={s.avatarLetter}>{instructor.full_name?.[0]?.toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.name}>{instructor.full_name}</Text>
              <Text style={s.meta}>{[instructor.neighborhood, instructor.phone, instructor.email].filter(Boolean).join(' · ') || 'Sin datos de contacto'}</Text>
              <Text style={s.meta}>Registrado el {formatDate(instructor.created_at)}</Text>
            </View>
          </View>
          {instructor.bio ? <Text style={s.bio}>{instructor.bio}</Text> : null}
        </BlobCard>

        {rates ? (
          <BlobCard style={s.card} delay={600} blobColor={colors.gold + '1a'} blobColor2={colors.gold + '0f'}>
            <Text style={s.sectionTitle}>TARIFAS POR CLASE</Text>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <View style={[s.rateBox, { backgroundColor: colors.sageLight }]}>
                <Text style={s.rateLabel}>REGULAR</Text>
                <Text style={s.rateVal}>{rates.rate_regular ? '$' + rates.rate_regular.toLocaleString('es-AR') : '—'}</Text>
              </View>
              <View style={[s.rateBox, { backgroundColor: colors.goldLight }]}>
                <Text style={[s.rateLabel, { color: colors.gold }]}>REEMPLAZO</Text>
                <Text style={[s.rateVal, { color: colors.gold }]}>{rates.rate_replacement ? '$' + rates.rate_replacement.toLocaleString('es-AR') : '—'}</Text>
              </View>
            </View>
          </BlobCard>
        ) : null}

        {specialties.length > 0 && (
          <BlobCard style={s.card} delay={1200}>
            <Text style={s.sectionTitle}>ESPECIALIDADES</Text>
            <View style={s.tagRow}>
              {specialties.map((sp: any) => (
                <View key={sp.id} style={s.tag}>
                  <Text style={s.tagTxt}>{(SPECIALTY_LABELS as Record<string, string>)[sp.specialty] ?? sp.specialty}</Text>
                </View>
              ))}
            </View>
          </BlobCard>
        )}

        <Text style={s.groupTitle}>CERTIFICACIONES ({approvedCerts}/{certs.length} APROBADAS)</Text>
        {certs.length === 0 && <Text style={s.emptyTxt}>El instructor todavía no cargó certificaciones.</Text>}
        {certs.map((cert: any, idx: number) => {
          const st = cert.review_status ?? 'pending'
          const ic = CERT_ICON[st] ?? CERT_ICON.pending
          const busy = certMutation.isPending && certMutation.variables?.certId === cert.id
          return (
            <BlobCard key={cert.id} style={s.certCard} delay={idx * 500}
              blobColor={st === 'approved' ? 'rgba(46,107,26,0.10)' : st === 'rejected' ? 'rgba(139,31,31,0.08)' : colors.sage + '14'}
            >
              {st === 'rejected' && cert.review_note ? (
                <View style={[s.banner, { backgroundColor: colors.redBg }]}>
                  <Feather name="alert-circle" size={13} color={colors.redTx} />
                  <Text style={[s.bannerTxt, { color: colors.redTx }]}>Rechazado: {cert.review_note}</Text>
                </View>
              ) : null}
              {st === 'approved' ? (
                <View style={[s.banner, { backgroundColor: colors.okBg }]}>
                  <Feather name="check-circle" size={13} color={colors.okTx} />
                  <Text style={[s.bannerTxt, { color: colors.okTx }]}>
                    Aprobado{cert.reviewed_at ? ` el ${formatDate(cert.reviewed_at)}` : ''}
                  </Text>
                </View>
              ) : null}
              <View style={s.certTop}>
                <Feather name={ic.icon as any} size={20} color={ic.color} />
                <View style={{ flex: 1 }}>
                  <Text style={s.certName}>{cert.name}</Text>
                  <Text style={s.certMeta}>{[cert.institution, cert.year, cert.hours ? `${cert.hours} h` : null].filter(Boolean).join(' · ')}</Text>
                </View>
                {cert.document_url ? (
                  <TouchableOpacity style={s.pdfBtn} onPress={() => viewFile(cert.document_url)}>
                    <Feather name="file-text" size={13} color={colors.blueTx} />
                    <Text style={s.pdfTxt}>Ver archivo</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={s.noPdfTag}><Text style={s.noPdfTxt}>Sin archivo</Text></View>
                )}
              </View>
              {st !== 'approved' ? (
                <View style={s.certActions}>
                  {st !== 'rejected' ? (
                    <Button label="Rechazar" variant="danger" size="sm" style={{ flex: 1 }}
                      onPress={() => openModal('reject_cert', cert)} disabled={busy}
                      icon={<Feather name="x" size={14} color={colors.redTx} />} />
                  ) : null}
                  <Button label="Aprobar" size="sm" style={{ flex: 1 }}
                    onPress={() => certMutation.mutate({ certId: cert.id, status: 'approved' })}
                    isLoading={busy} disabled={busy || !cert.document_url}
                    icon={<Feather name="check" size={14} color={colors.white} />} />
                </View>
              ) : (
                <TouchableOpacity style={s.undoBtn} disabled={busy}
                  onPress={() => certMutation.mutate({ certId: cert.id, status: 'pending' })}>
                  <Text style={s.undoTxt}>↩ Volver a revisión</Text>
                </TouchableOpacity>
              )}
              {!cert.document_url && st !== 'approved' ? (
                <Text style={s.hintLeft}>No se puede aprobar sin archivo adjunto.</Text>
              ) : null}
            </BlobCard>
          )
        })}

        <BlobCard style={s.card} delay={800}>
          <Text style={s.sectionTitle}>NOTA INTERNA (SOLO LA VE LA CÁMARA)</Text>
          <TextInput
            style={s.noteInput}
            placeholder="Ej: Certificados verificados telefónicamente con la institución"
            placeholderTextColor={colors.light}
            value={internalNote}
            onChangeText={setInternalNote}
            multiline numberOfLines={3}
          />
          {notes.length > 0 ? (
            <View style={s.notesList}>
              {notes.map((n: any) => (
                <Text key={n.id} style={s.noteItem}>• {formatDate(n.created_at)} — {n.note}</Text>
              ))}
            </View>
          ) : null}
        </BlobCard>

        {isVerified && (
          <Button
            label={isActive ? 'Pausar instructor (deja de aparecer en búsquedas)' : 'Reactivar instructor'}
            variant={isActive ? 'outline' : 'secondary'}
            onPress={() => toggleActiveMutation.mutate(!isActive)}
            isLoading={toggleActiveMutation.isPending}
            icon={<Feather name={isActive ? 'pause-circle' : 'play-circle'} size={16} color={colors.sage} />}
            fullWidth
            style={{ marginBottom: spacing.sm }}
          />
        )}

        {!isVerified ? (
          <>
            <Button
              label="Verificar instructor"
              onPress={() => verifyMutation.mutate()}
              isLoading={verifyMutation.isPending}
              disabled={!canVerify}
              icon={<Feather name="check" size={16} color={colors.white} />}
              fullWidth
            />
            {verifyHint ? <Text style={s.hint}>{verifyHint}</Text> : null}
            <View style={s.actions}>
              <Button label="Pedir corrección" variant="secondary" fullWidth
                onPress={() => openModal('request_fix')}
                icon={<Feather name="edit-3" size={14} color={colors.sage} />} />
              {status !== 'rechazado' ? (
                <Button label="Rechazar" variant="danger" fullWidth
                  onPress={() => openModal('reject')}
                  icon={<Feather name="x" size={14} color={colors.redTx} />} />
              ) : null}
            </View>
          </>
        ) : (
          <Button label="Revocar verificación" variant="danger" onPress={() => openModal('reject')}
            icon={<Feather name="rotate-ccw" size={16} color={colors.redTx} />} fullWidth />
        )}
      </ScrollView>

      <Modal visible={modal !== null} transparent animationType="slide" onRequestClose={closeModal}>
        <View style={s.overlay}>
          <View style={s.modalBox}>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={s.modalTitle}>{modalTitle}</Text>
              <Text style={s.modalSub}>{modalSub}</Text>
              <Text style={s.inputLabel}>MOTIVO</Text>
              {reasons.map(r => (
                <TouchableOpacity key={r} style={s.reasonRow} onPress={() => setSelectedReason(r)}>
                  <View style={[s.radio, selectedReason === r && s.radioOn]}>
                    {selectedReason === r && <View style={s.radioDot} />}
                  </View>
                  <Text style={s.reasonTxt}>{r}</Text>
                </TouchableOpacity>
              ))}
              <Text style={[s.inputLabel, { marginTop: spacing.md }]}>
                {selectedReason === 'Otro' ? 'DETALLE (OBLIGATORIO)' : 'MENSAJE ADICIONAL (OPCIONAL)'}
              </Text>
              <TextInput style={[s.noteInput, s.modalInput]} value={extraMessage} onChangeText={setExtraMessage}
                placeholder="Ej: Subí el certificado con la fecha visible" placeholderTextColor={colors.light} multiline />
              <Button
                label="Confirmar"
                variant={modal === 'request_fix' ? 'primary' : 'danger'}
                onPress={confirmModal}
                isLoading={modalPending}
                disabled={selectedReason === 'Otro' && !extraMessage.trim()}
                fullWidth
                style={{ marginTop: spacing.md }}
              />
              <Button label="Cancelar" variant="ghost" onPress={closeModal} fullWidth style={{ marginTop: spacing.xs }} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Toast visible={toast.visible} message={toast.message} type={toast.type} onHide={hideToast} />
    </View>
  )
}

const s = StyleSheet.create({
  container:      { flex: 1, backgroundColor: colors.cream },
  content:        { padding: spacing.md, paddingBottom: 48 },
  statusBadge:    { ...radius.leaf, paddingHorizontal: 10, paddingVertical: 4 },
  statusBadgeTxt: { fontFamily: 'Nunito-Bold', fontSize: 10 },

  noteBanner:     { flexDirection: 'row', gap: 6, alignItems: 'flex-start', backgroundColor: colors.warnBg, ...radius.leaf, padding: spacing.sm, marginBottom: spacing.sm },
  noteBannerTxt:  { fontFamily: 'Nunito-SemiBold', fontSize: 12, color: colors.warnTx, flex: 1 },

  card:           { padding: spacing.md, marginBottom: spacing.sm },
  profileRow:     { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginBottom: spacing.sm },
  avatar:         { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.sageLight, alignItems: 'center', justifyContent: 'center' },
  avatarLetter:   { fontFamily: 'Nunito-Bold', fontSize: 18, color: colors.sage },
  name:           { fontFamily: 'Nunito-Bold', fontSize: 16, color: colors.dark },
  meta:           { fontFamily: 'Nunito-Regular', fontSize: 12, color: colors.mid, marginTop: 2 },
  bio:            { fontFamily: 'Nunito-Regular', fontSize: 13, color: colors.mid, lineHeight: 18, marginTop: spacing.sm },

  sectionTitle:   { ...typography.caption, marginBottom: spacing.sm },
  groupTitle:     { ...typography.caption, marginBottom: spacing.sm, marginTop: spacing.sm },

  rateBox:        { flex: 1, ...radius.leaf, padding: spacing.md },
  rateLabel:      { fontFamily: 'Nunito-Bold', fontSize: 10, color: colors.sageMid, letterSpacing: 0.5, marginBottom: 3 },
  rateVal:        { fontFamily: 'Nunito-Bold', fontSize: 20, color: colors.sage },

  tagRow:         { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag:            { backgroundColor: colors.sageLight, ...radius.leaf, paddingHorizontal: 10, paddingVertical: 4 },
  tagTxt:         { fontFamily: 'Nunito-SemiBold', fontSize: 11, color: colors.sage },

  certCard:       { padding: spacing.md, marginBottom: spacing.sm },
  banner:         { flexDirection: 'row', alignItems: 'center', gap: 6, ...radius.leaf, paddingHorizontal: 10, paddingVertical: 6, marginBottom: spacing.sm },
  bannerTxt:      { fontFamily: 'Nunito-SemiBold', fontSize: 12, flex: 1 },
  certTop:        { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginBottom: spacing.sm },
  certName:       { fontFamily: 'Nunito-Bold', fontSize: 13, color: colors.dark },
  certMeta:       { fontFamily: 'Nunito-Regular', fontSize: 11, color: colors.mid, marginTop: 2 },
  noPdfTag:       { backgroundColor: colors.warnBg, borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 4 },
  noPdfTxt:       { fontFamily: 'Nunito-SemiBold', fontSize: 10, color: colors.warnTx },
  pdfBtn:         { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.blueBg, ...radius.leaf, paddingHorizontal: 8, paddingVertical: 5 },
  pdfTxt:         { fontFamily: 'Nunito-SemiBold', fontSize: 11, color: colors.blueTx },
  certActions:    { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  undoBtn:        { alignItems: 'center', paddingTop: spacing.xs },
  undoTxt:        { fontFamily: 'Nunito-SemiBold', fontSize: 11, color: colors.mid },
  hintLeft:       { fontFamily: 'Nunito-Regular', fontSize: 11, color: colors.light, marginTop: spacing.xs },

  noteInput:      { fontFamily: 'Nunito-Regular', fontSize: 13, color: colors.dark, minHeight: 64, textAlignVertical: 'top' },
  modalInput:     { backgroundColor: colors.cream, ...radius.leaf, padding: spacing.sm, borderWidth: 0.5, borderColor: colors.border },
  notesList:      { borderTopWidth: 0.5, borderColor: colors.borderLight, marginTop: spacing.sm, paddingTop: spacing.sm, gap: 4 },
  noteItem:       { fontFamily: 'Nunito-Regular', fontSize: 11, color: colors.mid },

  actions:        { gap: spacing.sm, marginTop: spacing.sm },
  hint:           { fontFamily: 'Nunito-Regular', fontSize: 12, color: colors.mid, textAlign: 'center', marginTop: spacing.xs },
  emptyTxt:       { fontFamily: 'Nunito-Regular', fontSize: 13, color: colors.light, marginBottom: spacing.md },

  overlay:        { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalBox:       { backgroundColor: colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.xl, paddingBottom: 40, maxHeight: '85%' },
  modalTitle:     { fontFamily: 'Nunito-Bold', fontSize: 20, color: colors.dark, marginBottom: spacing.xs },
  modalSub:       { fontFamily: 'Nunito-Regular', fontSize: 13, color: colors.mid, marginBottom: spacing.md },
  inputLabel:     { ...typography.caption, marginBottom: spacing.xs },
  reasonRow:      { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 8 },
  radio:          { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  radioOn:        { borderColor: colors.sage },
  radioDot:       { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.sage },
  reasonTxt:      { fontFamily: 'Nunito-Regular', fontSize: 13, color: colors.dark, flex: 1 },
})
