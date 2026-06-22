// src/screens/camara/DirectoryScreen.tsx
import React, { useState } from 'react'
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, Modal, ScrollView, Alert
} from 'react-native'
import { usePendingInstructors, useVerifyInstructor } from '../../hooks'
import { useQuery } from '@tanstack/react-query'
import { db } from '../../lib/supabase'
import { Card, Avatar, Badge, Button, EmptyState, LoadingScreen, colors, spacing, radius, typography } from '../../components/ui'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'

type Filter = 'todos' | 'verificado' | 'pendiente' | 'inactivo'

export default function DirectoryScreen({ navigation }: any) {
  const [filter, setFilter] = useState<Filter>('todos')
  const [search, setSearch] = useState('')
  const [selectedInstructor, setSelectedInstructor] = useState<any>(null)
  const verifyMutation = useVerifyInstructor()

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

  const handleVerify = async (id: string, approved: boolean) => {
    Alert.alert(
      approved ? '¿Verificar instructor?' : '¿Rechazar instructor?',
      approved
        ? 'Se activará su perfil público y recibirá una notificación.'
        : 'El instructor recibirá una notificación de rechazo.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: approved ? 'Verificar' : 'Rechazar',
          style: approved ? 'default' : 'destructive',
          onPress: async () => {
            await verifyMutation.mutateAsync({ id, approved })
            setSelectedInstructor(null)
            refetch()
          },
        },
      ]
    )
  }

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
          renderItem={({ item }: any) => (
            <Card style={styles.card} onPress={() => setSelectedInstructor(item)}>
              <Avatar name={item.full_name} size={36} color={colors.sageMid} />
              <View style={{ flex: 1, marginLeft: spacing.sm }}>
                <Text style={styles.name}>{item.full_name}</Text>
                <Text style={styles.meta}>{item.neighborhood} · DNI {item.dni}</Text>
              </View>
              <Badge label={BADGE_LABEL[item.verification_status]} color={BADGE_COLOR[item.verification_status]} />
            </Card>
          )}
        />
      )}

      {/* FAB agregar */}
      <TouchableOpacity style={styles.fab} onPress={() => navigation.navigate('AddInstructor')}>
        <Text style={{ fontSize: 24, color: colors.white }}>+</Text>
      </TouchableOpacity>

      {/* Modal verificación */}
      <Modal visible={!!selectedInstructor} animationType="slide" presentationStyle="pageSheet">
        {selectedInstructor && (
          <ScrollView style={{ flex: 1, backgroundColor: colors.cream }}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Badge label={BADGE_LABEL[selectedInstructor.verification_status]}
                  color={BADGE_COLOR[selectedInstructor.verification_status]} />
                <Text style={styles.modalTitle}>{selectedInstructor.full_name}</Text>
                <Text style={styles.modalSub}>
                  {selectedInstructor.email} · {selectedInstructor.neighborhood}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedInstructor(null)}>
                <Text style={{ fontSize: 22, color: colors.mid }}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={{ padding: spacing.lg }}>
              <Text style={styles.sectionTitle}>Certificaciones a validar</Text>
              {(selectedInstructor.certifications ?? []).length === 0 ? (
                <Text style={{ ...typography.body, color: colors.light }}>Sin certificaciones cargadas</Text>
              ) : (selectedInstructor.certifications ?? []).map((cert: any) => (
                <Card key={cert.id} style={styles.certCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.certName}>{cert.name}</Text>
                    <Text style={styles.certMeta}>{cert.institution} · {cert.year}</Text>
                  </View>
                  {cert.verified
                    ? <Badge label="✓ Verificada" color="success" />
                    : <Badge label="Pendiente" color="warning" />
                  }
                </Card>
              ))}

              {selectedInstructor.verification_status === 'pendiente' && (
                <View style={styles.verifyActions}>
                  <Button label="✓ Verificar instructor" onPress={() => handleVerify(selectedInstructor.id, true)}
                    isLoading={verifyMutation.isPending} fullWidth size="lg" style={{ marginBottom: spacing.sm }} />
                  <Button label="Rechazar" variant="danger" onPress={() => handleVerify(selectedInstructor.id, false)}
                    fullWidth />
                </View>
              )}
            </View>
          </ScrollView>
        )}
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  searchBox: { backgroundColor: colors.cream, padding: spacing.lg, paddingBottom: spacing.sm },
  searchInput: { backgroundColor: colors.white, borderRadius: radius.md, padding: spacing.md, ...typography.body, color: colors.dark, borderWidth: 0.5, borderColor: colors.border },
  filtersRow: { paddingVertical: spacing.sm },
  chip: { paddingVertical: 6, paddingHorizontal: 14, borderRadius: 999, backgroundColor: colors.white, borderWidth: 0.5, borderColor: colors.border, marginRight: spacing.xs },
  chipActive: { backgroundColor: colors.cream, borderColor: colors.cream },
  chipText: { ...typography.small, color: colors.mid },
  chipTextActive: { color: colors.dark, fontFamily: 'Nunito-SemiBold' },
  card: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, backgroundColor: colors.white },
  name: { fontFamily: 'Nunito-SemiBold', fontSize: 14, color: colors.dark },
  meta: { ...typography.small, color: colors.mid, marginTop: 2 },
  fab: {
    position: 'absolute', bottom: spacing.xl, right: spacing.xl,
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: colors.cream, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 8,
  },
  modalHeader: { flexDirection: 'row', alignItems: 'flex-start', padding: spacing.xl, backgroundColor: colors.goldLight },
  modalTitle: { fontFamily: 'Nunito-Bold', fontSize: 20, color: colors.dark, marginTop: spacing.xs },
  modalSub: { ...typography.small, color: colors.mid, marginTop: 2 },
  sectionTitle: { ...typography.label, color: colors.dark, marginBottom: spacing.md },
  certCard: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, marginBottom: spacing.sm, backgroundColor: colors.white },
  certName: { fontFamily: 'Nunito-Medium', fontSize: 13, color: colors.dark },
  certMeta: { ...typography.small, color: colors.mid, marginTop: 2 },
  verifyActions: { marginTop: spacing.xl },
})
