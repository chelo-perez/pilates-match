// Patrocinios en el panel.
// - Plataforma: todos los avisos, en qué redes se publican, cuánto pagan y cómo les va.
// - Entidad: los avisos que la plataforma le propone para aprobar, los que cargó ella y sus resultados.
import React, { useMemo, useState } from 'react'
import { View, Text, StyleSheet, Image, Platform, Alert } from 'react-native'
import { useAuthStore } from '../../store'
import { formatARS } from '../../lib/payments'
import { errorText } from '../../lib/errors'
import { shortDate, useIsEntity } from '../../lib/admin'
import { AUDIENCE_LABEL, KIND_LABEL, STATUS_LABEL, SponsorOffer, statsFor, useDecideOffer, useSponsorOffers, useSponsorStats } from '../../lib/sponsors'
import { ActionButton, AdminPage, Card, CellTitle, DataTable, Kpi, KpiGrid, Notice, Pill, Segmented, Toolbar } from '../../components/admin/AdminUI'
import { LoadingScreen, ErrorState, colors } from '../../components/ui'

const say = (msg: string) => Platform.OS === 'web' ? window.alert(msg) : Alert.alert('', msg)

export function SponsorLogo({ o, size = 32 }: { o: Pick<SponsorOffer, 'logo_url' | 'sponsor_name'>; size?: number }) {
  return o.logo_url
    ? <Image source={{ uri: o.logo_url }} style={{ width: size, height: size, borderRadius: size / 4, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.borderLight }} />
    : <View style={{ width: size, height: size, borderRadius: size / 4, backgroundColor: colors.sageLight, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontFamily: 'Nunito-Bold', fontSize: size * 0.42, color: colors.sage }}>{o.sponsor_name?.[0]?.toUpperCase() ?? '?'}</Text>
      </View>
}

const vigente = (o: SponsorOffer) => {
  const today = new Date().toISOString().slice(0, 10)
  return o.is_active !== false && (!o.starts_on || o.starts_on <= today) && (!o.ends_on || o.ends_on >= today)
}

