// Ficha de un instructor para la plataforma: solo lectura. La verificación la hace la entidad de su red.
import React from 'react'
import { View, Text, StyleSheet, Linking, Platform, Alert } from 'react-native'
import { supabase } from '../../lib/supabase'
import { useInstructor } from '../../hooks'
import { useCamaras } from '../../lib/platform'
import { formatARS } from '../../lib/payments'
import { reliabilityWarning, useReliability } from '../../lib/matchFlow'
import { matchState, one, shortDate, useAdminMatches, VERIF } from '../../lib/admin'
import { SPECIALTY_LABELS, DAY_LABELS } from '../../constants/labels'
import { AdminPage, Card, CellTitle, Columns, DataTable, Field, Kpi, KpiGrid, Notice, Pill } from '../../components/admin/AdminUI'
import { Avatar, ErrorState, LoadingScreen, colors } from '../../components/ui'

const CERT: Record<string, { label: string; tone: 'ok' | 'warn' | 'red' }> = {
  approved: { label: 'Aprobado', tone: 'ok' }, pending: { label: 'Pendiente', tone: 'warn' }, rejected: { label: 'Rechazado', tone: 'red' },
}
const notify = (msg: string) => Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Archivo', msg)

export default function AdminInstructorDetailScreen({ navigation, route }: any) {
  const id: string | undefined = route?.params?.instructorId
  const { data: ins, isLoading, isError, refetch } = useInstructor(id)
  const { data: camaras = [] } = useCamaras()
  const { data: matches = [] } = useAdminMatches()
  const { data: rel } = useReliability({ instructorId: id })

  if (isLoading) return <LoadingScreen />
  if (isError || !ins) return <ErrorState message="No encontramos el instructor." onRetry={refetch} />
  const net = camaras.find(c => c.id === ins.camara_id)
  const entity = net ? `${(net as any).entity_article === 'el' ? 'el' : 'la'} ${(net as any).entity_type ?? 'Cámara'}` : 'la entidad de su red'
  const v = VERIF[ins.verification_status] ?? { label: ins.verification_status, tone: 'neutral' as const }
  const mine = matches.filter(m => one<any>(m.instructor)?.id === ins.id)
  const st: any = ins.stats
  const rates: any = ins.rates
  const warn = reliabilityWarning(rel)
  const viewFile = async (path: string) => {
    if (/^https?:\/\//.test(path)) { Linking.openURL(path); return }
    const { data, error } = await supabase.storage.from('certifications').createSignedUrl(path, 600)
    if (error || !data?.signedUrl) { notify('No se pudo abrir el archivo.'); return }
    Linking.openURL(data.signedUrl)
  }
  const days = (ins.availability ?? []).filter((a: any) => a.is_active !== false)

  return (
    <AdminPage title={ins.full_name} subtitle={`${net?.name ?? 'Sin red'} · ${ins.neighborhood ?? 'Sin barrio'}`}
      onBack={() => navigation.goBack()} backLabel="Instructores"
      actions={<><Pill label={v.label} tone={v.tone} />{ins.is_active === false ? <Pill label="Inactivo" tone="neutral" /> : null}</>}>
      <Notice icon="shield">
        La verificación de instructores y certificados la hace {entity}. Desde la plataforma ves el estado, pero no aprobás ni rechazás.
      </Notice>

      <KpiGrid>
        <Kpi label="Puntaje de los estudios" value={st?.total_evaluations ? Number(st.avg_score).toFixed(1) : '—'} icon="star" hint={`${st?.total_evaluations ?? 0} evaluaciones`} />
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
          <Field label="DNI" value={(ins as any).dni} />
          <Field label="Red" value={net?.name} />
          <Field label="Se registró" value={shortDate(ins.created_at)} />
          <Field label="Verificado" value={(ins as any).verified_at ? shortDate((ins as any).verified_at) : 'Todavía no'} />
          {(ins as any).verification_note ? <Field label="Nota de la entidad" value={(ins as any).verification_note} /> : null}
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

      <Card title="Certificados" subtitle="Los revisa la entidad de su red" pad={false}>
        <View style={{ padding: 12, paddingTop: 0 }}>
          <DataTable rows={ins.certifications ?? []} keyOf={(c: any) => c.id} empty="No cargó certificados."
            columns={[
              { key: 'n', label: 'Certificado', flex: 2.2, render: (c: any) => <CellTitle title={c.name} sub={[c.institution, c.year].filter(Boolean).join(' · ')} /> },
              { key: 'f', label: 'Archivo', width: 140, render: (c: any) => c.document_url
                ? <Text style={s.link} onPress={() => viewFile(c.document_url)}>Ver archivo</Text> : <Text style={s.muted}>Sin archivo</Text> },
              { key: 'e', label: 'Estado', width: 130, align: 'right', render: (c: any) => {
                const x = CERT[c.review_status ?? 'pending'] ?? CERT.pending
                return <Pill label={x.label} tone={x.tone} />
              } },
            ]} />
        </View>
      </Card>

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
    </AdminPage>
  )
}

const s = StyleSheet.create({
  bio:   { flex: 1, fontFamily: 'Nunito-Regular', fontSize: 13, color: colors.mid, lineHeight: 19 },
  chips: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  small: { fontFamily: 'Nunito-Regular', fontSize: 13, color: colors.dark },
  muted: { fontFamily: 'Nunito-Regular', fontSize: 13, color: colors.light },
  link:  { fontFamily: 'Nunito-Bold', fontSize: 13, color: colors.sage, textDecorationLine: 'underline' },
})
