// Verificación de instructores por la entidad de la red: certificados uno por uno y, con todo
// revisado, verificar, pedir corrección o rechazar. Lo usa el portal de la entidad en la compu
// (misma lógica y mismos motivos que la pantalla del celular, VerifyInstructorScreen).
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase, db } from './supabase'
import { instructorAPI } from './api'
import { errorText, UserError } from './errors'
import { useAuthStore } from '../store'

export const REJECT_CERT_REASONS = ['Certificado inválido o vencido', 'Institución no reconocida por la entidad', 'Imagen ilegible o incompleta',
  'El nombre no coincide con el del perfil', 'Las horas declaradas no coinciden', 'Otro']
export const FIX_REASONS = ['Falta documentación', 'Información inconsistente en el perfil', 'Certificados ilegibles o incompletos', 'Otro']
export const REJECT_REASONS = ['No cumple los requisitos mínimos de la entidad', 'Instructor inhabilitado', 'Decisión del directorio', 'Otro']

export type VerifyModal = 'reject_cert' | 'request_fix' | 'reject' | null

export function useVerification(instructorId: string | undefined, notify: (msg: string, type?: 'success' | 'error' | 'warning') => void) {
  const qc = useQueryClient()
  const user = useAuthStore(s => s.user)
  const [internalNote, setInternalNote] = useState('')
  const [modal, setModal] = useState<VerifyModal>(null)
  const [cert, setCert] = useState<any>(null)
  const [reason, setReason] = useState('')
  const [extra, setExtra] = useState('')

  const q = useQuery({
    queryKey: ['instructor-detail', instructorId],
    queryFn: async () => {
      const { data, error } = await db.instructors()
        .select('*, certifications(id, name, institution, year, hours, document_url, review_status, review_note, reviewed_at), specialties:instructor_specialties(*), zones:instructor_zones(*), availability(*), rates:instructor_rates(*)')
        .eq('id', instructorId!).single()
      if (error) throw error
      return data as any
    },
    enabled: !!instructorId,
  })
  const notes = useQuery({
    queryKey: ['instructor-detail', instructorId, 'notes'],
    queryFn: async () => {
      const { data, error } = await supabase.from('camara_instructor_notes')
        .select('id, note, type, created_at').eq('instructor_id', instructorId!).order('created_at', { ascending: false }).limit(10)
      if (error) throw error
      return data ?? []
    },
    enabled: !!instructorId,
  })

  const refresh = () => ['instructor-detail', 'camara-instructors', 'camara-stats', 'camara-reports', 'pending-instructors', 'instructor', 'admin-instructors']
    .forEach(k => qc.invalidateQueries({ queryKey: [k] }))
  const reasonText = () => `${reason}${extra.trim() ? ': ' + extra.trim() : ''}`
  const close = () => { setModal(null); setCert(null); setExtra('') }
  const open = (mode: Exclude<VerifyModal, null>, c?: any) => {
    setCert(c ?? null); setExtra('')
    setReason((mode === 'reject_cert' ? REJECT_CERT_REASONS : mode === 'request_fix' ? FIX_REASONS : REJECT_REASONS)[0])
    setModal(mode)
  }

  const saveNote = async (note: string, type: string, rejectReason?: string) => {
    const { error } = await supabase.from('camara_instructor_notes').insert({
      instructor_id: instructorId, camara_id: user?.camara_id ?? null, note, type, reject_reason: rejectReason ?? null, created_by: user?.id,
    })
    if (error) notify('La acción se guardó, pero no pudimos guardar la nota interna.', 'warning')
  }
  const updateCert = async (id: string, fields: Record<string, any>) => {
    const { data, error } = await supabase.from('certifications').update(fields).eq('id', id).select('id')
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
        review_status: status, review_note: status === 'rejected' ? reasonText() : null,
        reviewed_by: status === 'pending' ? null : user?.id, reviewed_at: status === 'pending' ? null : now,
        verified: status === 'approved', verified_at: status === 'approved' ? now : null,
      })
    },
    onSuccess: (_d, v) => { refresh(); close(); notify(v.status === 'approved' ? 'Certificado aprobado' : v.status === 'rejected' ? 'Certificado rechazado' : 'Certificado vuelto a revisión') },
    onError: (e: any) => notify(errorText(e), 'error'),
  })
  const verifyMutation = useMutation({
    mutationFn: async () => {
      await instructorAPI.verify(instructorId!, true, null)
      if (internalNote.trim()) await saveNote(internalNote.trim(), 'verificacion')
    },
    onSuccess: () => { refresh(); setInternalNote(''); notify('Instructor verificado') },
    onError: (e: any) => notify(errorText(e), 'error'),
  })
  const statusMutation = useMutation({
    mutationFn: async (mode: 'request_fix' | 'reject') => {
      const msg = reasonText()
      await updateInstructor({ verification_status: mode === 'reject' ? 'rechazado' : 'pendiente', verification_note: msg, verified_at: null, verified_by: null })
      await saveNote(internalNote.trim() ? `${msg} — Nota interna: ${internalNote.trim()}` : msg, mode === 'reject' ? 'rechazo' : 'correccion', reason)
    },
    onSuccess: (_d, mode) => { refresh(); close(); setInternalNote(''); notify(mode === 'reject' ? 'Instructor marcado como rechazado' : 'Pedido de corrección enviado') },
    onError: (e: any) => notify(errorText(e), 'error'),
  })
  const activeMutation = useMutation({
    mutationFn: (active: boolean) => updateInstructor({ is_active: active }),
    onSuccess: (_d, active) => { refresh(); notify(active ? 'Instructor reactivado' : 'Instructor pausado') },
    onError: (e: any) => notify(errorText(e), 'error'),
  })
  const noteMutation = useMutation({
    mutationFn: async () => { if (internalNote.trim()) await saveNote(internalNote.trim(), 'nota') },
    onSuccess: () => { refresh(); setInternalNote(''); notify('Nota guardada') },
  })

  const confirm = () => {
    if (modal === 'reject_cert' && cert) certMutation.mutate({ certId: cert.id, status: 'rejected' })
    else if (modal === 'request_fix' || modal === 'reject') statusMutation.mutate(modal)
  }

  const ins = q.data
  const certs: any[] = ins?.certifications ?? []
  const pending = certs.filter(c => (c.review_status ?? 'pending') === 'pending').length
  const approved = certs.filter(c => c.review_status === 'approved').length
  const canVerify = certs.length > 0 && pending === 0 && approved > 0
  const verifyHint = certs.length === 0 ? 'Todavía no cargó certificados. Podés pedirle que los suba.'
    : pending > 0 ? (pending > 1 ? `Revisá los ${pending} certificados pendientes antes de verificar.` : 'Revisá el certificado pendiente antes de verificar.')
    : approved === 0 ? 'Para verificar tiene que haber al menos un certificado aprobado.' : null

  return {
    q, notes: notes.data ?? [], internalNote, setInternalNote, modal, open, close, cert, reason, setReason, extra, setExtra, confirm,
    reasons: modal === 'reject_cert' ? REJECT_CERT_REASONS : modal === 'request_fix' ? FIX_REASONS : REJECT_REASONS,
    certMutation, verifyMutation, statusMutation, activeMutation, noteMutation, canVerify, verifyHint, pending, approved,
    busy: certMutation.isPending || statusMutation.isPending || verifyMutation.isPending,
  }
}

export async function openCertificate(path: string, onError: (m: string) => void) {
  const { Linking } = require('react-native')
  if (/^https?:\/\//.test(path)) { Linking.openURL(path); return }
  const { data, error } = await supabase.storage.from('certifications').createSignedUrl(path, 600)
  if (error || !data?.signedUrl) { onError('No se pudo abrir el archivo.'); return }
  Linking.openURL(data.signedUrl)
}
