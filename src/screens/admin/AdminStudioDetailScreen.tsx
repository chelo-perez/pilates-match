// Ficha de un estudio para la plataforma: solo lectura. El plan y la condición de socio los maneja la entidad de su red.
import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useCamaras } from '../../lib/platform'
import { formatARS } from '../../lib/payments'
import { reliabilityWarning, useReliability, PLACEMENT_STATUS } from '../../lib/matchFlow'
import { matchState, one, PLAN_LABEL, shortDate, useAdminMatches, usedThisMonth } from '../../lib/admin'
import { SPECIALTY_LABELS } from '../../constants/labels'
import { AdminPage, Card, CellTitle, Columns, DataTable, Field, Kpi, KpiGrid, Notice, Pill } from '../../components/admin/AdminUI'
import { Avatar, ErrorState, LoadingScreen, colors } from '../../components/ui'

export default function AdminStudioDetailScreen({ navigation, route }: any) {
  const id: string | undefined = route?.params?.studioId
  const { data: st, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-studio', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('studios').select('*, user:users(email), membership:memberships(*)').eq('id', id!).maybeSingle()
      if (error) throw error
      return data as any
    },
    enabled: !!id,
  })
  const { data: pay } = useQuery({
    queryKey: ['admin-studio-pay', id],
    queryFn: async () => {
      const { data } = await supabase.from('studio_evaluations').select('paid_as_agreed').eq('studio_id', id!).not('paid_as_agreed', 'is', null)
      const rows = data ?? []
      return { total: rows.length, ok: rows.filter((r: any) => r.paid_as_agreed).length }
    },
    enabled: !!id,
  })
  const { data: camaras = [] } = useCamaras()
  const { data: matches = [] } = useAdminMatches()
  const { data: rel } = useReliability({ studioId: id })

  if (isLoading) return <LoadingScreen />
  if (isError || !st) return <ErrorState message="No encontramos el estudio." onRetry={refetch} />
  const net = camaras.find(c => c.id === st.camara_id)
  const m = one<any>(st.membership)
  const mine = matches.filter(x => one<any>(x.studio)?.id === st.id)
  const warn = reliabilityWarning(rel)
  const entity = net ? `${(net as any).entity_article === 'el' ? 'el' : 'la'} ${(net as any).entity_type ?? 'Cámara'}` : 'la entidad de su red'

  return (
    <AdminPage title={st.name} subtitle={`${net?.name ?? 'Sin red'} · ${st.neighborhood ?? 'Sin barrio'}`}
      onBack={() => navigation.goBack()} backLabel="Volver"
      actions={<><Pill label={st.is_member ? 'Socio' : 'No socio'} tone={st.is_member ? 'ok' : 'neutral'} />{!st.user_id ? <Pill label="Sin cuenta" tone="warn" /> : null}</>}>
      <Notice icon="info">El plan y la condición de socio los maneja {entity}. Desde la plataforma ves el detalle.</Notice>

      <KpiGrid>
        <Kpi label="Plan" value={m ? PLAN_LABEL[m.plan_type] ?? m.plan_type : 'Sin plan'} icon="award" hint={m ? (m.status === 'activa' ? `Vence ${shortDate(m.end_date)}` : `Plan ${m.status}`) : undefined} tone={m?.status === 'activa' ? 'brand' : 'warn'} />
        <Kpi label="Avisos del mes" value={m ? `${usedThisMonth(m)}${m.matches_limit != null ? ` / ${m.matches_limit}` : ''}` : '—'} icon="send" hint={m?.matches_limit == null ? 'Sin límite' : 'Cubiertos este mes'} />
        <Kpi label="Pagó lo acordado" value={pay?.total ? `${pay.ok} / ${pay.total}` : '—'} icon="check-circle" tone={pay && pay.total && pay.ok < pay.total ? 'red' : 'ok'} hint="Según los instructores" />
        <Kpi label="Confiabilidad" value={warn ? 'Con alertas' : 'Sin alertas'} icon="shield" tone={warn ? 'red' : 'ok'} hint={warn ?? 'Sin cancelaciones tardías'} />
      </KpiGrid>

      <Columns min={420}>
        <Card title="Perfil">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <Avatar name={st.name} source={st.logo_url} size={56} />
            <Text style={s.bio}>{st.bio || st.description || 'Sin descripción.'}</Text>
          </View>
          <Field label="Email" value={one<any>(st.user)?.email ?? st.owner_email} />
          <Field label="Responsable" value={st.owner_name} />
          <Field label="Teléfono" value={st.phone} />
          <Field label="Dirección" value={st.address} />
          <Field label="Instagram" value={st.instagram} />
          <Field label="CUIT" value={st.cuit} />
          <Field label="Se registró" value={shortDate(st.created_at)} />
          <Field label="Socio desde" value={st.member_since ? shortDate(st.member_since) : st.is_member ? '—' : 'No es socio'} />
        </Card>
        <Card title="Clases que necesita">
          <Field label="Equipamiento">
            <View style={s.chips}>{(st.equipment ?? []).length ? (st.equipment as string[]).map(e => <Pill key={e} label={SPECIALTY_LABELS[e] ?? e} tone="brand" />) : <Text style={s.muted}>—</Text>}</View>
          </Field>
          <Field label="Presupuesto regular" value={st.budget_regular ? `${formatARS(st.budget_regular)} / clase` : 'Sin cargar'} />
          <Field label="Presupuesto reemplazo" value={st.budget_replacement ? `${formatARS(st.budget_replacement)} / clase` : 'Sin cargar'} />
          <Field label="Créditos de incorporación" value={String(st.placement_credits ?? 0)} />
        </Card>
      </Columns>

      <Card title="Propuestas" pad={false}>
        <View style={{ padding: 12, paddingTop: 0 }}>
          <DataTable rows={mine} keyOf={x => x.id} empty="Todavía no envió propuestas."
            onRowPress={x => one<any>(x.instructor)?.id && navigation.navigate('AdminInstructorDetail', { instructorId: one<any>(x.instructor).id })}
            columns={[
              { key: 'c', label: 'Clase', width: 160, render: x => <CellTitle title={shortDate(x.class_date)} sub={x.class_type === 'regular' ? 'Entrevista regular' : 'Reemplazo'} /> },
              { key: 'i', label: 'Instructor', flex: 2, render: x => <CellTitle title={one<any>(x.instructor)?.full_name ?? '—'} avatar={<Avatar name={one<any>(x.instructor)?.full_name ?? '?'} source={one<any>(x.instructor)?.avatar_url} size={28} />} /> },
              { key: 'm', label: 'Monto', width: 130, align: 'right', render: x => `${formatARS(Number(x.agreed_rate ?? x.offered_rate ?? 0))} / clase` },
              { key: 'e', label: 'Estado', flex: 1.5, align: 'right', render: x => {
                const y = matchState(x)
                return (
                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    <Pill label={y.label} tone={y.tone} />
                    {x.placement_status && x.placement_status !== 'sin_cargo' ? <Pill label={`Cargo: ${PLACEMENT_STATUS[x.placement_status] ?? x.placement_status}`} tone="neutral" /> : null}
                  </View>
                )
              } },
            ]} />
        </View>
      </Card>
    </AdminPage>
  )
}

const s = StyleSheet.create({
  bio:   { flex: 1, fontFamily: 'Nunito-Regular', fontSize: 13, color: colors.mid, lineHeight: 19 },
  chips: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  muted: { fontFamily: 'Nunito-Regular', fontSize: 13, color: colors.light },
})
