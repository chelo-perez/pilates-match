// Estudios de la red del instructor: marca en cuáles le interesa trabajar ("Me interesa").
// El estudio lo ve primero cuando busca y recibe un aviso. Es el "like" de un solo sentido.
import React, { useState } from 'react'
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput } from 'react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Feather } from '@expo/vector-icons'
import { supabase } from '../../lib/supabase'
import { useMyInstructor } from '../../hooks'
import { errorText } from '../../lib/errors'
import { SPECIALTY_LABELS } from '../../constants/labels'
import { Avatar, EmptyState, ErrorState, LoadingScreen, colors, spacing, radius } from '../../components/ui'
import HeroHeader from '../../components/HeroHeader'
import Toast from '../../components/Toast'
import { useToast } from '../../hooks/useToast'

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export default function InstructorStudiosScreen({ navigation }: any) {
  const { data: instructor } = useMyInstructor()
  const qc = useQueryClient()
  const { toast, showToast, hideToast } = useToast()
  const [search, setSearch] = useState('')
  const instructorId = instructor?.id

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['instructor-studios', instructorId],
    queryFn: async () => {
      const [studios, interests, worked] = await Promise.all([
        supabase.from('studios').select('id, name, neighborhood, logo_url, equipment, is_member').order('name'),
        supabase.from('instructor_interests').select('studio_id').eq('instructor_id', instructorId!),
        supabase.from('matches').select('studio_id').eq('instructor_id', instructorId!).eq('status', 'aceptado'),
      ])
      if (studios.error) throw studios.error
      return {
        studios: studios.data ?? [],
        interests: new Set((interests.data ?? []).map((i: any) => i.studio_id as string)),
        worked: new Set((worked.data ?? []).map((m: any) => m.studio_id as string)),
      }
    },
    enabled: !!instructorId,
  })

  const toggle = useMutation({
    mutationFn: async ({ studioId, on }: { studioId: string; on: boolean }) => {
      const q = on
        ? supabase.from('instructor_interests').insert({ instructor_id: instructorId, studio_id: studioId })
        : supabase.from('instructor_interests').delete().eq('instructor_id', instructorId!).eq('studio_id', studioId)
      const { error } = await q
      if (error && (error as any).code !== '23505') throw error
    },
    onMutate: async ({ studioId, on }) => {
      await qc.cancelQueries({ queryKey: ['instructor-studios', instructorId] })
      qc.setQueryData(['instructor-studios', instructorId], (old: any) => {
        if (!old) return old
        const interests = new Set(old.interests); on ? interests.add(studioId) : interests.delete(studioId)
        return { ...old, interests }
      })
    },
    onSuccess: (_d, v) => showToast(v.on ? 'Listo: el estudio te va a ver primero' : 'Marca quitada'),
    onError: (e: any) => { showToast(errorText(e), 'error'); qc.invalidateQueries({ queryKey: ['instructor-studios', instructorId] }) },
  })

  const q = norm(search.trim())
  const list = (data?.studios ?? []).filter((s: any) => !q || norm(s.name).includes(q) || norm(s.neighborhood ?? '').includes(q))
  const count = data?.interests.size ?? 0

  return (
    <View style={{ flex: 1, backgroundColor: colors.cream }}>
      <HeroHeader
        title="Estudios de tu red"
        subtitle={count ? `Te interesan ${count}` : 'Marcá dónde te gustaría trabajar'}
        onBack={() => navigation.goBack()} backLabel="Inicio"
        bottomElement={
          <View style={s.searchBox}>
            <Feather name="search" size={15} color={colors.light} />
            <TextInput style={s.searchInput} placeholder="Buscar por nombre o barrio..." placeholderTextColor={colors.light}
              value={search} onChangeText={setSearch} autoCorrect={false} />
            {search ? <TouchableOpacity onPress={() => setSearch('')} hitSlop={10}><Feather name="x" size={15} color={colors.light} /></TouchableOpacity> : null}
          </View>
        }
      />
      {isLoading || !instructorId ? <LoadingScreen /> : isError ? <ErrorState message="No pudimos cargar los estudios." onRetry={refetch} /> : (
        <FlatList
          data={list}
          keyExtractor={(i: any) => i.id}
          contentContainerStyle={s.list}
          ListHeaderComponent={
            <Text style={s.hint}>Al marcar un estudio, le avisamos que te interesa y te ve primero cuando busca instructores. Tu tarifa sigue siendo privada.</Text>
          }
          ListEmptyComponent={<EmptyState icon="home" title={q ? 'Ningún estudio coincide' : 'Todavía no hay estudios en tu red'} />}
          renderItem={({ item }: any) => {
            const on = data!.interests.has(item.id)
            const equip = (item.equipment ?? []).filter((e: string) => e in SPECIALTY_LABELS).map((e: string) => SPECIALTY_LABELS[e])
            return (
              <View style={s.card}>
                <Avatar name={item.name} source={item.logo_url} size={44} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={s.name} numberOfLines={1}>{item.name}</Text>
                  <Text style={s.meta} numberOfLines={1}>
                    {item.neighborhood ?? 'Sin barrio'}{equip.length ? ` · ${equip.join(', ')}` : ''}
                  </Text>
                  {data!.worked.has(item.id) ? <Text style={s.worked}><Feather name="check" size={11} /> Ya trabajaron juntos</Text> : null}
                </View>
                <TouchableOpacity style={[s.heart, on && s.heartOn]} onPress={() => toggle.mutate({ studioId: item.id, on: !on })}
                  accessibilityRole="button" accessibilityLabel={on ? `Quitar interés en ${item.name}` : `Me interesa ${item.name}`} accessibilityState={{ selected: on }}>
                  <Feather name="heart" size={18} color={on ? colors.white : colors.sage} />
                </TouchableOpacity>
              </View>
            )
          }}
        />
      )}
      <Toast visible={toast.visible} message={toast.message} type={toast.type} onHide={hideToast} />
    </View>
  )
}

const s = StyleSheet.create({
  searchBox:   { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 12, backgroundColor: colors.white, ...radius.leaf, paddingHorizontal: spacing.md, height: 44 },
  searchInput: { flex: 1, fontFamily: 'Nunito-Regular', fontSize: 14, color: colors.dark },
  list:        { padding: spacing.md, paddingBottom: 100 },
  hint:        { fontFamily: 'Nunito-Regular', fontSize: 12, color: colors.mid, lineHeight: 17, marginBottom: spacing.md },
  card:        { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.white, ...radius.leaf, padding: spacing.md, borderWidth: 0.5, borderColor: colors.borderLight, marginBottom: spacing.sm },
  name:        { fontFamily: 'Nunito-Bold', fontSize: 14, color: colors.dark },
  meta:        { fontFamily: 'Nunito-Regular', fontSize: 12, color: colors.mid, marginTop: 2 },
  worked:      { fontFamily: 'Nunito-SemiBold', fontSize: 11, color: colors.okTx, marginTop: 3 },
  heart:       { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: colors.sage, alignItems: 'center', justifyContent: 'center' },
  heartOn:     { backgroundColor: colors.sage },
})
