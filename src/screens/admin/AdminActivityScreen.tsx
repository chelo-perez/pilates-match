// Actividad: todas las propuestas de la plataforma y qué pasó con cada una.
import React, { useEffect, useMemo, useState } from 'react'
import { View } from 'react-native'
import { useCamaras } from '../../lib/platform'
import { formatARS } from '../../lib/payments'
import { PLACEMENT_STATUS } from '../../lib/matchFlow'
import { matchState, one, shortDate, useAdminMatches } from '../../lib/admin'
import { useIsEntity } from '../../lib/admin'
import { AdminPage, CellTitle, DataTable, NetworkFilter, Pill, SearchBox, Segmented, Toolbar } from '../../components/admin/AdminUI'
import { Avatar, ErrorState, LoadingScreen } from '../../components/ui'

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
type F = 'todas' | 'pendiente' | 'confirmada' | 'cancelada' | 'regular'
const hours = (m: any) => Math.max(1, Math.round((+new Date(`2000-01-01T${m.end_time}`) - +new Date(`2000-01-01T${m.start_time}`)) / 3600_000))

export default function AdminActivityScreen({ navigation, route }: any) {
  const isEntity = useIsEntity()
  const { data: rows = [], isLoading, isError, refetch } = useAdminMatches()
  const { data: camaras = [] } = useCamaras()
  const [filter, setFilter] = useState<F>(route?.params?.filter ?? 'todas')
  const [net, setNet] = useState<string | null>(null)
  const [q, setQ] = useState('')
  useEffect(() => { if (route?.params?.filter) setFilter(route.params.filter) }, [route?.params?.filter])

  const inNet = rows.filter(r => !net || r.camara_id === net)
  const is = (r: any, k: F) => k === 'todas' || (k === 'pendiente' ? r.status === 'pendiente'
    : k === 'confirmada' ? r.status === 'aceptado' : k === 'cancelada' ? r.status === 'cancelado' : r.class_type === 'regular')
  const list = useMemo(() => inNet.filter(r => is(r, filter))
    .filter(r => !q || norm(`${one<any>(r.studio)?.name ?? ''} ${one<any>(r.instructor)?.full_name ?? ''}`).includes(norm(q))), [rows, net, filter, q])

  if (isLoading) return <LoadingScreen />
  if (isError) return <ErrorState message="No pudimos cargar la actividad." onRetry={refetch} />

  return (
    <AdminPage title="Actividad" subtitle={isEntity ? "Propuestas, clases confirmadas y cancelaciones de tu red" : "Propuestas, clases confirmadas y cancelaciones de todas las redes"}>
      <Toolbar>
        <Segmented value={filter} onChange={setFilter} items={(['todas', 'pendiente', 'confirmada', 'cancelada', 'regular'] as F[]).map(k => ({
          key: k, label: { todas: 'Todas', pendiente: 'Pendientes', confirmada: 'Confirmadas', cancelada: 'Canceladas', regular: 'Regulares' }[k],
          count: inNet.filter(r => is(r, k)).length,
        }))} />
        {!isEntity ? <NetworkFilter networks={camaras} value={net} onChange={setNet} /> : null}
        <SearchBox value={q} onChange={setQ} placeholder="Estudio o instructor" />
      </Toolbar>
      <DataTable rows={list} keyOf={r => r.id} onRowPress={r => one<any>(r.studio)?.id && navigation.navigate('AdminStudioDetail', { studioId: one<any>(r.studio).id })}
        empty="No hay propuestas con este filtro."
        columns={[
          { key: 'c', label: 'Clase', width: 150, render: r => <CellTitle title={shortDate(r.class_date)} sub={`${r.class_type === 'regular' ? 'Entrevista regular' : 'Reemplazo'} · ${String(r.start_time).slice(0, 5)}`} /> },
          { key: 'p', label: 'Estudio → Instructor', flex: 2.4, render: r => (
            <CellTitle title={one<any>(r.studio)?.name ?? 'Estudio'} sub={`→ ${one<any>(r.instructor)?.full_name ?? 'Instructor'}`}
              avatar={<Avatar name={one<any>(r.instructor)?.full_name ?? '?'} source={one<any>(r.instructor)?.avatar_url} size={30} />} />
          ) },
          { key: 'm', label: 'Monto', width: 150, align: 'right', render: r => {
            const rate = Number(r.agreed_rate ?? r.offered_rate ?? 0)
            return <CellTitle title={`${formatARS(rate)} / clase`} sub={r.class_type === 'reemplazo' && hours(r) > 1 ? `Bloque ${formatARS(rate * hours(r))}` : null} />
          } },
          { key: 'e', label: 'Estado', flex: 1.3, align: 'right', render: r => {
            const st = matchState(r)
            return (
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                <Pill label={st.label} tone={st.tone} />
                {r.placement_status && r.placement_status !== 'sin_cargo'
                  ? <Pill label={`Cargo: ${PLACEMENT_STATUS[r.placement_status] ?? r.placement_status}`} tone="neutral" /> : null}
              </View>
            )
          } },
        ]} />
    </AdminPage>
  )
}
