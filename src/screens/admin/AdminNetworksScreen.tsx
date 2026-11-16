// Redes: cada una la coordina una entidad. Modelo de cobro, actividad y acceso a su configuración.
import React, { useMemo, useState } from 'react'
import { View, Image } from 'react-native'
import { useCamaras } from '../../lib/platform'
import { useAdminInstructors, useAdminStudios } from '../../lib/admin'
import { ActionButton, AdminPage, CellTitle, DataTable, Pill, SearchBox, Segmented, Toolbar } from '../../components/admin/AdminUI'
import { ErrorState, LoadingScreen, colors } from '../../components/ui'

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export default function AdminNetworksScreen({ navigation }: any) {
  const { data: camaras = [], isLoading, isError, refetch } = useCamaras()
  const { data: studios = [] } = useAdminStudios()
  const { data: instructors = [] } = useAdminInstructors()
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<'todas' | 'activas' | 'inactivas'>('todas')

  const rows = useMemo(() => camaras
    .filter(c => filter === 'todas' || (filter === 'activas' ? c.is_active : !c.is_active))
    .filter(c => !q || norm(`${c.name} ${c.slug} ${c.business_label}`).includes(norm(q)))
    .map(c => ({
      ...c,
      studios: studios.filter(s => s.camara_id === c.id).length,
      members: studios.filter(s => s.camara_id === c.id && s.is_member && s.user_id).length,
      instructors: instructors.filter(i => i.camara_id === c.id && i.verification_status === 'verificado').length,
      pending: instructors.filter(i => i.camara_id === c.id && i.verification_status === 'pendiente').length,
    })), [camaras, studios, instructors, q, filter])

  if (isLoading) return <LoadingScreen />
  if (isError) return <ErrorState message="No pudimos cargar las redes." onRetry={refetch} />

  return (
    <AdminPage title="Redes" subtitle="Cada red la coordina una entidad: cámara, asociación, colegio…"
      actions={<ActionButton label="Nueva red" icon="plus" onPress={() => navigation.navigate('PlatformCamaraEdit', {})} />}>
      <Toolbar>
        <Segmented value={filter} onChange={setFilter} items={[
          { key: 'todas', label: 'Todas', count: camaras.length },
          { key: 'activas', label: 'Activas', count: camaras.filter(c => c.is_active).length },
          { key: 'inactivas', label: 'Inactivas', count: camaras.filter(c => !c.is_active).length },
        ]} />
        <SearchBox value={q} onChange={setQ} placeholder="Buscar red" />
      </Toolbar>
      <DataTable rows={rows} keyOf={r => r.id} onRowPress={r => navigation.navigate('PlatformCamaraEdit', { camaraId: r.id })}
        empty={q ? 'Ninguna red coincide con la búsqueda.' : 'Todavía no hay redes.'}
        columns={[
          { key: 'n', label: 'Entidad', flex: 2.6, render: r => (
            <CellTitle title={r.name} sub={`${r.entity_type ?? 'Cámara'} · red de ${(r.business_label ?? r.sector ?? '').toLowerCase()}`}
              avatar={r.logo_url ? <Image source={{ uri: r.logo_url }} style={{ width: 34, height: 34, borderRadius: 8, backgroundColor: colors.sageLighter }} /> : undefined} />
          ) },
          { key: 'b', label: 'Cobro', flex: 1.3, render: r => (
            <View style={{ gap: 4 }}>
              <Pill label={r.billing_model === 'per_member' ? 'Por sede' : 'Suscripciones'} tone="brand" />
              {(r as any).placement_enabled !== false ? <Pill label="Cargo de incorporación" tone="neutral" /> : null}
            </View>
          ) },
          { key: 's', label: 'Estudios', align: 'right', render: r => `${r.studios} · ${r.members} sedes socias` },
          { key: 'i', label: 'Instructores', align: 'right', render: r => (
            <View style={{ alignItems: 'flex-end', gap: 4 }}>
              <CellTitle title={`${r.instructors} verificados`} />
              {r.pending ? <Pill label={`${r.pending} por verificar`} tone="warn" /> : null}
            </View>
          ) },
          { key: 'm', label: 'Marca', width: 90, align: 'center', hideOnNarrow: true, render: r => <Pill label={(r as any).brand?.enabled ? 'Co-marca' : 'Estándar'} tone={(r as any).brand?.enabled ? 'info' : 'neutral'} /> },
          { key: 'e', label: 'Estado', width: 90, align: 'right', render: r => <Pill label={r.is_active ? 'Activa' : 'Inactiva'} tone={r.is_active ? 'ok' : 'neutral'} /> },
        ]} />
    </AdminPage>
  )
}
