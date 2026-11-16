// Notificaciones de la plataforma, con el formato del panel.
import React from 'react'
import { View, Text, StyleSheet, Pressable } from 'react-native'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Feather } from '@expo/vector-icons'
import { supabase } from '../../lib/supabase'
import { useNotificationsList } from '../../hooks'
import { openNotificationTarget } from '../../lib/notificationTarget'
import { ActionButton, AdminPage, Card } from '../../components/admin/AdminUI'
import { ErrorState, LoadingScreen, colors } from '../../components/ui'

const when = (iso: string) => new Date(iso).toLocaleString('es-AR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).replace('.', '')

export default function AdminNotificationsScreen({ navigation }: any) {
  const qc = useQueryClient()
  const { data = [], isLoading, isError, refetch } = useNotificationsList()
  const unread = data.filter((n: any) => !n.read_at).map((n: any) => n.id)
  const markRead = useMutation({
    mutationFn: async (ids: string[]) => {
      if (!ids.length) return
      const { error } = await supabase.from('notifications').update({ read_at: new Date().toISOString() }).in('id', ids)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })
  if (isLoading) return <LoadingScreen />
  if (isError) return <ErrorState message="No pudimos cargar las notificaciones." onRetry={refetch} />

  return (
    <AdminPage title="Notificaciones" subtitle={unread.length ? `${unread.length} sin leer` : 'Estás al día'} maxWidth={860}
      actions={unread.length ? <ActionButton label="Marcar todas como leídas" icon="check-circle" variant="secondary" onPress={() => markRead.mutate(unread)} loading={markRead.isPending} /> : undefined}>
      <Card pad={false}>
        {data.length ? data.map((n: any, i: number) => {
          const isUnread = !n.read_at
          return (
            <Pressable key={n.id} onPress={() => { if (isUnread) markRead.mutate([n.id]); openNotificationTarget(navigation, 'super_admin', n.data) }}
              style={({ hovered }: any) => [s.row, i === data.length - 1 && { borderBottomWidth: 0 }, isUnread && s.unread, hovered && s.hover]}>
              <View style={[s.dot, { backgroundColor: isUnread ? colors.gold : 'transparent' }]} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[s.title, isUnread && { fontFamily: 'Nunito-Bold' }]}>{n.title}</Text>
                {n.body ? <Text style={s.body}>{n.body}</Text> : null}
              </View>
              <Text style={s.when}>{when(n.created_at)}</Text>
              <Feather name="chevron-right" size={16} color={colors.light} />
            </Pressable>
          )
        }) : <Text style={s.empty}>No tenés notificaciones.</Text>}
      </Card>
    </AdminPage>
  )
}

const s = StyleSheet.create({
  row:    { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  unread: { backgroundColor: colors.sageLighter },
  hover:  { backgroundColor: colors.sageLight },
  dot:    { width: 8, height: 8, borderRadius: 4 },
  title:  { fontFamily: 'Nunito-SemiBold', fontSize: 14, color: colors.dark },
  body:   { fontFamily: 'Nunito-Regular', fontSize: 13, color: colors.mid, marginTop: 2 },
  when:   { fontFamily: 'Nunito-Regular', fontSize: 12, color: colors.light },
  empty:  { fontFamily: 'Nunito-Regular', fontSize: 14, color: colors.light, textAlign: 'center', padding: 24 },
})
