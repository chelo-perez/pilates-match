// Resumen del portal de la entidad (camara_admin): su red, lo que tiene para hacer y la actividad reciente.
import React, { useMemo } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store'
import { INVOICE_STATUS, useBillingPreview, useCamara, useInvoices } from '../../lib/platform'
import { formatARS } from '../../lib/payments'
import { matchState, monthStartIso, one, shortDate, useAdminInstructors, useAdminMatches, useAdminStudios } from '../../lib/admin'
import { useSponsorOffers } from '../../lib/sponsors'
import { AdminPage, Card, Columns, Kpi, KpiGrid, Pill, TodoRow } from '../../components/admin/AdminUI'
import { Avatar, LoadingScreen, colors } from '../../components/ui'

export default function EntityHomeScreen({ navigation }: any) {
  const camaraId = useAuthStore(s => s.user?.camara_id) as string | undefined
  const { data: camara, isLoading } = useCamara(camaraId)
  const { data: studios = [] } = useAdminStudios()
  const { data: instructors = [] } = useAdminInstructors()
  const { data: matches = [] } = useAdminMatches()
  const { data: invoices = [] } = useInvoices()
  const { data: sponsorOffers = [] } = useSponsorOffers()
  const perMember = (camara as any)?.billing_model === 'per_member'
  const { data: preview } = useBillingPreview(camaraId, perMember)
  // Certificados esperando revisión (de instructores todavía sin verificar)
  const { data: certsPending = [] } = useQuery({
    queryKey: ['camara-instructors', 'certs-pending'],
    queryFn: async () => {
      const { data } = await supabase.from('certifications').select('id, instructor_id, instructor:instructors!inner(camara_id)')
        .eq('review_status', 'pending')
      return data ?? []
    },
  })

  const m = useMemo(() => {
    const since = monthStartIso()
    const month = matches.filter(x => x.created_at >= since)
    const toVerify = instructors.filter(i => i.verification_status === 'pendiente')
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
    return {
      verified: instructors.filter(i => i.verification_status === 'verificado').length,
      toVerify,
      members: studios.filter(s => s.is_member).length,
      monthProposals: month.length,
      covered: matches.filter(x => x.status === 'aceptado' && (x.responded_at ?? x.created_at) >= since).length,
      lateCancels: matches.filter(x => x.late_cancel && x.created_at >= since).length,
    }
  }, [studios, instructors, matches])

  if (isLoading) return <LoadingScreen />
  const certFor = (id: string) => certsPending.filter((c: any) => c.instructor_id === id).length
  const unpaid = invoices.filter(i => i.status === 'enviada')
  const goIns = (id: string) => navigation.navigate('AdminInstructorDetail', { instructorId: id })
  const todos = [
    ...m.toVerify.slice(0, 8).map(i => {
      const days = Math.floor((Date.now() - new Date(i.created_at).getTime()) / 864e5)
      const c = certFor(i.id)
      return { key: 'v' + i.id, icon: 'user-check', tone: (days > 3 ? 'red' : 'warn') as any,
        title: `Verificar a ${i.full_name}`,
        sub: `${c ? `${c} certificado${c === 1 ? '' : 's'} por revisar · ` : 'Sin certificados por revisar · '}espera hace ${days === 0 ? 'menos de un día' : days === 1 ? '1 día' : `${days} días`}`,
        cta: 'Revisar', onPress: () => goIns(i.id) }
    }),
    ...(m.toVerify.length > 8 ? [{ key: 'more', icon: 'users', tone: 'info' as const, title: `Y ${m.toVerify.length - 8} más esperando verificación`, cta: 'Ver todos',
      onPress: () => navigation.navigate('AdminInstructores', { filter: 'pendiente' }) }] : []),
    ...sponsorOffers.filter(o => o.networks?.some(n => n.camara_id === camaraId && n.status === 'pendiente')).map(o => ({
      key: 's' + o.id, icon: 'gift', tone: 'info' as const, title: `Aprobar ${o.kind === 'formacion' ? 'la formación' : 'el beneficio'} de ${o.sponsor_name}`,
      sub: o.title, cta: 'Revisar', onPress: () => navigation.navigate('AdminSponsorEdit', { offerId: o.id }) })),
    ...unpaid.map(i => ({ key: 'f' + i.id, icon: 'file-text', tone: 'info' as const, title: `Factura de la plataforma por ${formatARS(Number(i.amount_ars))}`,
      sub: `${shortDate(i.period)} · ${INVOICE_STATUS[i.status]?.label ?? i.status}`, cta: 'Ver', onPress: () => navigation.navigate('EntityReportes') })),
  ]

  return (
    <AdminPage title={camara?.name ?? 'Resumen'} subtitle={new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}>
      <KpiGrid>
        <Kpi label="Instructores verificados" value={m.verified} icon="user-check" onPress={() => navigation.navigate('AdminInstructores', { filter: 'verificado' })}
          hint={`${instructors.length} registrados`} />
        <Kpi label="Por verificar" value={m.toVerify.length} icon="clock" tone={m.toVerify.length ? 'warn' : 'neutral'}
          hint={certsPending.length ? `${certsPending.length} certificado${certsPending.length === 1 ? '' : 's'} por revisar` : 'Nadie esperando'}
          onPress={() => navigation.navigate('AdminInstructores', { filter: 'pendiente' })} />
        <Kpi label="Estudios" value={studios.length} icon="home" hint={`${m.members} socios`} onPress={() => navigation.navigate('AdminEstudios')} />
        <Kpi label="Propuestas este mes" value={m.monthProposals} icon="send" hint={`${m.covered} clases cubiertas`} onPress={() => navigation.navigate('AdminActividad')} />
        <Kpi label="Cancelaciones tardías" value={m.lateCancels} icon="alert-triangle" tone={m.lateCancels ? 'red' : 'neutral'} hint="Este mes"
          onPress={() => navigation.navigate('AdminActividad', { filter: 'cancelada' })} />
        {perMember && preview ? (
          <Kpi label="Estimado del mes" value={formatARS(Number(preview.amount_ars ?? 0))} icon="dollar-sign"
            hint={`${preview.members} sede${preview.members === 1 ? '' : 's'} socia${preview.members === 1 ? '' : 's'} con cuenta`}
            onPress={() => navigation.navigate('EntityReportes')} />
        ) : null}
      </KpiGrid>

      <Columns min={380}>
        <Card title="Para hacer" subtitle={todos.length ? `${todos.length} pendiente${todos.length === 1 ? '' : 's'}` : 'Verificaciones y facturas'}>
          {todos.length ? todos.map(({ key, ...t }) => <TodoRow key={key} {...t} />) : (
            <View style={s.allDone}><Text style={s.allDoneTitle}>Todo al día</Text><Text style={s.allDoneTxt}>No hay instructores esperando verificación ni facturas por pagar.</Text></View>
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
          {!matches.length ? <Text style={s.actSub}>Todavía no hay propuestas en la red.</Text> : null}
        </Card>
      </Columns>
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
