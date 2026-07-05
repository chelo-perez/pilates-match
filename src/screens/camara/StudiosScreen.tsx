// src/screens/camara/StudiosScreen.tsx
// Lista completa de estudios para la Cámara — estado de membresía + gestión

import React, { useState } from 'react'
import {
  View, Text, StyleSheet, FlatList, TextInput,
  TouchableOpacity, Alert, RefreshControl
} from 'react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { db } from '../../lib/supabase'
import { Badge, EmptyState, LoadingScreen, colors, spacing, radius, typography } from '../../components/ui'
import BlobCard from '../../components/BlobCard'
import HeroHeader from '../../components/HeroHeader'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Toast from '../../components/Toast'
import { useToast } from '../../hooks/useToast'
import { Feather } from '@expo/vector-icons'

type Filter = 'todos' | 'miembro' | 'no_miembro'

function formatDate(dateStr: string | null) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function CamaraStudiosScreen({ navigation }: any) {
  const { toast, showToast, hideToast } = useToast()
  const qc = useQueryClient()
  const [filter, setFilter]   = useState<Filter>('todos')
  const [search, setSearch]   = useState('')
  const [refreshing, setRefreshing] = useState(false)

  const { data: studios = [], isLoading, refetch } = useQuery({
    queryKey: ['camara-studios-full', filter],
    queryFn: async () => {
      let q = db.studios()
        .select(`
          *,
          membership:memberships(status, start_date, end_date, matches_used_month, matches_limit)
        `)
        .order('created_at', { ascending: false })

      if (filter === 'miembro')    q = q.eq('is_member', true)
      if (filter === 'no_miembro') q = q.eq('is_member', false)

      const { data, error } = await q
      if (error) throw error
      return data
    },
  })

  const toggleMemberMutation = useMutation({
    mutationFn: async ({ studioId, isMember }: { studioId: string; isMember: boolean }) => {
      const { error } = await db.studios()
        .update({
          is_member: isMember,
          member_since: isMember ? new Date().toISOString().split('T')[0] : null,
        })
        .eq('id', studioId)
      if (error) throw error

      if (isMember) {
        // Crear membresía activa por 1 año
        const endDate = new Date()
        endDate.setFullYear(endDate.getFullYear() + 1)
        await db.memberships().upsert(
          {
            studio_id: studioId,
            status: 'activa',
            start_date: new Date().toISOString().split('T')[0],
            end_date: endDate.toISOString().split('T')[0],
            matches_limit: null, // ilimitado
          },
          { onConflict: 'studio_id' }
        )
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['camara-studios-full'] })
      qc.invalidateQueries({ queryKey: ['camara-dashboard'] })
    },
    onError: (e: any) => Alert.alert('Error', e.message),
  })

  const handleToggleMember = (studio: any) => {
    const nowMember = studio.is_member
    Alert.alert(
      nowMember ? 'Quitar membresía' : 'Activar membresía',
      nowMember
        ? `¿Querés remover a "${studio.name}" como estudio miembro?`
        : `¿Querés activar la membresía de "${studio.name}"? Se creará una membresía por 12 meses.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: nowMember ? 'Quitar' : 'Activar',
          style: nowMember ? 'destructive' : 'default',
          onPress: () => toggleMemberMutation.mutate({ studioId: studio.id, isMember: !nowMember }),
        },
      ]
    )
  }

  const onRefresh = async () => {
    setRefreshing(true)
    await refetch()
    setRefreshing(false)
  }

  const filtered = search
    ? studios.filter((s: any) =>
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.neighborhood?.toLowerCase().includes(search.toLowerCase())
      )
    : studios

  const FILTERS: { key: Filter; label: string }[] = [
    { key: 'todos',     label: 'Todos' },
    { key: 'miembro',    label: 'Socios' },
    { key: 'no_miembro', label: 'No socios' },
  ]

  if (isLoading) return <LoadingScreen message="Cargando estudios..." />

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Estudios registrados</Text>
        <Text style={styles.count}>{studios.length} en total</Text>
      </View>

      {/* Buscador */}
      <View style={styles.searchRow}>
        <Feather name="search" size={16} color={colors.light} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar por nombre o barrio..."
          placeholderTextColor={colors.light}
          value={search}
          onChangeText={setSearch}
        />
        {search ? (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Feather name="x" size={16} color={colors.light} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Filtros */}
      <View style={styles.filters}>
        {FILTERS.map(f => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterBtn, filter === f.key && styles.filterActive]}
            onPress={() => setFilter(f.key)}
          >
            <Text style={[styles.filterText, filter === f.key && styles.filterTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Lista */}
      <FlatList
        data={filtered}
        keyExtractor={(item: any) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.sage} />}
        ListEmptyComponent={
          <EmptyState
            icon="briefcase"
            title="Sin estudios"
            subtitle={search ? 'Ningún estudio coincide con tu búsqueda.' : 'No hay estudios registrados aún.'}
          />
        }
        renderItem={({ item: studio }: any) => {
          const membership = Array.isArray(studio.membership) ? studio.membership[0] : studio.membership
          const isMember   = studio.is_member
          const matchUsed  = membership?.matches_used_month ?? 0
          const matchLimit = membership?.matches_limit ?? null

          return (
            <BlobCard style={styles.card}>
              {/* Fila principal */}
              <View style={styles.row}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarLetter}>{studio.name?.[0]?.toUpperCase() ?? '?'}</Text>
                </View>
                <View style={styles.info}>
                  <Text style={styles.studioName}>{studio.name}</Text>
                  <Text style={styles.neighborhood}>
                    <Feather name="map-pin" size={11} color={colors.light} /> {studio.neighborhood}
                  </Text>
                </View>
                <Badge
                  label={isMember ? 'Socio' : 'No socio'}
                  variant={isMember ? 'success' : 'default'}
                />
              </View>

              {/* Detalles membresía */}
              <View style={styles.memberDetail}>
                {isMember && membership ? (
                  <>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Vencimiento</Text>
                      <Text style={styles.detailVal}>{formatDate(membership.end_date)}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Matches este mes</Text>
                      <Text style={styles.detailVal}>
                        {matchUsed}{matchLimit !== null ? ` / ${matchLimit}` : ' (ilimitado)'}
                      </Text>
                    </View>
                  </>
                ) : (
                  <Text style={styles.noMemberText}>
                    Registrado el {formatDate(studio.created_at)}
                  </Text>
                )}
              </View>

              {/* Acción */}
              <TouchableOpacity
                style={[styles.actionBtn, isMember ? styles.actionRemove : styles.actionAdd]}
                onPress={() => handleToggleMember(studio)}
                disabled={toggleMemberMutation.isPending}
              >
                <Feather
                  name={isMember ? 'user-minus' : 'user-plus'}
                  size={14}
                  color={isMember ? '#A32D2D' : colors.sage}
                />
                <Text style={[styles.actionText, isMember ? { color: '#A32D2D' } : { color: colors.sage }]}>
                  {isMember ? 'Quitar membresía' : 'Activar membresía'}
                </Text>
              </TouchableOpacity>
            </BlobCard>
          )
        }}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: colors.cream },
  header:          { paddingHorizontal: spacing.md, paddingTop: 52, paddingBottom: spacing.sm },
  title:           { fontFamily: 'Nunito-Bold', fontSize: 22, color: colors.dark },
  count:           { ...typography.small, color: colors.mid, marginTop: 2 },
  searchRow:       { flexDirection: 'row', alignItems: 'center', marginHorizontal: spacing.md, marginBottom: spacing.sm, backgroundColor: colors.white, borderTopLeftRadius: 14, borderTopRightRadius: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 14, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderWidth: 0.5, borderColor: colors.border },
  searchIcon:      { marginRight: spacing.sm },
  searchInput:     { flex: 1, ...typography.body, color: colors.dark, fontSize: 14 },
  filters:         { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.md, marginBottom: spacing.sm },
  filterBtn:       { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: 9999, backgroundColor: colors.white, borderWidth: 0.5, borderColor: colors.border },
  filterActive:    { backgroundColor: colors.sage, borderColor: colors.sage },
  filterText:      { ...typography.small, color: colors.mid, fontFamily: 'Nunito-SemiBold' },
  filterTextActive:{ color: colors.white },
  list:            { paddingHorizontal: spacing.md, paddingBottom: spacing.xl },
  card:            { marginBottom: spacing.sm, padding: spacing.md, backgroundColor: colors.white },
  row:             { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  avatar:          { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.sageLight, alignItems: 'center', justifyContent: 'center', marginRight: spacing.sm },
  avatarLetter:    { fontFamily: 'Nunito-SemiBold', fontSize: 18, color: colors.sage },
  info:            { flex: 1 },
  studioName:      { fontFamily: 'Nunito-SemiBold', fontSize: 14, color: colors.dark },
  neighborhood:    { ...typography.small, color: colors.mid, marginTop: 2 },
  memberDetail:    { backgroundColor: colors.cream, borderTopLeftRadius: 8, borderTopRightRadius: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 8, padding: spacing.sm, marginBottom: spacing.sm },
  detailRow:       { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  detailLabel:     { ...typography.small, color: colors.mid },
  detailVal:       { ...typography.small, color: colors.dark, fontFamily: 'Nunito-SemiBold' },
  noMemberText:    { ...typography.small, color: colors.light },
  actionBtn:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, paddingVertical: spacing.sm, borderTopLeftRadius: 14, borderTopRightRadius: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 14, borderWidth: 1 },
  actionAdd:       { borderColor: colors.sage, backgroundColor: colors.sageLight },
  actionRemove:    { borderColor: '#F09595', backgroundColor: '#FCEBEB' },
  actionText:      { fontFamily: 'Nunito-SemiBold', fontSize: 13 },
})
