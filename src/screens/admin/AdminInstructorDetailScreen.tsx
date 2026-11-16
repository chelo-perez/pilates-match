// Ficha de un instructor en el panel.
// - Entidad de la red: revisa certificados y verifica, pide corrección, rechaza o pausa.
// - Plataforma: solo lectura (la verificación es de la entidad; la base también lo impide).
import React from 'react'
import { View, Text, StyleSheet, Platform, Alert, Modal, Pressable, TextInput } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { instructorAPI } from '../../lib/api'
import { useCamaras } from '../../lib/platform'
import { formatARS } from '../../lib/payments'
import { reliabilityWarning, useReliability } from '../../lib/matchFlow'
import { openCertificate, useVerification } from '../../lib/verification'
import { matchState, one, shortDate, useAdminMatches, useIsEntity, VERIF } from '../../lib/admin'
import { SPECIALTY_LABELS, DAY_LABELS } from '../../constants/labels'
import { ActionButton, AdminPage, Card, CellTitle, Columns, DataTable, Field, Kpi, KpiGrid, Notice, Pill } from '../../components/admin/AdminUI'
import { Avatar, ErrorState, LoadingScreen, colors, spacing } from '../../components/ui'

const CERT: Record<string, { label: string; tone: 'ok' | 'warn' | 'red' }> = {
  approved: { label: 'Aprobado', tone: 'ok' }, pending: { label: 'Pendiente', tone: 'warn' }, rejected: { label: 'Rechazado', tone: 'red' },
}
const say = (msg: string) => Platform.OS === 'web' ? window.alert(msg) : Alert.alert('', msg)

