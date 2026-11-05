// Clases abiertas de la red: el instructor ve qué clases buscan instructor y toca "Me anoto".
import React from 'react'
import { View, Text, StyleSheet, FlatList } from 'react-native'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Feather } from '@expo/vector-icons'
import { useMyInstructor } from '../../hooks'
import { errorText } from '../../lib/errors'
import { applyToOpenClass, money, useOpenClassesForInstructor, whenLabel, OpenClass } from '../../lib/openClasses'
import { Avatar, Badge, Button, EmptyState, ErrorState, LoadingScreen, colors, spacing, radius } from '../../components/ui'
import HeroHeader from '../../components/HeroHeader'
import StudioRep from '../../components/StudioRep'
import Toast from '../../components/Toast'
import { useToast } from '../../hooks/useToast'

export default function OpenClassesScreen({ navigation }: any) {
  const { data: instructor } = useMyInstructor()
  const instructorId = instructor?.id
  const qc = useQueryClient()
  const { toast, showToast, hideToast } = useToast()
  const { data, isLoading, isError, refetch, isRefetching } = useOpenClassesForInstructor(instructorId)
  const myRates: any = Array.isArray(instructor?.rates) ? (instructor?.rates as any)[0] : instructor?.rates
  const verified = instructor?.verification_status === 'verificado'

  const apply = useMutation({
    mutationFn: ({ id, on }: { id: string; on: boolean }) => applyToOpenClass(id, instructorId!, on),
    onSuccess: (_d, v) => { qc.invalidateQueries({ queryKey: ['open-classes'] }); showToast(v.on ? 'Anotado: el estudio va a elegir entre los anotados' : 'Te quitaste de la clase') },
    onError: (e: any) => { showToast(errorText(e), 'error'); qc.invalidateQueries({ queryKey: ['open-classes'] }) },
  })

  const render = ({ item: c }: { item: OpenClass }) => {
    const applied = data!.applied.has(c.id)
    const myRate = Number(c.class_type === 'regular' ? myRates?.rate_regular : myRates?.rate_replacement) || null
    const below = myRate != null && c.offered_rate < myRate
    return (
      <View style={s.card}>
        <View style={s.head}>
          <Avatar name={c.studio?.name ?? 'E'} source={c.studio?.logo_url} size={40} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.name} numberOfLines={1}>{c.studio?.name ?? 'Estudio'}</Text>
            {c.studio?.neighborhood ? <Text style={s.meta}><Feather name="map-pin" size={11} /> {c.studio.neighborhood}</Text> : null}
            <StudioRep studioId={c.studio_id} />
          </View>
          <Badge label={c.class_type === 'reemplazo' ? 'Reemplazo' : 'Regular'} variant={c.class_type === 'reemplazo' ? 'warning' : 'success'} />
        </View>
        <Text style={s.when}><Feather name="calendar" size={13} color={colors.sage} /> {whenLabel(c)}</Text>
        <View style={[s.offer, { backgroundColor: below ? colors.warnBg : colors.sageLighter }]}>
          <Text style={[s.offerTxt, { color: below ? colors.warnTx : colors.sage }]}>Pagan {money(c.offered_rate)} por clase</Text>
          <Text style={s.offerSub}>{!myRate ? 'Cargá tu tarifa para comparar' : below ? `Por debajo de tu tarifa de ${money(myRate)}` : `Cubre tu tarifa de ${money(myRate)}`}</Text>
        </View>
        {c.note ? <Text style={s.note}>"{c.note}"</Text> : null}
        {applied ? (
          <View style={s.appliedRow}>
            <Text style={s.appliedTxt}><Feather name="check-circle" size={13} /> Anotado · el estudio elige entre los anotados</Text>
            <Button label="Quitarme" variant="ghost" size="sm" onPress={() => apply.mutate({ id: c.id, on: false })} />
          </View>
        ) : (
          <Button label="Me anoto" onPress={() => apply.mutate({ id: c.id, on: true })} isLoading={apply.isPending} fullWidth
            disabled={!verified} icon={<Feather name="check" size={15} color={colors.white} />} />
        )}
      </View>
    )
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.cream }}>
      <HeroHeader title="Clases abiertas" subtitle="Estudios de tu red que buscan instructor" onBack={() => navigation.goBack()} backLabel="Inicio" />
      {isLoading || !instructorId ? <LoadingScreen /> : isError ? <ErrorState message="No pudimos cargar las clases abiertas." onRetry={refetch} /> : (
        <FlatList
          data={data!.classes} keyExtractor={c => c.id} renderItem={render}
          contentContainerStyle={s.list} refreshing={isRefetching} onRefresh={refetch}
          ListHeaderComponent={!verified ? <Text style={s.hint}>Vas a poder anotarte cuando tu perfil esté verificado.</Text> : null}
          ListEmptyComponent={<EmptyState icon="inbox" title="No hay clases abiertas ahora" message="Cuando un estudio de tu red publique una clase que encaje con tus zonas u horarios, te avisamos." />}
        />
      )}
      <Toast visible={toast.visible} message={toast.message} type={toast.type} onHide={hideToast} />
    </View>
  )
}

const s = StyleSheet.create({
  list:       { padding: spacing.md, paddingBottom: 100 },
  hint:       { fontFamily: 'Nunito-SemiBold', fontSize: 12, color: colors.warnTx, marginBottom: spacing.sm },
  card:       { backgroundColor: colors.white, ...radius.leaf, padding: spacing.md, borderWidth: 0.5, borderColor: colors.borderLight, marginBottom: spacing.sm, gap: spacing.sm },
  head:       { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  name:       { fontFamily: 'Nunito-Bold', fontSize: 14, color: colors.dark },
  meta:       { fontFamily: 'Nunito-Regular', fontSize: 12, color: colors.mid },
  when:       { fontFamily: 'Nunito-SemiBold', fontSize: 13, color: colors.dark },
  offer:      { ...radius.leaf, padding: spacing.sm },
  offerTxt:   { fontFamily: 'Nunito-Bold', fontSize: 13 },
  offerSub:   { fontFamily: 'Nunito-Regular', fontSize: 12, color: colors.mid, marginTop: 1 },
  note:       { fontFamily: 'Nunito-Regular', fontSize: 12, color: colors.mid, fontStyle: 'italic' },
  appliedRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  appliedTxt: { fontFamily: 'Nunito-SemiBold', fontSize: 12, color: colors.okTx, flex: 1 },
})
