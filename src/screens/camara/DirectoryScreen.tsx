// src/screens/camara/DirectoryScreen.tsx
import React, { useEffect, useState } from 'react'
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, ScrollView, RefreshControl } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { db } from '../../lib/supabase'
import { VERIFICATION_STATUS } from '../../constants/labels'
import { Avatar, Badge, EmptyState, ErrorState, LoadingScreen, colors, spacing, radius, typography } from '../../components/ui'
import BlobCard from '../../components/BlobCard'
import HeroHeader from '../../components/HeroHeader'
import { Feather } from '@expo/vector-icons'
import { useAuthStore } from '../../store'

type Filter = 'todos' | 'pendiente' | 'verificado' | 'rechazado' | 'inactivo'
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'todos',      label: 'Todos' },
  { key: 'pendiente',  label: 'Pendientes' },
  { key: 'verificado', label: 'Verificados' },
  { key: 'rechazado',  label: 'Rechazados' },
  { key: 'inactivo',   label: 'Inactivos' },
]

export default function DirectoryScreen({ navigation, route }: any) {
  const isPlatform = useAuthStore(st => st.user?.role) === 'super_admin'
  const [filter, setFilter] = useState<Filter>(route?.params?.filter ?? 'todos')
  const [search, setSearch] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  // Permite llegar filtrado desde el panel (ej: "Verificar pendientes")
  useEffect(() => {
    if (route?.params?.filter) setFilter(route.params.filter)
  }, [route?.params?.filter])

  const { data: allInstructors = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['camara-instructors', filter],
    queryFn: async () => {
      let q = db.instructors()
        .select('id, full_name, neighborhood, dni, avatar_url, verification_status, is_active, created_at, certifications(id, review_status), camara:camaras(name)')
        .order('created_at', { ascending: false })
      if (filter !== 'todos') q = q.eq('verification_status', filter)
      const { data, error } = await q
      if (error) throw error
      return data ?? []
    },
  })

  const term = search.trim().toLowerCase()
  const filtered = term
    ? allInstructors.filter((i: any) =>
        i.full_name?.toLowerCase().includes(term) || i.dni?.includes(term) || i.neighborhood?.toLowerCase().includes(term))
    : allInstructors

  const onRefresh = async () => { setRefreshing(true); await refetch(); setRefreshing(false) }

  return (
    <View style={{ flex: 1, backgroundColor: colors.cream }}>
      <HeroHeader
        title="Instructores"
        subtitle={`${allInstructors.length} instructor${allInstructors.length === 1 ? '' : 'es'}`}
        bottomElement={
          <View style={styles.searchBox}>
            <Feather name="search" size={15} color={colors.light} />
            <TextInput style={styles.searchInput} placeholder="Buscar por nombre, DNI o barrio..."
              placeholderTextColor={colors.light} value={search} onChangeText={setSearch} />
            {search ? (
              <TouchableOpacity onPress={() => setSearch('')}>
                <Feather name="x" size={15} color={colors.light} />
              </TouchableOpacity>
            ) : null}
          </View>
        }
      />

      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersRow}>
          {FILTERS.map(f => (
            <TouchableOpacity key={f.key} style={[styles.chip, filter === f.key && styles.chipActive]} onPress={() => setFilter(f.key)}>
              <Text style={[styles.chipText, filter === f.key && styles.chipTextActive]}>{f.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {isLoading ? <LoadingScreen message="Cargando instructores..." /> : isError ? (
        <ErrorState message="No pudimos cargar el directorio." onRetry={refetch} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item: any) => item.id}
          contentContainerStyle={{ padding: spacing.md, paddingBottom: 100, flexGrow: 1 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.sage} />}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          ListEmptyComponent={
            <EmptyState
              icon="users"
              title="Sin instructores"
              message={term ? 'Nadie coincide con tu búsqueda.' : 'No hay instructores con este estado.'}
            />
          }
          renderItem={({ item }: any) => {
            const st = VERIFICATION_STATUS[item.verification_status] ?? VERIFICATION_STATUS.pendiente
            const pendingCerts = (item.certifications ?? []).filter((c: any) => (c.review_status ?? 'pending') === 'pending').length
            // La plataforma ve todas las redes: se aclara a cuál pertenece
            const meta = [isPlatform ? item.camara?.name : null, item.neighborhood, item.dni ? `DNI ${item.dni}` : null].filter(Boolean).join(' · ')
            return (
              <BlobCard style={styles.card} onPress={() => navigation.navigate('VerifyInstructor', { instructorId: item.id })}>
                <Avatar name={item.full_name} size={40} source={item.avatar_url} />
                <View style={{ flex: 1, marginLeft: spacing.sm }}>
                  <Text style={styles.name}>{item.full_name}</Text>
                  {meta ? <Text style={styles.meta} numberOfLines={2}>{meta}</Text> : null}
                  {pendingCerts > 0 ? (
                    <Text style={styles.pendingCerts}>{pendingCerts} certificado{pendingCerts > 1 ? 's' : ''} por revisar</Text>
                  ) : null}
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <Badge label={st.label} variant={st.variant} />
                  {item.is_active === false && item.verification_status !== 'inactivo' ? <Badge label="Pausado" variant="neutral" /> : null}
                </View>
                <Feather name="chevron-right" size={16} color={colors.border} style={{ marginLeft: 6 }} />
              </BlobCard>
            )
          }}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  searchBox:      { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 12, backgroundColor: colors.white, ...radius.leaf, paddingHorizontal: spacing.md, height: 44 },
  searchInput:    { flex: 1, fontFamily: 'Nunito-Regular', fontSize: 14, color: colors.dark },
  filtersRow:     { paddingHorizontal: spacing.md, paddingTop: spacing.md, gap: spacing.xs },
  chip:           { paddingVertical: 6, paddingHorizontal: 12, borderRadius: radius.full, backgroundColor: colors.white, borderWidth: 0.5, borderColor: colors.border },
  chipActive:     { backgroundColor: colors.sage, borderColor: colors.sage },
  chipText:       { fontFamily: 'Nunito-SemiBold', fontSize: 12, color: colors.mid },
  chipTextActive: { color: colors.white },
  card:           { flexDirection: 'row', alignItems: 'center', padding: spacing.md, backgroundColor: colors.white },
  name:           { fontFamily: 'Nunito-SemiBold', fontSize: 14, color: colors.dark },
  meta:           { ...typography.small, color: colors.mid, marginTop: 2 },
  pendingCerts:   { fontFamily: 'Nunito-SemiBold', fontSize: 11, color: colors.warnTx, marginTop: 3 },
})
