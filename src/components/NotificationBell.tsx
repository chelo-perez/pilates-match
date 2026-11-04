// Campanita con la cantidad de avisos sin leer. Va arriba a la derecha en los inicios.
import React from 'react'
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native'
import { Feather } from '@expo/vector-icons'
import { useNavigation } from '@react-navigation/native'
import { useUnreadNotifications } from '../hooks'
import { colors } from './ui'

export default function NotificationBell() {
  const nav: any = useNavigation()
  const unread = useUnreadNotifications()
  if (unread < 0) return null // centro de notificaciones todavía no disponible
  return (
    <TouchableOpacity style={s.btn} onPress={() => nav.navigate('Notifications')} hitSlop={8}
      accessibilityRole="button" accessibilityLabel={unread ? `Notificaciones, ${unread} sin leer` : 'Notificaciones'}>
      <Feather name="bell" size={18} color={colors.white} />
      {unread > 0 ? (
        <View style={s.badge}><Text style={s.badgeTxt}>{unread > 9 ? '9+' : unread}</Text></View>
      ) : null}
    </TouchableOpacity>
  )
}

const s = StyleSheet.create({
  btn:      { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
  badge:    { position: 'absolute', top: -2, right: -2, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, backgroundColor: colors.redTx, borderWidth: 1.5, borderColor: colors.forest, alignItems: 'center', justifyContent: 'center' },
  badgeTxt: { fontFamily: 'Nunito-Bold', fontSize: 10, color: colors.white },
})
