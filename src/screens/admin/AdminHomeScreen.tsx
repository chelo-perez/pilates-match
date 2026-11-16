// Resumen de la plataforma: indicadores del mes, lo que hay que hacer, redes y actividad reciente.
import React, { useMemo } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useCamaras } from '../../lib/platform'
import { formatARS } from '../../lib/payments'
import { matchState, monthStartIso, one, shortDate, useAdminInstructors, useAdminMatches, useAdminPending, useAdminStudios } from '../../lib/admin'
import { AdminPage, Card, CellTitle, Columns, DataTable, Kpi, KpiGrid, Pill, TodoRow } from '../../components/admin/AdminUI'
import { Avatar, LoadingScreen, colors } from '../../components/ui'

export default function AdminHomeScreen({ navigation }: any) {
  const { data: camaras = [], isLoading } = useCamaras()
  const { data: studios = [] } = useAdminStudios()
  const { data: instructors = [] } = useAdminInstructors()
  const { data: matches = [] } = useAdminMatches()
  const { data: pending } = useAdminPending()

  const m = useMemo(() => {
    const since = monthStartIso()
    const month = matches.filter(x => x.created_at >= since)
    const covered = matches.filter(x => x.status === 'aceptado' && (x.responded_at ?? x.created_at) >= since)
    const placementsIncome = matches.filter(x => x.placement_status === 'cobrado' && (x.placement_paid_at ?? '') >= since)
      .reduce((a, x) => a + Number(x.placement_fee_ars ?? 0), 0)
    const byNet = (rows: any[], id: string) => rows.filter(r => r.camara_id === id).length
    return {
      activeNets: camaras.filter(c => c.is_active).length,
      members: studios.filter(s => s.is_member).length,
      verified: instructors.filter(i => i.verification_status === 'verificado').length,
      toVerify: instructors.filter(i => i.verification_status === 'pendiente'),
      monthProposals: month.length,
      covered: covered.length,
      placementsIncome,
      lateCancels: matches.filter(x => x.late_cancel && (x.created_at >= since)).length,
      nets: camaras.map(c => ({
        ...c, studios: byNet(studios, c.id), members: studios.filter(s => s.camara_id === c.id && s.is_member).length,
        instructors: instructors.filter(i => i.camara_id === c.id && i.verification_status === 'verificado').length,
        proposals: byNet(month, c.id),
      })),
    }
  }, [camaras, studios, instructors, matches])

  if (isLoading) return <LoadingScreen />
  const toInvoice = (pending?.invoices ?? []).filter(i => i.status === 'pendiente' && Number(i.amount_ars) > 0)
  const toCollect = (pending?.invoices ?? []).filter(i => i.status === 'enviada')
  const toPay = (pending?.settlements ?? []).filter(s => s.status === 'facturada')
  const refunds = pending?.refunds ?? []
  const goBilling = (tab?: string) => navigation.navigate('AdminCobros', tab ? { tab } : undefined)
  const todos = [
    ...m.toVerify.slice(0, 5).map(i => ({ key: 'v' + i.id, icon: 'user-check', tone: 'warn' as const, title: `Verificar a ${i.full_name}`,
      sub: `${camaras.find(c => c.id === i.camara_id)?.name ?? 'Sin red'} · se registró el ${shortDate(i.created_at)}`, cta: 'Revisar',
      onPress: () => navigation.navigate('VerifyInstructor', { instructorId: i.id }) })),
    ...(m.toVerify.length > 5 ? [{ key: 'vmore', icon: 'users', tone: 'warn' as const, title: `Y ${m.toVerify.length - 5} instructores más por verificar`, cta: 'Ver todos', onPress: () => navigation.navigate('AdminInstructores', { filter: 'pendiente' }) }] : []),
    ...refunds.map(r => ({ key: 'r' + r.id, icon: 'rotate-ccw', tone: 'red' as const, title: `Devolver ${formatARS(Number(r.placement_fee_ars))} a ${one<any>(r.studio)?.name ?? 'un estudio'}`,
      sub: 'Cargo de incorporación que corresponde devolver', cta: 'Devolver', onPress: () => goBilling('incorporacion') })),
    ...toInvoice.map(i => ({ key: 'i' + i.id, icon: 'file-text', tone: 'warn' as const, title: `Emitir la factura de ${one<any>(i.camara)?.name ?? 'una red'}`,
      sub: `${formatARS(Number(i.amount_ars))} · ${shortDate(i.period)}`, cta: 'Emitir', onPress: () => goBilling('socios') })),
    ...toCollect.map(i => ({ key: 'c' + i.id, icon: 'clock', tone: 'info' as const, title: `Cobrar la factura de ${one<any>(i.camara)?.name ?? 'una red'}`,
      sub: `${formatARS(Number(i.amount_ars))} · emitida`, cta: 'Ver', onPress: () => goBilling('socios') })),
    ...toPay.map(s => ({ key: 'p' + s.id, icon: 'send', tone: 'info' as const, title: `Pagar la liquidación de ${one<any>(s.camara)?.name ?? 'una red'}`,
      sub: `${formatARS(Number(s.share_ars))} · ya facturada`, cta: 'Pagar', onPress: () => goBilling('liquidaciones') })),
  ]

  return (
    <AdminPage title="Resumen" subtitle={new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}>
      <KpiGrid>
        <Kpi label="Redes activas" value={m.activeNets} icon="share-2" hint={`${camaras.length} en total`} onPress={() => navigation.navigate('AdminRedes')} />
        <Kpi label="Estudios" value={studios.length} icon="home" hint={`${m.members} socios`} onPress={() => navigation.navigate('AdminEstudios')} />
        <Kpi label="Instructores verificados" value={m.verified} icon="user-check"
          tone={m.toVerify.length ? 'warn' : 'brand'} hint={m.toVerify.length ? `${m.toVerify.length} por verificar` : 'Nadie esperando'}
          onPress={() => navigation.navigate('AdminInstructores', m.toVerify.length ? { filter: 'pendiente' } : undefined)} />
        <Kpi label="Propuestas este mes" value={m.monthProposals} icon="send" hint={`${m.covered} clases cubiertas`} onPress={() => navigation.navigate('AdminActividad')} />
        <Kpi label="Cargos de incorporación" value={formatARS(m.placementsIncome)} icon="dollar-sign" hint="Cobrados este mes" onPress={() => goBilling('incorporacion')} />
        <Kpi label="Cancelaciones tardías" value={m.lateCancels} icon="alert-triangle" tone={m.lateCancels ? 'red' : 'neutral'} hint="Este mes" onPress={() => navigation.navigate('AdminActividad', { filter: 'cancelada' })} />
      </KpiGrid>

      <Columns min={380}>
        <Card title="Para hacer" subtitle={todos.length ? `${todos.length} pendiente${todos.length === 1 ? '' : 's'}` : undefined}>
          {todos.length ? todos.map(({ key, ...t }) => <TodoRow key={key} {...t} />) : (
            <View style={s.allDone}><Text style={s.allDoneTitle}>Todo al día</Text><Text style={s.allDoneTxt}>No hay verificaciones, facturas ni devoluciones pendientes.</Text></View>
          )}
        </Card>
        <Card title="Actividad reciente" action={<Text style={s.link} onPress={() => navigation.navigate('AdminActividad')}>Ver todo</Text>}>
          {matches.slice(0, 7).map(x => {
            const st = matchState(x)
            return (
              <View key={x.id} style={s.act}>
                <Avatar name={one<any>(x.instructor)?.full_name ?? '?'} source={one<any>(x.instructor)?.avatar_url} size={30} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={s.actTitle} numberOfLines={1}>{one<any>(x.studio)?.name ?? 'Estudio'} → {one<any>(x.instructor)?.full_name ?? 'Instructor'}</Text>
                  <Text style={s.actSub} numberOfLines={1}>{x.class_type === 'regular' ? 'Regular' : 'Reemplazo'} · {shortDate(x.class_date)}</Text>
                </View>
                <Pill label={st.label} tone={st.tone} />
              </View>
            )
          })}
          {!matches.length ? <Text style={s.actSub}>Todavía no hay propuestas.</Text> : null}
        </Card>
      </Columns>

      <Card title="Redes" subtitle="Actividad de este mes" pad={false}
        action={<Text style={s.link} onPress={() => navigation.navigate('AdminRedes')}>Administrar</Text>}>
        <View style={{ padding: 12, paddingTop: 0 }}>
          <DataTable rows={m.nets} keyOf={r => r.id} onRowPress={r => navigation.navigate('PlatformCamaraEdit', { camaraId: r.id })}
            columns={[
              { key: 'n', label: 'Red', flex: 2.4, render: r => <CellTitle title={r.name} sub={`${r.entity_type ?? 'Cámara'} · ${r.business_label ?? r.sector}`} /> },
              { key: 'm', label: 'Cobro', flex: 1.2, render: r => <Pill label={r.billing_model === 'per_member' ? 'Por sede' : 'Suscripciones'} tone="brand" /> },
              { key: 's', label: 'Estudios', align: 'right', render: r => `${r.studios} (${r.members} socios)` },
              { key: 'i', label: 'Instructores', align: 'right', render: r => String(r.instructors) },
              { key: 'p', label: 'Propuestas', align: 'right', render: r => String(r.proposals) },
              { key: 'e', label: 'Estado', align: 'right', render: r => <Pill label={r.is_active ? 'Activa' : 'Inactiva'} tone={r.is_active ? 'ok' : 'neutral'} /> },
            ]} />
        </View>
      </Card>
    </AdminPage>
  )
}

const s = StyleSheet.create({
  link:        { fontFamily: 'Nunito-Bold', fontSize: 13, color: colors.sage },
  allDone:     { paddingVertical: 18, alignItems: 'center', gap: 4 },
  allDoneTitle:{ fontFamily: 'Nunito-Bold', fontSize: 15, color: colors.okTx },
  allDoneTxt:  { fontFamily: 'Nunito-Regular', fontSize: 13, color: colors.mid, textAlign: 'center' },
  act:         { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  actTitle:    { fontFamily: 'Nunito-Bold', fontSize: 13, color: colors.dark },
  actSub:      { fontFamily: 'Nunito-Regular', fontSize: 12, color: colors.mid },
})
