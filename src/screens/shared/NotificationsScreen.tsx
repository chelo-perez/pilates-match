// Centro de notificaciones (campanita): historial de avisos del usuario.
import React, { useEffect } from 'react'
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Feather } from '@expo/vector-icons'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store'
import { useNotificationsList } from '../../hooks'
import { openNotificationTarget } from '../../lib/notificationTarget'
import HeroHeader from '../../components/HeroHeader'
import { EmptyState, ErrorState, LoadingScreen, colors, spacing, radius } from '../../components/ui'

function timeAgo(iso: string) {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (min < 1) return 'Recién'
  if (min < 60) return `Hace ${min} min`
  const h = Math.round(min / 60)
  if (h < 24) return `Hace ${h} h`
  const d = Math.round(h / 24)
  if (d < 7) return d === 1 ? 'Ayer' : `Hace ${d} días`
  return new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }).replace('.', '')
}

const ICON: Record<string, string> = { propuestas: 'inbox', historial: 'send', verificar: 'user-check', perfil: 'user', inicio: 'bell' }

export default function NotificationsScreen({ navigation }: any) {
  const qc = useQueryClient()
  const role = useAuthStore(s => s.user?.role)
  const { data = [], isLoading, isError, refetch, isRefetching } = useNotificationsList()
  const unreadIds = data.filter((n: any) => !n.read_at).map((n: any) => n.id)

  const markRead = useMutation({
    mutationFn: async (ids: string[]) => {
      if (!ids.length) return
      const { error } = await supabase.from('notifications').update({ read_at: new Date().toISOString() }).in('id', ids)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })

  // Al abrir la campanita, lo que se ve queda como leído (el punto se mantiene en esta visita)
  useEffect(() => {
    if (unreadIds.length) { const t = setTimeout(() => markRead.mutate(unreadIds), 1500); return () => clearTimeout(t) }
  }, [unreadIds.join(',')])

  if (isLoading) return <LoadingScreen message="Cargando notificaciones..." />
  if (isError) return <ErrorState message="No pudimos cargar tus notificaciones." onRetry={refetch} />

  return (
    <View style={{ flex: 1, backgroundColor: colors.cream }}>
      <HeroHeader title="Notificaciones" subtitle={unreadIds.length ? `${unreadIds.length} sin leer` : 'Estás al día'} onBack={() => navigation.goBack()} />
      <FlatList
        data={data}
        keyExtractor={(n: any) => n.id}
        contentContainerStyle={{ padding: spacing.md, paddingBottom: 40, gap: spacing.sm, flexGrow: 1 }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.sage} colors={[colors.sage]} />}
        ListEmptyComponent={<EmptyState icon="bell" title="Sin notificaciones" message="Acá vas a ver las propuestas, respuestas y novedades de tu cuenta." />}
        renderItem={({ item }: any) => {
          const unread = !item.read_at
          return (
            <TouchableOpacity style={[s.card, unread && s.cardUnread]} activeOpacity={0.85}
              onPress={() => { if (unread) markRead.mutate([item.id]); openNotificationTarget(navigation, role, item.data) }}>
              <View style={[s.icon, unread && s.iconUnread]}>
                <Feather name={(ICON[item.data?.screen] ?? 'bell') as any} size={16} color={unread ? colors.white : colors.sage} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[s.title, unread && s.titleUnread]}>{item.title}</Text>
                {item.body ? <Text style={s.body}>{item.body}</Text> : null}
                <Text style={s.when}>{timeAgo(item.created_at)}</Text>
              </View>
              {unread ? <View style={s.dot} /> : null}
            </TouchableOpacity>
          )
        }}
      />
    </View>
  )
}

const s = StyleSheet.create({
  card:        { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, padding: spacing.md, backgroundColor: colors.white, ...radius.leaf, borderWidth: 0.5, borderColor: colors.borderLight },
  cardUnread:  { borderColor: colors.mint, backgroundColor: colors.sageLighter },
  icon:        { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.sageLight, alignItems: 'center', justifyContent: 'center' },
  iconUnread:  { backgroundColor: colors.sage },
  title:       { fontFamily: 'Nunito-SemiBold', fontSize: 14, color: colors.dark },
  titleUnread: { fontFamily: 'Nunito-Bold' },
  body:        { fontFamily: 'Nunito-Regular', fontSize: 13, color: colors.mid, lineHeight: 18, marginTop: 2 },
  when:        { fontFamily: 'Nunito-Regular', fontSize: 11, color: colors.light, marginTop: 4 },
  dot:         { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.gold, marginTop: 6 },
})
