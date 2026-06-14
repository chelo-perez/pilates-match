// src/screens/studio/SearchScreen.tsx
import React, { useState, useCallback } from 'react'
import {
  View, Text, TextInput, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator, Modal, ScrollView
} from 'react-native'
import { useInstructorSearch, useMyStudio } from '../../hooks'
import { useSearchStore } from '../../store'
import {
  Card, Avatar, Badge, ScoreDisplay, TariffMatchPill, Button, EmptyState,
  colors, spacing, radius, typography
} from '../../components/ui'
import type { InstructorSearchResult } from '../../types/database'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { Ionicons, Feather } from '@expo/vector-icons'

type Props = NativeStackScreenProps<any, 'Search'>

export default function SearchScreen({ navigation }: Props) {
  const { data: studio } = useMyStudio()
  const { filters, setFilter, clearFilters } = useSearchStore()
  const [showFilters, setShowFilters] = useState(false)
  const [searchText, setSearchText] = useState('')

  const { data: results = [], isLoading } = useInstructorSearch(
    studio?.id,
    {
      neighborhood: filters.neighborhood || undefined,
      class_type: filters.classType || undefined,
      min_score: filters.minScore > 0 ? filters.minScore : undefined,
    }
  )

  const filtered = searchText
    ? results.filter(r => r.full_name.toLowerCase().includes(searchText.toLowerCase()))
    : results

  return (
    <View style={styles.container}>
      {/* Cabecera / Barra de búsqueda */}
      <View style={styles.searchHeader}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.dark || '#333'} />
        </TouchableOpacity>
        <View style={styles.inputContainer}>
          <Ionicons name="search" size={18} color={colors.light || '#999'} style={styles.searchIcon} />
          <TextInput
            style={styles.input}
            placeholder="Buscar instructor por nombre..."
            placeholderTextColor={colors.light || '#999'}
            value={searchText}
            onChangeText={setSearchText}
          />
        </View>
        <TouchableOpacity style={styles.filterButton} onPress={() => setShowFilters(true)}>
          <Ionicons name="options-outline" size={22} color="#4A5D4E" />
        </TouchableOpacity>
      </View>

      {/* Listado de Instructores */}
      {isLoading ? (
        <View style={styles.loadingArea}>
          <ActivityIndicator size="large" color="#4A5D4E" />
          <Text style={styles.loadingText}>Buscando perfiles calificados...</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyState={() => (
            <EmptyState message="No encontramos instructores que coincidan con los filtros aplicados en Buenos Aires." />
          )}
          renderItem={({ item }: { item: InstructorSearchResult }) => (
            <Card style={styles.resultCard} onPress={() => navigation.navigate('InstructorProfile', { instructorId: item.id })}>
              <View style={styles.cardTop}>
                <Avatar src={item.avatar_url} fallback={item.full_name[0]} size="lg" />
                <View style={styles.metaArea}>
                  <Text style={styles.nameText}>{item.full_name}</Text>
                  <Text style={styles.subText}>{item.neighborhood || 'Buenos Aires'} • {item.experience_years || 0} años exp.</Text>
                </View>
                <ScoreDisplay score={item.average_score || 0} />
              </View>

              {/* Bloque de tarifas unificado con el ecosistema de la app */}
              <View style={styles.tariffRow}>
                <View style={styles.tariffBox}>
                  <Text style={styles.tariffLabel}>CLASE REGULAR</Text>
                  <Text style={styles.tariffValue}>${item.tariff_regular || '—'}</Text>
                </View>
                <View style={styles.tariffBox}>
                  <Text style={styles.tariffLabel}>REEMPLAZO</Text>
                  <Text style={styles.tariffValue}>${item.tariff_replacement || '—'}</Text>
                </View>
                <TariffMatchPill matchType={item.tariff_match_status} />
              </View>
            </Card>
          )}
        />
      )}

      {/* Modal Lateral de Filtros Avanzados */}
      <Modal visible={showFilters} animationType="slide" transparent={false}>
        <View style={filtersStyles.header}>
          <Text style={filtersStyles.title}>Filtros de Búsqueda</Text>
          <TouchableOpacity onPress={() => setShowFilters(false)}>
            <Ionicons name="close" size={26} color={colors.dark || '#333'} />
          </TouchableOpacity>
        </View>
        <ScrollView style={filtersStyles.content}>
          <Text style={filtersStyles.sectionLabel}>BARRIO / ZONA</Text>
          <View style={filtersStyles.chipGrid}>
            {['Palermo', 'Belgrano', 'Recoleta', 'San Isidro', 'Caballito'].map((b) => (
              <TouchableOpacity
                key={b}
                style={[filtersStyles.chip, filters.neighborhood === b && filtersStyles.chipActive]}
                onPress={() => setFilter('neighborhood', filters.neighborhood === b ? null : b)}
              >
                <Text style={[filtersStyles.chipText, filters.neighborhood === b && filtersStyles.chipTextActive]}>{b}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Button label="Aplicar Filtros" style={{ marginTop: spacing.xxl }} onPress={() => setShowFilters(false)} />
        </ScrollView>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream || '#F9F9F6' },
  searchHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingTop: 50, paddingBottom: spacing.md, backgroundColor: colors.white || '#FFF', borderBottomWidth: 0.5, borderColor: colors.borderLight || '#EEE' },
  backButton: { marginRight: spacing.sm },
  inputContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.cream || '#F9F9F6', borderRadius: radius.md, paddingHorizontal: spacing.sm, height: 44 },
  searchIcon: { marginRight: spacing.xs },
  input: { flex: 1, fontFamily: 'DM_Sans-Regular', fontSize: 14, color: colors.dark || '#333' },
  filterButton: { marginLeft: spacing.sm, width: 44, height: 44, backgroundColor: colors.cream || '#F9F9F6', borderRadius: radius.md, justifyContent: 'center', alignItems: 'center' },
  loadingArea: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { fontFamily: 'DM_Sans-Medium', fontSize: 14, color: colors.mid || '#666', marginTop: spacing.md },
  listContent: { padding: spacing.lg },
  resultCard: { padding: spacing.lg, backgroundColor: colors.white || '#FFF', marginBottom: spacing.md },
  cardTop: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  metaArea: { flex: 1, marginLeft: spacing.md },
  nameText: { fontFamily: 'DM_Sans-SemiBold', fontSize: 15, color: colors.dark || '#333' },
  subText: { ...typography.small, color: colors.mid || '#666', marginTop: 2 },
  tariffRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingTop: spacing.md, borderTopWidth: 0.5, borderColor: colors.borderLight || '#EEE' },
  tariffBox: { flex: 1, backgroundColor: colors.cream || '#F9F9F6', borderRadius: radius.sm, padding: spacing.sm },
  tariffLabel: { fontSize: 9, fontFamily: 'DM_Sans-Medium', color: colors.light || '#999', letterSpacing: 0.5 },
  tariffValue: { fontFamily: 'DM_Sans-SemiBold', fontSize: 13, color: colors.dark || '#333', marginTop: 2 }
})

const filtersStyles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.lg, borderBottomWidth: 0.5, borderColor: colors.borderLight || '#EEE', paddingTop: 50 },
  title: { fontFamily: 'Playfair_Display-Medium', fontSize: 22, color: colors.dark || '#333' },
  content: { padding: spacing.lg },
  sectionLabel: { ...typography.label, color: colors.dark || '#333', marginBottom: spacing.sm },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: radius.full, backgroundColor: colors.cream || '#F9F9F6', borderWidth: 0.5, borderColor: colors.borderLight || '#EEE' },
  chipActive: { backgroundColor: '#4A5D4E', borderColor: '#4A5D4E' },
  chipText: { fontFamily: 'DM_Sans-Regular', fontSize: 13, color: colors.dark || '#333' },
  chipTextActive: { color: '#FFF', fontFamily: 'DM_Sans-Medium' }
})