export default function AdminInstructorDetailScreen({ navigation, route }: any) {
  const id: string | undefined = route?.params?.instructorId
  const isEntity = useIsEntity()
  const v = useVerification(id, (msg, type) => { if (type === 'error' || type === 'warning') say(msg) })
  const { data: ins, isLoading, isError, refetch } = v.q
  const { data: stats } = useQuery({ queryKey: ['instructor-stats', id], queryFn: () => instructorAPI.getStats(id!), enabled: !!id })
  const { data: camaras = [] } = useCamaras()
  const { data: matches = [] } = useAdminMatches()
  const { data: rel } = useReliability({ instructorId: id })

  if (isLoading) return <LoadingScreen />
  if (isError || !ins) return <ErrorState message="No encontramos el instructor." onRetry={refetch} />
  const net = camaras.find(c => c.id === ins.camara_id)
  const entity = net ? `${(net as any).entity_article === 'el' ? 'el' : 'la'} ${(net as any).entity_type ?? 'Cámara'}` : 'la entidad de su red'
  const status = VERIF[ins.verification_status] ?? { label: ins.verification_status, tone: 'neutral' as const }
  const isVerified = ins.verification_status === 'verificado'
  const isActive = ins.is_active !== false
  const mine = matches.filter(m => one<any>(m.instructor)?.id === ins.id)
  const rates: any = Array.isArray(ins.rates) ? ins.rates[0] : ins.rates
  const warn = reliabilityWarning(rel)
  const days = (ins.availability ?? []).filter((a: any) => a.is_active !== false)
  const certs: any[] = ins.certifications ?? []
  const modalTitle = v.modal === 'reject_cert' ? 'Rechazar certificado' : v.modal === 'request_fix' ? 'Pedir corrección' : isVerified ? 'Revocar verificación' : 'Rechazar instructor'
  const modalSub = v.modal === 'reject_cert' ? `${v.cert?.name ?? ''}. Va a ver el motivo en su perfil y puede subir otro archivo.`
    : v.modal === 'request_fix' ? `${ins.full_name} queda pendiente y ve este mensaje en su perfil para corregir.`
    : `${ins.full_name} queda como rechazado y ve el motivo en su perfil.`

  return (
    <AdminPage title={ins.full_name} subtitle={[net?.name, ins.neighborhood, ins.dni ? `DNI ${ins.dni}` : null].filter(Boolean).join(' · ')}
      onBack={() => navigation.goBack()} backLabel="Instructores"
      actions={<>
        <Pill label={isVerified && !isActive ? 'Pausado' : status.label} tone={isVerified && !isActive ? 'warn' : status.tone} />
        {isEntity && isVerified ? <ActionButton label={isActive ? 'Pausar' : 'Reactivar'} icon={isActive ? 'pause' : 'play'} variant="secondary"
          onPress={() => v.activeMutation.mutate(!isActive)} loading={v.activeMutation.isPending} /> : null}
      </>}>
      {!isEntity ? (
        <Notice icon="shield">La verificación de instructores y certificados la hace {entity}. Desde la plataforma ves el estado, pero no aprobás ni rechazás.</Notice>
      ) : ins.verification_note && !isVerified ? (
        <Notice icon="message-circle" tone="warn">Último mensaje al instructor: "{ins.verification_note}"</Notice>
      ) : null}

      {/* Entidad: verificación */}
      {isEntity ? (
        <Card title={isVerified ? 'Verificado' : 'Verificación'} subtitle={isVerified ? `Desde el ${shortDate(ins.verified_at)}` : (v.verifyHint ?? 'Todo revisado: ya podés verificarlo.')}>
          <TextInput style={s.note} value={v.internalNote} onChangeText={v.setInternalNote} multiline
            placeholder="Nota interna (solo la ve la entidad). Ej: certificados confirmados por teléfono con la institución" placeholderTextColor={colors.light} />
          <View style={s.verifyRow}>
            {!isVerified ? <ActionButton label="Verificar instructor" icon="check" onPress={() => v.verifyMutation.mutate()} disabled={!v.canVerify} loading={v.verifyMutation.isPending} /> : null}
            {!isVerified ? <ActionButton label="Pedir corrección" icon="edit-2" variant="secondary" onPress={() => v.open('request_fix')} /> : null}
            <ActionButton label={isVerified ? 'Revocar verificación' : 'Rechazar'} icon="x" variant="danger" onPress={() => v.open('reject')} />
            {v.internalNote.trim() ? <ActionButton label="Guardar solo la nota" variant="secondary" onPress={() => v.noteMutation.mutate()} loading={v.noteMutation.isPending} /> : null}
          </View>
        </Card>
      ) : null}

      <Card title={`Certificados (${v.approved}/${certs.length} aprobados)`} subtitle={isEntity ? 'Abrí cada archivo y aprobalo o rechazalo' : 'Los revisa la entidad de su red'} pad={false}>
        <View style={{ padding: 12, paddingTop: 0 }}>
          <DataTable rows={certs} keyOf={(c: any) => c.id} empty="No cargó certificados."
            columns={[
              { key: 'n', label: 'Certificado', flex: 2.2, render: (c: any) => <CellTitle title={c.name} sub={[c.institution, c.year, c.hours ? `${c.hours} h` : null].filter(Boolean).join(' · ') + (c.review_note ? ` · "${c.review_note}"` : '')} /> },
              { key: 'f', label: 'Archivo', width: 110, render: (c: any) => c.document_url
                ? <Text style={s.link} onPress={() => openCertificate(c.document_url, say)}>Ver archivo</Text> : <Text style={s.muted}>Sin archivo</Text> },
              { key: 'e', label: 'Estado', width: 110, align: 'right', render: (c: any) => { const x = CERT[c.review_status ?? 'pending'] ?? CERT.pending; return <Pill label={x.label} tone={x.tone} /> } },
              ...(isEntity ? [{ key: 'a', label: '', width: 230, align: 'right' as const, render: (c: any) => (
                (c.review_status ?? 'pending') === 'pending' ? (
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    <ActionButton label="Rechazar" variant="danger" onPress={() => v.open('reject_cert', c)} />
                    <ActionButton label="Aprobar" icon="check" disabled={!c.document_url} onPress={() => v.certMutation.mutate({ certId: c.id, status: 'approved' })} />
                  </View>
                ) : <Text style={s.link} onPress={() => v.certMutation.mutate({ certId: c.id, status: 'pending' })}>Volver a revisar</Text>
              ) }] : []),
            ]} />
        </View>
      </Card>

      <KpiGrid>
        <Kpi label="Puntaje de los estudios" value={stats?.total_evaluations ? Number(stats.avg_score).toFixed(1) : '—'} icon="star" hint={`${stats?.total_evaluations ?? 0} evaluaciones`} />
        <Kpi label="Propuestas recibidas" value={mine.length} icon="inbox" hint={`${mine.filter(m => m.status === 'aceptado').length} aceptadas`} />
        <Kpi label="Confiabilidad" value={warn ? 'Con alertas' : 'Sin alertas'} icon="shield" tone={warn ? 'red' : 'ok'} hint={warn ?? 'Sin cancelaciones tardías ni ausencias'} />
      </KpiGrid>

      <Columns min={420}>
        <Card title="Perfil">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <Avatar name={ins.full_name} source={ins.avatar_url} size={56} />
            <Text style={s.bio}>{ins.bio || 'Sin descripción.'}</Text>
          </View>
          <Field label="Email" value={ins.email} />
          <Field label="Teléfono" value={ins.phone} />
          <Field label="DNI" value={ins.dni} />
          <Field label="Se registró" value={shortDate(ins.created_at)} />
        </Card>
        <Card title="Trabajo">
          <Field label="Tarifa regular" value={rates?.rate_regular ? formatARS(rates.rate_regular) : 'Sin cargar'} />
          <Field label="Tarifa reemplazo" value={rates?.rate_replacement ? formatARS(rates.rate_replacement) : 'Sin cargar'} />
          <Field label="Especialidades">
            <View style={s.chips}>{(ins.specialties ?? []).length ? (ins.specialties as any[]).map(x => <Pill key={x.id ?? x.specialty} label={SPECIALTY_LABELS[x.specialty] ?? x.specialty} tone="brand" />) : <Text style={s.muted}>—</Text>}</View>
          </Field>
          <Field label="Zonas">
            <View style={s.chips}>{(ins.zones ?? []).length ? (ins.zones as any[]).map(z => <Pill key={z.id ?? z.neighborhood} label={z.neighborhood} tone="neutral" />) : <Text style={s.muted}>—</Text>}</View>
          </Field>
          <Field label="Disponibilidad">
            <View style={{ flex: 1, gap: 2 }}>{days.length ? days.map((a: any) => (
              <Text key={a.id} style={s.small}>{DAY_LABELS[a.day_of_week] ?? a.day_of_week} · {String(a.start_time).slice(0, 5)}–{String(a.end_time).slice(0, 5)} · {a.class_type === 'regular' ? 'Regular' : 'Reemplazo'}</Text>
            )) : <Text style={s.muted}>Sin horarios cargados</Text>}</View>
          </Field>
        </Card>
      </Columns>

      {isEntity && v.notes.length ? (
        <Card title="Notas internas" subtitle="Solo las ve la entidad">
          {v.notes.map((n: any) => <Field key={n.id} label={shortDate(n.created_at)} value={n.note} />)}
        </Card>
      ) : null}

      <Card title="Propuestas" pad={false}>
        <View style={{ padding: 12, paddingTop: 0 }}>
          <DataTable rows={mine} keyOf={m => m.id} empty="Todavía no recibió propuestas."
            onRowPress={m => one<any>(m.studio)?.id && navigation.navigate('AdminStudioDetail', { studioId: one<any>(m.studio).id })}
            columns={[
              { key: 'c', label: 'Clase', width: 160, render: m => <CellTitle title={shortDate(m.class_date)} sub={m.class_type === 'regular' ? 'Entrevista regular' : 'Reemplazo'} /> },
              { key: 's', label: 'Estudio', flex: 2, render: m => one<any>(m.studio)?.name ?? '—' },
              { key: 'm', label: 'Monto', width: 130, align: 'right', render: m => `${formatARS(Number(m.agreed_rate ?? m.offered_rate ?? 0))} / clase` },
              { key: 'e', label: 'Estado', flex: 1.4, align: 'right', render: m => { const x = matchState(m); return <Pill label={x.label} tone={x.tone} /> } },
            ]} />
        </View>
      </Card>

      {/* Motivo: rechazar certificado, pedir corrección o rechazar */}
      <Modal visible={!!v.modal} transparent animationType="fade" onRequestClose={v.close}>
        <Pressable style={s.overlay} onPress={v.close}>
          <Pressable style={s.sheet} onPress={() => {}}>
            <Text style={s.sheetTitle}>{modalTitle}</Text>
            <Text style={s.sheetSub}>{modalSub}</Text>
            <View style={{ gap: 6, marginBottom: spacing.sm }}>
              {v.reasons.map(r => (
                <Pressable key={r} onPress={() => v.setReason(r)} style={[s.reason, v.reason === r && s.reasonOn]}>
                  <Text style={[s.reasonTxt, v.reason === r && { color: colors.white }]}>{r}</Text>
                </Pressable>
              ))}
            </View>
            <TextInput style={s.note} value={v.extra} onChangeText={v.setExtra} multiline placeholder="Mensaje para el instructor (opcional)" placeholderTextColor={colors.light} />
            <View style={{ flexDirection: 'row', gap: spacing.sm, justifyContent: 'flex-end' }}>
              <ActionButton label="Cancelar" variant="secondary" onPress={v.close} />
              <ActionButton label="Confirmar" variant={v.modal === 'request_fix' ? 'primary' : 'danger'} onPress={v.confirm} loading={v.busy} />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </AdminPage>
  )
}

