// Instructores de todas las redes: verificación, red, barrio y alta.
import React, { useEffect, useMemo, useState } from 'react'
import { useCamaras } from '../../lib/platform'
import { shortDate, useAdminInstructors, VERIF } from '../../lib/admin'
import { AdminPage, CellTitle, DataTable, NetworkFilter, Pill, SearchBox, Segmented, Toolbar } from '../../components/admin/AdminUI'
import { Avatar, ErrorState, LoadingScreen } from '../../components/ui'

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
type F = 'todos' | 'pendiente' | 'verificado' | 'rechazado'

export default function AdminInstructorsScreen({ navigation, route }: any) {
  const { data: rows = [], isLoading, isError, refetch } = useAdminInstructors()
  const { data: camaras = [] } = useCamaras()
  const [filter, setFilter] = useState<F>(route?.params?.filter ?? 'todos')
  const [net, setNet] = useState<string | null>(null)
  const [q, setQ] = useState('')
  useEffect(() => { if (route?.params?.filter) setFilter(route.params.filter) }, [route?.params?.filter])

  const inNet = rows.filter(r => !net || r.camara_id === net)
  const count = (k: F) => k === 'todos' ? inNet.length : inNet.filter(r => r.verification_status === k).length
  const list = useMemo(() => inNet
    .filter(r => filter === 'todos' || r.verification_status === filter)
    .filter(r => !q || norm(`${r.full_name} ${r.email ?? ''} ${r.neighborhood ?? ''}`).includes(norm(q))), [rows, net, filter, q])

  if (isLoading) return <LoadingScreen />
  if (isError) return <ErrorState message="No pudimos cargar los instructores." onRetry={refetch} />
  const netName = (id: string) => camaras.find(c => c.id === id)?.name ?? 'Sin red'

  return (
    <AdminPage title="Instructores" subtitle="Estado de verificación de cada red: la verificación la hace la entidad">
      <Toolbar>
        <Segmented value={filter} onChange={setFilter} items={[
          { key: 'todos', label: 'Todos', count: count('todos') },
          { key: 'pendiente', label: 'Por verificar', count: count('pendiente') },
          { key: 'verificado', label: 'Verificados', count: count('verificado') },
          { key: 'rechazado', label: 'Rechazados', count: count('rechazado') },
        ]} />
        <NetworkFilter networks={camaras} value={net} onChange={setNet} />
        <SearchBox value={q} onChange={setQ} placeholder="Nombre, email o barrio" />
      </Toolbar>
      <DataTable rows={list} keyOf={r => r.id} onRowPress={r => navigation.navigate('AdminInstructorDetail', { instructorId: r.id })}
        empty={q ? 'Nadie coincide con la búsqueda.' : 'No hay instructores con este filtro.'}
        columns={[
          { key: 'n', label: 'Instructor', flex: 2.4, render: r => <CellTitle title={r.full_name} sub={r.email} avatar={<Avatar name={r.full_name} source={r.avatar_url} size={34} />} /> },
          { key: 'r', label: 'Red', flex: 1.6, render: r => netName(r.camara_id) },
          { key: 'b', label: 'Barrio', flex: 1, render: r => r.neighborhood ?? '—' },
          { key: 'a', label: 'Alta', width: 130, render: r => shortDate(r.created_at) },
          { key: 'e', label: 'Estado', width: 120, align: 'right', render: r => {
            const v = VERIF[r.verification_status] ?? { label: r.verification_status, tone: 'neutral' as const }
            return <Pill label={r.is_active === false ? 'Inactivo' : v.label} tone={r.is_active === false ? 'neutral' : v.tone} />
          } },
        ]} />
    </AdminPage>
  )
}
