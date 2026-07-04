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
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import BlobCard from '../../components/BlobCard'
import HeroHeader from '../../components/HeroHeader'
import { Feather } from '@expo/vector-icons'

type Props = NativeStackScreenProps<any, 'Search'>

export default function SearchScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets()
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
      <HeroHeader
        title="Buscar instructor"
        subtitle={studio?.neighborhood ?? 'Buenos Aires'}
        onBack={() => navigation.goBack()}
        backLabel="Inicio"
      />
      {/* Search bar */}
      <View style={styles.searchBar}>
        <Feather name="search" size={16} color={colors.light} />
        <TextInput
          style={styles.input}
          placeholder="Buscar por nombre..."
          placeholderTextColor={colors.light}
          value={searchText}
          onChangeText={setSearchText}
        />
        <TouchableOpacity style={styles.filterBtn} onPress={() => setShowFilters(true)}>
          <Feather name="sliders" size={18} color={colors.sage} />
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
          ListEmptyComponent={() => (
            <EmptyState message="No encontramos instructores que coincidan con los filtros aplicados en Buenos Aires." />
          )}
          renderItem={({ item }: { item: InstructorSearchResult }) => (
            <BlobCard style={styles.resultCard} onPress={() => navigation.navigate('InstructorProfile', { instructorId: item.id })} blobColor='rgba(74,93,78,0.08)' blobColor2='rgba(74,93,78,0.05)'>
              <View style={styles.cardTop}>
                <Avatar name={item.full_name} size={44} />
                <View style={styles.metaArea}>
                  <Text style={styles.nameText}>{item.full_name}</Text>
                  <Text style={styles.subText}>{item.neighborhood || 'Buenos Aires'} • {(item.stats?.total_evaluations || 0) || 0} años exp.</Text>
                </View>
                <ScoreDisplay score={(item.stats?.avg_score || 0) || 0} />
              </View>

              {/* Bloque de tarifas unificado con el ecosistema de la app */}
              <View style={styles.tariffRow}>
                <View style={styles.tariffBox}>
                  <Text style={styles.tariffLabel}>CLASE REGULAR</Text>
                  <Text style={styles.tariffValue}>${(item.rates?.rate_regular || 0) || '—'}</Text>
                </View>
                <View style={styles.tariffBox}>
                  <Text style={styles.tariffLabel}>REEMPLAZO</Text>
                  <Text style={styles.tariffValue}>${(item.rates?.rate_replacement || 0) || '—'}</Text>
                </View>
                <TariffMatchPill status={item.tariff_status_regular} />
              </View>
            </BlobCard>
          )}
        />
      )}

      {/* Modal Lateral de Filtros Avanzados */}
      <Modal visible={showFilters} animationType="slide" transparent={false}>
        <View style={filtersStyles.header}>
          <Text style={filtersStyles.title}>Filtros de Búsqueda</Text>
          <TouchableOpacity onPress={() => setShowFilters(false)}>
            <Feather name="x" size={26} color={colors.dark || '#333'} />
          </TouchableOpacity>
        </View>
        <ScrollView style={filtersStyles.content}>
          <Text style={filtersStyles.sectionLabel}>BARRIO / ZONA</Text>
          <View style={filtersStyles.chipGrid}>
            {['Palermo','Belgrano','Recoleta','Caballito','Almagro','Villa Crespo',
              'Colegiales','Núñez','Flores','San Telmo','Barracas','Villa Urquiza',
              'Chacarita','Boedo','Balvanera'].map((b) => (
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
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: spacing.md, marginVertical: spacing.md, backgroundColor: '#fff', borderTopLeftRadius: 14, borderTopRightRadius: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 14, borderWidth: 0.5, borderColor: colors.border, paddingHorizontal: 12, height: 46 },
  input: { flex: 1, fontFamily: 'Nunito-Regular', fontSize: 14, color: colors.dark },
  filterBtn: { width: 34, height: 34, borderTopLeftRadius: 10, borderTopRightRadius: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 10, backgroundColor: colors.sageLight, alignItems: 'center', justifyContent: 'center' },
  loadingArea: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { fontFamily: 'Nunito-Medium', fontSize: 14, color: colors.mid || '#666', marginTop: spacing.md },
  listContent: { padding: spacing.lg },
  resultCard: { padding: spacing.lg, backgroundColor: colors.white || '#FFF', marginBottom: spacing.md },
  cardTop: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  metaArea: { flex: 1, marginLeft: spacing.md },
  nameText: { fontFamily: 'Nunito-SemiBold', fontSize: 15, color: colors.dark || '#333' },
  subText: { ...typography.small, color: colors.mid || '#666', marginTop: 2 },
  tariffRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingTop: spacing.md, borderTopWidth: 0.5, borderColor: colors.borderLight || '#EEE' },
  tariffBox: { flex: 1, backgroundColor: colors.cream || '#F9F9F6', borderTopLeftRadius: 8, borderTopRightRadius: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 8, padding: spacing.sm },
  tariffLabel: { fontSize: 9, fontFamily: 'Nunito-Medium', color: colors.light || '#999', letterSpacing: 0.5 },
  tariffValue: { fontFamily: 'Nunito-SemiBold', fontSize: 13, color: colors.dark || '#333', marginTop: 2 }
})

const filtersStyles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.lg, borderBottomWidth: 0.5, borderColor: colors.borderLight || '#EEE', paddingTop: 52 },
  title: { fontFamily: 'Nunito-Bold', fontSize: 22, color: colors.dark || '#333' },
  content: { padding: spacing.lg },
  sectionLabel: { ...typography.label, color: colors.dark || '#333', marginBottom: spacing.sm },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 9999, backgroundColor: colors.cream || '#F9F9F6', borderWidth: 0.5, borderColor: colors.borderLight || '#EEE' },
  chipActive: { backgroundColor: '#4A5D4E', borderColor: '#4A5D4E' },
  chipText: { fontFamily: 'Nunito-Regular', fontSize: 13, color: colors.dark || '#333' },
  chipTextActive: { color: '#FFF', fontFamily: 'Nunito-Medium' }
})