const s = StyleSheet.create({
  bio:       { flex: 1, fontFamily: 'Nunito-Regular', fontSize: 13, color: colors.mid, lineHeight: 19 },
  chips:     { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  small:     { fontFamily: 'Nunito-Regular', fontSize: 13, color: colors.dark },
  muted:     { fontFamily: 'Nunito-Regular', fontSize: 13, color: colors.light },
  link:      { fontFamily: 'Nunito-Bold', fontSize: 13, color: colors.sage, textDecorationLine: 'underline' },
  note:      { minHeight: 64, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 10, fontFamily: 'Nunito-Regular', fontSize: 13, color: colors.dark, textAlignVertical: 'top', marginBottom: 12, outlineStyle: 'none' } as any,
  verifyRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  overlay:   { flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', alignItems: 'center', padding: spacing.lg },
  sheet:     { width: '100%', maxWidth: 480, backgroundColor: colors.white, borderRadius: 16, padding: spacing.lg },
  sheetTitle:{ fontFamily: 'Nunito-Bold', fontSize: 18, color: colors.dark },
  sheetSub:  { fontFamily: 'Nunito-Regular', fontSize: 13, color: colors.mid, marginTop: 4, marginBottom: spacing.md, lineHeight: 19 },
  reason:    { paddingVertical: 9, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: colors.border },
  reasonOn:  { backgroundColor: colors.sage, borderColor: colors.sage },
  reasonTxt: { fontFamily: 'Nunito-SemiBold', fontSize: 13, color: colors.dark },
})