export default function AdminSponsorsScreen({ navigation }: any) {
  const isEntity = useIsEntity()
  const camaraId = useAuthStore(s => s.user?.camara_id) as string | undefined
  const { data: offers = [], isLoading, isError, refetch } = useSponsorOffers()
  const { data: stats = [] } = useSponsorStats(30)
  const decide = useDecideOffer()
  const [filter, setFilter] = useState<'todos' | 'beneficio' | 'formacion'>('todos')

  const mine = (o: SponsorOffer) => o.networks?.find(n => n.camara_id === camaraId)
  const pending = useMemo(() => isEntity ? offers.filter(o => mine(o)?.status === 'pendiente') : [], [offers, isEntity, camaraId])
  const list = offers.filter(o => filter === 'todos' || o.kind === filter)

  const k = useMemo(() => {
    const live = offers.filter(vigente)
    const approvedNets = live.flatMap(o => (o.networks ?? []).filter(n => n.status === 'aprobado' && (!isEntity || n.camara_id === camaraId)))
    const gross = approvedNets.reduce((a, n) => a + Number(n.monthly_fee_ars ?? 0), 0)
    const entityShare = approvedNets.reduce((a, n) => a + Number(n.monthly_fee_ars ?? 0) * Number(n.entity_share_pct ?? 0) / 100, 0)
    const views = stats.filter(s => !isEntity || s.camara_id === camaraId).reduce((a, s) => a + s.vistas, 0)
    const clicks = stats.filter(s => !isEntity || s.camara_id === camaraId).reduce((a, s) => a + s.links + s.codigos + s.whatsapp, 0)
    return {
      published: live.filter(o => (o.networks ?? []).some(n => n.status === 'aprobado' && (!isEntity || n.camara_id === camaraId))).length,
      pendingAll: offers.flatMap(o => o.networks ?? []).filter(n => n.status === 'pendiente').length,
      gross, entityShare, views, clicks,
    }
  }, [offers, stats, isEntity, camaraId])

  const doDecide = (o: SponsorOffer, status: 'aprobado' | 'rechazado') => {
    let note: string | undefined
    if (status === 'rechazado' && Platform.OS === 'web') note = window.prompt('Motivo (opcional, lo ve la plataforma):') ?? undefined
    decide.mutate({ offerId: o.id, camaraId: camaraId!, status, note }, { onError: (e: any) => say(errorText(e)) })
  }

  if (isLoading) return <LoadingScreen />
  if (isError) return <ErrorState message="No pudimos cargar los patrocinios." onRetry={refetch} />

  return (
    <AdminPage title="Patrocinios"
      onBack={navigation.getState?.()?.type === 'stack' ? () => navigation.goBack() : undefined} backLabel="Inicio"
      subtitle={isEntity ? 'Beneficios y formaciones para los estudios e instructores de tu red' : 'Beneficios y formaciones publicados en las redes'}
      actions={<ActionButton label="Nuevo aviso" icon="plus" onPress={() => navigation.navigate('AdminSponsorEdit', {})} />}>

      <KpiGrid>
        <Kpi label="Publicados" value={k.published} icon="gift" hint={isEntity ? 'En tu red, vigentes' : 'Vigentes, en al menos una red'} />
        <Kpi label="Para aprobar" value={isEntity ? pending.length : k.pendingAll} icon="clock" tone={(isEntity ? pending.length : k.pendingAll) ? 'warn' : 'neutral'}
          hint={isEntity ? 'Te los propone la plataforma' : 'Esperando a la entidad de cada red'} />
        <Kpi label={isEntity ? 'Te corresponde por mes' : 'Ingreso mensual'} value={formatARS(isEntity ? k.entityShare : k.gross)} icon="dollar-sign"
          hint={isEntity ? `De ${formatARS(k.gross)} que pagan los patrocinadores` : `${formatARS(k.entityShare)} para las entidades`} />
        <Kpi label="Lo vieron" value={k.views} icon="eye" hint={`${k.clicks} abrieron el link, copiaron el código o escribieron · 30 días`} />
      </KpiGrid>

      {isEntity && pending.length ? (
        <Card title="Para aprobar" subtitle="Decidí si se publican en tu red. Solo se ven después de que los aprobás.">
          {pending.map(o => {
            const n = mine(o)!
            return (
              <View key={o.id} style={s.pendRow}>
                <SponsorLogo o={o} size={40} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={s.pendTitle} numberOfLines={1}>{o.title}</Text>
                  <Text style={s.pendSub} numberOfLines={1}>{o.sponsor_name} · {KIND_LABEL[o.kind]} · para {AUDIENCE_LABEL[o.audience].toLowerCase()}
                    {n.monthly_fee_ars ? ` · te corresponden ${formatARS(Number(n.monthly_fee_ars) * Number(n.entity_share_pct ?? 0) / 100)} por mes` : ''}</Text>
                </View>
                <ActionButton label="Ver" variant="secondary" onPress={() => navigation.navigate('AdminSponsorEdit', { offerId: o.id })} />
                <ActionButton label="Rechazar" variant="danger" onPress={() => doDecide(o, 'rechazado')} />
                <ActionButton label="Aprobar" icon="check" onPress={() => doDecide(o, 'aprobado')} loading={decide.isPending} />
              </View>
            )
          })}
        </Card>
      ) : null}

      {!offers.length ? (
        <Notice icon="gift">
          {isEntity
            ? 'Todavía no hay avisos. Podés cargar un beneficio o una formación que consiguió tu entidad, o esperar los que te proponga la plataforma.'
            : 'Todavía no hay avisos. Cargá el primero con "Nuevo aviso": elegís en qué redes se publica y cada entidad lo aprueba.'}
        </Notice>
      ) : (
        <Card title="Avisos" pad={false} action={
          <Segmented value={filter} onChange={setFilter} items={[
            { key: 'todos', label: 'Todos', count: offers.length },
            { key: 'beneficio', label: 'Beneficios', count: offers.filter(o => o.kind === 'beneficio').length },
            { key: 'formacion', label: 'Formaciones', count: offers.filter(o => o.kind === 'formacion').length },
          ]} />}>
          <View style={{ padding: 12, paddingTop: 0 }}>
            <DataTable rows={list} keyOf={o => o.id} empty="No hay avisos con este filtro."
              onRowPress={o => navigation.navigate('AdminSponsorEdit', { offerId: o.id })}
              columns={[
                { key: 'a', label: 'Aviso', flex: 2.6, render: o => <CellTitle title={o.title} sub={`${o.sponsor_name}${o.perk ? ' · ' + o.perk : ''}`} avatar={<SponsorLogo o={o} />} /> },
                { key: 't', label: 'Tipo', width: 120, render: o => <Pill label={KIND_LABEL[o.kind]} tone={o.kind === 'formacion' ? 'info' : 'brand'} /> },
                { key: 'p', label: 'Para', width: 130, render: o => AUDIENCE_LABEL[o.audience] },
                { key: 'r', label: isEntity ? 'Estado' : 'Redes', flex: 1.6, render: o => {
                  const nets = (o.networks ?? []).filter(n => !isEntity || n.camara_id === camaraId)
                  if (!vigente(o)) return <Pill label={o.is_active === false ? 'Pausado' : 'Fuera de fecha'} tone="neutral" />
                  return (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
                      {nets.length ? nets.map(n => { const st = STATUS_LABEL[n.status]; return <Pill key={n.camara_id} label={isEntity ? st.label : `${n.camara?.name ?? 'Red'}: ${st.label.toLowerCase()}`} tone={st.tone} /> })
                        : <Pill label="Sin redes" tone="neutral" />}
                    </View>
                  )
                } },
                { key: 'f', label: '$ / mes', width: 120, align: 'right', render: o => {
                  const nets = (o.networks ?? []).filter(n => !isEntity || n.camara_id === camaraId)
                  return formatARS(nets.reduce((a, n) => a + Number(n.monthly_fee_ars ?? 0), 0))
                } },
                { key: 'v', label: 'Vistas · clics', width: 120, align: 'right', render: o => { const x = statsFor(stats, o.id, isEntity ? camaraId : undefined); return `${x.vistas} · ${x.clicks}` } },
                { key: 'h', label: 'Hasta', width: 110, align: 'right', render: o => o.ends_on ? shortDate(o.ends_on) : 'Sin fecha' },
              ]} />
          </View>
        </Card>
      )}
    </AdminPage>
  )
}

const s = StyleSheet.create({
  pendRow:   { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.borderLight, flexWrap: 'wrap' },
  pendTitle: { fontFamily: 'Nunito-Bold', fontSize: 14, color: colors.dark },
  pendSub:   { fontFamily: 'Nunito-Regular', fontSize: 12, color: colors.mid, marginTop: 2 },
})
