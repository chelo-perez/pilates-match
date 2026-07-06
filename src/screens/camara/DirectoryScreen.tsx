// src/screens/camara/DirectoryScreen.tsx
import React, { useState } from 'react'
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, ScrollView, Alert
} from 'react-native'
import { usePendingInstructors } from '../../hooks'
import { useQuery } from '@tanstack/react-query'
import { db } from '../../lib/supabase'
import { Avatar, Badge, Button, EmptyState, LoadingScreen, colors, spacing, radius, typography } from '../../components/ui'
import BlobCard from '../../components/BlobCard'
import HeroHeader from '../../components/HeroHeader'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'

type Filter = 'todos' | 'verificado' | 'pendiente' | 'inactivo'

export default function DirectoryScreen({ navigation }: any) {
  const [filter, setFilter] = useState<Filter>('todos')
  const [search, setSearch] = useState('')

  const { data: allInstructors = [], isLoading, refetch } = useQuery({
    queryKey: ['camara-instructors', filter],
    queryFn: async () => {
      let q = db.instructors()
        .select(`*, certifications(*)`)
        .order('created_at', { ascending: false })
      if (filter !== 'todos') q = q.eq('verification_status', filter)
      const { data, error } = await q
      if (error) throw error
      return data
    },
  })

  const filtered = search
    ? allInstructors.filter((i: any) => i.full_name.toLowerCase().includes(search.toLowerCase()))
    : allInstructors

  const BADGE_COLOR: Record<string, any> = {
    verificado: 'success', pendiente: 'warning', rechazado: 'danger', inactivo: 'sand',
  }
  const BADGE_LABEL: Record<string, string> = {
    verificado: '✓ Verificado', pendiente: '⏳ Pendiente', rechazado: '✗ Rechazado', inactivo: 'Inactivo',
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.cream }}>
      {/* Search */}
      <View style={styles.searchBox}>
        <TextInput style={styles.searchInput} placeholder="Buscar instructor..."
          placeholderTextColor={colors.light} value={search} onChangeText={setSearch} />
      </View>

      {/* Filters */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersRow} contentContainerStyle={{ paddingHorizontal: spacing.lg }}>
        {(['todos', 'verificado', 'pendiente', 'inactivo'] as Filter[]).map(f => (
          <TouchableOpacity key={f} style={[styles.chip, filter === f && styles.chipActive]} onPress={() => setFilter(f)}>
            <Text style={[styles.chipText, filter === f && styles.chipTextActive]}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {isLoading ? <LoadingScreen /> : (
        <FlatList
          data={filtered}
          keyExtractor={(item: any) => item.id}
          contentContainerStyle={{ padding: spacing.lg }}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          ListEmptyComponent={<EmptyState title="Sin instructores" subtitle="No hay resultados para este filtro." />}
          renderItem={({ item, index }: any) => (
            <BlobCard style={styles.card} onPress={() => navigation.navigate('VerifyInstructor', { instructorId: item.id })}>
              <Avatar name={item.full_name} size={36} color={colors.sageMid} />
              <View style={{ flex: 1, marginLeft: spacing.sm }}>
                <Text style={styles.name}>{item.full_name}</Text>
                <Text style={styles.meta}>{item.neighborhood} · DNI {item.dni}</Text>
              </View>
              <Badge label={BADGE_LABEL[item.verification_status]} color={BADGE_COLOR[item.verification_status]} />
            </BlobCard>
          )}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  searchBox: { backgroundColor: colors.white, padding: spacing.md, paddingTop: 52, paddingBottom: spacing.sm, borderBottomWidth: 0.5, borderColor: colors.borderLight },
  searchInput: { backgroundColor: colors.white, borderTopLeftRadius: 14, borderTopRightRadius: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 14, padding: spacing.md, ...typography.body, color: colors.dark, borderWidth: 0.5, borderColor: colors.border },
  filtersRow: { paddingVertical: spacing.sm, marginBottom: 0, maxHeight: 44 },
  chip: { paddingVertical: 5, paddingHorizontal: 12, borderRadius: 999, backgroundColor: colors.white, borderWidth: 0.5, borderColor: colors.border, marginRight: spacing.xs, height: 30, justifyContent: 'center' },
  chipActive: { backgroundColor: colors.sage, borderColor: colors.sage },
  chipText: { ...typography.small, color: colors.mid },
  chipTextActive: { color: colors.white, fontFamily: 'Nunito-SemiBold' },
  card: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, backgroundColor: colors.white },
  name: { fontFamily: 'Nunito-SemiBold', fontSize: 14, color: colors.dark },
  meta: { ...typography.small, color: colors.mid, marginTop: 2 },
  sectionTitle: { ...typography.label, color: colors.dark, marginBottom: spacing.md },
})
