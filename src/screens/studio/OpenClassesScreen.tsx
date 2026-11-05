// Clases abiertas del estudio: ve quiénes se anotaron, elige a uno (crea la propuesta ya aceptada) o cierra la clase.
import React from 'react'
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert } from 'react-native'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Feather } from '@expo/vector-icons'
import { useMyStudio } from '../../hooks'
import { errorText } from '../../lib/errors'
import { closeOpenClass, money, pickApplicant, useStudioOpenClasses, whenLabel, OpenClass } from '../../lib/openClasses'
import { Avatar, Badge, Button, EmptyState, ErrorState, LoadingScreen, colors, spacing, radius } from '../../components/ui'
import HeroHeader from '../../components/HeroHeader'

const STATUS: Record<string, { label: string; variant: any }> = {
  abierta: { label: 'Abierta', variant: 'success' }, cubierta: { label: 'Cubierta', variant: 'neutral' },
  cerrada: { label: 'Cerrada', variant: 'neutral' }, vencida: { label: 'Vencida', variant: 'warning' },
}

export default function StudioOpenClassesScreen({ navigation }: any) {
  const { data: studio } = useMyStudio()
  const qc = useQueryClient()
  const { data: classes = [], isLoading, isError, refetch, isRefetching } = useStudioOpenClasses(studio?.id)
  const refresh = () => { qc.invalidateQueries({ queryKey: ['open-classes'] }); qc.invalidateQueries({ queryKey: ['studio-matches'] }); qc.invalidateQueries({ queryKey: ['studio-membership'] }) }

  const pick = useMutation({
    mutationFn: ({ id, instructorId }: { id: string; instructorId: string }) => pickApplicant(id, instructorId),
    onSuccess: () => { refresh(); Alert.alert('Clase confirmada', 'La propuesta quedó aceptada con el monto publicado. La ves en Historial.') },
    onError: (e: any) => Alert.alert('No se pudo elegir', errorText(e)),
  })
  const close = useMutation({
    mutationFn: (id: string) => closeOpenClass(id),
    onSuccess: refresh, onError: (e: any) => Alert.alert('No se pudo cerrar', errorText(e)),
  })
  const confirmPick = (c: OpenClass, a: any) => Alert.alert(`¿Elegir a ${a.instructor?.full_name ?? 'este instructor'}?`,
    `Queda confirmada la clase por ${money(c.offered_rate)}. A los demás anotados les avisamos que ya se cubrió.`,
    [{ text: 'Cancelar', style: 'cancel' }, { text: 'Elegir', onPress: () => pick.mutate({ id: c.id, instructorId: a.instructor_id }) }])
  const confirmClose = (c: OpenClass) => Alert.alert('Cerrar clase abierta', 'Ya no va a recibir anotados. La publicación ya contó para tu plan.',
    [{ text: 'Volver', style: 'cancel' }, { text: 'Cerrar clase', style: 'destructive', onPress: () => close.mutate(c.id) }])

  const render = ({ item: c }: { item: OpenClass }) => {
    const st = STATUS[c.status] ?? STATUS.abierta
    const apps = c.applications ?? []
    return (
      <View style={s.card}>
        <View style={s.head}>
          <View style={{ flex: 1 }}>
            <Text style={s.when}>{whenLabel(c)}</Text>
            <Text style={s.meta}>{c.class_type === 'reemplazo' ? 'Reemplazo' : 'Clase regular'} · {money(c.offered_rate)} por clase</Text>
          </View>
          <Badge label={st.label} variant={st.variant} />
        </View>
        {c.status === 'abierta' ? (
          <>
            <Text style={s.section}>{apps.length ? `ANOTADOS (${apps.length})` : 'TODAVÍA NADIE SE ANOTÓ'}</Text>
            {apps.map(a => (
              <View key={a.instructor_id} style={s.appRow}>
                <TouchableOpacity style={s.appInfo} onPress={() => navigation.navigate('InstructorProfile', { instructorId: a.instructor_id })}>
                  <Avatar name={a.instructor?.full_name ?? '?'} source={a.instructor?.avatar_url} size={36} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={s.appName} numberOfLines={1}>{a.instructor?.full_name ?? 'Instructor'}</Text>
                    <Text style={s.appMeta}>{a.instructor?.neighborhood ?? ''}{a.note ? ` · "${a.note}"` : ''} · ver perfil</Text>
                  </View>
                </TouchableOpacity>
                <Button label="Elegir" size="sm" onPress={() => confirmPick(c, a)} isLoading={pick.isPending} />
              </View>
            ))}
            {!apps.length ? <Text style={s.hint}>Avisamos a los instructores de tu red con zona u horario compatibles. Vence el {new Date(c.expires_at).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}.</Text> : null}
            <TouchableOpacity onPress={() => confirmClose(c)} style={{ alignSelf: 'flex-end', paddingVertical: 6 }}>
              <Text style={s.closeTxt}>Cerrar clase</Text>
            </TouchableOpacity>
          </>
        ) : c.status === 'cubierta' ? (
          <Text style={s.covered}><Feather name="check-circle" size={13} /> Confirmada con {apps.find(a => a.instructor_id === c.chosen_instructor_id)?.instructor?.full_name ?? 'el instructor elegido'}</Text>
        ) : null}
      </View>
    )
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.cream }}>
      <HeroHeader title="Clases abiertas" subtitle="Publicaste una clase y los instructores se anotan" onBack={() => navigation.goBack()} backLabel="Volver" />
      {isLoading || !studio ? <LoadingScreen /> : isError ? <ErrorState message="No pudimos cargar tus clases abiertas." onRetry={refetch} /> : (
        <FlatList
          data={classes} keyExtractor={c => c.id} renderItem={render} contentContainerStyle={s.list} refreshing={isRefetching} onRefresh={refetch}
          ListEmptyComponent={<EmptyState icon="radio" title="Todavía no publicaste clases abiertas" message="Desde Buscar, cargá la clase que necesitás y tocá 'Publicar clase abierta': los instructores compatibles se anotan y vos elegís." action="Ir a Buscar" onAction={() => navigation.navigate('Search')} />}
        />
      )}
    </View>
  )
}

const s = StyleSheet.create({
  list:     { padding: spacing.md, paddingBottom: 100 },
  card:     { backgroundColor: colors.white, ...radius.leaf, padding: spacing.md, borderWidth: 0.5, borderColor: colors.borderLight, marginBottom: spacing.sm },
  head:     { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginBottom: spacing.sm },
  when:     { fontFamily: 'Nunito-Bold', fontSize: 14, color: colors.dark },
  meta:     { fontFamily: 'Nunito-Regular', fontSize: 12, color: colors.mid, marginTop: 2 },
  section:  { fontFamily: 'Nunito-Bold', fontSize: 11, letterSpacing: 0.6, color: colors.light, marginTop: spacing.xs, marginBottom: spacing.xs },
  appRow:   { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm, borderTopWidth: 0.5, borderTopColor: colors.borderLight },
  appInfo:  { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minWidth: 0 },
  appName:  { fontFamily: 'Nunito-SemiBold', fontSize: 13, color: colors.dark },
  appMeta:  { fontFamily: 'Nunito-Regular', fontSize: 11, color: colors.mid },
  hint:     { fontFamily: 'Nunito-Regular', fontSize: 12, color: colors.mid, lineHeight: 17 },
  closeTxt: { fontFamily: 'Nunito-Bold', fontSize: 12, color: colors.mid },
  covered:  { fontFamily: 'Nunito-SemiBold', fontSize: 12, color: colors.okTx },
})
