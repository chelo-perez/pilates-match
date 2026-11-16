// Estudios de todas las redes: socio, plan, uso del mes y alta.
import React, { useMemo, useState } from 'react'
import { useCamaras } from '../../lib/platform'
import { one, PLAN_LABEL, shortDate, useAdminStudios, usedThisMonth } from '../../lib/admin'
import { AdminPage, CellTitle, DataTable, NetworkFilter, Pill, SearchBox, Segmented, Toolbar } from '../../components/admin/AdminUI'
import { Avatar, ErrorState, LoadingScreen } from '../../components/ui'

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
type F = 'todos' | 'socios' | 'no_socios' | 'sin_cuenta'

export default function AdminStudiosScreen({ navigation }: any) {
  const { data: rows = [], isLoading, isError, refetch } = useAdminStudios()
  const { data: camaras = [] } = useCamaras()
  const [filter, setFilter] = useState<F>('todos')
  const [net, setNet] = useState<string | null>(null)
  const [q, setQ] = useState('')

  const inNet = rows.filter(r => !net || r.camara_id === net)
  const match = (r: any, k: F) => k === 'todos' || (k === 'socios' ? r.is_member : k === 'no_socios' ? !r.is_member : !r.user_id)
  const list = useMemo(() => inNet.filter(r => match(r, filter))
    .filter(r => !q || norm(`${r.name} ${r.neighborhood ?? ''} ${r.owner_email ?? ''}`).includes(norm(q))), [rows, net, filter, q])

  if (isLoading) return <LoadingScreen />
  if (isError) return <ErrorState message="No pudimos cargar los estudios." onRetry={refetch} />
  const netName = (id: string) => camaras.find(c => c.id === id)?.name ?? 'Sin red'

  return (
    <AdminPage title="Estudios" subtitle="Tocá un estudio para ver su ficha, su plan y su historial">
      <Toolbar>
        <Segmented value={filter} onChange={setFilter} items={[
          { key: 'todos', label: 'Todos', count: inNet.length },
          { key: 'socios', label: 'Socios', count: inNet.filter(r => match(r, 'socios')).length },
          { key: 'no_socios', label: 'No socios', count: inNet.filter(r => match(r, 'no_socios')).length },
          { key: 'sin_cuenta', label: 'Sin cuenta', count: inNet.filter(r => match(r, 'sin_cuenta')).length },
        ]} />
        <NetworkFilter networks={camaras} value={net} onChange={setNet} />
        <SearchBox value={q} onChange={setQ} placeholder="Nombre, barrio o email" />
      </Toolbar>
      <DataTable rows={list} keyOf={r => r.id} onRowPress={r => navigation.navigate('AdminStudioDetail', { studioId: r.id })}
        empty={q ? 'Ningún estudio coincide con la búsqueda.' : 'No hay estudios con este filtro.'}
        columns={[
          { key: 'n', label: 'Estudio', flex: 2.3, render: r => <CellTitle title={r.name} sub={r.owner_email ?? (r.user_id ? null : 'Sin cuenta en la app')} avatar={<Avatar name={r.name} source={r.logo_url} size={34} />} /> },
          { key: 'r', label: 'Red', flex: 1.5, render: r => netName(r.camara_id) },
          { key: 'b', label: 'Barrio', flex: 1, render: r => r.neighborhood ?? '—' },
          { key: 'p', label: 'Plan', width: 110, render: r => {
            const m = one<any>(r.membership)
            return <Pill label={m ? PLAN_LABEL[m.plan_type] ?? m.plan_type : 'Sin plan'} tone={m?.status === 'activa' ? (m.plan_type === 'freemium' ? 'neutral' : 'brand') : 'warn'} />
          } },
          { key: 'u', label: 'Avisos del mes', width: 120, align: 'right', render: r => {
            const m = one<any>(r.membership)
            return m ? `${usedThisMonth(m)}${m.matches_limit != null ? ` de ${m.matches_limit}` : ' (sin límite)'}` : '—'
          } },
          { key: 's', label: 'Socio', width: 100, align: 'right', render: r => <Pill label={r.is_member ? 'Socio' : 'No socio'} tone={r.is_member ? 'ok' : 'neutral'} /> },
          { key: 'a', label: 'Alta', width: 130, align: 'right', hideOnNarrow: true, render: r => shortDate(r.created_at) },
        ]} />
    </AdminPage>
  )
}
