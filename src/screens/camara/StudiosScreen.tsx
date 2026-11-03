import React, { useState } from 'react'
import {
  View, Text, StyleSheet, FlatList, TextInput,
  TouchableOpacity, Alert, RefreshControl
} from 'react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { db } from '../../lib/supabase'
import { errorText, UserError } from '../instructor/userError'
import { formatDate } from '../../lib/dates'
import { planLabel, usedThisMonth } from '../../constants/plans'
import { Badge, Button, EmptyState, ErrorState, LoadingScreen, colors, spacing, radius, typography } from '../../components/ui'
import BlobCard from '../../components/BlobCard'
import HeroHeader from '../../components/HeroHeader'
import Toast from '../../components/Toast'
import { useToast } from '../../hooks/useToast'
import { Feather } from '@expo/vector-icons'
import { applyPlan, membershipOf, PAID_PLANS, STUDIO_KEYS } from './planUtils'

type Filter = 'todos' | 'miembro' | 'no_miembro'

export default function CamaraStudiosScreen({ navigation }: any) {
  const { toast, showToast, hideToast } = useToast()
  const qc = useQueryClient()
  const [filter, setFilter]   = useState<Filter>('todos')
  const [search, setSearch]   = useState('')
  const [refreshing, setRefreshing] = useState(false)

  const { data: studios = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['camara-studios-full', filter],
    queryFn: async () => {
      let q = db.studios()
        .select(`
          id, name, neighborhood, is_member, created_at,
          membership:memberships(status, plan_type, start_date, end_date, matches_used_month, matches_limit, last_reset_date)
        `)
        .order('created_at', { ascending: false })

      if (filter === 'miembro')    q = q.eq('is_member', true)
      if (filter === 'no_miembro') q = q.eq('is_member', false)

      const { data, error } = await q
      if (error) throw error
      return data ?? []
    },
  })

  const toggleMemberMutation = useMutation({
    mutationFn: ({ studioId, isMember }: { studioId: string; isMember: boolean }) =>
      applyPlan(studioId, isMember ? 'socio' : 'freemium'),
    onSuccess: (_data, vars) => {
      STUDIO_KEYS.forEach(queryKey => qc.invalidateQueries({ queryKey }))
      showToast(vars.isMember ? 'Ahora es socio de la Cámara' : 'Ya no es socio: pasó a Freemium')
    },
    onError: (e: any) => showToast(errorText(e), 'error'),
  })

  const handleToggleMember = (studio: any) => {
    const nowMember = studio.is_member
    const current = membershipOf(studio)?.plan_type
    const paidWarning = current && PAID_PLANS.includes(current)
      ? `\n\nAtención: hoy tiene el plan ${planLabel(current)}, que se va a reemplazar.`
      : ''
    Alert.alert(
      nowMember ? 'Quitar de socios' : 'Hacer socio',
      (nowMember
        ? `"${studio.name}" deja de ser socio y pasa al plan Freemium (1 propuesta por mes).`
        : `"${studio.name}" pasa al plan Socio Cámara (5 propuestas por mes) por 12 meses.`) + paidWarning,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: nowMember ? 'Quitar' : 'Hacer socio',
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

  return (
    <View style={styles.container}>
      <HeroHeader
        title="Estudios"
        subtitle={`${studios.length} ${filter === 'todos' ? 'registrados' : filter === 'miembro' ? 'socios' : 'no socios'}`}
        bottomElement={
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
        }
      />

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

      {isLoading ? <LoadingScreen message="Cargando estudios..." /> : isError ? (
        <ErrorState message="No pudimos cargar los estudios." onRetry={refetch} />
      ) : (
      <FlatList
        data={filtered}
        keyExtractor={(item: any) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.sage} />}
        ListEmptyComponent={
          <EmptyState
            icon="briefcase"
            title="Sin estudios"
            message={search ? 'Ningún estudio coincide con tu búsqueda.' : 'Todavía no hay estudios en este grupo.'}
          />
        }
        renderItem={({ item: studio, index }: any) => {
          const membership = membershipOf(studio)
          const isMember   = studio.is_member
          const matchUsed  = membership ? usedThisMonth(membership) : 0
          const matchLimit = membership?.matches_limit ?? null
          const blocked    = membership && membership.status !== 'activa'

          return (
            <BlobCard style={styles.card} onPress={() => navigation.navigate('StudioDetail', { studioId: studio.id })} delay={index * 600}>
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
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <Badge label={isMember ? 'Socio' : 'No socio'} variant={isMember ? 'success' : 'neutral'} />
                  {blocked ? <Badge label={membership.status === 'cancelada' ? 'Bloqueado' : 'Vencida'} variant="danger" /> : null}
                </View>
              </View>

              {/* Detalles membresía */}
              <View style={styles.memberDetail}>
                {membership ? (
                  <>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Plan</Text>
                      <Text style={styles.detailVal}>{planLabel(membership.plan_type ?? 'freemium')}</Text>
                    </View>
                    {membership.plan_type !== 'freemium' ? (
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Vencimiento</Text>
                        <Text style={styles.detailVal}>{membership.end_date ? formatDate(membership.end_date) : '—'}</Text>
                      </View>
                    ) : null}
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Propuestas este mes</Text>
                      <Text style={styles.detailVal}>
                        {matchUsed}{matchLimit !== null ? ` / ${matchLimit}` : ' (ilimitadas)'}
                      </Text>
                    </View>
                  </>
                ) : (
                  <Text style={styles.noMemberText}>
                    Sin plan asignado · registrado el {formatDate(studio.created_at)}
                  </Text>
                )}
              </View>

              {/* Acción */}
              <Button
                label={isMember ? 'Quitar de socios' : 'Hacer socio'}
                variant={isMember ? 'danger' : 'secondary'}
                size="sm"
                onPress={() => handleToggleMember(studio)}
                disabled={toggleMemberMutation.isPending}
                isLoading={toggleMemberMutation.isPending && toggleMemberMutation.variables?.studioId === studio.id}
                icon={<Feather name={isMember ? 'user-minus' : 'user-plus'} size={14} color={isMember ? colors.redTx : colors.sage} />}
                fullWidth
              />
            </BlobCard>
          )
        }}
      />
      )}
      <Toast visible={toast.visible} message={toast.message} type={toast.type} onHide={hideToast} />
    </View>
  )
}

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: colors.cream },
  searchRow:       { flexDirection: 'row', alignItems: 'center', marginTop: 12, backgroundColor: colors.white, ...radius.leaf, paddingHorizontal: spacing.md, height: 44 },
  searchIcon:      { marginRight: spacing.sm },
  searchInput:     { flex: 1, fontFamily: 'Nunito-Regular', color: colors.dark, fontSize: 14 },
  filters:         { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.md, paddingTop: spacing.md, marginBottom: spacing.sm },
  filterBtn:       { paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.full, backgroundColor: colors.white, borderWidth: 0.5, borderColor: colors.border },
  filterActive:    { backgroundColor: colors.sage, borderColor: colors.sage },
  filterText:      { fontFamily: 'Nunito-SemiBold', fontSize: 12, color: colors.mid },
  filterTextActive:{ color: colors.white },
  list:            { paddingHorizontal: spacing.md, paddingBottom: 100, flexGrow: 1 },
  card:            { marginBottom: spacing.sm, padding: spacing.md, backgroundColor: colors.white },
  row:             { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  avatar:          { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.sageLight, alignItems: 'center', justifyContent: 'center', marginRight: spacing.sm },
  avatarLetter:    { fontFamily: 'Nunito-SemiBold', fontSize: 18, color: colors.sage },
  info:            { flex: 1 },
  studioName:      { fontFamily: 'Nunito-SemiBold', fontSize: 14, color: colors.dark },
  neighborhood:    { ...typography.small, color: colors.mid, marginTop: 2 },
  memberDetail:    { backgroundColor: colors.cream, ...radius.leaf, padding: spacing.sm, marginBottom: spacing.sm },
  detailRow:       { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  detailLabel:     { ...typography.small, color: colors.mid },
  detailVal:       { ...typography.small, color: colors.dark, fontFamily: 'Nunito-SemiBold' },
  noMemberText:    { ...typography.small, color: colors.light },
})
